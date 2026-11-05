import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const sources = await Promise.all(["playback-clock.js", "content.js"].map((name) =>
  readFile(new URL(`../src/content/${name}`, import.meta.url), "utf8")
));

async function createPage({ tickSession = null } = {}) {
  const documentEvents = new Map();
  const windowEvents = new Map();
  const intervals = [];
  const messages = [];
  let now = 0;
  let focused = true;
  let messageListener;
  let storageListener;
  let controls;
  let rendered;
  class Video {
    tagName = "VIDEO";
    currentTime = 0;
    playbackRate = 1;
    paused = true;
    ended = false;
    seeking = false;
  }
  const video = new Video();
  const document = {
    title: "Python 教程",
    visibilityState: "visible",
    hasFocus: () => focused,
    querySelector: (selector) => selector === "video" ? video : null,
    querySelectorAll: () => [],
    addEventListener: (name, listener) => documentEvents.set(name, listener)
  };
  const location = {
    href: "https://www.bilibili.com/video/BVTEST123",
    origin: "https://www.bilibili.com",
    pathname: "/video/BVTEST123",
    search: ""
  };
  const dashboard = {
    settings: { recreationLimitMinutes: 90, trackingEnabled: true },
    usage: { dateKey: "2026-11-03", educationSeconds: 0, recreationSeconds: 0, limitSeconds: 5400, remainingSeconds: 5400, limitMinutes: 90, overLimit: false }
  };
  const environment = {
    document, location, HTMLVideoElement: Video, URLSearchParams,
    performance: { now: () => now },
    setInterval: (listener, delay) => { intervals.push({ listener, delay }); },
    setTimeout: () => {},
    BiliBalancePanel: { create: (callbacks) => {
      controls = callbacks;
      return { render: (value) => { rendered = value; }, setUnavailable() {} };
    } },
    chrome: {
      runtime: {
        sendMessage: async (message) => {
          messages.push(structuredClone(message));
          if (message.type === "PAGE_INFO") return {
            ok: true, context: { ...message.context, contextId: `bvid:${message.context.bvid}`, topic: "Python", category: "education" }
          };
          if (message.type === "GET_DASHBOARD") return { ok: true, ...dashboard };
          if (message.type === "VIDEO_TICK" && tickSession) {
            return { ok: true, usage: dashboard.usage, recreationSession: tickSession };
          }
          return { ok: true };
        },
        onMessage: { addListener: (listener) => { messageListener = listener; } }
      },
      storage: { onChanged: { addListener: (listener) => { storageListener = listener; } } }
    },
    addEventListener: (name, listener) => windowEvents.set(name, listener)
  };
  environment.window = environment;
  const context = vm.createContext(environment);
  sources.forEach((source) => vm.runInContext(source, context));
  await new Promise(setImmediate);
  return {
    video, document, location, controls, messages,
    get rendered() { return rendered; },
    pulse(seconds = 1) {
      now += seconds * 1000;
      if (!video.paused) video.currentTime += seconds * video.playbackRate;
      intervals.filter((timer) => timer.delay === 1000).forEach((timer) => timer.listener());
    },
    play() { video.paused = false; documentEvents.get("play")({ target: video }); },
    pause() { video.paused = true; documentEvents.get("pause")({ target: video }); },
    seek(time) {
      video.seeking = true;
      documentEvents.get("seeking")({ target: video });
      video.currentTime = time;
      video.seeking = false;
      documentEvents.get("seeked")({ target: video });
    },
    focus(value) { focused = value; windowEvents.get(value ? "focus" : "blur")(); },
    visibility(value) { document.visibilityState = value; documentEvents.get("visibilitychange")(); },
    tracking(enabled) {
      dashboard.settings.trackingEnabled = enabled;
      storageListener({ biliBalanceState: { newValue: { settings: dashboard.settings, days: { "2026-11-03": {} } } } }, "local");
    },
    context() {
      let result;
      messageListener({ type: "GET_CONTEXT" }, {}, (value) => { result = value.context; });
      return result;
    },
    ticks() { return messages.filter((message) => message.type === "VIDEO_TICK"); }
  };
}

test("hidden or unfocused pause events cannot add background playback", async () => {
  const page = await createPage();
  page.play();
  for (let i = 0; i < 6; i++) page.pulse();
  assert.equal(page.ticks().reduce((sum, tick) => sum + tick.seconds, 0), 5);
  page.visibility("hidden");
  page.pulse(8);
  page.pause();
  assert.equal(page.ticks().reduce((sum, tick) => sum + tick.seconds, 0), 6);
  page.visibility("visible");
  page.focus(false);
  page.play();
  page.pulse(8);
  page.pause();
  assert.equal(page.ticks().reduce((sum, tick) => sum + tick.seconds, 0), 6);
});

test("double speed, seeking and category changes keep attribution local and correct", async () => {
  const page = await createPage();
  page.video.playbackRate = 2;
  page.play();
  for (let i = 0; i < 5; i++) page.pulse();
  assert.equal(page.ticks()[0].seconds, 5);
  page.seek(400);
  page.pulse(2);
  await page.controls.setCategory("recreation");
  assert.equal(page.ticks()[1].seconds, 2);
  assert.equal(page.ticks()[1].context.category, "education");
  page.pulse();
  for (let i = 0; i < 5; i++) page.pulse();
  assert.equal(page.ticks()[2].seconds, 5);
  assert.equal(page.ticks()[2].context.category, "recreation");
  assert.equal(page.context().category, "recreation");
});

test("pause tracking and navigation to the homepage stop further reporting", async () => {
  const page = await createPage();
  page.play();
  page.pulse(3);
  page.tracking(false);
  await new Promise(setImmediate);
  page.pulse(5);
  page.pause();
  assert.equal(page.ticks().length, 0);
  page.tracking(true);
  await new Promise(setImmediate);
  page.play();
  page.pulse(5);
  assert.equal(page.ticks().length, 1);
  page.location.href = "https://www.bilibili.com/";
  page.location.pathname = "/";
  page.pulse(5);
  page.pause();
  assert.equal(page.ticks().length, 1);
  assert.equal(page.context(), null);
});

test("playback response updates the continuous reminder without waiting for a dashboard poll", async () => {
  const session = { seconds: 1500, limitSeconds: 1500, remainingSeconds: 0, overLimit: true };
  const page = await createPage({ tickSession: session });
  await page.controls.setCategory("recreation");
  page.play();
  page.pulse(5);
  await new Promise(setImmediate);
  assert.equal(page.rendered.recreationSession.seconds, 1500);
  assert.equal(page.rendered.recreationSession.overLimit, true);
});
