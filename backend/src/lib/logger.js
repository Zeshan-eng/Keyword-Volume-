/**
 * Minimal structured logger (JSON lines). Callers must never pass credentials;
 * search keywords are only logged at debug level.
 */
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

export function createLogger({
  level = 'info',
  write = (line) => process.stdout.write(line),
} = {}) {
  const threshold = LEVELS[level] ?? LEVELS.info;
  const log =
    (lvl) =>
    (event, fields = {}) => {
      if (LEVELS[lvl] < threshold) return;
      write(
        `${JSON.stringify({ time: new Date().toISOString(), level: lvl, event, ...fields })}\n`,
      );
    };
  return { debug: log('debug'), info: log('info'), warn: log('warn'), error: log('error') };
}

export const silentLogger = Object.freeze({
  debug() {},
  info() {},
  warn() {},
  error() {},
});
