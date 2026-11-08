/** Shared test utilities. Fixtures are used only in tests, never at runtime. */
import { readFileSync } from 'node:fs';

export function loadFixture(name) {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
}

/** A fake fetch that records calls and replies from a queue of responders. */
export function createFakeFetch(...responders) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const responder = responders[Math.min(calls.length - 1, responders.length - 1)];
    return responder(url, init);
  };
  return { fetchImpl, calls };
}

export const jsonResponse =
  (body, status = 200) =>
  () =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export function createManualClock(start = Date.parse('2026-11-08T12:00:00Z')) {
  let current = start;
  return {
    now: () => current,
    advance: (ms) => {
      current += ms;
    },
  };
}
