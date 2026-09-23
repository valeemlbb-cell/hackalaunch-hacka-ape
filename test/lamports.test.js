import test from 'node:test';
import assert from 'node:assert/strict';
import { batchCount, chunk, estimateFee, formatLamports, formatSol, netGain, sumLamports } from '../src/lamports.js';
import { LAMPORTS_PER_SIGNATURE } from '../src/constants.js';
import { account, RENT } from './helpers.js';

test('formats lamports as SOL with six decimals', () => {
  assert.equal(formatSol(1_488_440), '0.001488 SOL');
  assert.equal(formatSol(0), '0.000000 SOL');
});

test('formatLamports shows both units with thousands separators', () => {
  assert.equal(formatLamports(1_488_440), '0.001488 SOL (1,488,440 lamports)');
});

test('sums the rent held across accounts', () => {
  assert.equal(sumLamports([account(), account(), account()]), RENT * 3);
  assert.equal(sumLamports([]), 0);
});

test('batchCount rounds up and treats an empty plan as zero transactions', () => {
  // Arrange / Act / Assert
  assert.equal(batchCount(0, 12), 0);
  assert.equal(batchCount(1, 12), 1);
  assert.equal(batchCount(12, 12), 1);
  assert.equal(batchCount(13, 12), 2);
  assert.equal(batchCount(25, 12), 3);
});

test('fee is one signature per batch', () => {
  assert.equal(estimateFee(0), 0);
  assert.equal(estimateFee(3), 3 * LAMPORTS_PER_SIGNATURE);
});

test('net gain subtracts fees from reclaimed rent', () => {
  assert.equal(netGain(1_488_440, 5_000), 1_483_440);
  assert.equal(netGain(1_000, 5_000), -4_000);
});

test('chunk splits in order and keeps the short tail', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 3), []);
});

test('chunk rejects a size below one rather than looping forever', () => {
  assert.throws(() => chunk([1, 2], 0), RangeError);
});
