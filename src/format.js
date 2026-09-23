/**
 * Everything the agent says out loud. Pure string building, so the report is
 * testable and the rest of the code never has to think about layout.
 */
import { SKIP_REASON_TEXT } from './constants.js';
import { formatLamports, formatSol } from './lamports.js';

/** Shorten an address for display: "3dZJyQ…v5TiH". */
export function short(address) {
  if (typeof address !== 'string' || address.length <= 13) return String(address ?? '');
  return `${address.slice(0, 6)}…${address.slice(-5)}`;
}

function pad(text, width) {
  const value = String(text);
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

/**
 * @param {{wallet: string, cluster: string, endpoint: string, execute: boolean}} context
 * @returns {string}
 */
export function header({ wallet, cluster, endpoint, execute }) {
  return [
    '',
    '  APE GROOM  ·  autonomous primate engine',
    '  ─────────────────────────────────────────────────────────────',
    `  ${pad('wallet', 10)}${wallet}`,
    `  ${pad('cluster', 10)}${cluster} (${endpoint})`,
    `  ${pad('mode', 10)}${execute ? 'EXECUTE — will sign and send' : 'DRY RUN — nothing is signed'}`,
    '',
  ].join('\n');
}

/**
 * The plan, with the agent's reasoning shown for every account.
 *
 * @param {ReturnType<import('./planner.js').planGroom>} plan
 * @param {{scanned: number, showSkips?: number}} options
 * @returns {string}
 */
export function renderPlan(plan, { scanned, showSkips = 6 }) {
  const lines = [
    `  scanned   ${scanned} token account${scanned === 1 ? '' : 's'}`,
    `  close     ${plan.close.length}`,
    `  keep      ${plan.skipped.length}`,
    '',
  ];

  if (plan.close.length > 0) {
    lines.push('  RECLAIM');
    for (const account of plan.close) {
      lines.push(`    + ${pad(short(account.address), 15)} ${pad(formatSol(account.lamports), 14)} mint ${short(account.mint)}`);
    }
    lines.push('');
  }

  const grouped = groupSkips(plan.skipped);
  if (grouped.length > 0) {
    lines.push('  LEFT ALONE');
    for (const { reason, count } of grouped.slice(0, showSkips)) {
      const why = SKIP_REASON_TEXT[reason] ?? reason;
      lines.push(`    - ${pad(`${count}×`, 5)} ${pad(reason, 26)} ${why}`);
    }
    lines.push('');
  }

  lines.push(`  rent reclaimable   ${formatLamports(plan.reclaimLamports)}`);
  lines.push(`  network fee        ${formatLamports(plan.feeLamports)} in ${plan.batches} tx`);
  lines.push(`  net to wallet      ${formatLamports(plan.netLamports)}`);
  lines.push('');

  return lines.join('\n');
}

/** Count skips by reason, most common first. */
export function groupSkips(skipped) {
  const counts = new Map();
  for (const skip of skipped) counts.set(skip.reason, (counts.get(skip.reason) ?? 0) + 1);
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

/**
 * @param {{signatures: string[], closed: any[], error: string|null}} result
 * @returns {string}
 */
export function renderResult(result) {
  const lines = ['  SENT'];
  for (const signature of result.signatures) lines.push(`    ✓ ${signature}`);
  if (result.error) lines.push(`    ✗ batch failed: ${result.error}`);
  lines.push('');
  lines.push(`  closed ${result.closed.length} account${result.closed.length === 1 ? '' : 's'}`);
  lines.push('');
  return lines.join('\n');
}

/**
 * @param {ReturnType<import('./journal.js').summarize>} totals
 * @returns {string}
 */
export function renderJournal(totals) {
  return [
    '',
    '  APE JOURNAL  ·  lifetime',
    '  ─────────────────────────────────────────────────────────────',
    `  ${pad('runs', 20)}${totals.runs} (${totals.executed} that acted, ${totals.failures} failed)`,
    `  ${pad('accounts closed', 20)}${totals.closed}`,
    `  ${pad('rent reclaimed', 20)}${formatLamports(totals.reclaimLamports)}`,
    `  ${pad('fees paid', 20)}${formatLamports(totals.feeLamports)}`,
    `  ${pad('net to wallet', 20)}${formatLamports(totals.netLamports)}`,
    '',
  ].join('\n');
}
