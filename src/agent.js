/**
 * One grooming cycle, start to finish: look, decide, act, remember, write it down.
 *
 * This is the only place the pure brain and the impure world meet, and it is
 * deliberately thin -- everything interesting already happened in planner.js.
 */
import { scanWallet } from './scanner.js';
import { planGroom } from './planner.js';
import { executeBatches } from './executor.js';
import { loadMemory, recordClosures, saveMemory } from './memory.js';
import { appendRun } from './journal.js';

/**
 * @param {object} input
 * @param {import('@solana/web3.js').Connection} input.connection
 * @param {import('@solana/web3.js').Keypair} input.keypair
 * @param {object} input.config
 * @param {boolean} input.execute
 * @param {(event: object) => void} [input.onEvent]
 * @param {() => string} [input.now]
 * @param {typeof executeBatches} [input.executeBatchesImpl] seam for tests; the real one by default
 * @returns {Promise<{plan: object, scanned: number, result: object|null, entry: object}>}
 */
export async function groomOnce({
  connection,
  keypair,
  config,
  execute,
  onEvent = () => {},
  now = () => new Date().toISOString(),
  executeBatchesImpl = executeBatches,
}) {
  const signer = keypair.publicKey.toBase58();
  const startedAt = now();

  const accounts = await scanWallet(connection, keypair.publicKey);
  onEvent({ type: 'scanned', count: accounts.length });

  const memory = loadMemory(config.memoryFile);
  const plan = planGroom({ accounts, policy: config.policy, memory, signer });
  onEvent({ type: 'planned', close: plan.close.length, reclaimLamports: plan.reclaimLamports });

  let result = null;
  if (execute && plan.close.length > 0) {
    result = await executeBatchesImpl({
      connection,
      payer: keypair,
      plan,
      batchSize: config.policy.batchSize,
      onBatch: (update) => onEvent({ type: 'batch', ...update }),
    });

    if (result.closed.length > 0) {
      const updated = recordClosures(memory, result.closed.map((a) => a.mint), {
        recurrenceLimit: config.policy.recurrenceLimit,
        now: now(),
      });
      saveMemory(config.memoryFile, updated);
    }
  }

  const entry = buildEntry({ startedAt, finishedAt: now(), signer, config, plan, result, scanned: accounts.length, execute });
  appendRun(config.journalFile, entry);

  return { plan, scanned: accounts.length, result, entry };
}

/**
 * The single line that lands in the journal. Pure, so the shape is testable.
 */
export function buildEntry({ startedAt, finishedAt, signer, config, plan, result, scanned, execute }) {
  const closedCount = result ? result.closed.length : 0;
  const reclaimed = result ? result.closed.reduce((total, a) => total + a.lamports, 0) : 0;

  return {
    startedAt,
    finishedAt,
    wallet: signer,
    cluster: config.cluster,
    executed: Boolean(result) && closedCount > 0,
    dryRun: !execute,
    scanned,
    planned: plan.close.length,
    closed: closedCount,
    reclaimLamports: reclaimed,
    feeLamports: result ? result.signatures.length * 5000 : 0,
    signatures: result ? result.signatures : [],
    error: result?.error ?? null,
  };
}
