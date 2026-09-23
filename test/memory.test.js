import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { emptyMemory, isQuarantined, loadMemory, quarantinedMints, recordClosures, saveMemory } from '../src/memory.js';
import { tempDir } from './helpers.js';

test('a fresh memory knows nothing', () => {
  const memory = emptyMemory();
  assert.deepEqual(memory.mints, {});
  assert.equal(isQuarantined(memory, 'MintA'), false);
});

test('isQuarantined survives a missing or malformed memory', () => {
  assert.equal(isQuarantined(undefined, 'MintA'), false);
  assert.equal(isQuarantined({}, 'MintA'), false);
  assert.equal(isQuarantined({ mints: {} }, 'MintA'), false);
});

test('recording a closure counts it without mutating the old memory', () => {
  const before = emptyMemory();

  const after = recordClosures(before, ['MintA'], { recurrenceLimit: 3, now: '2026-09-24T00:00:00.000Z' });

  assert.equal(after.mints.MintA.closed, 1);
  assert.equal(after.mints.MintA.lastClosed, '2026-09-24T00:00:00.000Z');
  assert.equal(after.mints.MintA.quarantined, false);
  assert.deepEqual(before.mints, {}, 'the input memory is untouched');
});

test('a mint that keeps coming back gets quarantined at the limit', () => {
  let memory = emptyMemory();
  for (let i = 0; i < 3; i += 1) {
    memory = recordClosures(memory, ['MintSpam'], { recurrenceLimit: 3, now: 'now' });
  }

  assert.equal(memory.mints.MintSpam.closed, 3);
  assert.equal(isQuarantined(memory, 'MintSpam'), true, 'stops the agent paying fees forever');
});

test('quarantine is sticky once earned', () => {
  const memory = { mints: { MintSpam: { closed: 9, lastClosed: 'x', quarantined: true } } };
  const after = recordClosures(memory, ['MintSpam'], { recurrenceLimit: 100, now: 'now' });
  assert.equal(after.mints.MintSpam.quarantined, true);
});

test('counts duplicates within one batch', () => {
  const memory = recordClosures(emptyMemory(), ['MintA', 'MintA', 'MintB'], { recurrenceLimit: 2, now: 'now' });
  assert.equal(memory.mints.MintA.closed, 2);
  assert.equal(memory.mints.MintA.quarantined, true);
  assert.equal(memory.mints.MintB.closed, 1);
});

test('lists quarantined mints in a stable order', () => {
  const memory = {
    mints: {
      Zeta: { closed: 3, quarantined: true },
      Alpha: { closed: 3, quarantined: true },
      Fine: { closed: 1, quarantined: false },
    },
  };
  assert.deepEqual(quarantinedMints(memory), ['Alpha', 'Zeta']);
});

test('memory round-trips through disk', () => {
  const { dir, cleanup } = tempDir();
  try {
    const file = path.join(dir, 'nested', 'memory.json');
    const memory = recordClosures(emptyMemory(), ['MintA'], { recurrenceLimit: 3, now: 'now' });

    saveMemory(file, memory);

    assert.deepEqual(loadMemory(file).mints, memory.mints);
  } finally {
    cleanup();
  }
});

test('a missing or corrupt memory file makes the agent forgetful, not broken', () => {
  const { dir, cleanup } = tempDir();
  try {
    assert.deepEqual(loadMemory(path.join(dir, 'nope.json')).mints, {});

    const corrupt = path.join(dir, 'corrupt.json');
    fs.writeFileSync(corrupt, '{ this is not json');
    assert.deepEqual(loadMemory(corrupt).mints, {});

    const wrongShape = path.join(dir, 'wrong.json');
    fs.writeFileSync(wrongShape, '[1,2,3]');
    assert.deepEqual(loadMemory(wrongShape).mints, {});
  } finally {
    cleanup();
  }
});
