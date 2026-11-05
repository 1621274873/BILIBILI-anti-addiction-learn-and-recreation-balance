export function clampRecreationLimit(minutes, fallback = 90) {
  const number = Number(minutes);
  const value = Number.isFinite(number) ? number : fallback;
  return Math.min(720, Math.max(0, Math.round(value)));
}

export function buildUsageSnapshot({
  day,
  limitMinutes,
  dateKey
}) {
  const normalizedLimit = clampRecreationLimit(limitMinutes);
  const limitSeconds = normalizedLimit * 60;
  const recreationSeconds = day.recreationSeconds;

  return {
    dateKey,
    educationSeconds: day.educationSeconds,
    recreationSeconds,
    limitMinutes: normalizedLimit,
    limitSeconds,
    remainingSeconds:
      limitSeconds > 0
        ? Math.max(0, limitSeconds - recreationSeconds)
        : null,
    overLimit:
      limitSeconds > 0 && recreationSeconds >= limitSeconds,
    warningIssued: day.warningIssued
  };
}

export function shouldIssueRecreationWarning({
  recreationSeconds,
  limitMinutes,
  warningIssued
}) {
  const limitSeconds = clampRecreationLimit(limitMinutes) * 60;

  return (
    limitSeconds > 0 &&
    recreationSeconds >= limitSeconds &&
    !warningIssued
  );
}
