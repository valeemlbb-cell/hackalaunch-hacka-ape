import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_POLICY, PolicyError, resolvePolicy } from '../src/policy.js';

test('defaults are the cautious ones', () => {
  const policy = resolvePolicy();
  assert.equal(policy.includeWrappedSol, false, 'wrapped SOL is opt-in');
  assert.equal(policy.requireNetGain, true, 'never act at a loss by default');
  assert.deepEqual(policy.protectedMints, []);
  assert.equal(policy.maxAccountsPerRun, DEFAULT_POLICY.maxAccountsPerRun);
});

test('overrides merge over the defaults', () => {
  const policy = resolvePolicy({ batchSize: 5, includeWrappedSol: true });
  assert.equal(policy.batchSize, 5);
  assert.equal(policy.includeWrappedSol, true);
  assert.equal(policy.recurrenceLimit, DEFAULT_POLICY.recurrenceLimit, 'untouched fields keep their default');
});

test('the returned policy is frozen so nothing can mutate it mid-run', () => {
  const policy = resolvePolicy();
  assert.throws(() => {
    'use strict';
    policy.batchSize = 99;
  }, TypeError);
});

test('rejects an unknown field instead of silently ignoring a typo', () => {
  assert.throws(() => resolvePolicy({ batchSiz: 5 }), PolicyError);
});

test('rejects out-of-range and non-integer numbers', () => {
  assert.throws(() => resolvePolicy({ batchSize: 0 }), PolicyError);
  assert.throws(() => resolvePolicy({ batchSize: 21 }), PolicyError);
  assert.throws(() => resolvePolicy({ maxAccountsPerRun: 1.5 }), PolicyError);
  assert.throws(() => resolvePolicy({ minReclaimLamports: -1 }), PolicyError);
});

test('rejects a non-boolean switch', () => {
  assert.throws(() => resolvePolicy({ includeWrappedSol: 'yes' }), PolicyError);
});

test('rejects a malformed protected mint list', () => {
  assert.throws(() => resolvePolicy({ protectedMints: 'MintA' }), PolicyError);
  assert.throws(() => resolvePolicy({ protectedMints: [''] }), PolicyError);
});

test('rejects a batch larger than the run cap, which could never be filled', () => {
  assert.throws(() => resolvePolicy({ batchSize: 10, maxAccountsPerRun: 5 }), PolicyError);
});

test('rejects a non-object override', () => {
  assert.throws(() => resolvePolicy([1, 2]), PolicyError);
  assert.throws(() => resolvePolicy(null), PolicyError);
});
