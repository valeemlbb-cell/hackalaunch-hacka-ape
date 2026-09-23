/**
 * What the APE remembers between runs.
 *
 * The one thing that turns this from a script into an agent: a wallet that is
 * being spammed gets the same empty account recreated over and over. A dumb
 * loop would close it forever and pay a fee every time. The APE notices a mint
 * that keeps coming back and quarantines it instead.
 *
 * The core is pure and immutable; only the last two functions touch disk.
 */
import fs from 'node:fs';
import path from 'node:path';

const MEMORY_VERSION = 1;

/** @returns {{version: number, mints: Record<string, {closed: number, lastClosed: string, quarantined: boolean}>}} */
export function emptyMemory() {
  return { version: MEMORY_VERSION, mints: {} };
}

/**
 * @param {object} memory
 * @param {string} mint
 * @returns {boolean}
 */
export function isQuarantined(memory, mint) {
  return Boolean(memory?.mints?.[mint]?.quarantined);
}

/**
 * Record that these mints just had an account closed, and quarantine any mint
 * that has now hit the recurrence limit. Returns a new memory object.
 *
 * @param {object} memory
 * @param {string[]} mints one entry per closed account, duplicates are counted
 * @param {{recurrenceLimit: number, now?: string}} options
 * @returns {object} a new memory
 */
export function recordClosures(memory, mints, { recurrenceLimit, now = new Date().toISOString() }) {
  const next = { version: MEMORY_VERSION, mints: { ...(memory?.mints ?? {}) } };

  for (const mint of mints) {
    const previous = next.mints[mint] ?? { closed: 0, lastClosed: '', quarantined: false };
    const closed = previous.closed + 1;
    next.mints[mint] = {
      closed,
      lastClosed: now,
      quarantined: previous.quarantined || closed >= recurrenceLimit,
    };
  }

  return next;
}

/**
 * @param {object} memory
 * @returns {string[]} mints currently quarantined, sorted for stable output
 */
export function quarantinedMints(memory) {
  return Object.entries(memory?.mints ?? {})
    .filter(([, entry]) => entry.quarantined)
    .map(([mint]) => mint)
    .sort();
}

/**
 * Read memory from disk. A missing or corrupt file is not fatal: the agent
 * simply starts out forgetful rather than refusing to run.
 *
 * @param {string} file
 * @returns {object}
 */
export function loadMemory(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || typeof parsed.mints !== 'object' || parsed.mints === null) {
      return emptyMemory();
    }
    return { version: MEMORY_VERSION, mints: parsed.mints };
  } catch {
    return emptyMemory();
  }
}

/**
 * Write memory atomically so an interrupted run cannot leave a half file.
 * @param {string} file
 * @param {object} memory
 */
export function saveMemory(file, memory) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(memory, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}
