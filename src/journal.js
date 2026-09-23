/**
 * An append-only record of everything the agent did, one JSON object per line.
 *
 * An autonomous process that acts on a wallet while nobody is watching has to
 * be auditable after the fact, so every run lands here whether it acted or not.
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * @param {string} file
 * @param {object} entry
 */
export function appendRun(file, entry) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(entry)}\n`, 'utf8');
}

/**
 * Read the journal back. Unparseable lines are skipped rather than throwing,
 * so one bad line never hides the rest of the history.
 *
 * @param {string} file
 * @returns {object[]}
 */
export function readRuns(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const runs = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      runs.push(JSON.parse(line));
    } catch {
      /* skip a torn line */
    }
  }
  return runs;
}

/**
 * Lifetime totals across runs. Pure.
 *
 * @param {object[]} runs
 * @returns {{runs: number, executed: number, closed: number, reclaimLamports: number,
 *   feeLamports: number, netLamports: number, failures: number}}
 */
export function summarize(runs) {
  const totals = {
    runs: runs.length,
    executed: 0,
    closed: 0,
    reclaimLamports: 0,
    feeLamports: 0,
    netLamports: 0,
    failures: 0,
  };

  for (const run of runs) {
    if (run.error) totals.failures += 1;
    if (!run.executed) continue;
    totals.executed += 1;
    totals.closed += run.closed ?? 0;
    totals.reclaimLamports += run.reclaimLamports ?? 0;
    totals.feeLamports += run.feeLamports ?? 0;
  }
  totals.netLamports = totals.reclaimLamports - totals.feeLamports;

  return totals;
}
