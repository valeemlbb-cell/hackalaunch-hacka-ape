import test from 'node:test';
import assert from 'node:assert/strict';
import { backoffDelay, jitter, runLoop } from '../src/loop.js';

/** A sleep that records what it was asked to wait rather than waiting. */
function fakeClock() {
  const waited = [];
  return { waited, sleep: async (ms) => { waited.push(ms); } };
}

test('backoff doubles and then flattens at the ceiling', () => {
  assert.equal(backoffDelay(0), 0);
  assert.equal(backoffDelay(1, { baseMs: 2_000, maxMs: 120_000 }), 2_000);
  assert.equal(backoffDelay(2, { baseMs: 2_000, maxMs: 120_000 }), 4_000);
  assert.equal(backoffDelay(3, { baseMs: 2_000, maxMs: 120_000 }), 8_000);
  assert.equal(backoffDelay(20, { baseMs: 2_000, maxMs: 120_000 }), 120_000, 'never runs away');
});

test('jitter stays inside the band around the interval', () => {
  assert.equal(jitter(10_000, 0.1, () => 0), 9_500);
  assert.equal(jitter(10_000, 0.1, () => 1), 10_500);
  assert.equal(jitter(10_000, 0.1, () => 0.5), 10_000);
});

test('jitter never returns a negative delay', () => {
  assert.equal(jitter(0, 0.5, () => 0), 0);
});

test('runs the requested number of cycles and sleeps between them', async () => {
  // Arrange
  const clock = fakeClock();
  let calls = 0;

  // Act
  const summary = await runLoop(
    { runOnce: async () => { calls += 1; return { ok: true }; }, sleep: clock.sleep, random: () => 0.5 },
    { intervalMs: 60_000, maxRuns: 3 },
  );

  // Assert
  assert.equal(calls, 3);
  assert.equal(summary.runs, 3);
  assert.equal(summary.failures, 0);
  assert.equal(summary.stoppedBecause, 'max-runs');
  assert.deepEqual(clock.waited, [60_000, 60_000], 'no trailing sleep after the last run');
});

test('a failing cycle backs off instead of hammering the endpoint', async () => {
  const clock = fakeClock();

  await runLoop(
    { runOnce: async () => ({ ok: false, error: 'rpc down' }), sleep: clock.sleep, random: () => 0.5 },
    { intervalMs: 60_000, maxRuns: 3, baseBackoffMs: 1_000, maxBackoffMs: 10_000 },
  );

  assert.deepEqual(clock.waited, [1_000, 2_000], 'delays grow while it keeps failing');
});

test('the circuit breaker stops the agent after repeated failures', async () => {
  const clock = fakeClock();
  const events = [];

  const summary = await runLoop(
    {
      runOnce: async () => ({ ok: false, error: 'rpc down' }),
      sleep: clock.sleep,
      log: (event) => events.push(event.type),
      random: () => 0.5,
    },
    { intervalMs: 60_000, maxRuns: 100, maxConsecutiveFailures: 3 },
  );

  assert.equal(summary.runs, 3);
  assert.equal(summary.failures, 3);
  assert.equal(summary.stoppedBecause, 'circuit-breaker');
  assert.ok(events.includes('circuit-open'));
});

test('a recovery resets the failure streak', async () => {
  const clock = fakeClock();
  const outcomes = [false, false, true, false, false];
  let i = 0;

  const summary = await runLoop(
    {
      runOnce: async () => ({ ok: outcomes[i++], error: 'flaky' }),
      sleep: clock.sleep,
      random: () => 0.5,
    },
    { intervalMs: 60_000, maxRuns: 5, maxConsecutiveFailures: 3 },
  );

  assert.equal(summary.stoppedBecause, 'max-runs', 'the good run in the middle cleared the streak');
  assert.equal(summary.failures, 4);
});

test('a thrown error is caught and counted, not allowed to kill the loop', async () => {
  const clock = fakeClock();

  const summary = await runLoop(
    {
      runOnce: async () => { throw new Error('boom'); },
      sleep: clock.sleep,
      random: () => 0.5,
    },
    { intervalMs: 60_000, maxRuns: 2, maxConsecutiveFailures: 5 },
  );

  assert.equal(summary.runs, 2);
  assert.equal(summary.failures, 2);
});
