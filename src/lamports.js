/**
 * Lamport arithmetic and formatting. Pure, no I/O.
 *
 * Every number in this file is an integer count of lamports. SOL only ever
 * appears at the very edge, when something is printed for a human.
 */
import { LAMPORTS_PER_SOL, LAMPORTS_PER_SIGNATURE } from './constants.js';

/**
 * @param {number} lamports
 * @returns {string} e.g. "0.014884 SOL"
 */
export function formatSol(lamports) {
  const sol = lamports / LAMPORTS_PER_SOL;
  return `${sol.toFixed(6)} SOL`;
}

/**
 * @param {number} lamports
 * @returns {string} e.g. "0.014884 SOL (14,884,400 lamports)"
 */
export function formatLamports(lamports) {
  return `${formatSol(lamports)} (${lamports.toLocaleString('en-US')} lamports)`;
}

/**
 * Total rent sitting inside a list of accounts.
 * @param {{lamports: number}[]} accounts
 * @returns {number}
 */
export function sumLamports(accounts) {
  return accounts.reduce((total, account) => total + account.lamports, 0);
}

/**
 * Number of transactions needed for `count` closes at `batchSize` per transaction.
 * @param {number} count
 * @param {number} batchSize
 * @returns {number}
 */
export function batchCount(count, batchSize) {
  if (count <= 0) return 0;
  return Math.ceil(count / batchSize);
}

/**
 * Fee for a run: one signature per batch.
 * @param {number} batches
 * @returns {number}
 */
export function estimateFee(batches) {
  return batches * LAMPORTS_PER_SIGNATURE;
}

/**
 * What the wallet actually gains: rent reclaimed minus the fees spent reclaiming it.
 * @param {number} reclaimed
 * @param {number} fee
 * @returns {number}
 */
export function netGain(reclaimed, fee) {
  return reclaimed - fee;
}

/**
 * Split a list into fixed-size chunks, preserving order.
 * @template T
 * @param {T[]} items
 * @param {number} size
 * @returns {T[][]}
 */
export function chunk(items, size) {
  if (size < 1) throw new RangeError('chunk size must be at least 1');
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
