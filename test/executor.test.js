import test from 'node:test';
import assert from 'node:assert/strict';
import { Keypair } from '@solana/web3.js';
import { buildCloseTransaction } from '../src/executor.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '../src/constants.js';

const owner = Keypair.generate().publicKey;

function tokenAccount(programId = TOKEN_PROGRAM_ID) {
  return { address: Keypair.generate().publicKey.toBase58(), programId, mint: 'M', lamports: 2_039_280 };
}

test('builds one close instruction per account', () => {
  const accounts = [tokenAccount(), tokenAccount(), tokenAccount()];

  const transaction = buildCloseTransaction({ accounts, owner });

  assert.equal(transaction.instructions.length, 3);
});

test('rent is sent back to the owner, and the owner is the only signer', () => {
  const account = tokenAccount();

  const transaction = buildCloseTransaction({ accounts: [account], owner });
  const [instruction] = transaction.instructions;

  // SPL closeAccount takes [account, destination, authority].
  assert.equal(instruction.keys[0].pubkey.toBase58(), account.address);
  assert.equal(instruction.keys[1].pubkey.toBase58(), owner.toBase58(), 'destination is the owner itself');
  assert.equal(instruction.keys[2].pubkey.toBase58(), owner.toBase58(), 'authority is the owner');
  assert.equal(instruction.keys[2].isSigner, true);

  const signers = instruction.keys.filter((key) => key.isSigner);
  assert.equal(signers.length, 1, 'nobody else can be made to sign this');
});

test('there is no third-party destination anywhere in the transaction', () => {
  const accounts = [tokenAccount(), tokenAccount()];

  const transaction = buildCloseTransaction({ accounts, owner });

  const addresses = new Set(accounts.map((a) => a.address));
  for (const instruction of transaction.instructions) {
    for (const key of instruction.keys) {
      const value = key.pubkey.toBase58();
      assert.ok(
        addresses.has(value) || value === owner.toBase58(),
        `unexpected account in a close transaction: ${value}`,
      );
    }
  }
});

test('routes each account to the token program that actually owns it', () => {
  const accounts = [tokenAccount(TOKEN_PROGRAM_ID), tokenAccount(TOKEN_2022_PROGRAM_ID)];

  const transaction = buildCloseTransaction({ accounts, owner });

  assert.equal(transaction.instructions[0].programId.toBase58(), TOKEN_PROGRAM_ID);
  assert.equal(transaction.instructions[1].programId.toBase58(), TOKEN_2022_PROGRAM_ID);
});

test('an empty batch builds an empty transaction rather than throwing', () => {
  const transaction = buildCloseTransaction({ accounts: [], owner });
  assert.equal(transaction.instructions.length, 0);
});
