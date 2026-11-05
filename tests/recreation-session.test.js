import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceRecreationSession,
  normalizeRecreationSession,
  recreationSessionSnapshot
} from "../src/shared/recreation-session.js";

const now = 1800000000000;

test("continuous warning begins at 25 minutes, never before", () => {
  const before = { seconds: 1499, lastActivityAt: now - 1000 };
  assert.equal(recreationSessionSnapshot(before, now).overLimit, false);
  const after = advanceRecreationSession(before, { category: "recreation", seconds: 1, now });
  assert.equal(recreationSessionSnapshot(after, now).overLimit, true);
  assert.equal(recreationSessionSnapshot(after, now).remainingSeconds, 0);
});

test("short gaps preserve the session, a 60-second gap resets it", () => {
  const session = { seconds: 600, lastActivityAt: now };
  const shortGap = advanceRecreationSession(session, { category: "recreation", seconds: 5, now: now + 59000 });
  assert.equal(shortGap.seconds, 605);
  const breakTime = advanceRecreationSession(session, { category: "recreation", seconds: 5, now: now + 60000 });
  assert.equal(breakTime.seconds, 5);
  assert.equal(recreationSessionSnapshot(session, now + 60000).seconds, 0);
});

test("learning and invalid, expired or future state cannot preserve a session", () => {
  const session = { seconds: 1495, lastActivityAt: now };
  assert.equal(advanceRecreationSession(session, { category: "education", seconds: 5, now }).seconds, 0);
  for (const raw of [undefined, {}, { seconds: -1, lastActivityAt: now },
    { seconds: Infinity, lastActivityAt: now }, { seconds: 1500, lastActivityAt: now + 1 },
    { seconds: 1500, lastActivityAt: now - 60000 }]) {
    assert.deepEqual(normalizeRecreationSession(raw, now), { seconds: 0, lastActivityAt: 0 });
  }
});
