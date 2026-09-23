/**
 * The whole pipeline -- scan, plan, remember, journal -- against a faked RPC.
 * No network, but every module the real agent uses, wired the real way.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { Keypair } from '@solana/web3.js';
import { groomOnce } from '../src/agent.js';
import { resolvePolicy } from '../src/policy.js';
import { readRuns, summarize } from '../src/journal.js';
import { loadMemory, isQuarantined } from '../src/memory.js';
import { TOKEN_PROGRAM_ID } from '../src/constants.js';
import { tempDir } from './helpers.js';

const keypair = Keypair.generate();
const OWNER = keypair.publicKey.toBase58();

/** A connection that answers getParsedTokenAccountsByOwner from a fixture. */
function fakeConnection(rows) {
  return {
    calls: 0,
    async getParsedTokenAccountsByOwner(_owner, { programId }) {
      this.calls += 1;
      const wanted = programId.toBase58();
      return { value: rows.filter((row) => row.account.owner === wanted) };
    },
  };
}

function parsedRow({ address, mint, amount = '0', state = 'initialized', lamports = 2_039_280 }) {
  return {
    pubkey: address,
    account: {
      lamports,
      owner: TOKEN_PROGRAM_ID,
      data: { parsed: { type: 'account', info: { mint, owner: OWNER, state, tokenAmount: { amount, decimals: 6 } } } },
    },
  };
}

function makeConfig(dir, overrides = {}) {
  return {
    cluster: 'localnet',
    policy: resolvePolicy(overrides),
    memoryFile: path.join(dir, 'memory.json'),
    journalFile: path.join(dir, 'journal.jsonl'),
  };
}

test('a dry run plans, journals and signs nothing', async () => {
  const { dir, cleanup } = tempDir();
  try {
    // Arrange
    const connection = fakeConnection([
      parsedRow({ address: Keypair.generate().publicKey.toBase58(), mint: 'MintA' }),
      parsedRow({ address: Keypair.generate().publicKey.toBase58(), mint: 'MintB' }),
      parsedRow({ address: Keypair.generate().publicKey.toBase58(), mint: 'MintC', amount: '500' }),
    ]);
    const config = makeConfig(dir);

    // Act
    const { plan, scanned, result } = await groomOnce({ connection, keypair, config, execute: false });

    // Assert
    assert.equal(scanned, 3);
    assert.equal(plan.close.length, 2);
    assert.equal(plan.skipped.length, 1);
    assert.equal(result, null, 'nothing was sent');
    assert.equal(connection.calls, 2, 'both token programs were scanned');

    const runs = readRuns(config.journalFile);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].dryRun, true);
    assert.equal(runs[0].planned, 2);
    assert.equal(runs[0].closed, 0);
  } finally {
    cleanup();
  }
});

test('every run appends to the journal and the totals add up', async () => {
  const { dir, cleanup } = tempDir();
  try {
    const connection = fakeConnection([parsedRow({ address: Keypair.generate().publicKey.toBase58(), mint: 'MintA' })]);
    const config = makeConfig(dir);

    await groomOnce({ connection, keypair, config, execute: false });
    await groomOnce({ connection, keypair, config, execute: false });
    await groomOnce({ connection, keypair, config, execute: false });

    const totals = summarize(readRuns(config.journalFile));
    assert.equal(totals.runs, 3);
    assert.equal(totals.executed, 0, 'dry runs never count as having acted');
  } finally {
    cleanup();
  }
});

test('a mint that keeps reappearing is eventually quarantined and then left alone', async () => {
  const { dir, cleanup } = tempDir();
  try {
    const config = makeConfig(dir, { recurrenceLimit: 2 });
    const address = Keypair.generate().publicKey.toBase58();

    // A faked executor: the account closes, then the spammer recreates it.
    const connection = fakeConnection([parsedRow({ address, mint: 'MintSpam' })]);
    const closeEverything = async ({ plan }) => ({ signatures: ['sig'], closed: plan.close, error: null });

    for (let i = 0; i < 2; i += 1) {
      await groomOnce({ connection, keypair, config, execute: true, executeBatchesImpl: closeEverything });
    }

    const memory = loadMemory(config.memoryFile);
    assert.equal(memory.mints.MintSpam.closed, 2);
    assert.equal(isQuarantined(memory, 'MintSpam'), true);

    // Act: the third run sees the same account back again.
    const { plan } = await groomOnce({ connection, keypair, config, execute: true, executeBatchesImpl: closeEverything });

    // Assert: the agent refuses to pay another fee for it.
    assert.equal(plan.close.length, 0);
    assert.equal(plan.skipped[0].reason, 'quarantined-recurring');
  } finally {
    cleanup();
  }
});
