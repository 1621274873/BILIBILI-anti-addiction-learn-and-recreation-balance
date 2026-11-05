import test from "node:test";
import assert from "node:assert/strict";
import { mountPopup } from "../src/popup/popup.js";

function createDocument() {
  const elements = new Map();
  const selectors = ["dateLabel", "limitState", "totalTime", "educationTime", "educationShare",
    "recreationTime", "recreationShare", "remainingTime", "progress", "progressBar", "sourceLabel",
    "emptyState", "currentContent", "topic", "pageTitle", "tagList", "educationButton", "recreationButton",
    "limitForm", "limitInput", "saveLimit", "saveMessage", "toggleTracking", "clearHistory", "sessionTime", "sessionWarning"];
  for (const id of selectors) elements.set(id, {
    value: "", textContent: "", hidden: false, disabled: false, attributes: {}, listeners: new Map(),
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, handler) { this.listeners.set(name, handler); },
    removeEventListener(name) { this.listeners.delete(name); },
    replaceChildren() {}, append() {}
  });
  const document = { activeElement: null, querySelector(selector) { return elements.get(selector.slice(1)); }, createElement() { return { className: "", textContent: "" }; } };
  return { document, elements, emit(id, name, event = {}) { return elements.get(id).listeners.get(name)?.(event); } };
}

function dashboard() {
  return { ok: true,
    settings: { recreationLimitMinutes: 90, trackingEnabled: true },
    usage: { dateKey: "2026-11-05", educationSeconds: 120, recreationSeconds: 300,
      limitMinutes: 90, limitSeconds: 5400, remainingSeconds: 5100, overLimit: false },
    current: { contextId: "video:1", kind: "video", category: "education", title: "Python",
      topic: "Python", tags: ["编程"] },
    recreationSession: { seconds: 0, overLimit: false } };
}

test("popup view validates input, updates controls and clears history after confirmation", async () => {
  const ui = createDocument();
  const calls = [];
  let state = dashboard();
  const popup = mountPopup({ document: ui.document, refreshMs: 0, request: async (message) => {
    calls.push(message);
    if (message.type === "SET_LIMIT") state = { ...state, settings: { ...state.settings, recreationLimitMinutes: message.minutes } };
    if (message.type === "SET_TRACKING") state = { ...state, settings: { ...state.settings, trackingEnabled: message.enabled } };
    if (message.type === "CLEAR_HISTORY") state = { ...state, usage: { ...state.usage, educationSeconds: 0, recreationSeconds: 0 } };
    return structuredClone(state);
  } });
  await popup.ready;
  ui.elements.get("limitInput").value = "721";
  ui.emit("limitForm", "submit", { preventDefault() {} });
  assert.equal(calls.length, 1); // Initial dashboard load only.
  assert.match(ui.elements.get("saveMessage").textContent, /0 至 720/);

  ui.elements.get("limitInput").value = "45";
  ui.emit("limitForm", "submit", { preventDefault() {} });
  await new Promise(setImmediate);
  assert.deepEqual(calls[1], { type: "SET_LIMIT", minutes: 45 });
  assert.equal(ui.elements.get("limitInput").value, "45");

  ui.emit("educationButton", "click");
  await new Promise(setImmediate);
  assert.deepEqual(calls[2], { type: "SET_CURRENT_CATEGORY", category: "education", contextId: "video:1" });
  ui.emit("clearHistory", "click");
  assert.equal(calls.length, 3);
  ui.emit("clearHistory", "click");
  await new Promise(setImmediate);
  assert.deepEqual(calls[3], { type: "CLEAR_HISTORY" });
  popup.destroy();
  assert.equal(ui.elements.get("limitForm").listeners.size, 0);
});
