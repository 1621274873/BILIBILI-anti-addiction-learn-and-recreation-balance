(() => {
  function createFloatingPanel({ request, setCategory }) {
    const { host, root, node, bubble, panel, header, date, minimize, status, studyTime, funTime, remaining, progress, fill, warning, sessionTime, sessionWarning, topic, tags, education, recreation, form, limit, save, pause, message } = BiliBalancePanelView.create({
      onCollapse: collapse,
      onCategory: changeCategory,
      onPause: () => perform({ type: "SET_TRACKING", enabled: !dashboard?.settings.trackingEnabled }),
      onClear: clearHistory
    });

    let dashboard = null;
    let clearArmedUntil = 0;
    let collapsed = false;
    let busy = false;
    let drag = null;
    let positioned = false;

    function clearHistory() {
      if (busy) return;
      if (Date.now() > clearArmedUntil) {
        clearArmedUntil = Date.now() + 5000;
        message.textContent = "5 秒内再次点击，清除所有本地时长记录。";
        return;
      }
      clearArmedUntil = 0;
      perform({ type: "CLEAR_HISTORY" });
    }

    function duration(seconds) {
      const value = Math.max(0, Math.floor(seconds || 0));
      if (value < 60) return `${value} 秒`;
      if (value < 3600) return `${Math.floor(value / 60)} 分 ${value % 60} 秒`;
      return `${Math.floor(value / 3600)} 时 ${Math.floor(value % 3600 / 60)} 分`;
    }

    function move(left, top) {
      const rect = host.getBoundingClientRect();
      const x = Math.max(8, Math.min(left, window.innerWidth - rect.width - 8));
      const y = Math.max(8, Math.min(top, window.innerHeight - rect.height - 8));
      for (const [key, value] of Object.entries({ left: `${x}px`, top: `${y}px`, right: "auto", bottom: "auto" })) {
        host.style.setProperty(key, value, "important");
      }
      positioned = true;
    }

    function clampPosition() {
      if (positioned) {
        const rect = host.getBoundingClientRect();
        move(rect.left, rect.top);
      }
    }

    function collapse(value) {
      collapsed = value;
      panel.hidden = value;
      bubble.hidden = !value;
      clampPosition();
      (value ? bubble : minimize).focus({ preventScroll: true });
    }

    header.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("button")) return;
      const rect = host.getBoundingClientRect();
      drag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      header.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    header.addEventListener("pointermove", (event) => {
      if (drag) move(event.clientX - drag.x, event.clientY - drag.y);
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) {
      header.addEventListener(name, () => { drag = null; });
    }
    header.addEventListener("keydown", (event) => {
      if (event.target !== header) return;
      const offset = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }[event.key];
      if (!offset) return;
      event.preventDefault();
      const rect = host.getBoundingClientRect();
      move(rect.left + offset[0], rect.top + offset[1]);
    });
    // Keep extension controls from triggering Bilibili keyboard/click handlers.
    for (const name of ["click", "keydown", "keyup", "pointerdown"]) {
      root.addEventListener(name, (event) => event.stopPropagation());
    }
    window.addEventListener("resize", clampPosition);
    document.addEventListener("fullscreenchange", () => {
      host.hidden = Boolean(document.fullscreenElement);
    });

    function render(next, playbackActive = false) {
      dashboard = next;
      const { usage, settings, current: video } = next;
      date.textContent = `${usage.dateKey} · 今日`;
      status.textContent = !settings.trackingEnabled ? "计时已暂停" : playbackActive ? "正在记录当前播放" : "等待前台视频播放";
      status.dataset.active = String(settings.trackingEnabled && playbackActive);
      studyTime.textContent = duration(usage.educationSeconds);
      funTime.textContent = duration(usage.recreationSeconds);
      remaining.textContent = usage.limitMinutes === 0 ? "提醒已关闭" : usage.overLimit ? "已达限额" : `剩余 ${duration(usage.remainingSeconds)}`;
      const percent = usage.limitSeconds ? Math.min(100, usage.recreationSeconds / usage.limitSeconds * 100) : 0;
      fill.style.width = `${percent}%`;
      fill.style.background = usage.overLimit ? "#b76b42" : "#7c9b85";
      progress.setAttribute("aria-valuenow", String(Math.round(percent)));
      warning.hidden = !usage.overLimit;
      const session = next.recreationSession;
      const expired = session?.expiresAt && Date.now() >= session.expiresAt;
      const sessionOverLimit = Boolean(session?.overLimit && !expired);
      sessionTime.textContent = duration(expired ? 0 : session?.seconds);
      sessionWarning.hidden = !sessionOverLimit;
      bubble.textContent = sessionOverLimit ? "BB · 连续娱乐已满 25 分钟" : usage.overLimit ? "BB · 娱乐已达限额" : `BB · 学 ${duration(usage.educationSeconds)} / 娱 ${duration(usage.recreationSeconds)}`;
      bubble.dataset.warning = String(usage.overLimit || sessionOverLimit);
      topic.textContent = video?.topic || "打开视频后开始计时";
      topic.title = video?.title || "";
      tags.replaceChildren();
      for (const tag of (video?.tags || []).slice(0, 3)) node("span", "tag", tag, tags);
      for (const [element, category] of [[education, "education"], [recreation, "recreation"]]) {
        element.disabled = !video?.contextId || busy;
        element.setAttribute("aria-pressed", String(video?.category === category));
      }
      if (root.activeElement !== limit) limit.value = String(settings.recreationLimitMinutes);
      pause.textContent = settings.trackingEnabled ? "暂停计时" : "恢复计时";
      clampPosition();
    }

    async function perform(action) {
      if (busy) return;
      busy = true;
      save.disabled = true;
      message.textContent = "";
      try {
        const response = await request(action);
        if (!response?.ok) throw new Error("扩展连接已失效，请刷新 B站页面。");
        render(response);
        message.textContent = action.type === "CLEAR_HISTORY" ? "本地时长记录已清除。" : "已保存。";
      } catch {
        message.textContent = "操作失败，请刷新 B站页面后重试。";
      } finally {
        busy = false;
        save.disabled = false;
        if (dashboard) render(dashboard);
      }
    }

    async function changeCategory(category) {
      if (!dashboard?.current || busy) return;
      try {
        await setCategory(category);
      } catch {
        message.textContent = "当前视频已变化，请稍后重试。";
      }
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const minutes = Number(limit.value);
      if (limit.value === "" || !Number.isInteger(minutes) || minutes < 0 || minutes > 720) {
        message.textContent = "请输入 0 至 720 的整数分钟。";
        return;
      }
      perform({ type: "SET_LIMIT", minutes });
    });

    host.hidden = Boolean(document.fullscreenElement);
    document.documentElement.append(host);
    return {
      render,
      setUnavailable() { status.textContent = "扩展已更新，请刷新此页面。"; },
      get collapsed() { return collapsed; }
    };
  }

  globalThis.BiliBalancePanel = { create: createFloatingPanel };
})();
