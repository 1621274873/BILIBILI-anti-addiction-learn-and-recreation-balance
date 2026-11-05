import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
const sources = await Promise.all(manifest.content_scripts[0].js
  .filter((path) => path.includes("/panel/") || path.endsWith("/floating-panel.js"))
  .map((path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")));

function createPanel() {
  const all = [];
  const events = new Map();
  const calls = [];
  const viewport = { innerWidth: 1000, innerHeight: 800 };
  class Element {
    children = [];
    attributes = new Map();
    handlers = new Map();
    dataset = {};
    hidden = false;
    textContent = "";
    value = "";
    constructor(tag) {
      this.tag = tag;
      this.style = { setProperty: (key, value) => { this.style[key] = value; } };
      all.push(this);
    }
    append(...children) { children.forEach((child) => { child.parent = this; this.children.push(child); }); }
    attachShadow(options) { this.shadowOptions = options; return new Element("shadow-root"); }
    replaceChildren(...children) { this.children = children; }
    setAttribute(key, value) { this.attributes.set(key, value); }
    addEventListener(name, handler) { this.handlers.set(name, handler); }
    focus() {}
    setPointerCapture() {}
    closest(tag) { return this.tag === tag ? this : null; }
    getBoundingClientRect() {
      const width = all.find((node) => node.className === "panel")?.hidden ? 180 : 320;
      const height = width === 180 ? 42 : 460;
      return { width, height, left: parseFloat(this.style.left ?? viewport.innerWidth - width - 24), top: parseFloat(this.style.top ?? viewport.innerHeight - height - 24) };
    }
    emit(name, extra = {}) {
      return this.handlers.get(name)?.({ target: this, button: 0, preventDefault() {}, stopPropagation() {}, ...extra });
    }
  }
  const page = new Element("html");
  const original = new Element("original-bilibili-content");
  original.textContent = "Existing page and platform notices";
  page.append(original);
  const document = { createElement: (tag) => new Element(tag), documentElement: page,
    fullscreenElement: null, addEventListener: (name, handler) => events.set(name, handler) };
  const dashboard = { settings: { recreationLimitMinutes: 90, trackingEnabled: true },
    usage: { dateKey: "2026-11-03", educationSeconds: 60, recreationSeconds: 120, limitMinutes: 90,
      limitSeconds: 5400, remainingSeconds: 5280, overLimit: false },
    current: { contextId: "video", topic: "<img src=x onerror=alert(1)>", tags: ["Python"], category: "education" }
  };
  const sandbox = vm.createContext({ document, window: { ...viewport, addEventListener() {} } });
  sources.forEach((source) => vm.runInContext(source, sandbox));
  const panel = sandbox.BiliBalancePanel.create({
    request: async (message) => {
      calls.push({ ...message });
      return { ok: true, ...dashboard };
    },
    setCategory: async (category) => calls.push({ type: "category", category })
  });
  panel.render(dashboard, true);
  return { page, original, all, calls, document, events, dashboard, panel,
    byClass: (className) => all.find((element) => element.className === className),
    button: (text) => all.find((element) => element.tag === "button" && element.textContent === text)
  };
}

test("mounts a single isolated host and renders untrusted metadata as text", () => {
  const ui = createPanel();
  assert.equal(ui.page.children.length, 2);
  assert.equal(ui.page.children[0], ui.original);
  assert.equal(ui.original.textContent, "Existing page and platform notices");
  assert.equal(ui.page.children[1].tag, "bili-balance-panel");
  assert.equal(ui.page.children[1].shadowOptions.mode, "closed");
  assert.equal(ui.byClass("topic").textContent, ui.dashboard.current.topic);
  assert.equal(ui.all.some((element) => element.tag === "img"), false);
});

test("collapse, keyboard movement, fullscreen and over-limit feedback work", () => {
  const ui = createPanel();
  ui.button("−").emit("click");
  assert.equal(ui.panel.collapsed, true);
  assert.equal(ui.byClass("panel").hidden, true);
  ui.byClass("bubble").emit("click");
  assert.equal(ui.panel.collapsed, false);
  const head = ui.byClass("head");
  head.emit("keydown", { key: "ArrowLeft" });
  assert.equal(ui.page.children[1].style.left, "640px");
  ui.document.fullscreenElement = {};
  ui.events.get("fullscreenchange")();
  assert.equal(ui.page.children[1].hidden, true);
  ui.document.fullscreenElement = null;
  ui.events.get("fullscreenchange")();
  assert.equal(ui.page.children[1].hidden, false);
  ui.dashboard.usage.overLimit = true;
  ui.panel.render(ui.dashboard);
  assert.equal(ui.byClass("warning").hidden, false);
  assert.equal(ui.byClass("bubble").dataset.warning, "true");
});

test("validates limits, changes categories, and confirms history deletion", async () => {
  const ui = createPanel();
  const input = ui.all.find((element) => element.tag === "input");
  input.value = "721";
  ui.byClass("limit").emit("submit");
  assert.equal(ui.calls.length, 0);
  input.value = "60";
  ui.byClass("limit").emit("submit");
  await new Promise(setImmediate);
  assert.deepEqual(ui.calls[0], { type: "SET_LIMIT", minutes: 60 });
  ui.button("计入娱乐").emit("click");
  await new Promise(setImmediate);
  assert.deepEqual(ui.calls[1], { type: "category", category: "recreation" });
  ui.button("清除时长记录").emit("click");
  assert.equal(ui.calls.length, 2);
  ui.button("清除时长记录").emit("click");
  await new Promise(setImmediate);
  assert.deepEqual(ui.calls[2], { type: "CLEAR_HISTORY" });
});

test("continuous reminder appears in both panel and collapsed strip with the daily limit off", () => {
  const ui = createPanel();
  ui.dashboard.usage.limitMinutes = 0;
  ui.dashboard.usage.overLimit = false;
  ui.dashboard.recreationSession = { seconds: 1495, overLimit: false, expiresAt: Date.now() + 60000 };
  ui.panel.render(ui.dashboard);
  assert.equal(ui.byClass("warning session-warning").hidden, true);
  assert.match(ui.byClass("session-time").textContent, /24 分 55 秒/);
  ui.button("−").emit("click");
  ui.dashboard.recreationSession.seconds = 1500;
  ui.dashboard.recreationSession.overLimit = true;
  ui.panel.render(ui.dashboard);
  assert.equal(ui.byClass("warning session-warning").hidden, false);
  assert.match(ui.byClass("bubble").textContent, /连续娱乐已满 25 分钟/);
  assert.equal(ui.byClass("bubble").dataset.warning, "true");
  assert.equal(ui.byClass("warning").hidden, true);
  ui.dashboard.recreationSession.expiresAt = Date.now() - 1;
  ui.panel.render(ui.dashboard);
  assert.equal(ui.byClass("warning session-warning").hidden, true);
  assert.equal(ui.byClass("session-time").textContent, "0 秒");
  assert.equal(ui.byClass("bubble").dataset.warning, "false");
});
