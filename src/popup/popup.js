import { createPopupView } from "./view.js";

// Injecting transport and document lets previews/tests use the production UI.
export function mountPopup({ request, document = globalThis.document, refreshMs = 15000 }) {
  const view = createPopupView(document);
  const { elements } = view;
  let dashboard = null;
  let busy = false;
  let destroyed = false;
  let revision = 0;
  let clearArmedUntil = 0;
  const cleanup = [];

  function render() {
    if (!destroyed && dashboard) view.render(dashboard, { busy });
  }

  async function send(message) {
    const response = await request(message);
    if (!response?.ok) throw new Error("扩展连接失败，请重新打开弹窗。");
    return response;
  }

  async function refresh() {
    if (busy || destroyed) return;
    const currentRevision = ++revision;
    try {
      const response = await send({ type: "GET_DASHBOARD" });
      if (currentRevision !== revision || destroyed) return;
      dashboard = response;
      render();
    } catch (error) {
      if (currentRevision !== revision || destroyed) return;
      elements.limitState.textContent = "暂不可用";
      elements.limitState.classList.add("warning");
      elements.saveMessage.textContent = error.message;
    }
  }

  async function perform(message, successMessage = "已保存。") {
    if (busy || destroyed || !dashboard) return;
    busy = true;
    revision++; // An older dashboard poll must not overwrite a user's change.
    elements.saveMessage.textContent = "";
    render();
    try {
      const response = await send(message);
      if (destroyed) return;
      dashboard = response;
      elements.saveMessage.textContent = successMessage;
    } catch (error) {
      if (!destroyed) elements.saveMessage.textContent = error.message;
    } finally {
      busy = false;
      render();
    }
  }

  function listen(element, name, handler) {
    element.addEventListener(name, handler);
    cleanup.push(() => element.removeEventListener(name, handler));
  }

  function setCategory(category) {
    if (!dashboard?.current?.contextId) return;
    return perform({ type: "SET_CURRENT_CATEGORY", category, contextId: dashboard.current.contextId });
  }

  listen(elements.educationButton, "click", () => setCategory("education"));
  listen(elements.recreationButton, "click", () => setCategory("recreation"));
  listen(elements.limitForm, "submit", (event) => {
    event.preventDefault();
    if (busy) return;
    const minutes = Number(elements.limitInput.value);
    if (elements.limitInput.value === "" || !Number.isInteger(minutes) || minutes < 0 || minutes > 720) {
      elements.saveMessage.textContent = "请输入 0 至 720 的整数分钟。";
      return;
    }
    return perform({ type: "SET_LIMIT", minutes }, "限额已保存。");
  });
  listen(elements.toggleTracking, "click", () => {
    if (dashboard) return perform({ type: "SET_TRACKING", enabled: !dashboard.settings.trackingEnabled }, "计时设置已更新。");
  });
  listen(elements.clearHistory, "click", () => {
    if (busy || !dashboard) return;
    if (Date.now() > clearArmedUntil) {
      clearArmedUntil = Date.now() + 5000;
      elements.saveMessage.textContent = "5 秒内再次点击，清除所有本地时长记录。";
      return;
    }
    clearArmedUntil = 0;
    return perform({ type: "CLEAR_HISTORY" }, "本地时长记录已清除。");
  });

  const ready = refresh();
  const timer = refreshMs > 0 ? setInterval(refresh, refreshMs) : null;
  return {
    ready,
    refresh,
    destroy() {
      destroyed = true;
      revision++;
      if (timer !== null) clearInterval(timer);
      cleanup.forEach((dispose) => dispose());
    }
  };
}
