export const RECREATION_SESSION_LIMIT_SECONDS = 25 * 60;
export const RECREATION_BREAK_MS = 60 * 1000;

export function emptyRecreationSession() {
  return { seconds: 0, lastActivityAt: 0 };
}

export function normalizeRecreationSession(raw, now = Date.now()) {
  // One shared local snapshot survives page navigation and MV3 worker suspension.
  // Inactivity is measured from the last accepted foreground playback report.
  const seconds = Number(raw?.seconds);
  const lastActivityAt = Number(raw?.lastActivityAt);
  if (!Number.isSafeInteger(seconds) || seconds <= 0 ||
      !Number.isSafeInteger(lastActivityAt) || lastActivityAt <= 0 ||
      lastActivityAt > now || now - lastActivityAt >= RECREATION_BREAK_MS) {
    return emptyRecreationSession();
  }
  return { seconds, lastActivityAt };
}

export function advanceRecreationSession(raw, { category, seconds, now = Date.now() }) {
  if (category !== "recreation") return emptyRecreationSession();
  const session = normalizeRecreationSession(raw, now);
  return { seconds: session.seconds + seconds, lastActivityAt: now };
}

export function recreationSessionSnapshot(raw, now = Date.now()) {
  const session = normalizeRecreationSession(raw, now);
  return {
    seconds: session.seconds,
    limitSeconds: RECREATION_SESSION_LIMIT_SECONDS,
    remainingSeconds: Math.max(0, RECREATION_SESSION_LIMIT_SECONDS - session.seconds),
    overLimit: session.seconds >= RECREATION_SESSION_LIMIT_SECONDS,
    expiresAt: session.lastActivityAt ? session.lastActivityAt + RECREATION_BREAK_MS : 0
  };
}
