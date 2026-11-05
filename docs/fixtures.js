// Development-only synthetic state; never packaged with the extension.
(() => {
  function createDemo() {
    const dashboard = {
      ok: true,
      settings: { recreationLimitMinutes: 90, trackingEnabled: true },
      usage: { dateKey: new Date().toLocaleDateString("sv-SE"), educationSeconds: 2880, recreationSeconds: 1260 },
      recreationSession: emptySession(),
      current: { contextId: "preview", kind: "video", category: "education",
        topic: "Python / 编程入门 / 数据结构", title: "理解数据结构 · 从一个问题开始",
        tags: ["Python", "编程入门", "数据结构", "计算机科学", "算法基础", "A very long descriptive tag"] }
    };

    function emptySession() {
      return { seconds: 0, limitSeconds: 1500, remainingSeconds: 1500, overLimit: false };
    }

    function snapshot() {
      const usage = dashboard.usage;
      usage.limitMinutes = dashboard.settings.recreationLimitMinutes;
      usage.limitSeconds = usage.limitMinutes * 60;
      usage.remainingSeconds = usage.limitSeconds ? Math.max(0, usage.limitSeconds - usage.recreationSeconds) : null;
      usage.overLimit = usage.limitSeconds > 0 && usage.recreationSeconds >= usage.limitSeconds;
      return structuredClone(dashboard);
    }

    return {
      snapshot,
      async request(message) {
        if (message.type === "SET_LIMIT") dashboard.settings.recreationLimitMinutes = message.minutes;
        if (message.type === "SET_TRACKING") dashboard.settings.trackingEnabled = message.enabled;
        if (message.type === "SET_CURRENT_CATEGORY") dashboard.current.category = message.category;
        if (message.type === "CLEAR_HISTORY" ||
            (message.type === "SET_TRACKING" && !message.enabled) ||
            (message.type === "SET_CURRENT_CATEGORY" && message.category === "education")) {
          dashboard.recreationSession = emptySession();
        }
        if (message.type === "CLEAR_HISTORY") {
          dashboard.usage.educationSeconds = 0;
          dashboard.usage.recreationSeconds = 0;
        }
        return snapshot();
      },
      continuousWarning() {
        dashboard.current.category = "recreation";
        dashboard.settings.trackingEnabled = true;
        dashboard.recreationSession = { seconds: 1500, limitSeconds: 1500, remainingSeconds: 0, overLimit: true };
        return snapshot();
      }
    };
  }
  globalThis.BiliBalanceDemo = { create: createDemo };
})();
