import test from 'node:test';
import assert from 'node:assert/strict';
import { groupSkips, header, renderJournal, renderPlan, renderResult, short } from '../src/format.js';
import { planGroom } from '../src/planner.js';
import { resolvePolicy } from '../src/policy.js';
import { summarize } from '../src/journal.js';
import { account, accounts, SIGNER } from './helpers.js';

test('shortens long addresses and leaves short ones alone', () => {
  assert.equal(short('Acct1111111111111111111111111111111111111111'), 'Acct11…11111');
  assert.equal(short('short'), 'short');
  assert.equal(short(undefined), '');
});

test('the header states the mode in plain words', () => {
  const dry = header({ wallet: 'W', cluster: 'devnet', endpoint: 'https://x', execute: false });
  assert.match(dry, /DRY RUN/);
  assert.doesNotMatch(dry, /EXECUTE/);

  const live = header({ wallet: 'W', cluster: 'devnet', endpoint: 'https://x', execute: true });
  assert.match(live, /EXECUTE/);
});

test('skips are grouped by reason, commonest first', () => {
  const grouped = groupSkips([
    { reason: 'frozen' },
    { reason: 'holds-balance' },
    { reason: 'holds-balance' },
    { reason: 'holds-balance' },
  ]);

  assert.deepEqual(grouped, [{ reason: 'holds-balance', count: 3 }, { reason: 'frozen', count: 1 }]);
});

test('the plan report shows the money and explains every skip', () => {
  const input = [...accounts(2), account({ address: 'Frozen', mint: 'MintF', state: 'frozen' })];
  const plan = planGroom({ accounts: input, policy: resolvePolicy(), memory: {}, signer: SIGNER });

  const text = renderPlan(plan, { scanned: input.length });

  assert.match(text, /scanned {3}3 token accounts/);
  assert.match(text, /RECLAIM/);
  assert.match(text, /LEFT ALONE/);
  assert.match(text, /frozen/);
  assert.match(text, /the token program will not close it/);
  assert.match(text, /net to wallet/);
  assert.match(text, /0\.002972 SOL/, 'two accounts of rent, minus one signature');
});

test('an empty plan renders without a reclaim block', () => {
  const plan = planGroom({ accounts: [], policy: resolvePolicy(), memory: {}, signer: SIGNER });
  const text = renderPlan(plan, { scanned: 0 });

  assert.match(text, /scanned {3}0 token accounts/);
  assert.doesNotMatch(text, /RECLAIM/);
});

test('the result report lists signatures and surfaces a failure', () => {
  const ok = renderResult({ signatures: ['sig1', 'sig2'], closed: [account(), account()], error: null });
  assert.match(ok, /sig1/);
  assert.match(ok, /closed 2 accounts/);

  const bad = renderResult({ signatures: [], closed: [], error: 'blockhash expired' });
  assert.match(bad, /blockhash expired/);
  assert.match(bad, /closed 0 accounts/);
});

test('the journal report totals a lifetime of runs', () => {
  const totals = summarize([
    { executed: true, closed: 3, reclaimLamports: 4_465_320, feeLamports: 5_000 },
  ]);

  const text = renderJournal(totals);

  assert.match(text, /accounts closed {5}3/);
  assert.match(text, /0\.004465 SOL/);
  assert.match(text, /net to wallet/);
});
