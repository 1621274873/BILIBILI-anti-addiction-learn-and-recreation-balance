(() => {
  // No timers, page access, or storage here: only compare consecutive samples.
  class PlaybackClock {
    previous = null;

    reset() {
      this.previous = null;
    }

    sample(next) {
      const previous = this.previous;
      this.previous = { ...next };
      if (!previous || !previous.eligible || !next.eligible ||
          previous.key !== next.key || previous.rate !== next.rate) {
        return 0;
      }

      const elapsed = (next.now - previous.now) / 1000;
      const mediaDelta = next.mediaTime - previous.mediaTime;
      if (![elapsed, mediaDelta, next.rate].every(Number.isFinite) ||
          elapsed <= 0 || elapsed > 20 || mediaDelta <= 0 || next.rate <= 0 ||
          mediaDelta > elapsed * next.rate + 0.75) {
        return 0;
      }

      // At 2x speed, two media seconds represent one second of viewing.
      return Math.min(elapsed, mediaDelta / next.rate);
    }
  }

  globalThis.BiliBalancePlaybackClock = PlaybackClock;
})();
