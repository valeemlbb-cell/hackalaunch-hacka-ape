#!/usr/bin/env node
/**
 * Make a wallet messy on purpose, so there is something real to groom.
 *
 * Creates a handful of SPL mints and token accounts for the configured wallet:
 * most are left empty (dead rent), one keeps a balance and one is frozen, so a
 * demo run exercises the agent's "leave it alone" reasoning as well as its
 * "close it" path.
 *
 * Devnet / localnet only -- it refuses to run anywhere else, same as the agent.
 */
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  freezeAccount,
} from '@solana/spl-token';
import { loadConfig, readKeypairFile } from '../src/config.js';

const DEAD_ACCOUNTS = Number(process.env.APE_SEED_DEAD ?? 8);

async function main() {
  const config = loadConfig(process.env, {});
  if (!config.keypairFile) throw new Error('set APE_KEYPAIR first (see .env.example)');

  const payer = Keypair.fromSecretKey(readKeypairFile(config.keypairFile));
  const connection = new Connection(config.endpoint, 'confirmed');

  const balance = await connection.getBalance(payer.publicKey);
  console.log(`seeding ${payer.publicKey.toBase58()} on ${config.cluster} (${balance / LAMPORTS_PER_SOL} SOL)`);
  if (balance < 0.5 * LAMPORTS_PER_SOL) throw new Error('wallet needs at least 0.5 SOL to seed');

  for (let i = 0; i < DEAD_ACCOUNTS; i += 1) {
    const mint = await createMint(connection, payer, payer.publicKey, payer.publicKey, 6);
    const account = await getOrCreateAssociatedTokenAccount(connection, payer, mint, payer.publicKey);
    console.log(`  dead    ${account.address.toBase58()}  mint ${mint.toBase58()}`);
  }

  const heldMint = await createMint(connection, payer, payer.publicKey, payer.publicKey, 6);
  const heldAccount = await getOrCreateAssociatedTokenAccount(connection, payer, heldMint, payer.publicKey);
  await mintTo(connection, payer, heldMint, heldAccount.address, payer, 1_250_000_000);
  console.log(`  holding ${heldAccount.address.toBase58()}  1250 tokens`);

  const frozenMint = await createMint(connection, payer, payer.publicKey, payer.publicKey, 6);
  const frozenAccount = await getOrCreateAssociatedTokenAccount(connection, payer, frozenMint, payer.publicKey);
  await freezeAccount(connection, payer, frozenAccount.address, frozenMint, payer);
  console.log(`  frozen  ${frozenAccount.address.toBase58()}`);

  console.log(`\nseeded ${DEAD_ACCOUNTS} dead + 1 holding + 1 frozen. Run: npm run ape -- plan`);
}

main().catch((error) => {
  console.error(`seed failed: ${error.message}`);
  process.exitCode = 1;
});
