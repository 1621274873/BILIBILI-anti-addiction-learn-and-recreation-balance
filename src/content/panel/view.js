(() => {
  function createPanelView({ onCollapse, onCategory, onPause, onClear }) {
    // All writes target extension-owned nodes, never existing Bilibili content.
    const host = document.createElement("bili-balance-panel");
    const root = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = BiliBalancePanelStyles;
    root.append(style);
    function node(tag, className = "", text = "", parent = root) {
      const element = document.createElement(tag);
      element.className = className;
      element.textContent = text;
      parent.append(element);
      return element;
    }
    function button(label, className, parent, onClick) {
      const element = node("button", className, label, parent);
      element.type = "button";
      element.addEventListener("click", onClick);
      return element;
    }
    const bubble = button("BB · 今日时长", "bubble", root, () => onCollapse(false));
    bubble.hidden = true;
    bubble.setAttribute("aria-label", "展开 Bili Balance 悬浮窗");
    bubble.setAttribute("aria-live", "polite");
    const panel = node("section", "panel");
    panel.setAttribute("aria-label", "Bili Balance 本地视频计时");
    const header = node("div", "head", "", panel);
    header.tabIndex = 0;
    header.setAttribute("aria-label", "拖动悬浮窗，或使用方向键移动");
    node("span", "mark", "BB", header);
    const brand = node("div", "brand", "", header);
    node("strong", "", "Bili Balance", brand);
    const date = node("span", "sub", "今日 · 给时间一点分寸", brand);
    const minimize = button("−", "collapse", header, () => onCollapse(true));
    minimize.setAttribute("aria-label", "折叠悬浮窗");
    const body = node("div", "body", "", panel);
    const status = node("p", "status", "正在连接本地计时…", body);
    const totals = node("div", "totals", "", body);
    const studyTile = node("div", "tile", "", totals);
    node("span", "", "学习 / EDUCATION", studyTile);
    const studyTime = node("strong", "", "0 秒", studyTile);
    const funTile = node("div", "tile fun", "", totals);
    node("span", "", "娱乐 / RECREATION", funTile);
    const funTime = node("strong", "", "0 秒", funTile);
    const budget = node("div", "budget", "", body);
    node("span", "", "今日娱乐额度", budget);
    const remaining = node("strong", "", "—", budget);
    const progress = node("div", "track", "", body);
    progress.setAttribute("role", "progressbar");
    progress.setAttribute("aria-label", "今日娱乐额度使用比例");
    progress.setAttribute("aria-valuemin", "0");
    progress.setAttribute("aria-valuemax", "100");
    const fill = node("span", "fill", "", progress);
    const warning = node("p", "warning", "今日娱乐已到限额，休息一下吧。", body);
    warning.setAttribute("role", "status");
    warning.hidden = true;
    const sessionRow = node("div", "budget session-row", "", body);
    node("span", "", "本次连续娱乐 / 25 分钟提醒", sessionRow);
    const sessionTime = node("strong", "session-time", "0 秒", sessionRow);
    const sessionWarning = node("p", "warning session-warning", "已连续娱乐 25 分钟，休息至少 1 分钟再继续吧。", body);
    sessionWarning.setAttribute("role", "status");
    sessionWarning.hidden = true;
    const current = node("div", "current", "", body);
    node("p", "eyebrow", "当前视频 · 主题来自页面标签", current);
    const topic = node("p", "topic", "打开视频后开始计时", current);
    const tags = node("div", "tags", "", current);
    const categories = node("div", "categories", "", current);
    const education = button("计入学习", "", categories, () => onCategory("education"));
    const recreation = button("计入娱乐", "", categories, () => onCategory("recreation"));
    const form = node("form", "limit", "", body);
    const label = node("label", "", "娱乐限额（分钟）", form);
    label.htmlFor = "bb-limit";
    const limit = node("input", "", "", form);
    limit.id = "bb-limit";
    limit.type = "number";
    limit.min = "0";
    limit.max = "720";
    limit.step = "1";
    limit.value = "90";
    const save = button("保存", "", form, () => {});
    save.type = "submit";
    const tools = node("div", "tools", "", body);
    const pause = button("暂停计时", "", tools, onPause);
    button("清除时长记录", "", tools, onClear);
    const message = node("p", "message", "", body);
    message.setAttribute("role", "status");
    node("p", "privacy", "仅本地保存 · 限额 0 仅关闭每日提醒", body);

    return { host, root, node, bubble, panel, header, date, minimize, status, studyTime, funTime, remaining, progress, fill, warning, sessionTime, sessionWarning, topic, tags, education, recreation, form, limit, save, pause, message };
  }

  globalThis.BiliBalancePanelView = { create: createPanelView };
})();
