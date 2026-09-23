import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEntry } from '../src/agent.js';
import { planGroom } from '../src/planner.js';
import { resolvePolicy } from '../src/policy.js';
import { accounts, SIGNER, RENT } from './helpers.js';

const config = { cluster: 'devnet', policy: resolvePolicy() };

function planFor(count) {
  return planGroom({ accounts: accounts(count), policy: config.policy, memory: {}, signer: SIGNER });
}

test('a dry run is journalled as having acted on nothing', () => {
  const entry = buildEntry({
    startedAt: 'a', finishedAt: 'b', signer: SIGNER, config,
    plan: planFor(3), result: null, scanned: 5, execute: false,
  });

  assert.equal(entry.dryRun, true);
  assert.equal(entry.executed, false);
  assert.equal(entry.planned, 3);
  assert.equal(entry.closed, 0);
  assert.equal(entry.reclaimLamports, 0);
  assert.deepEqual(entry.signatures, []);
});

test('an executed run records what was actually closed, not what was planned', () => {
  const plan = planFor(3);
  const result = { signatures: ['sig1'], closed: plan.close.slice(0, 2), error: null };

  const entry = buildEntry({
    startedAt: 'a', finishedAt: 'b', signer: SIGNER, config,
    plan, result, scanned: 5, execute: true,
  });

  assert.equal(entry.executed, true);
  assert.equal(entry.dryRun, false);
  assert.equal(entry.planned, 3);
  assert.equal(entry.closed, 2, 'only the batch that landed counts');
  assert.equal(entry.reclaimLamports, RENT * 2);
  assert.equal(entry.feeLamports, 5_000);
  assert.deepEqual(entry.signatures, ['sig1']);
});

test('a failed execution is journalled with its error and marked as not executed', () => {
  const plan = planFor(2);
  const result = { signatures: [], closed: [], error: 'blockhash not found' };

  const entry = buildEntry({
    startedAt: 'a', finishedAt: 'b', signer: SIGNER, config,
    plan, result, scanned: 2, execute: true,
  });

  assert.equal(entry.executed, false);
  assert.equal(entry.error, 'blockhash not found');
  assert.equal(entry.feeLamports, 0);
});

test('the entry carries the wallet and cluster so the journal is auditable', () => {
  const entry = buildEntry({
    startedAt: 'a', finishedAt: 'b', signer: SIGNER, config,
    plan: planFor(1), result: null, scanned: 1, execute: false,
  });

  assert.equal(entry.wallet, SIGNER);
  assert.equal(entry.cluster, 'devnet');
  assert.equal(entry.startedAt, 'a');
  assert.equal(entry.finishedAt, 'b');
});
