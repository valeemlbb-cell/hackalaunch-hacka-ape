/**
 * The rulebook the APE grooms by. Pure: defaults, validation, merging.
 *
 * The policy is the only thing standing between an autonomous agent and a
 * wallet, so every field is validated and every default is the cautious one.
 */

/** @typedef {ReturnType<typeof resolvePolicy>} Policy */

export const DEFAULT_POLICY = Object.freeze({
  /** Ignore accounts holding less rent than this. 0 = reclaim everything. */
  minReclaimLamports: 0,
  /** Never touch more than this many accounts in a single run. */
  maxAccountsPerRun: 24,
  /** Close instructions per transaction. Keeps each tx well under the size limit. */
  batchSize: 12,
  /** Wrapped SOL accounts are real balances, so they are opt-in only. */
  includeWrappedSol: false,
  /** Mints the agent must never close an account for. */
  protectedMints: [],
  /** Close the same mint this many times and it gets quarantined instead. */
  recurrenceLimit: 3,
  /** Refuse to act when fees would eat the rent reclaimed. */
  requireNetGain: true,
});

const INTEGER_FIELDS = [
  ['minReclaimLamports', 0, Number.MAX_SAFE_INTEGER],
  ['maxAccountsPerRun', 1, 10_000],
  ['batchSize', 1, 20],
  ['recurrenceLimit', 1, 1_000],
];

const BOOLEAN_FIELDS = ['includeWrappedSol', 'requireNetGain'];

export class PolicyError extends Error {}

function assertInteger(value, field, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new PolicyError(`policy.${field} must be an integer between ${min} and ${max}, got ${JSON.stringify(value)}`);
  }
}

/**
 * Merge a partial policy over the defaults and validate the result.
 *
 * @param {Partial<typeof DEFAULT_POLICY>} [overrides]
 * @returns {Readonly<typeof DEFAULT_POLICY>}
 */
export function resolvePolicy(overrides = {}) {
  if (overrides === null || typeof overrides !== 'object' || Array.isArray(overrides)) {
    throw new PolicyError('policy overrides must be an object');
  }

  const unknown = Object.keys(overrides).filter((key) => !(key in DEFAULT_POLICY));
  if (unknown.length > 0) {
    throw new PolicyError(`unknown policy field(s): ${unknown.join(', ')}`);
  }

  const merged = { ...DEFAULT_POLICY, ...stripUndefined(overrides) };

  for (const [field, min, max] of INTEGER_FIELDS) {
    assertInteger(merged[field], field, min, max);
  }
  for (const field of BOOLEAN_FIELDS) {
    if (typeof merged[field] !== 'boolean') {
      throw new PolicyError(`policy.${field} must be a boolean, got ${JSON.stringify(merged[field])}`);
    }
  }
  if (!Array.isArray(merged.protectedMints) || merged.protectedMints.some((m) => typeof m !== 'string' || m === '')) {
    throw new PolicyError('policy.protectedMints must be an array of mint address strings');
  }
  if (merged.batchSize > merged.maxAccountsPerRun) {
    throw new PolicyError('policy.batchSize cannot exceed policy.maxAccountsPerRun');
  }

  return Object.freeze({ ...merged, protectedMints: Object.freeze([...merged.protectedMints]) });
}

function stripUndefined(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}
