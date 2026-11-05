import {
  classifyContext,
  isCategory,
  normalizeTags,
  summarizeTopic
} from "../shared/model.js";
import {
  ensureDay,
  getState,
  localDateKey,
  updateState
} from "../shared/storage.js";
import {
  buildUsageSnapshot,
  clampRecreationLimit,
  shouldIssueRecreationWarning
} from "../shared/usage.js";
import {
  advanceRecreationSession,
  emptyRecreationSession,
  recreationSessionSnapshot
} from "../shared/recreation-session.js";

const MAX_TICK_SECONDS = 20;

function cleanContext(rawContext = {}) {
  const tags = normalizeTags(rawContext.tags);
  const bvid = String(rawContext.bvid ?? "")
    .trim()
    .toUpperCase();
  const pageKey = String(
    rawContext.pageKey ?? rawContext.url ?? "bilibili"
  );

  return {
    pageKey,
    url: String(rawContext.url ?? ""),
    kind: ["bangumi", "video", "page"].includes(rawContext.kind)
      ? rawContext.kind
      : "page",
    bvid: /^BV[0-9A-Z]+$/i.test(bvid) ? bvid : "",
    bangumiId: String(rawContext.bangumiId ?? ""),
    title: String(rawContext.title ?? "").slice(0, 300),
    tname: String(rawContext.tname ?? "").slice(0, 80),
    category: isCategory(rawContext.category)
      ? rawContext.category
      : undefined,
    tags
  };
}

function contextId(context) {
  if (context.bvid) {
    return `bvid:${context.bvid}`;
  }

  if (context.bangumiId) {
    return `bangumi:${context.bangumiId}`;
  }

  return `page:${context.pageKey}`;
}

function buildContext(rawContext) {
  const context = cleanContext(rawContext);
  const tags = context.tags;

  const classification = classifyContext({
    tags,
    tname: context.tname,
    kind: context.kind
  });

  return {
    ...context,
    tags,
    topic: summarizeTopic(tags, context.title),
    category: classification.category,
    confidence: classification.confidence,
    contextId: contextId(context),
    updatedAt: new Date().toISOString()
  };
}

function usageFromState(state) {
  const day = ensureDay(state);
  return buildUsageSnapshot({
    day,
    limitMinutes: state.settings.recreationLimitMinutes,
    dateKey: localDateKey()
  });
}

function dashboardFromState(state, current = null) {
  return {
    settings: {
      recreationLimitMinutes: state.settings.recreationLimitMinutes,
      trackingEnabled: state.settings.trackingEnabled
    },
    usage: usageFromState(state),
    recreationSession: recreationSessionSnapshot(state.recreationSession),
    current: current ?? null
  };
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true
  });

  return tab ?? null;
}

async function getActiveContentContext(sender = {}) {
  const tab = isBilibiliSender(sender) ? sender.tab : await getActiveTab();

  if (!tab?.id) {
    return { found: false, context: null, tabId: null };
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "GET_CONTEXT"
    });

    if (response && Object.hasOwn(response, "context")) {
      return {
        found: true,
        context: response.context,
        tabId: tab.id
      };
    }
  } catch {
    // The active tab is not a loaded Bilibili content page.
  }

  return { found: false, context: null, tabId: tab.id };
}

async function isActiveSender(sender) {
  if (!isBilibiliSender(sender)) {
    return false;
  }

  const activeTab = await getActiveTab();

  return activeTab?.id === sender.tab.id;
}

function isBilibiliSender(sender) {
  if (!sender.tab?.id || (sender.frameId !== undefined && sender.frameId !== 0)) return false;
  try {
    return new URL(sender.url || sender.tab.url).origin === "https://www.bilibili.com";
  } catch {
    return false;
  }
}

async function handlePageInfo(message, sender) {
  if (!isBilibiliSender(sender) || !message.context) {
    return { ok: false };
  }

  const context = buildContext(message.context);
  const state = await getState();

  return {
    ok: true,
    context,
    usage: usageFromState(state)
  };
}

async function handleVideoTick(message, sender) {
  if (!(await isActiveSender(sender))) {
    return { ok: true, counted: false };
  }

  const seconds = Math.min(
    MAX_TICK_SECONDS,
    Math.max(0, Math.round(Number(message.seconds) || 0))
  );

  if (seconds === 0) {
    return { ok: true, counted: false };
  }

  const rawContext = message.context
    ? cleanContext(message.context)
    : null;

  if (
    !rawContext ||
    !["video", "bangumi"].includes(rawContext.kind)
  ) {
    return { ok: true, counted: false };
  }

  const category = isCategory(rawContext.category)
    ? rawContext.category
    : classifyContext(rawContext).category;

  const { state, result } = await updateState((nextState) => {
    if (!nextState.settings.trackingEnabled) return { counted: false };
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todaySeconds = Math.min(seconds, Math.max(0, Math.floor((now - midnight) / 1000)));

    const field =
      category === "education"
        ? "educationSeconds"
        : "recreationSeconds";
    // Allocate the small reporting interval across local midnight when needed.
    if (todaySeconds < seconds) {
      const yesterday = new Date(midnight);
      yesterday.setDate(yesterday.getDate() - 1);
      ensureDay(nextState, yesterday)[field] += seconds - todaySeconds;
    }
    const day = ensureDay(nextState);
    day[field] += todaySeconds;
    const previousSession = recreationSessionSnapshot(nextState.recreationSession);
    nextState.recreationSession = advanceRecreationSession(nextState.recreationSession, {
      category, seconds, now: now.getTime()
    });
    const recreationSession = recreationSessionSnapshot(nextState.recreationSession);

    const warning = shouldIssueRecreationWarning({
      recreationSeconds: day.recreationSeconds,
      limitMinutes: nextState.settings.recreationLimitMinutes,
      warningIssued: day.warningIssued
    });

    if (warning) {
      day.warningIssued = true;
    }

    const usage = usageFromState(nextState);
    return {
      counted: true,
      category,
      warning,
      sessionWarning: recreationSession.overLimit && !previousSession.overLimit,
      recreationSession,
      usage
    };
  });

  await refreshBadge(state);
  return { ok: true, ...result };
}

async function refreshBadge(state) {
  try {
    const usage = usageFromState(state);
    const session = recreationSessionSnapshot(state.recreationSession);
    await chrome.action.setBadgeBackgroundColor({ color: "#c8553d" });
    await chrome.action.setBadgeText({
      text: usage.overLimit || session.overLimit ? "!" : ""
    });
    await chrome.action.setTitle({
      title: session.overLimit
        ? "Bili Balance: 连续娱乐已满 25 分钟，休息一下吧"
        : usage.overLimit
        ? "Bili Balance: recreation limit reached"
        : "Bili Balance"
    });
  } catch {
    // Badge updates are opportunistic and should not fail tracking.
  }
}

async function handleDashboard(sender = {}) {
  const state = await getState();
  await refreshBadge(state);
  const active = await getActiveContentContext(sender);
  const current = active.found ? active.context : null;

  return {
    ok: true,
    ...dashboardFromState(state, current)
  };
}

async function handleSetLimit(message, sender) {
  const requestedMinutes = Number(message.minutes);

  if (!Number.isFinite(requestedMinutes)) {
    throw new Error("Invalid recreation limit.");
  }

  const minutes = clampRecreationLimit(requestedMinutes);
  const { state } = await updateState((nextState) => {
    nextState.settings.recreationLimitMinutes = minutes;
    ensureDay(nextState).warningIssued = false;
  });

  await refreshBadge(state);
  return handleDashboard(sender);
}

async function handleSetTracking(message, sender) {
  if (typeof message.enabled !== "boolean") throw new Error("Invalid tracking setting.");
  await updateState((state) => {
    state.settings.trackingEnabled = message.enabled;
    if (!message.enabled) state.recreationSession = emptyRecreationSession();
  });
  return handleDashboard(sender);
}

async function handleClearHistory(sender) {
  const { state } = await updateState((state) => {
    state.days = {};
    state.recreationSession = emptyRecreationSession();
  });
  await refreshBadge(state);
  return handleDashboard(sender);
}

async function handleSetCategory(message) {
  if (!isCategory(message.category) || !message.contextId) {
    throw new Error("Invalid category update.");
  }

  const tab = await getActiveTab();

  if (!tab?.id) {
    throw new Error("No active Bilibili page.");
  }

  let response;

  try {
    response = await chrome.tabs.sendMessage(tab.id, {
      type: "SET_CONTEXT_CATEGORY",
      category: message.category,
      contextId: message.contextId
    });
  } catch {
    throw new Error("The active page is not a supported video page.");
  }

  if (!response?.ok || !response.context) {
    throw new Error("The active video context is unavailable.");
  }

  const state = await getState();
  return {
    ok: true,
    ...dashboardFromState(state, response.context)
  };
}

async function handleMessage(message, sender) {
  switch (message?.type) {
    case "PAGE_INFO":
      return handlePageInfo(message, sender);
    case "VIDEO_TICK":
      return handleVideoTick(message, sender);
    case "GET_DASHBOARD":
      return handleDashboard(sender);
    case "SET_LIMIT":
      return handleSetLimit(message, sender);
    case "SET_TRACKING":
      return handleSetTracking(message, sender);
    case "CLEAR_HISTORY":
      return handleClearHistory(sender);
    case "SET_CURRENT_CATEGORY":
      return handleSetCategory(message);
    default:
      return { ok: false, error: "Unknown message type." };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => {
      console.error("Bili Balance request failed:", error);
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  updateState(() => {}).then(({ state }) => refreshBadge(state)).catch(console.error);
});

chrome.runtime.onStartup.addListener(() => {
  updateState(() => {}).then(({ state }) => refreshBadge(state)).catch(console.error);
});
