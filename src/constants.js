/**
 * Shared constants. Nothing here reaches the network.
 */

/** Base fee charged per signature on Solana. One close batch = one signature. */
export const LAMPORTS_PER_SIGNATURE = 5000;

/** Lamports in one SOL. */
export const LAMPORTS_PER_SOL = 1_000_000_000;

/** SPL Token program ids the groomer understands. */
export const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
export const TOKEN_PROGRAM_IDS = [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID];

/**
 * Clusters the APE is allowed to touch. Mainnet is deliberately absent:
 * this is a hackathon build and it must never sign against real money.
 */
export const CLUSTERS = {
  localnet: 'http://127.0.0.1:8899',
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
};

/** Substrings that identify a mainnet endpoint, used by the refuse-to-run guard. */
export const MAINNET_MARKERS = ['mainnet', 'api.mainnet-beta.solana.com'];

/** Every reason the planner can give for leaving an account alone. */
export const SKIP_REASONS = {
  FROZEN: 'frozen',
  UNINITIALIZED: 'uninitialized',
  WRAPPED_SOL: 'wrapped-sol-excluded',
  HOLDS_BALANCE: 'holds-balance',
  CLOSE_AUTHORITY: 'close-authority-mismatch',
  ACTIVE_DELEGATE: 'active-delegate',
  PROTECTED_MINT: 'protected-mint',
  QUARANTINED: 'quarantined-recurring',
  BELOW_THRESHOLD: 'below-threshold',
  OVER_RUN_CAP: 'over-run-cap',
};

/** Human wording for each skip reason, used by the reporter. */
export const SKIP_REASON_TEXT = {
  [SKIP_REASONS.FROZEN]: 'account is frozen, the token program will not close it',
  [SKIP_REASONS.UNINITIALIZED]: 'account is not initialized',
  [SKIP_REASONS.WRAPPED_SOL]: 'wrapped SOL, excluded unless --include-wsol',
  [SKIP_REASONS.HOLDS_BALANCE]: 'still holds tokens',
  [SKIP_REASONS.CLOSE_AUTHORITY]: 'close authority is someone else',
  [SKIP_REASONS.ACTIVE_DELEGATE]: 'a delegate still has an allowance on it',
  [SKIP_REASONS.PROTECTED_MINT]: 'mint is on the protected list',
  [SKIP_REASONS.QUARANTINED]: 'this mint keeps coming back, quarantined to stop a fee loop',
  [SKIP_REASONS.BELOW_THRESHOLD]: 'rent inside is below the minimum worth reclaiming',
  [SKIP_REASONS.OVER_RUN_CAP]: 'past the per-run account cap, will be picked up next run',
};
