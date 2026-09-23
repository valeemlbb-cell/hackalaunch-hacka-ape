/** Shared fixtures for the test suite. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TOKEN_PROGRAM_ID } from '../src/constants.js';

export const SIGNER = 'HenggarWa11etAddress1111111111111111111111';
export const RENT = 1_488_440;

/** A closable, boring, empty token account. Override any field. */
export function account(overrides = {}) {
  return {
    address: 'Acct1111111111111111111111111111111111111111',
    mint: 'Mint1111111111111111111111111111111111111111',
    owner: SIGNER,
    programId: TOKEN_PROGRAM_ID,
    amount: '0',
    decimals: 6,
    state: 'initialized',
    isNative: false,
    delegate: null,
    delegatedAmount: '0',
    closeAuthority: null,
    lamports: RENT,
    ...overrides,
  };
}

/** `count` closable accounts with distinct addresses and mints. */
export function accounts(count, overrides = {}) {
  return Array.from({ length: count }, (_, i) =>
    account({ address: `Acct${i}`.padEnd(44, 'x'), mint: `Mint${i}`.padEnd(44, 'y'), ...overrides }),
  );
}

/** A throwaway directory that cleans itself up. */
export function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ape-test-'));
  return { dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}
