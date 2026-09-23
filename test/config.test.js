import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ConfigError, assertNotMainnet, loadConfig, parsePolicyEnv, readKeypairFile, resolveEndpoint } from '../src/config.js';
import { tempDir } from './helpers.js';

test('refuses anything that looks like mainnet', () => {
  assert.throws(() => assertNotMainnet('https://api.mainnet-beta.solana.com'), ConfigError);
  assert.throws(() => assertNotMainnet('https://my-node.MAINNET.example.com'), ConfigError);
  assert.throws(() => resolveEndpoint({ rpcUrl: 'https://rpc.mainnet.example/x' }), ConfigError);
});

test('allows the clusters this agent is meant for', () => {
  assert.doesNotThrow(() => assertNotMainnet('https://api.devnet.solana.com'));
  assert.doesNotThrow(() => assertNotMainnet('http://127.0.0.1:8899'));
});

test('devnet is the default cluster', () => {
  assert.deepEqual(resolveEndpoint(), { cluster: 'devnet', endpoint: 'https://api.devnet.solana.com' });
});

test('resolves named clusters and rejects unknown ones', () => {
  assert.equal(resolveEndpoint({ cluster: 'localnet' }).endpoint, 'http://127.0.0.1:8899');
  assert.throws(() => resolveEndpoint({ cluster: 'moonnet' }), ConfigError);
});

test('an explicit rpc url wins over the cluster name', () => {
  const resolved = resolveEndpoint({ cluster: 'devnet', rpcUrl: 'http://127.0.0.1:8799' });
  assert.equal(resolved.endpoint, 'http://127.0.0.1:8799');
});

test('reads a keypair file of raw bytes', () => {
  const { dir, cleanup } = tempDir();
  try {
    const file = path.join(dir, 'key.json');
    fs.writeFileSync(file, JSON.stringify(Array.from({ length: 64 }, (_, i) => i % 256)));

    const bytes = readKeypairFile(file);

    assert.equal(bytes.length, 64);
  } finally {
    cleanup();
  }
});

test('explains clearly when the keypair is missing or malformed', () => {
  const { dir, cleanup } = tempDir();
  try {
    assert.throws(() => readKeypairFile(path.join(dir, 'nope.json')), ConfigError);

    const notJson = path.join(dir, 'bad.json');
    fs.writeFileSync(notJson, 'hello');
    assert.throws(() => readKeypairFile(notJson), ConfigError);

    const wrongLength = path.join(dir, 'short.json');
    fs.writeFileSync(wrongLength, '[1,2,3]');
    assert.throws(() => readKeypairFile(wrongLength), ConfigError);
  } finally {
    cleanup();
  }
});

test('policy env is optional and must be valid JSON when present', () => {
  assert.deepEqual(parsePolicyEnv(undefined), {});
  assert.deepEqual(parsePolicyEnv('   '), {});
  assert.deepEqual(parsePolicyEnv('{"batchSize":4}'), { batchSize: 4 });
  assert.throws(() => parsePolicyEnv('{nope}'), ConfigError);
});

test('execute stays off unless the environment says exactly true', () => {
  const base = { APE_CLUSTER: 'devnet' };
  assert.equal(loadConfig(base).executeAllowed, false);
  assert.equal(loadConfig({ ...base, APE_EXECUTE: 'yes' }).executeAllowed, false);
  assert.equal(loadConfig({ ...base, APE_EXECUTE: 'TRUE' }).executeAllowed, true);
});

test('cli flags win over the environment', () => {
  const config = loadConfig(
    { APE_CLUSTER: 'devnet', APE_POLICY: '{"batchSize":4}' },
    { cluster: 'localnet', batchSize: 7 },
  );

  assert.equal(config.cluster, 'localnet');
  assert.equal(config.policy.batchSize, 7);
});

test('state files live under the state directory', () => {
  const config = loadConfig({ APE_STATE_DIR: path.join('tmp', 'ape-state') });
  assert.equal(config.memoryFile, path.join('tmp', 'ape-state', 'memory.json'));
  assert.equal(config.journalFile, path.join('tmp', 'ape-state', 'journal.jsonl'));
});
