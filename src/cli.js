#!/usr/bin/env node
/**
 * The command line. Parsing, wiring, and the two-key rule that stands between
 * `ape` and a signed transaction.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Connection, Keypair } from '@solana/web3.js';
import { loadConfig, readKeypairFile, ConfigError } from './config.js';
import { groomOnce } from './agent.js';
import { runLoop } from './loop.js';
import { readRuns, summarize } from './journal.js';
import { loadMemory, quarantinedMints } from './memory.js';
import { header, renderPlan, renderResult, renderJournal, short } from './format.js';
import { formatSol } from './lamports.js';

const USAGE = `
  APE GROOM — an autonomous primate engine that reclaims the rent locked in
  dead SPL token accounts and hands it back to the wallet that owns them.

  usage
    ape scan                  list the wallet's token accounts
    ape plan                  decide what to close, explain every decision
    ape run [--execute]       one grooming cycle
    ape loop [--interval s]   keep grooming, autonomously
    ape journal               lifetime totals from the run journal
    ape doctor                check the configuration and the RPC

  flags
    --cluster <name>          localnet | devnet | testnet   (default devnet)
    --rpc-url <url>           explicit endpoint, mainnet is refused
    --keypair <file>          JSON byte array, as solana-keygen writes
    --execute                 actually sign and send (also needs APE_EXECUTE=true)
    --interval <seconds>      loop period                   (default 300)
    --max-runs <n>            stop the loop after n cycles
    --min-reclaim <lamports>  ignore accounts holding less than this
    --max-accounts <n>        cap the accounts touched per run
    --batch-size <n>          close instructions per transaction
    --include-wsol            also close wrapped-SOL accounts
    --json                    machine-readable output

  Rent always returns to the wallet that owned the account. There is no
  configurable destination and no fee split.
`;

const FLAG_ALIASES = {
  'min-reclaim': 'minReclaimLamports',
  'max-accounts': 'maxAccountsPerRun',
  'batch-size': 'batchSize',
  'include-wsol': 'includeWrappedSol',
  'rpc-url': 'rpcUrl',
  'max-runs': 'maxRuns',
  'state-dir': 'stateDir',
};

const NUMERIC_FLAGS = new Set(['minReclaimLamports', 'maxAccountsPerRun', 'batchSize', 'interval', 'maxRuns']);
const BOOLEAN_FLAGS = new Set(['includeWrappedSol', 'execute', 'json', 'help']);

/**
 * Parse argv into a command plus flags. Pure, so it is covered by tests.
 *
 * @param {string[]} argv
 * @returns {{command: string, flags: object}}
 */
export function parseArgs(argv) {
  const [command = 'help', ...rest] = argv;
  const flags = {};

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith('--')) throw new ConfigError(`unexpected argument '${token}'`);
    const raw = token.slice(2);
    const key = FLAG_ALIASES[raw] ?? raw;

    if (BOOLEAN_FLAGS.has(key)) {
      flags[key] = true;
    } else {
      const value = rest[i + 1];
      if (value === undefined || value.startsWith('--')) throw new ConfigError(`flag --${raw} needs a value`);
      flags[key] = NUMERIC_FLAGS.has(key) ? toInteger(value, raw) : value;
      i += 1;
    }
  }

  return { command, flags };
}

function toInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new ConfigError(`flag --${name} needs a whole number, got '${value}'`);
  return parsed;
}

function loadRuntime(flags, env) {
  const config = loadConfig(env, flags);
  if (!config.keypairFile) {
    throw new ConfigError('no keypair: set APE_KEYPAIR or pass --keypair <file>. See .env.example.');
  }
  const keypair = Keypair.fromSecretKey(readKeypairFile(config.keypairFile));
  const connection = new Connection(config.endpoint, 'confirmed');
  return { config, keypair, connection };
}

/**
 * Executing needs BOTH an env opt-in and the flag. One of them alone is a
 * mistake, and a mistake should not spend money.
 */
function resolveExecute(flags, config, out) {
  if (!flags.execute) return false;
  if (!config.executeAllowed) {
    out('\n  --execute ignored: set APE_EXECUTE=true in the environment as well.');
    out('  This stays a dry run.\n');
    return false;
  }
  return true;
}

async function commandScan({ config, keypair, connection }, flags, out) {
  const { scanWallet } = await import('./scanner.js');
  const accounts = await scanWallet(connection, keypair.publicKey);
  if (flags.json) return out(JSON.stringify(accounts, null, 2));

  out(header({ wallet: keypair.publicKey.toBase58(), cluster: config.cluster, endpoint: config.endpoint, execute: false }));
  out(`  ${accounts.length} token account${accounts.length === 1 ? '' : 's'}\n`);
  for (const account of accounts) {
    out(`    ${short(account.address)}  mint ${short(account.mint)}  amount ${account.amount}  rent ${formatSol(account.lamports)}`);
  }
  out('');
}

async function commandRun({ config, keypair, connection }, flags, out, { execute }) {
  out(header({ wallet: keypair.publicKey.toBase58(), cluster: config.cluster, endpoint: config.endpoint, execute }));

  const { plan, scanned, result } = await groomOnce({
    connection,
    keypair,
    config,
    execute,
    onEvent: (event) => {
      if (event.type === 'batch') {
        out(event.ok
          ? `  batch ${event.index}/${event.total}: closed ${event.count} → ${event.signature}`
          : `  batch ${event.index}/${event.total}: FAILED ${event.error}`);
      }
    },
  });

  if (flags.json) return out(JSON.stringify({ scanned, plan, result }, null, 2));

  out(renderPlan(plan, { scanned }));
  if (result) out(renderResult(result));
  else if (plan.close.length > 0) out('  dry run: pass --execute (and APE_EXECUTE=true) to send this.\n');

  const quarantined = quarantinedMints(loadMemory(config.memoryFile));
  if (quarantined.length > 0) {
    out(`  quarantined mints (keep coming back): ${quarantined.map(short).join(', ')}\n`);
  }
}

async function commandLoop(runtime, flags, out, { execute }) {
  const intervalMs = (flags.interval ?? 300) * 1000;
  out(`\n  looping every ${flags.interval ?? 300}s — ctrl-c to stop\n`);

  const summary = await runLoop(
    {
      runOnce: async () => {
        try {
          await commandRun(runtime, flags, out, { execute });
          return { ok: true };
        } catch (error) {
          return { ok: false, error: error.message };
        }
      },
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      log: (event) => {
        if (event.type === 'run-failed') out(`  run failed (${event.consecutive} in a row): ${event.error}`);
        if (event.type === 'circuit-open') out('  circuit breaker tripped, stopping.');
        if (event.type === 'sleeping' && event.backingOff) out(`  backing off ${Math.round(event.ms / 1000)}s`);
      },
    },
    { intervalMs, maxRuns: flags.maxRuns ?? Infinity },
  );

  out(`\n  stopped after ${summary.runs} run(s): ${summary.stoppedBecause}\n`);
}

function commandJournal({ config }, flags, out) {
  const runs = readRuns(config.journalFile);
  const totals = summarize(runs);
  if (flags.json) return out(JSON.stringify(totals, null, 2));
  out(renderJournal(totals));
}

async function commandDoctor({ config, keypair, connection }, flags, out) {
  out(header({ wallet: keypair.publicKey.toBase58(), cluster: config.cluster, endpoint: config.endpoint, execute: false }));
  const version = await connection.getVersion();
  const balance = await connection.getBalance(keypair.publicKey);
  out(`  rpc ok            solana-core ${version['solana-core']}`);
  out(`  wallet balance    ${formatSol(balance)}`);
  out(`  execute allowed   ${config.executeAllowed ? 'yes (APE_EXECUTE=true)' : 'no — dry run only'}`);
  out(`  state dir         ${config.stateDir}`);
  out(`  policy            ${JSON.stringify(config.policy)}`);
  out('');
}

/**
 * @param {string[]} argv
 * @param {{env?: object, out?: (line: string) => void}} [io]
 * @returns {Promise<number>} process exit code
 */
export async function main(argv, { env = process.env, out = console.log } = {}) {
  let command;
  let flags;
  try {
    ({ command, flags } = parseArgs(argv));
  } catch (error) {
    out(`\n  ${error.message}`);
    out(USAGE);
    return 1;
  }

  if (command === 'help' || flags.help) {
    out(USAGE);
    return 0;
  }

  try {
    const runtime = loadRuntime(flags, env);
    const execute = resolveExecute(flags, runtime.config, out);

    switch (command) {
      case 'scan': await commandScan(runtime, flags, out); break;
      case 'plan': await commandRun(runtime, flags, out, { execute: false }); break;
      case 'run': await commandRun(runtime, flags, out, { execute }); break;
      case 'loop': await commandLoop(runtime, flags, out, { execute }); break;
      case 'journal': commandJournal(runtime, flags, out); break;
      case 'doctor': await commandDoctor(runtime, flags, out); break;
      default:
        out(`\n  unknown command '${command}'`);
        out(USAGE);
        return 1;
    }
    return 0;
  } catch (error) {
    out(`\n  ${error instanceof ConfigError ? error.message : `run failed: ${error.message}`}\n`);
    return 1;
  }
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
