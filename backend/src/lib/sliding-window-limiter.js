/**
 * Strict "at most N events in any rolling window" limiter. Used to respect
 * DataForSEO's account-wide limit of 12 Google Ads Live requests per minute.
 */
export function createSlidingWindowLimiter({ limit, windowMs, now = Date.now }) {
  const timestamps = [];

  return {
    /** Records an event and returns true if it is allowed; returns false otherwise. */
    tryAcquire() {
      const current = now();
      while (timestamps.length && current - timestamps[0] >= windowMs) timestamps.shift();
      if (timestamps.length >= limit) return false;
      timestamps.push(current);
      return true;
    },
  };
}
