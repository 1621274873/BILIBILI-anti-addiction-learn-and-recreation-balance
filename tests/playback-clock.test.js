import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const sandbox = vm.createContext({});
vm.runInContext(await readFile(new URL("../src/content/playback-clock.js", import.meta.url), "utf8"), sandbox);
const Clock = sandbox.BiliBalancePlaybackClock;
const sample = (now, mediaTime, options = {}) => ({ now, mediaTime, key: "video:education", rate: 1, eligible: true, ...options });

test("uses real viewing seconds at normal, double, and half speed", () => {
  for (const rate of [0.5, 1, 2]) {
    const clock = new Clock();
    clock.sample(sample(0, 100, { rate }));
    assert.equal(clock.sample(sample(5000, 100 + 5 * rate, { rate })), 5);
  }
});

test("skips stalled, seeking, hidden, unfocused, and sleeping intervals", () => {
  for (const next of [sample(5000, 100), sample(5000, 300), sample(5000, 105, { eligible: false }), sample(60000, 160)]) {
    const clock = new Clock();
    clock.sample(sample(0, 100));
    assert.equal(clock.sample(next), 0);
  }
});

test("resume, rate changes and new contexts always start a fresh baseline", () => {
  const clock = new Clock();
  clock.sample(sample(0, 10, { eligible: false }));
  assert.equal(clock.sample(sample(5000, 15)), 0);
  assert.equal(clock.sample(sample(10000, 20)), 5);
  assert.equal(clock.sample(sample(15000, 30, { rate: 2 })), 0);
  assert.equal(clock.sample(sample(20000, 40, { rate: 2 })), 5);
  assert.equal(clock.sample(sample(25000, 45, { key: "other" })), 0);
  clock.reset();
  assert.equal(clock.sample(sample(30000, 50)), 0);
});
