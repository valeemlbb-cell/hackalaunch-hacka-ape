import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { appendRun, readRuns, summarize } from '../src/journal.js';
import { tempDir } from './helpers.js';

test('runs append and read back in order', () => {
  const { dir, cleanup } = tempDir();
  try {
    const file = path.join(dir, 'nested', 'journal.jsonl');

    appendRun(file, { startedAt: 'a', closed: 1 });
    appendRun(file, { startedAt: 'b', closed: 2 });

    const runs = readRuns(file);
    assert.equal(runs.length, 2);
    assert.deepEqual(runs.map((r) => r.startedAt), ['a', 'b']);
  } finally {
    cleanup();
  }
});

test('a missing journal reads as no history', () => {
  const { dir, cleanup } = tempDir();
  try {
    assert.deepEqual(readRuns(path.join(dir, 'nothing.jsonl')), []);
  } finally {
    cleanup();
  }
});

test('one torn line does not hide the rest of the history', () => {
  const { dir, cleanup } = tempDir();
  try {
    const file = path.join(dir, 'journal.jsonl');
    fs.writeFileSync(file, '{"closed":1}\n{"closed":\n{"closed":3}\n\n');

    const runs = readRuns(file);

    assert.deepEqual(runs.map((r) => r.closed), [1, 3]);
  } finally {
    cleanup();
  }
});

test('summarize adds up only the runs that actually acted', () => {
  const runs = [
    { executed: true, closed: 3, reclaimLamports: 4_465_320, feeLamports: 5_000 },
    { executed: false, closed: 0, reclaimLamports: 0, feeLamports: 0 },
    { executed: true, closed: 2, reclaimLamports: 2_976_880, feeLamports: 5_000 },
    { executed: false, error: 'rpc down' },
  ];

  const totals = summarize(runs);

  assert.equal(totals.runs, 4);
  assert.equal(totals.executed, 2);
  assert.equal(totals.closed, 5);
  assert.equal(totals.reclaimLamports, 7_442_200);
  assert.equal(totals.feeLamports, 10_000);
  assert.equal(totals.netLamports, 7_432_200);
  assert.equal(totals.failures, 1);
});

test('summarize handles an empty journal', () => {
  const totals = summarize([]);
  assert.equal(totals.runs, 0);
  assert.equal(totals.netLamports, 0);
});

test('summarize tolerates runs missing numeric fields', () => {
  const totals = summarize([{ executed: true }]);
  assert.equal(totals.closed, 0);
  assert.equal(totals.reclaimLamports, 0);
});
