/**
 * Reading the wallet. The normalizer is pure so the planner's inputs can be
 * tested from fixtures; only `scanWallet` talks to an RPC node.
 */
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_IDS } from './constants.js';

/**
 * Turn one `getParsedTokenAccountsByOwner` row into the flat shape the planner
 * expects. Defensive about missing fields: different token programs and node
 * versions leave different keys out.
 *
 * @param {{pubkey: any, account: any}} row
 * @returns {import('./planner.js').TokenAccount}
 */
export function normalizeParsedAccount(row) {
  const info = row.account?.data?.parsed?.info ?? {};
  const tokenAmount = info.tokenAmount ?? {};

  return {
    address: String(row.pubkey),
    mint: String(info.mint ?? ''),
    owner: String(info.owner ?? ''),
    programId: String(row.account?.owner ?? ''),
    amount: String(tokenAmount.amount ?? '0'),
    decimals: Number(tokenAmount.decimals ?? 0),
    state: String(info.state ?? 'initialized'),
    isNative: Boolean(info.isNative) || info.rentExemptReserve !== undefined,
    delegate: info.delegate ? String(info.delegate) : null,
    delegatedAmount: String(info.delegatedAmount?.amount ?? '0'),
    closeAuthority: info.closeAuthority ? String(info.closeAuthority) : null,
    lamports: Number(row.account?.lamports ?? 0),
  };
}

/**
 * Every token account owned by `owner`, across both SPL token programs.
 *
 * @param {import('@solana/web3.js').Connection} connection
 * @param {import('@solana/web3.js').PublicKey} owner
 * @returns {Promise<import('./planner.js').TokenAccount[]>}
 */
export async function scanWallet(connection, owner) {
  const perProgram = await Promise.all(
    TOKEN_PROGRAM_IDS.map(async (programId) => {
      try {
        const response = await connection.getParsedTokenAccountsByOwner(owner, {
          programId: new PublicKey(programId),
        });
        return response.value.map(normalizeParsedAccount);
      } catch (error) {
        // A node that does not know Token-2022 should not kill the whole scan.
        if (isUnknownProgramError(error)) return [];
        throw error;
      }
    }),
  );

  return perProgram.flat();
}

function isUnknownProgramError(error) {
  const message = String(error?.message ?? '').toLowerCase();
  return message.includes('could not find') || message.includes('invalid param');
}
