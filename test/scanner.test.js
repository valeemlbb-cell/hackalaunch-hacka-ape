import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeParsedAccount } from '../src/scanner.js';
import { TOKEN_PROGRAM_ID } from '../src/constants.js';

/** Shaped exactly like a row from getParsedTokenAccountsByOwner. */
function row(info, overrides = {}) {
  return {
    pubkey: 'Acct1111111111111111111111111111111111111111',
    account: {
      lamports: 2_039_280,
      owner: TOKEN_PROGRAM_ID,
      data: { parsed: { type: 'account', info } },
      ...overrides,
    },
  };
}

test('flattens a parsed token account into the planner shape', () => {
  const account = normalizeParsedAccount(
    row({
      mint: 'Mint1111111111111111111111111111111111111111',
      owner: 'Ownr1111111111111111111111111111111111111111',
      state: 'initialized',
      isNative: false,
      tokenAmount: { amount: '1250000000', decimals: 6, uiAmountString: '1250' },
    }),
  );

  assert.equal(account.address, 'Acct1111111111111111111111111111111111111111');
  assert.equal(account.mint, 'Mint1111111111111111111111111111111111111111');
  assert.equal(account.owner, 'Ownr1111111111111111111111111111111111111111');
  assert.equal(account.programId, TOKEN_PROGRAM_ID);
  assert.equal(account.amount, '1250000000');
  assert.equal(account.decimals, 6);
  assert.equal(account.lamports, 2_039_280);
  assert.equal(account.delegate, null);
  assert.equal(account.closeAuthority, null);
});

test('reads the delegate and close authority when the node reports them', () => {
  const account = normalizeParsedAccount(
    row({
      mint: 'M',
      owner: 'O',
      state: 'frozen',
      delegate: 'Dele1111111111111111111111111111111111111111',
      delegatedAmount: { amount: '42', decimals: 0 },
      closeAuthority: 'Clos1111111111111111111111111111111111111111',
      tokenAmount: { amount: '0', decimals: 0 },
    }),
  );

  assert.equal(account.state, 'frozen');
  assert.equal(account.delegate, 'Dele1111111111111111111111111111111111111111');
  assert.equal(account.delegatedAmount, '42');
  assert.equal(account.closeAuthority, 'Clos1111111111111111111111111111111111111111');
});

test('detects wrapped SOL from either signal the node might send', () => {
  const flagged = normalizeParsedAccount(row({ mint: 'M', owner: 'O', isNative: true, tokenAmount: { amount: '0' } }));
  assert.equal(flagged.isNative, true);

  const reserved = normalizeParsedAccount(
    row({ mint: 'M', owner: 'O', rentExemptReserve: { amount: '2039280' }, tokenAmount: { amount: '0' } }),
  );
  assert.equal(reserved.isNative, true, 'rentExemptReserve only appears on native accounts');
});

test('a sparse row still normalizes to safe defaults rather than undefined', () => {
  const account = normalizeParsedAccount({ pubkey: 'A', account: {} });

  assert.equal(account.amount, '0');
  assert.equal(account.state, 'initialized');
  assert.equal(account.lamports, 0);
  assert.equal(account.isNative, false);
  assert.equal(account.delegatedAmount, '0');
});
