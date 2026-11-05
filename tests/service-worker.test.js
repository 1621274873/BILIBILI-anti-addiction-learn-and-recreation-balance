import test from "node:test";
import assert from "node:assert/strict";

const storage = new Map();
let messageListener = null;
let badgeText = "";
let activeContext = null;
let activeTabId = 10;
let requestedContextTabId = null;
const lifecycle = {};

globalThis.chrome = {
  storage: {
    local: {
      async get(key) {
        return { [key]: structuredClone(storage.get(key)) };
      },
      async set(value) {
        for (const [key, item] of Object.entries(value)) {
          storage.set(key, structuredClone(item));
        }
      }
    }
  },
  runtime: {
    onMessage: {
      addListener(listener) {
        messageListener = listener;
      }
    },
    onInstalled: {
      addListener(listener) { lifecycle.installed = listener; }
    },
    onStartup: {
      addListener(listener) { lifecycle.startup = listener; }
    }
  },
  tabs: {
    async query() {
      return [{ id: activeTabId }];
    },
    async sendMessage(_tabId, message) {
      requestedContextTabId = _tabId;
      if (message.type === "GET_CONTEXT") {
        return { context: activeContext };
      }

      if (
        message.type === "SET_CONTEXT_CATEGORY" &&
        activeContext?.contextId === message.contextId
      ) {
        activeContext = {
          ...activeContext,
          category: message.category
        };
        return { ok: true, context: activeContext };
      }

      return { ok: false, context: null };
    }
  },
  action: {
    async setBadgeBackgroundColor() {},
    async setBadgeText({ text }) {
      badgeText = text;
    },
    async setTitle() {}
  }
};

await import("../src/background/service-worker.js");

function dispatch(message, sender = {}) {
  return new Promise((resolve) => {
    messageListener(message, sender, resolve);
  });
}

test("tracks local video playback and rejects non-video pages", async () => {
  const sender = { tab: { id: 10 }, url: "https://www.bilibili.com/video/BVTEST123", frameId: 0 };
  const rawContext = {
    pageKey: "/video/BVTEST123",
    url: "https://www.bilibili.com/video/BVTEST123",
    kind: "video",
    bvid: "BVTEST123",
    title: "Python course",
    tname: "Technology",
    tags: ["Python", "programming course", "tutorial"]
  };
  const pageResponse = await dispatch(
    { type: "PAGE_INFO", context: rawContext },
    sender
  );

  assert.equal(pageResponse.ok, true);
  assert.equal(pageResponse.context.category, "education");
  activeContext = pageResponse.context;
  assert.equal(
    pageResponse.context.topic,
    "programming course / tutorial / Python"
  );

  const educationTick = await dispatch(
    {
      type: "VIDEO_TICK",
      seconds: 5,
      context: pageResponse.context
    },
    sender
  );

  assert.equal(educationTick.counted, true);
  assert.equal(educationTick.category, "education");
  assert.equal(educationTick.usage.educationSeconds, 5);

  const overrideResponse = await dispatch({
    type: "SET_CURRENT_CATEGORY",
    category: "recreation",
    contextId: pageResponse.context.contextId
  });

  assert.equal(overrideResponse.current.category, "recreation");

  const limitResponse = await dispatch({
    type: "SET_LIMIT",
    minutes: 1
  });

  assert.equal(limitResponse.settings.recreationLimitMinutes, 1);
  assert.equal(limitResponse.current.contextId, pageResponse.context.contextId);

  const firstTick = await dispatch(
    {
      type: "VIDEO_TICK",
      seconds: 20,
      context: overrideResponse.current
    },
    sender
  );
  const secondTick = await dispatch(
    {
      type: "VIDEO_TICK",
      seconds: 20,
      context: overrideResponse.current
    },
    sender
  );
  const crossing = await dispatch(
    {
      type: "VIDEO_TICK",
      seconds: 20,
      context: overrideResponse.current
    },
    sender
  );
  const afterWarning = await dispatch(
    {
      type: "VIDEO_TICK",
      seconds: 20,
      context: overrideResponse.current
    },
    sender
  );

  assert.equal(firstTick.warning, false);
  assert.equal(secondTick.warning, false);
  assert.equal(crossing.warning, true);
  assert.equal(crossing.usage.recreationSeconds, 60);
  assert.equal(crossing.usage.overLimit, true);
  assert.equal(afterWarning.warning, false);
  assert.equal(badgeText, "!");

  const articleResponse = await dispatch(
    {
      type: "PAGE_INFO",
      context: {
        pageKey: "/read/cv123",
        url: "https://www.bilibili.com/read/cv123",
        kind: "page",
        title: "Math article",
        tname: "Knowledge",
        tags: ["math", "science", "learning"]
      }
    },
    sender
  );

  assert.equal(articleResponse.context.category, "education");
  assert.equal(articleResponse.context.kind, "page");

  const articleTick = await dispatch(
    {
      type: "VIDEO_TICK",
      seconds: 5,
      context: articleResponse.context
    },
    sender
  );

  assert.equal(articleTick.counted, false);

  const storedState = storage.get("biliBalanceState");
  assert.equal(storedState.current, undefined);
  assert.equal(storedState.categoryOverrides, undefined);
});

test("rejects inactive tabs, other origins, frames, and globally paused tracking", async () => {
  const message = { type: "VIDEO_TICK", seconds: 5, context: activeContext };
  for (const sender of [
    { tab: { id: 11 }, url: "https://www.bilibili.com/video/BVTEST123" },
    { tab: { id: 10 }, url: "https://example.com/" },
    { tab: { id: 10 }, url: "https://www.bilibili.com/", frameId: 1 }
  ]) {
    assert.equal((await dispatch(message, sender)).counted, false);
  }
  const before = structuredClone(storage.get("biliBalanceState").days);
  await dispatch({ type: "SET_TRACKING", enabled: false });
  const sender = { tab: { id: 10 }, url: "https://www.bilibili.com/video/BVTEST123" };
  assert.equal((await dispatch(message, sender)).counted, false);
  assert.deepEqual(storage.get("biliBalanceState").days, before);
  await dispatch({ type: "SET_TRACKING", enabled: true });
  assert.equal((await dispatch(message, sender)).counted, true);
});

test("floating dashboards read their own tab, even when another tab is active", async () => {
  activeTabId = 99;
  const response = await dispatch({ type: "GET_DASHBOARD" }, {
    tab: { id: 10 }, url: "https://www.bilibili.com/video/BVTEST123"
  });
  assert.equal(response.ok, true);
  assert.equal(requestedContextTabId, 10);
  activeTabId = 10;
});

test("clearing history preserves settings and removes the warning badge", async () => {
  const response = await dispatch({ type: "CLEAR_HISTORY" });
  assert.equal(response.usage.educationSeconds, 0);
  assert.equal(response.usage.recreationSeconds, 0);
  assert.equal(response.settings.recreationLimitMinutes, 1);
  assert.equal(badgeText, "");
  assert.deepEqual(storage.get("biliBalanceState").days, {});
});

test("startup persists migration and removes records older than 30 calendar days", async () => {
  const { localDateKey, getState } = await import("../src/shared/storage.js");
  const today = new Date();
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  cutoff.setDate(cutoff.getDate() - 29);
  const expired = new Date(cutoff);
  expired.setDate(expired.getDate() - 1);
  storage.set("biliBalanceState", {
    version: 1,
    current: { title: "old metadata" },
    categoryOverrides: { BVTEST123: "education" },
    settings: { recreationLimitMinutes: 20 },
    days: Object.fromEntries([localDateKey(today), localDateKey(cutoff), localDateKey(expired), "2026-02-31", "9999-01-01"].map((key) => [key, { educationSeconds: 10 }]))
  });
  lifecycle.startup();
  await getState();
  const saved = storage.get("biliBalanceState");
  assert.equal(saved.version, 4);
  assert.equal(saved.current, undefined);
  assert.equal(saved.categoryOverrides, undefined);
  assert.equal(saved.settings.trackingEnabled, true);
  assert.deepEqual(Object.keys(saved.days).sort(), [localDateKey(cutoff), localDateKey(today)].sort());
  assert.deepEqual(saved.recreationSession, { seconds: 0, lastActivityAt: 0 });
});

test("25-minute reminder triggers once independently of the daily limit and expires after a break", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date(2026, 10, 3, 12).getTime() });
  storage.clear();
  await dispatch({ type: "SET_LIMIT", minutes: 0 });
  const sender = { tab: { id: 10 }, url: "https://www.bilibili.com/video/BVTEST123" };
  const tick = async () => {
    t.mock.timers.tick(5000);
    return dispatch({ type: "VIDEO_TICK", seconds: 5, context: { ...activeContext, category: "recreation" } }, sender);
  };
  let response;
  for (let index = 0; index < 299; index++) {
    response = await tick();
    assert.equal(response.sessionWarning, false);
  }
  assert.equal(response.recreationSession.seconds, 1495);
  assert.equal(response.recreationSession.overLimit, false);
  response = await tick();
  assert.equal(response.recreationSession.seconds, 1500);
  assert.equal(response.sessionWarning, true);
  assert.equal(response.usage.overLimit, false);
  assert.equal(badgeText, "!");
  response = await tick();
  assert.equal(response.sessionWarning, false);
  assert.equal(response.recreationSession.overLimit, true);
  t.mock.timers.tick(59999);
  assert.equal((await dispatch({ type: "GET_DASHBOARD" })).recreationSession.overLimit, true);
  t.mock.timers.tick(1);
  response = await dispatch({ type: "GET_DASHBOARD" });
  assert.equal(response.recreationSession.seconds, 0);
  assert.equal(response.recreationSession.overLimit, false);
  assert.equal(badgeText, "");
  response = await tick();
  assert.equal(response.recreationSession.seconds, 5);
  assert.equal(response.sessionWarning, false);
});

test("continuous recreation survives worker restart, a new video/tab and midnight", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date(2026, 10, 3, 23, 59, 58).getTime() });
  storage.clear();
  await dispatch({ type: "SET_LIMIT", minutes: 0 });
  const state = storage.get("biliBalanceState");
  state.recreationSession = { seconds: 1495, lastActivityAt: Date.now() };
  // Simulate the MV3 worker being recreated while the local snapshot survives.
  await import("../src/background/service-worker.js?restart=continuous-session");
  activeTabId = 11;
  try {
    t.mock.timers.tick(5000);
    const response = await dispatch({
      type: "VIDEO_TICK", seconds: 5,
      context: { ...activeContext, bvid: "BVOTHER", category: "recreation" }
    }, { tab: { id: 11 }, url: "https://www.bilibili.com/video/BVOTHER" });
    assert.equal(response.recreationSession.seconds, 1500);
    assert.equal(response.sessionWarning, true);
    assert.equal(response.usage.recreationSeconds, 3);
    const persisted = storage.get("biliBalanceState").recreationSession;
    assert.deepEqual(Object.keys(persisted).sort(), ["lastActivityAt", "seconds"]);
    assert.equal(persisted.seconds, 1500);
  } finally { activeTabId = 10; }
});

test("education, disabling tracking and clearing history reset the continuous session", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date(2026, 10, 3, 12).getTime() });
  storage.clear();
  const sender = { tab: { id: 10 }, url: "https://www.bilibili.com/video/BVTEST123" };
  const tick = async (category) => {
    t.mock.timers.tick(5000);
    return dispatch({ type: "VIDEO_TICK", seconds: 5, context: { ...activeContext, category } }, sender);
  };
  assert.equal((await tick("recreation")).recreationSession.seconds, 5);
  assert.equal((await tick("education")).recreationSession.seconds, 0);
  assert.equal((await tick("recreation")).recreationSession.seconds, 5);
  assert.equal((await dispatch({ type: "SET_TRACKING", enabled: false })).recreationSession.seconds, 0);
  await dispatch({ type: "SET_TRACKING", enabled: true });
  assert.equal((await tick("recreation")).recreationSession.seconds, 5);
  assert.equal((await dispatch({ type: "CLEAR_HISTORY" })).recreationSession.seconds, 0);
});

test("reporting across local midnight attributes seconds to the correct day", async (t) => {
  const instant = new Date(2026, 10, 3, 0, 0, 2);
  t.mock.timers.enable({ apis: ["Date"], now: instant.getTime() });
  storage.clear();
  const response = await dispatch({ type: "VIDEO_TICK", seconds: 5, context: activeContext }, {
    tab: { id: 10 }, url: "https://www.bilibili.com/video/BVTEST123"
  });
  assert.equal(response.counted, true);
  const days = storage.get("biliBalanceState").days;
  assert.equal(days["2026-11-02"].recreationSeconds, 3);
  assert.equal(days["2026-11-03"].recreationSeconds, 2);
});
