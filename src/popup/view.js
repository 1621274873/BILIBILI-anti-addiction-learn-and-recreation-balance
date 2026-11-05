import { formatDateLabel, formatDuration } from "../shared/format.js";

// Renders only the popup document; receives no Chrome APIs or transport.
export function createPopupView(document) {
  const elements = {
    dateLabel: document.querySelector("#dateLabel"),
    limitState: document.querySelector("#limitState"),
    totalTime: document.querySelector("#totalTime"),
    educationTime: document.querySelector("#educationTime"),
    educationShare: document.querySelector("#educationShare"),
    recreationTime: document.querySelector("#recreationTime"),
    recreationShare: document.querySelector("#recreationShare"),
    remainingTime: document.querySelector("#remainingTime"),
    progress: document.querySelector("#progress"),
    progressBar: document.querySelector("#progressBar"),
    sourceLabel: document.querySelector("#sourceLabel"),
    emptyState: document.querySelector("#emptyState"),
    currentContent: document.querySelector("#currentContent"),
    topic: document.querySelector("#topic"),
    pageTitle: document.querySelector("#pageTitle"),
    tagList: document.querySelector("#tagList"),
    educationButton: document.querySelector("#educationButton"),
    recreationButton: document.querySelector("#recreationButton"),
    limitForm: document.querySelector("#limitForm"),
    limitInput: document.querySelector("#limitInput"),
    saveLimit: document.querySelector("#saveLimit"),
    saveMessage: document.querySelector("#saveMessage"),
    toggleTracking: document.querySelector("#toggleTracking"),
    clearHistory: document.querySelector("#clearHistory"),
    sessionTime: document.querySelector("#sessionTime"),
    sessionWarning: document.querySelector("#sessionWarning")
  };

  function displayDuration(seconds) {
    return seconds > 0 && seconds < 60
      ? `${Math.floor(seconds)}s`
      : formatDuration(seconds);
  }

  function setLimitState(usage) {
    elements.limitState.classList.remove("warning", "neutral");

    if (usage.limitMinutes === 0) {
      elements.limitState.textContent = "每日提醒已关闭";
      elements.limitState.classList.add("neutral");
    } else if (usage.overLimit) {
      elements.limitState.textContent = "娱乐已达限额";
      elements.limitState.classList.add("warning");
    } else {
      elements.limitState.textContent = "额度充足";
    }
  }

  function renderTags(tags) {
    elements.tagList.replaceChildren();

    for (const value of tags.slice(0, 6)) {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = value;
      elements.tagList.append(tag);
    }
  }

  function renderCurrent(current) {
    const hasCurrent = Boolean(
      current?.contextId &&
        ["video", "bangumi"].includes(current.kind)
    );
    elements.emptyState.hidden = hasCurrent;
    elements.currentContent.hidden = !hasCurrent;

    if (!hasCurrent) {
      elements.sourceLabel.textContent = "未检测到";
      return;
    }

    const title = current.title || "";
    const topic = current.topic || title || "未检测到主题";
    const category = current.category === "education"
      ? "education"
      : "recreation";

    elements.topic.textContent = topic;
    elements.pageTitle.textContent = title === topic ? "" : title;
    elements.pageTitle.hidden = title === topic || !title;
    elements.sourceLabel.textContent =
      current.kind === "bangumi" ? "番剧" : "视频";
    renderTags(Array.isArray(current.tags) ? current.tags : []);
    elements.educationButton.setAttribute(
      "aria-pressed",
      String(category === "education")
    );
    elements.recreationButton.setAttribute(
      "aria-pressed",
      String(category === "recreation")
    );
  }

  function renderDashboard(dashboard, { busy = false } = {}) {
    const { usage, settings, current } = dashboard;
    const totalSeconds = usage.educationSeconds + usage.recreationSeconds;
    const educationShare =
      totalSeconds > 0
        ? Math.round((usage.educationSeconds / totalSeconds) * 100)
        : 0;
    const recreationShare =
      totalSeconds > 0 ? 100 - educationShare : 0;
    const limitPercent =
      usage.limitSeconds > 0
        ? Math.min(100, (usage.recreationSeconds / usage.limitSeconds) * 100)
        : 0;

    elements.dateLabel.textContent = formatDateLabel();
    elements.totalTime.textContent = `合计 ${formatDuration(totalSeconds)}`;
    elements.educationTime.textContent = displayDuration(
      usage.educationSeconds
    );
    elements.recreationTime.textContent = displayDuration(
      usage.recreationSeconds
    );
    elements.educationShare.textContent = `占观看时长 ${educationShare}%`;
    elements.recreationShare.textContent = `占观看时长 ${recreationShare}%`;
    elements.progressBar.style.width = `${limitPercent}%`;
    elements.progress.classList.toggle("warning", usage.overLimit);
    elements.progress.setAttribute("aria-valuenow", String(limitPercent));

    if (usage.limitMinutes === 0) {
      elements.remainingTime.textContent = "每日提醒已关闭";
    } else if (usage.overLimit) {
      elements.remainingTime.textContent = `已超出 ${formatDuration(
        Math.max(0, usage.recreationSeconds - usage.limitSeconds)
      )}`;
    } else {
      elements.remainingTime.textContent = `剩余 ${formatDuration(
        usage.remainingSeconds
      )}`;
    }

    setLimitState(usage);
    const session = dashboard.recreationSession;
    const expired = session?.expiresAt && Date.now() >= session.expiresAt;
    elements.sessionTime.textContent = displayDuration(expired ? 0 : session?.seconds || 0);
    elements.sessionWarning.hidden = !session?.overLimit || Boolean(expired);
    if (session?.overLimit && !expired) {
      elements.limitState.textContent = "连续娱乐已满 25 分钟";
      elements.limitState.classList.remove("neutral");
      elements.limitState.classList.add("warning");
    }
    elements.toggleTracking.textContent = settings.trackingEnabled ? "暂停计时" : "恢复计时";
    if (!settings.trackingEnabled) elements.limitState.textContent = "计时已暂停";
    renderCurrent(current);
    const hasCurrent = Boolean(current?.contextId && ["video", "bangumi"].includes(current.kind));
    elements.educationButton.disabled = busy || !hasCurrent;
    elements.recreationButton.disabled = busy || !hasCurrent;
    elements.saveLimit.disabled = busy;
    elements.toggleTracking.disabled = busy;
    elements.clearHistory.disabled = busy;

    if (document.activeElement !== elements.limitInput) {
      elements.limitInput.value = String(settings.recreationLimitMinutes);
    }
  }

  return { elements, render: renderDashboard };
}
