import { normalizeSeconds } from "./model.js";
import { clampRecreationLimit } from "./usage.js";
import { emptyRecreationSession, normalizeRecreationSession } from "./recreation-session.js";

export const STORAGE_KEY = "biliBalanceState";
export const STATE_VERSION = 4;
export const DEFAULT_RECREATION_LIMIT_MINUTES = 90;
const MAX_HISTORY_DAYS = 30;

function createDefaultState() {
  return {
    version: STATE_VERSION,
    settings: {
      recreationLimitMinutes: DEFAULT_RECREATION_LIMIT_MINUTES,
      trackingEnabled: true
    },
    days: {},
    recreationSession: emptyRecreationSession()
  };
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function normalizeState(rawState) {
  const defaults = createDefaultState();
  const raw = plainObject(rawState);
  const rawSettings = plainObject(raw.settings);
  const rawDays = plainObject(raw.days);
  const state = {
    version: STATE_VERSION,
    settings: {
      recreationLimitMinutes: clampRecreationLimit(
        rawSettings.recreationLimitMinutes,
        defaults.settings.recreationLimitMinutes
      ),
      trackingEnabled: rawSettings.trackingEnabled !== false
    },
    days: {},
    recreationSession: rawSettings.trackingEnabled === false
      ? emptyRecreationSession()
      : normalizeRecreationSession(raw.recreationSession)
  };

  for (const [dateKey, rawDay] of Object.entries(rawDays)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !rawDay) {
      continue;
    }

    const day = plainObject(rawDay);
    state.days[dateKey] = {
      educationSeconds: normalizeSeconds(day.educationSeconds),
      recreationSeconds: normalizeSeconds(day.recreationSeconds),
      warningIssued: Boolean(day.warningIssued)
    };
  }

  return state;
}

function pruneState(state) {
  const today = new Date();
  const oldest = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  oldest.setDate(oldest.getDate() - MAX_HISTORY_DAYS + 1);
  const cutoff = localDateKey(oldest);
  const latest = localDateKey(today);
  const recentDays = Object.keys(state.days).filter((key) => {
    const parsed = new Date(`${key}T12:00:00`);
    return Number.isFinite(parsed.getTime()) && localDateKey(parsed) === key &&
      key >= cutoff && key <= latest;
  }).sort();
  const prunedDays = {};

  for (const key of recentDays) {
    prunedDays[key] = state.days[key];
  }

  state.days = prunedDays;
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ensureDay(state, date = new Date()) {
  const dateKey = localDateKey(date);

  if (!state.days[dateKey]) {
    state.days[dateKey] = {
      educationSeconds: 0,
      recreationSeconds: 0,
      warningIssued: false
    };
  }

  return state.days[dateKey];
}

export async function readState() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const state = normalizeState(stored[STORAGE_KEY]);
  pruneState(state);
  return state;
}

let writeQueue = Promise.resolve();

export function updateState(mutator) {
  const operation = writeQueue
    .catch(() => undefined)
    .then(async () => {
      const state = await readState();
      const result = mutator(state);
      pruneState(state);
      await chrome.storage.local.set({ [STORAGE_KEY]: state });
      return { state, result };
    });

  writeQueue = operation.then(
    () => undefined,
    () => undefined
  );

  return operation;
}

export async function getState() {
  // Serialize read/cleanup with writes so an expired or migrated schema cannot
  // overwrite a concurrently recorded interval. Unchanged reads do not write.
  const operation = writeQueue.catch(() => undefined).then(async () => {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const state = normalizeState(stored[STORAGE_KEY]);
    pruneState(state);
    if (JSON.stringify(stored[STORAGE_KEY]) !== JSON.stringify(state)) {
      await chrome.storage.local.set({ [STORAGE_KEY]: state });
    }
    return state;
  });
  writeQueue = operation.then(() => undefined, () => undefined);
  return operation;
}
