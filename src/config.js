/**
 * Turning the environment into a validated run configuration -- including the
 * guard that refuses to point this agent at mainnet.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { CLUSTERS, MAINNET_MARKERS } from './constants.js';
import { resolvePolicy } from './policy.js';

export class ConfigError extends Error {}

/**
 * Refuse to run against real money. This is a hackathon agent that signs
 * transactions on a loop; mainnet is simply not one of its options.
 *
 * @param {string} endpoint
 */
export function assertNotMainnet(endpoint) {
  const haystack = endpoint.toLowerCase();
  if (MAINNET_MARKERS.some((marker) => haystack.includes(marker))) {
    throw new ConfigError(
      `refusing to run against what looks like mainnet (${endpoint}). ` +
        'ape-groom is devnet/localnet only by design.',
    );
  }
}

/**
 * Work out which RPC endpoint to use.
 *
 * @param {{cluster?: string, rpcUrl?: string}} input
 * @returns {{cluster: string, endpoint: string}}
 */
export function resolveEndpoint({ cluster, rpcUrl } = {}) {
  if (rpcUrl) {
    assertNotMainnet(rpcUrl);
    return { cluster: cluster ?? 'custom', endpoint: rpcUrl };
  }
  const name = cluster ?? 'devnet';
  const endpoint = CLUSTERS[name];
  if (!endpoint) {
    throw new ConfigError(`unknown cluster '${name}'. Known clusters: ${Object.keys(CLUSTERS).join(', ')}`);
  }
  assertNotMainnet(endpoint);
  return { cluster: name, endpoint };
}

/**
 * Read a Solana keypair from a JSON byte-array file (the format `solana-keygen`
 * writes). The path comes from the environment and the file is never read into
 * anything that gets logged.
 *
 * @param {string} file
 * @returns {Uint8Array}
 */
export function readKeypairFile(file) {
  const resolved = file.startsWith('~') ? path.join(os.homedir(), file.slice(1)) : file;
  let raw;
  try {
    raw = fs.readFileSync(resolved, 'utf8');
  } catch (error) {
    throw new ConfigError(`cannot read keypair file at ${resolved}: ${error.message}`);
  }
  let bytes;
  try {
    bytes = JSON.parse(raw);
  } catch {
    throw new ConfigError(`keypair file at ${resolved} is not a JSON array of bytes`);
  }
  if (!Array.isArray(bytes) || (bytes.length !== 64 && bytes.length !== 32)) {
    throw new ConfigError(`keypair file at ${resolved} must contain 32 or 64 bytes, found ${bytes?.length}`);
  }
  return Uint8Array.from(bytes);
}

/**
 * Parse the policy overrides that may be supplied as an env var of JSON.
 *
 * @param {string|undefined} raw
 * @returns {object}
 */
export function parsePolicyEnv(raw) {
  if (!raw || !raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new ConfigError(`APE_POLICY is not valid JSON: ${error.message}`);
  }
}

/**
 * Build the full run configuration from environment + CLI flags.
 * CLI flags win over the environment.
 *
 * @param {object} env
 * @param {object} [flags]
 * @returns {object}
 */
export function loadConfig(env, flags = {}) {
  const { cluster, endpoint } = resolveEndpoint({
    cluster: flags.cluster ?? env.APE_CLUSTER,
    rpcUrl: flags.rpcUrl ?? env.APE_RPC_URL,
  });

  const stateDir = flags.stateDir ?? env.APE_STATE_DIR ?? path.join(process.cwd(), '.ape');

  const policy = resolvePolicy({
    ...parsePolicyEnv(env.APE_POLICY),
    ...stripUndefined({
      minReclaimLamports: flags.minReclaimLamports,
      maxAccountsPerRun: flags.maxAccountsPerRun,
      batchSize: flags.batchSize,
      includeWrappedSol: flags.includeWrappedSol,
    }),
  });

  return {
    cluster,
    endpoint,
    stateDir,
    keypairFile: flags.keypair ?? env.APE_KEYPAIR ?? null,
    // Executing costs money and signs transactions, so it takes an explicit yes
    // from BOTH the environment and the command line.
    executeAllowed: String(env.APE_EXECUTE ?? '').toLowerCase() === 'true',
    policy,
    memoryFile: path.join(stateDir, 'memory.json'),
    journalFile: path.join(stateDir, 'journal.jsonl'),
  };
}

function stripUndefined(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}
