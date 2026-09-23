import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, planGroom } from '../src/planner.js';
import { resolvePolicy } from '../src/policy.js';
import { SKIP_REASONS } from '../src/constants.js';
import { account, accounts, SIGNER, RENT } from './helpers.js';

const policy = resolvePolicy();
const context = { policy, memory: {}, signer: SIGNER };

test('closes an empty, unfrozen, owned token account', () => {
  assert.equal(decide(account(), context), null);
});

test('refuses to touch a frozen account, which the token program cannot close', () => {
  assert.equal(decide(account({ state: 'frozen' }), context), SKIP_REASONS.FROZEN);
});

test('skips an uninitialized account', () => {
  assert.equal(decide(account({ state: 'uninitialized' }), context), SKIP_REASONS.UNINITIALIZED);
});

test('never closes an account that still holds tokens', () => {
  assert.equal(decide(account({ amount: '1250000000' }), context), SKIP_REASONS.HOLDS_BALANCE);
});

test('leaves wrapped SOL alone unless it is explicitly opted in', () => {
  const wsol = account({ isNative: true, amount: '900000' });
  assert.equal(decide(wsol, context), SKIP_REASONS.WRAPPED_SOL);

  const opted = { ...context, policy: resolvePolicy({ includeWrappedSol: true }) };
  assert.equal(decide(wsol, opted), null, 'a native account with a balance is still closable');
});

test('will not act when the close authority belongs to somebody else', () => {
  assert.equal(decide(account({ closeAuthority: 'SomeoneElse' }), context), SKIP_REASONS.CLOSE_AUTHORITY);
  assert.equal(decide(account({ owner: 'SomeoneElse' }), context), SKIP_REASONS.CLOSE_AUTHORITY);
  assert.equal(decide(account({ closeAuthority: SIGNER, owner: 'SomeoneElse' }), context), null);
});

test('backs off when a delegate still has an allowance', () => {
  assert.equal(decide(account({ delegate: 'Dele', delegatedAmount: '5' }), context), SKIP_REASONS.ACTIVE_DELEGATE);
  assert.equal(decide(account({ delegate: 'Dele', delegatedAmount: '0' }), context), null);
});

test('honours the protected mint list', () => {
  const protectedPolicy = resolvePolicy({ protectedMints: ['MintKeep'] });
  const target = account({ mint: 'MintKeep' });
  assert.equal(decide(target, { ...context, policy: protectedPolicy }), SKIP_REASONS.PROTECTED_MINT);
});

test('respects a quarantined mint so it stops paying fees in a spam loop', () => {
  const memory = { mints: { MintSpam: { closed: 3, quarantined: true } } };
  assert.equal(decide(account({ mint: 'MintSpam' }), { ...context, memory }), SKIP_REASONS.QUARANTINED);
});

test('ignores rent below the minimum worth reclaiming', () => {
  const thrifty = resolvePolicy({ minReclaimLamports: 2_000_000 });
  assert.equal(decide(account(), { ...context, policy: thrifty }), SKIP_REASONS.BELOW_THRESHOLD);
});

test('plan separates closable accounts from the rest and does the money maths', () => {
  // Arrange
  const input = [
    ...accounts(3),
    account({ address: 'Frozen', mint: 'MintF', state: 'frozen' }),
    account({ address: 'Held', mint: 'MintH', amount: '10' }),
  ];

  // Act
  const plan = planGroom({ accounts: input, policy, memory: {}, signer: SIGNER });

  // Assert
  assert.equal(plan.close.length, 3);
  assert.equal(plan.skipped.length, 2);
  assert.equal(plan.batches, 1);
  assert.equal(plan.reclaimLamports, RENT * 3);
  assert.equal(plan.feeLamports, 5_000);
  assert.equal(plan.netLamports, RENT * 3 - 5_000);
  assert.equal(plan.profitable, true);
});

test('takes the richest accounts first when the run cap bites', () => {
  const input = [
    account({ address: 'Small', mint: 'M1', lamports: 1_000_000 }),
    account({ address: 'Big', mint: 'M2', lamports: 9_000_000 }),
    account({ address: 'Mid', mint: 'M3', lamports: 4_000_000 }),
  ];
  const capped = resolvePolicy({ maxAccountsPerRun: 2, batchSize: 2 });

  const plan = planGroom({ accounts: input, policy: capped, memory: {}, signer: SIGNER });

  assert.deepEqual(plan.close.map((a) => a.address), ['Big', 'Mid']);
  assert.equal(plan.skipped.length, 1);
  assert.equal(plan.skipped[0].reason, SKIP_REASONS.OVER_RUN_CAP);
});

test('splits a large plan across transactions', () => {
  const plan = planGroom({
    accounts: accounts(25),
    policy: resolvePolicy({ maxAccountsPerRun: 25, batchSize: 12 }),
    memory: {},
    signer: SIGNER,
  });
  assert.equal(plan.close.length, 25);
  assert.equal(plan.batches, 3);
  assert.equal(plan.feeLamports, 15_000);
});

test('refuses a run where the fee would outweigh the rent reclaimed', () => {
  const dust = [account({ lamports: 1_000 })];
  const plan = planGroom({ accounts: dust, policy, memory: {}, signer: SIGNER });

  assert.equal(plan.close.length, 0, 'nothing is closed at a loss');
  assert.equal(plan.profitable, false);
  assert.equal(plan.netLamports, 0);
});

test('an empty wallet produces an empty, unprofitable, harmless plan', () => {
  const plan = planGroom({ accounts: [], policy, memory: {}, signer: SIGNER });
  assert.deepEqual(plan.close, []);
  assert.equal(plan.batches, 0);
  assert.equal(plan.feeLamports, 0);
  assert.equal(plan.profitable, false);
});
