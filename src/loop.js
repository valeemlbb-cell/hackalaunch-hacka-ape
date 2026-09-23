/**
 * The autonomous part: keep grooming on an interval, survive a flaky RPC, and
 * know when to give up instead of hammering a dead endpoint forever.
 *
 * Every dependency (the work, the clock, the logger, the randomness) is
 * injected, so the whole control flow is testable without a network or a wait.
 */

/**
 * Exponential backoff with a ceiling.
 *
 * @param {number} failures consecutive failures so far (1 = first failure)
 * @param {{baseMs?: number, maxMs?: number}} [options]
 * @returns {number} milliseconds to wait
 */
export function backoffDelay(failures, { baseMs = 2_000, maxMs = 120_000 } = {}) {
  if (failures <= 0) return 0;
  const raw = baseMs * 2 ** (failures - 1);
  return Math.min(raw, maxMs);
}

/**
 * Spread runs out slightly so many agents do not all hit the RPC on the same
 * tick. Deterministic when you inject `random`.
 *
 * @param {number} intervalMs
 * @param {number} jitterRatio
 * @param {() => number} random
 * @returns {number}
 */
export function jitter(intervalMs, jitterRatio = 0.1, random = Math.random) {
  const spread = intervalMs * jitterRatio;
  return Math.max(0, Math.round(intervalMs - spread / 2 + random() * spread));
}

/**
 * Run `runOnce` forever (or `maxRuns` times), backing off on failure and
 * tripping a circuit breaker after too many failures in a row.
 *
 * @param {object} deps
 * @param {() => Promise<{ok: boolean, error?: string}>} deps.runOnce
 * @param {(ms: number) => Promise<void>} deps.sleep
 * @param {(event: object) => void} [deps.log]
 * @param {() => number} [deps.random]
 * @param {object} [options]
 * @param {number} [options.intervalMs]
 * @param {number} [options.maxRuns] Infinity by default
 * @param {number} [options.maxConsecutiveFailures]
 * @param {number} [options.baseBackoffMs]
 * @param {number} [options.maxBackoffMs]
 * @returns {Promise<{runs: number, failures: number, stoppedBecause: string}>}
 */
export async function runLoop(
  { runOnce, sleep, log = () => {}, random = Math.random },
  {
    intervalMs = 300_000,
    maxRuns = Infinity,
    maxConsecutiveFailures = 5,
    baseBackoffMs = 2_000,
    maxBackoffMs = 120_000,
  } = {},
) {
  let runs = 0;
  let failures = 0;
  let consecutive = 0;

  while (runs < maxRuns) {
    let result;
    try {
      result = await runOnce();
    } catch (error) {
      result = { ok: false, error: error.message };
    }
    runs += 1;

    if (result.ok) {
      consecutive = 0;
    } else {
      failures += 1;
      consecutive += 1;
      log({ type: 'run-failed', run: runs, consecutive, error: result.error });

      if (consecutive >= maxConsecutiveFailures) {
        log({ type: 'circuit-open', run: runs, consecutive });
        return { runs, failures, stoppedBecause: 'circuit-breaker' };
      }
    }

    if (runs >= maxRuns) break;

    const delay = consecutive > 0
      ? backoffDelay(consecutive, { baseMs: baseBackoffMs, maxMs: maxBackoffMs })
      : jitter(intervalMs, 0.1, random);

    log({ type: 'sleeping', run: runs, ms: delay, backingOff: consecutive > 0 });
    await sleep(delay);
  }

  return { runs, failures, stoppedBecause: 'max-runs' };
}
