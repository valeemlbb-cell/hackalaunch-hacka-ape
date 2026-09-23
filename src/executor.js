/**
 * Turning a plan into signed transactions.
 *
 * One rule shapes this whole file: the reclaimed rent always goes back to the
 * wallet that owned the account. There is no configurable destination, no fee
 * split and no admin key, so there is no version of this agent that drains the
 * wallet it is grooming.
 */
import { Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import { createCloseAccountInstruction } from '@solana/spl-token';
import { chunk } from './lamports.js';

/**
 * Build one transaction that closes a batch of accounts.
 *
 * @param {object} input
 * @param {import('./planner.js').TokenAccount[]} input.accounts
 * @param {import('@solana/web3.js').PublicKey} input.owner signer and sole destination of the rent
 * @returns {Transaction}
 */
export function buildCloseTransaction({ accounts, owner }) {
  const transaction = new Transaction();
  for (const account of accounts) {
    transaction.add(
      createCloseAccountInstruction(
        new PublicKey(account.address),
        owner, // destination: always the owner's own wallet
        owner, // authority
        [],
        new PublicKey(account.programId),
      ),
    );
  }
  return transaction;
}

/**
 * Execute a plan batch by batch. Stops at the first failing batch rather than
 * ploughing on, so a bad run costs one fee instead of many.
 *
 * @param {object} input
 * @param {import('@solana/web3.js').Connection} input.connection
 * @param {import('@solana/web3.js').Keypair} input.payer
 * @param {ReturnType<import('./planner.js').planGroom>} input.plan
 * @param {number} input.batchSize
 * @param {(update: object) => void} [input.onBatch]
 * @returns {Promise<{signatures: string[], closed: import('./planner.js').TokenAccount[], error: string|null}>}
 */
export async function executeBatches({ connection, payer, plan, batchSize, onBatch = () => {} }) {
  const signatures = [];
  const closed = [];
  const batches = chunk(plan.close, batchSize);

  for (const [index, accounts] of batches.entries()) {
    const transaction = buildCloseTransaction({ accounts, owner: payer.publicKey });
    try {
      const signature = await sendAndConfirmTransaction(connection, transaction, [payer], {
        commitment: 'confirmed',
      });
      signatures.push(signature);
      closed.push(...accounts);
      onBatch({ index: index + 1, total: batches.length, count: accounts.length, signature, ok: true });
    } catch (error) {
      onBatch({ index: index + 1, total: batches.length, count: accounts.length, ok: false, error: error.message });
      return { signatures, closed, error: error.message };
    }
  }

  return { signatures, closed, error: null };
}
