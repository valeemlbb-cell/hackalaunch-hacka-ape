/**
 * The brain. Given a wallet's token accounts, the policy and what the agent
 * remembers, decide what to close and what to leave alone -- and say why.
 *
 * Completely pure: no network, no clock, no disk. That is what makes an
 * autonomous agent safe to reason about and cheap to test.
 */
import { SKIP_REASONS } from './constants.js';
import { batchCount, estimateFee, netGain, sumLamports } from './lamports.js';
import { isQuarantined } from './memory.js';

/**
 * @typedef {object} TokenAccount
 * @property {string} address
 * @property {string} mint
 * @property {string} owner
 * @property {string} programId
 * @property {string} amount raw u64 as a decimal string
 * @property {string} state 'initialized' | 'frozen' | 'uninitialized'
 * @property {boolean} isNative
 * @property {string|null} delegate
 * @property {string} delegatedAmount raw u64 as a decimal string
 * @property {string|null} closeAuthority
 * @property {number} lamports rent currently locked in the account
 */

/**
 * Why this one account should be left alone, or null if it is safe to close.
 *
 * Order matters: the first rule that fires is the reason a human sees, so the
 * hard on-chain impossibilities are checked before the softer policy opinions.
 *
 * @param {TokenAccount} account
 * @param {{policy: import('./policy.js').Policy, memory: object, signer: string}} context
 * @returns {string|null} a SKIP_REASONS value, or null to close
 */
export function decide(account, { policy, memory, signer }) {
  if (account.state === 'frozen') return SKIP_REASONS.FROZEN;
  if (account.state === 'uninitialized') return SKIP_REASONS.UNINITIALIZED;

  if (account.isNative && !policy.includeWrappedSol) return SKIP_REASONS.WRAPPED_SOL;
  if (!account.isNative && account.amount !== '0') return SKIP_REASONS.HOLDS_BALANCE;

  const authority = account.closeAuthority ?? account.owner;
  if (authority !== signer) return SKIP_REASONS.CLOSE_AUTHORITY;

  if (account.delegate && account.delegatedAmount !== '0') return SKIP_REASONS.ACTIVE_DELEGATE;
  if (policy.protectedMints.includes(account.mint)) return SKIP_REASONS.PROTECTED_MINT;
  if (isQuarantined(memory, account.mint)) return SKIP_REASONS.QUARANTINED;
  if (account.lamports < policy.minReclaimLamports) return SKIP_REASONS.BELOW_THRESHOLD;

  return null;
}

/**
 * Turn a wallet scan into a plan of action.
 *
 * @param {object} input
 * @param {TokenAccount[]} input.accounts
 * @param {import('./policy.js').Policy} input.policy
 * @param {object} [input.memory]
 * @param {string} input.signer
 * @returns {{close: TokenAccount[], skipped: {address: string, mint: string, lamports: number, reason: string}[],
 *   batches: number, reclaimLamports: number, feeLamports: number, netLamports: number, profitable: boolean}}
 */
export function planGroom({ accounts, policy, memory = {}, signer }) {
  const skipped = [];
  const closable = [];

  for (const account of accounts) {
    const reason = decide(account, { policy, memory, signer });
    if (reason) skipped.push(toSkip(account, reason));
    else closable.push(account);
  }

  // Richest accounts first, so a capped run always reclaims the most rent it can.
  closable.sort((a, b) => b.lamports - a.lamports || a.address.localeCompare(b.address));

  const close = closable.slice(0, policy.maxAccountsPerRun);
  for (const account of closable.slice(policy.maxAccountsPerRun)) {
    skipped.push(toSkip(account, SKIP_REASONS.OVER_RUN_CAP));
  }

  const batches = batchCount(close.length, policy.batchSize);
  const reclaimLamports = sumLamports(close);
  const feeLamports = estimateFee(batches);
  const netLamports = netGain(reclaimLamports, feeLamports);
  const profitable = close.length > 0 && netLamports > 0;

  if (policy.requireNetGain && close.length > 0 && !profitable) {
    return emptyPlan(skipped.concat(close.map((a) => toSkip(a, SKIP_REASONS.BELOW_THRESHOLD))));
  }

  return { close, skipped, batches, reclaimLamports, feeLamports, netLamports, profitable };
}

function toSkip(account, reason) {
  return { address: account.address, mint: account.mint, lamports: account.lamports, reason };
}

function emptyPlan(skipped) {
  return {
    close: [],
    skipped,
    batches: 0,
    reclaimLamports: 0,
    feeLamports: 0,
    netLamports: 0,
    profitable: false,
  };
}
