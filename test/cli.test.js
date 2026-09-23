import test from 'node:test';
import assert from 'node:assert/strict';
import { main, parseArgs } from '../src/cli.js';
import { ConfigError } from '../src/config.js';

test('defaults to help with no arguments', () => {
  assert.deepEqual(parseArgs([]), { command: 'help', flags: {} });
});

test('parses a command with value flags', () => {
  const { command, flags } = parseArgs(['run', '--cluster', 'localnet', '--batch-size', '5']);
  assert.equal(command, 'run');
  assert.equal(flags.cluster, 'localnet');
  assert.equal(flags.batchSize, 5);
});

test('parses boolean flags without a value', () => {
  const { flags } = parseArgs(['run', '--execute', '--include-wsol', '--json']);
  assert.equal(flags.execute, true);
  assert.equal(flags.includeWrappedSol, true);
  assert.equal(flags.json, true);
});

test('maps dashed flag names onto policy field names', () => {
  const { flags } = parseArgs(['plan', '--min-reclaim', '2000000', '--max-accounts', '10', '--rpc-url', 'http://x']);
  assert.equal(flags.minReclaimLamports, 2_000_000);
  assert.equal(flags.maxAccountsPerRun, 10);
  assert.equal(flags.rpcUrl, 'http://x');
});

test('rejects a stray positional argument', () => {
  assert.throws(() => parseArgs(['run', 'oops']), ConfigError);
});

test('rejects a value flag with no value', () => {
  assert.throws(() => parseArgs(['run', '--cluster']), ConfigError);
  assert.throws(() => parseArgs(['run', '--cluster', '--execute']), ConfigError);
});

test('rejects a non-numeric value where a number is required', () => {
  assert.throws(() => parseArgs(['run', '--batch-size', 'lots']), ConfigError);
});

test('help exits cleanly and describes the commands', async () => {
  const lines = [];
  const code = await main(['help'], { env: {}, out: (line) => lines.push(line) });

  assert.equal(code, 0);
  const text = lines.join('\n');
  assert.match(text, /ape scan/);
  assert.match(text, /ape loop/);
  assert.match(text, /mainnet is refused/);
});

test('a missing keypair fails with an actionable message, not a stack trace', async () => {
  const lines = [];
  const code = await main(['plan'], { env: { APE_CLUSTER: 'devnet' }, out: (line) => lines.push(line) });

  assert.equal(code, 1);
  assert.match(lines.join('\n'), /APE_KEYPAIR/);
});

test('pointing the agent at mainnet is refused before anything is loaded', async () => {
  const lines = [];
  const code = await main(['plan', '--rpc-url', 'https://api.mainnet-beta.solana.com'], {
    env: {},
    out: (line) => lines.push(line),
  });

  assert.equal(code, 1);
  assert.match(lines.join('\n'), /mainnet/i);
});

test('an unknown command is reported rather than silently doing nothing', async () => {
  const lines = [];
  const code = await main(['yeet'], { env: { APE_CLUSTER: 'devnet' }, out: (line) => lines.push(line) });

  assert.equal(code, 1);
});
