(() => {
  if (window.__biliBalanceLoaded) {
    return;
  }

  window.__biliBalanceLoaded = true;

  const HEARTBEAT_MS = 1000;
  const URL_CHECK_MS = 1000;
  const clock = new BiliBalancePlaybackClock();
  let lastUrl = location.href;
  let refreshSequence = 0;
  let currentContext = null;
  let trackedVideo = null;
  let pendingMediaSeconds = 0;
  let dashboard = null;
  let trackingEnabled = true;
  let manualCategory = null;
  let dashboardLoading = false;
  const panel = BiliBalancePanel.create({
    request: sendMessage,
    setCategory: async (category) => {
      if (!isCategory(category) || !currentContext?.contextId) return;
      captureMediaDelta(trackedVideo);
      flushTime();
      manualCategory = { contextId: currentContext.contextId, category };
      currentContext = { ...currentContext, category };
      clock.reset();
      renderPanel();
    }
  });

  function sendMessage(message) {
    try {
      return chrome.runtime.sendMessage(message).catch(() => null);
    } catch {
      return Promise.resolve(null);
    }
  }

  function extractBvid() {
    const pathMatch = location.pathname.match(/\/video\/(BV[0-9A-Za-z]+)/i);

    if (pathMatch) {
      return pathMatch[1].toUpperCase();
    }

    const queryBvid =
      new URLSearchParams(location.search).get("bvid") ?? "";

    if (/^BV[0-9A-Za-z]+$/i.test(queryBvid)) {
      return queryBvid.toUpperCase();
    }

    const canonical = document.querySelector('link[rel="canonical"]');
    const canonicalMatch = canonical?.href?.match(/\/video\/(BV[0-9A-Za-z]+)/i);
    return canonicalMatch?.[1]?.toUpperCase() ?? "";
  }

  function extractBangumiId() {
    const match = location.pathname.match(
      /\/bangumi\/play\/((?:ep|ss)\d+)/i
    );
    return match?.[1]?.toLowerCase() ?? "";
  }

  function splitTags(value) {
    return String(value ?? "")
      .split(/[,\uFF0C|]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  function extractTags() {
    const tags = [];
    const metaSelectors = [
      'meta[name="keywords"]',
      'meta[itemprop="keywords"]',
      'meta[property="og:keywords"]'
    ];
    const tagSelectors = [
      '.video-tag-container a[href*="/tag/"]',
      '.tag-panel a[href*="/tag/"]',
      '#v_tag a[href*="/tag/"]',
      '.video-info-container a[href*="/tag/"]',
      '.tag-area a[href*="/tag/"]'
    ];

    for (const selector of metaSelectors) {
      const content = document.querySelector(selector)?.content;
      tags.push(...splitTags(content));
    }

    for (const selector of tagSelectors) {
      for (const node of document.querySelectorAll(selector)) {
        const text = node.textContent?.trim();

        if (text) {
          tags.push(text);
        }
      }
    }

    const unique = [];
    const seen = new Set();

    for (const tag of tags) {
      const normalized = tag.replace(/^#+/, "").replace(/\s+/g, " ").trim();
      const key = normalized.toLocaleLowerCase();

      if (normalized && !seen.has(key)) {
        seen.add(key);
        unique.push(normalized);
      }

      if (unique.length === 30) {
        break;
      }
    }

    return unique;
  }

  function extractTitle() {
    const ogTitle = document
      .querySelector('meta[property="og:title"]')
      ?.getAttribute("content");

    return (ogTitle || document.title || "")
      .replace(/\s*[-_|]\s*\u54d4\u54e9\u54d4\u54e9.*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractCategoryName() {
    const selectors = [
      ".video-info-container .breadcrumb a",
      ".van-breadcrumb a",
      '.video-info-container a[href^="/v/"]'
    ];
    const values = [];

    for (const selector of selectors) {
      for (const node of document.querySelectorAll(selector)) {
        const text = node.textContent?.trim();

        if (text && !values.includes(text)) {
          values.push(text);
        }
      }
    }

    return values.at(-1) ?? "";
  }

  function buildRawContext() {
    const bangumiId = extractBangumiId();
    const bvid = extractBvid();

    if (!bangumiId && !bvid) {
      return null;
    }

    return {
      pageKey: location.pathname,
      url: `${location.origin}${location.pathname}`,
      kind: bangumiId ? "bangumi" : "video",
      bvid,
      bangumiId,
      title: extractTitle(),
      tname: extractCategoryName(),
      tags: extractTags()
    };
  }

  function getPrimaryVideo() {
    const video = document.querySelector("video");
    return video?.tagName === "VIDEO" ? video : null;
  }

  function isCategory(value) {
    return value === "education" || value === "recreation";
  }

  function resetMediaBaseline(video) {
    trackedVideo = video;
    clock.reset();
  }

  function isPlaybackActive(video) {
    return Boolean(
      video &&
        currentContext?.contextId &&
        ["video", "bangumi"].includes(currentContext.kind) &&
        trackingEnabled &&
        currentContext.pageKey === location.pathname &&
        !video.paused &&
        !video.seeking &&
        !video.ended &&
        document.visibilityState === "visible" &&
        document.hasFocus()
    );
  }

  function captureMediaDelta(video, ending = false) {
    if (!video || !currentContext || video !== trackedVideo) return;
    const foreground = trackingEnabled && document.visibilityState === "visible" &&
      document.hasFocus() && currentContext.pageKey === location.pathname;
    pendingMediaSeconds += clock.sample({
      key: `${currentContext.contextId}:${currentContext.category}`,
      now: performance.now(),
      mediaTime: Number(video.currentTime),
      rate: Number(video.playbackRate) || 1,
      eligible: foreground && !video.seeking && (ending || isPlaybackActive(video))
    });
    if (pendingMediaSeconds >= 5) flushTime();
  }

  function flushTime() {
    const seconds = Math.floor(pendingMediaSeconds);
    if (seconds < 1 || !currentContext || !trackingEnabled) return;
    pendingMediaSeconds -= seconds;
    sendMessage({
      type: "VIDEO_TICK",
      seconds,
      context: currentContext
    }).then((response) => {
      if (response?.ok && response.usage && dashboard) {
        dashboard.usage = response.usage;
        dashboard.recreationSession = response.recreationSession;
        renderPanel();
      }
    });
  }

  function handlePlay(event) {
    if (!(event.target instanceof HTMLVideoElement)) {
      return;
    }

    resetMediaBaseline(event.target);
    captureMediaDelta(event.target);
  }

  function handlePause(event) {
    if (!(event.target instanceof HTMLVideoElement)) {
      return;
    }

    captureMediaDelta(event.target, true);
    flushTime();
    resetMediaBaseline(event.target);
  }

  function handleSeeking(event) {
    if (event.target === trackedVideo) {
      flushTime();
      clock.reset();
    }
  }

  function handleSeeked(event) {
    if (event.target instanceof HTMLVideoElement) {
      resetMediaBaseline(event.target);
      captureMediaDelta(event.target);
    }
  }

  function heartbeat() {
    const video = getPrimaryVideo();

    if (!video) {
      trackedVideo = null;
      clock.reset();
      renderPanel();
      return;
    }

    if (video !== trackedVideo) {
      resetMediaBaseline(video);
    }

    captureMediaDelta(video);
    renderPanel();
  }

  function renderPanel() {
    if (dashboard) panel.render({ ...dashboard, current: currentContext }, isPlaybackActive(trackedVideo));
  }

  async function loadDashboard() {
    if (dashboardLoading) return;
    dashboardLoading = true;
    try {
      const response = await sendMessage({ type: "GET_DASHBOARD" });
      if (!response?.ok) { panel.setUnavailable(); return; }
      dashboard = response;
      const nextEnabled = response.settings.trackingEnabled !== false;
      if (trackingEnabled !== nextEnabled) {
        trackingEnabled = nextEnabled;
        pendingMediaSeconds = 0;
        clock.reset();
      }
      renderPanel();
    } finally {
      dashboardLoading = false;
    }
  }

  async function refreshContext() {
    const sequence = ++refreshSequence;
    const rawContext = buildRawContext();

    if (!rawContext) {
      currentContext = null;
      renderPanel();
      return;
    }

    if (!currentContext) {
      currentContext = rawContext;
    }

    const response = await sendMessage({
      type: "PAGE_INFO",
      context: rawContext
    });

    if (sequence === refreshSequence && response?.ok) {
      currentContext = response.context;
      if (manualCategory?.contextId === currentContext.contextId) {
        currentContext.category = manualCategory.category;
      }
      renderPanel();
    }
  }

  document.addEventListener("play", handlePlay, true);
  document.addEventListener("pause", handlePause, true);
  document.addEventListener("seeking", handleSeeking, true);
  document.addEventListener("seeked", handleSeeked, true);
  document.addEventListener("ended", handlePause, true);
  document.addEventListener("ratechange", handleSeeked, true);

  document.addEventListener("visibilitychange", () => {
    const video = trackedVideo ?? getPrimaryVideo();

    if (document.visibilityState === "hidden") {
      flushTime();
      resetMediaBaseline(video);
    } else {
      resetMediaBaseline(video);
    }
  });

  window.addEventListener("blur", () => {
    const video = trackedVideo ?? getPrimaryVideo();
    flushTime();
    resetMediaBaseline(video);
  });

  window.addEventListener("focus", () => {
    resetMediaBaseline(trackedVideo ?? getPrimaryVideo());
  });

  window.addEventListener("pagehide", () => {
    if (document.visibilityState === "visible" && document.hasFocus()) captureMediaDelta(trackedVideo);
    flushTime();
    clock.reset();
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "GET_CONTEXT") {
      sendResponse({ context: currentContext });
    }

    if (
      message?.type === "SET_CONTEXT_CATEGORY" &&
      isCategory(message.category) &&
      currentContext?.contextId === message.contextId
    ) {
      captureMediaDelta(trackedVideo);
      flushTime();
      manualCategory = { contextId: currentContext.contextId, category: message.category };
      currentContext = {
        ...currentContext,
        category: message.category
      };
      clock.reset();
      renderPanel();
      sendResponse({ ok: true, context: currentContext });
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    const next = changes.biliBalanceState?.newValue;
    if (next && (next.settings?.trackingEnabled !== trackingEnabled || Object.keys(next.days || {}).length === 0)) {
      trackingEnabled = next.settings?.trackingEnabled !== false;
      pendingMediaSeconds = 0;
      clock.reset();
    }
    loadDashboard();
  });

  setInterval(() => {
    if (location.href === lastUrl) {
      return;
    }

    lastUrl = location.href;
    flushTime();
    ++refreshSequence;
    currentContext = null;
    manualCategory = null;
    trackedVideo = null;
    clock.reset();
    pendingMediaSeconds = 0;
    renderPanel();
    refreshContext();
    for (const delay of [800, 2500]) setTimeout(refreshContext, delay);
  }, URL_CHECK_MS);

  setInterval(heartbeat, HEARTBEAT_MS);
  setInterval(() => {
    if (document.visibilityState === "visible") loadDashboard();
  }, 15000);
  loadDashboard();
  refreshContext();
  for (const delay of [800, 2500]) setTimeout(refreshContext, delay);
})();
