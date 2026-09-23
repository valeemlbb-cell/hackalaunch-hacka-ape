# 🦍 ape-groom

**An Autonomous Primate Engine that grooms your Solana wallet and hands you back your own SOL.**

Built for [HACKA APE](https://hackalaunch.com/h/hacka-ape) — *"one week to ship an autonomous primate engine (APE) agent that does something useful."*

---

## The useful thing

Every SPL token account on Solana is rent-exempt, which means **~0.002 SOL is locked inside it forever** until somebody closes it. Every airdrop you ignored, every token you fully sold, every NFT you burned, every pool you exited — each one left an empty account behind with your SOL sitting in it.

Nobody closes these by hand. There are hundreds of them in an active wallet.

`ape-groom` is an agent that does it for you, on a loop, while you sleep:

> **look** at every token account → **decide** which are genuinely dead → **close** them in batches → **remember** what it did → **write it down**.

Primates groom each other to pick off the parasites. This one picks the dead accounts off your wallet.

## Verified real run

From the demo recording, against a live local validator (see [Disclosure](#disclosure)) — 10 token accounts, 8 of them dead:

```
  scanned   10 token accounts
  close     8
  keep      2

  LEFT ALONE
    - 1×    frozen                     account is frozen, the token program will not close it
    - 1×    holds-balance              still holds tokens

  rent reclaimable   0.016314 SOL (16,314,240 lamports)
  network fee        0.000010 SOL (10,000 lamports) in 2 tx
  net to wallet      0.016304 SOL (16,304,240 lamports)

  SENT
    ✓ 2gwXkuToquR4XuodoWeBuCjPMgo6hipBZYLFjMBgPpPtcLGtp1LAcrYXKooi5Kj2wxvTrHYraY9iJiWuXE4vbSSZ
    ✓ 4ZCG9EjxZxVB9JbacuwPkWL5X12BHNntazjVgapgJDLN46Vh3XfXNw5fBFQ9bbjQQvwUoCm1rzRW959WgF8gdAwV

  closed 8 accounts
```

On-chain confirmation of the first transaction: 5 close instructions, `err: null`, and the wallet's balance moved by **+0.0101914 SOL** — exactly 5 × 0.00203928 rent minus the 5,000-lamport fee. The two survivors were the frozen account and the one still holding 1,250 tokens.

## What makes it an agent, not a script

Three things:

1. **It reasons, and shows its work.** Every account gets a decision with a stated reason. Ten ordered rules run before anything is closed — frozen, uninitialized, still holds tokens, wrapped SOL, close authority belongs to someone else, a delegate still has an allowance, protected mint, quarantined, below threshold, over the run cap.

2. **It remembers, so it can't be farmed.** A spammer can recreate the same empty account every hour. A dumb loop would close it forever and pay a fee every single time. `ape-groom` counts how often a mint comes back and **quarantines** it after three closes — it stops paying to fight a faucet. This is the whole reason `memory.json` exists.

3. **It refuses to act at a loss.** Fees are modelled per batch. If reclaiming the rent would cost more than the rent is worth, the plan comes back empty.

Plus the boring autonomy that makes an unattended loop survivable: exponential backoff on a flaky RPC, a circuit breaker that stops after five consecutive failures instead of hammering a dead endpoint, jitter so a fleet of these doesn't stampede one node, and an append-only journal of everything it ever did.

## Safety

This is an agent that signs transactions on a loop while nobody is watching, so the constraints are structural rather than promised:

- **The rent always goes back to the wallet that owned the account.** There is no configurable destination, no fee split, no admin key, no upgrade authority. Look at `src/executor.js` — the destination argument is `owner`, hardcoded. `test/executor.test.js` asserts that no third-party address can appear anywhere in a close transaction.
- **Mainnet is refused at startup.** Any endpoint containing `mainnet` throws before a connection is opened. Devnet, testnet and localnet only.
- **Signing takes two independent keys.** `APE_EXECUTE=true` in the environment *and* `--execute` on the command line. Either one alone leaves it a dry run, and says so.
- **Dry run is the default** for every command.
- **No secrets in this repo.** The keypair is read from a path you supply; `.env` and `*-keypair.json` are gitignored. See `.env.example`.
- **It stops at the first failing batch** rather than ploughing on, so a bad run costs one fee instead of many.

## Install

```bash
git clone https://github.com/<your-org>/ape-groom.git
cd ape-groom
npm install
```

Requires Node 20.11+.

## Configure

```bash
cp .env.example .env
```

Generate a throwaway devnet wallet — **keep it outside the repo**:

```bash
solana-keygen new --no-bip39-passphrase -o ~/.config/solana/ape-devnet.json
solana airdrop 2 --url devnet --keypair ~/.config/solana/ape-devnet.json
```

Then point `.env` at it:

```bash
APE_CLUSTER=devnet
APE_KEYPAIR=~/.config/solana/ape-devnet.json
APE_EXECUTE=false
```

Load it into your shell (`export $(grep -v '^#' .env | xargs)`), or pass the same values as flags.

## Run

Check the wiring first:

```bash
npm run ape -- doctor
```

See what it would do — this never signs anything:

```bash
npm run ape -- plan
```

Do it, once:

```bash
APE_EXECUTE=true npm run ape -- run --execute
```

Let it run autonomously, every 5 minutes:

```bash
APE_EXECUTE=true npm run ape -- loop --interval 300 --execute
```

Read the lifetime ledger:

```bash
npm run ape -- journal
```

### Want something to groom?

On devnet or a local validator, make the wallet messy on purpose — eight dead accounts, one holding tokens, one frozen:

```bash
npm run seed
```

### All commands

| Command | What it does |
|---|---|
| `ape doctor` | Check config, RPC, balance and policy |
| `ape scan` | List the wallet's token accounts |
| `ape plan` | Decide what to close and explain every decision |
| `ape run [--execute]` | One grooming cycle |
| `ape loop [--interval s]` | Keep grooming, autonomously |
| `ape journal` | Lifetime totals from the run journal |

Useful flags: `--cluster`, `--rpc-url`, `--keypair`, `--batch-size`, `--max-accounts`, `--min-reclaim`, `--include-wsol`, `--json`.

## Test

```bash
npm test
```

**100 tests, all passing.** Coverage: **89.7% of lines, 92.3% of branches.** The decision engine, policy validation, memory, journal and the autonomous loop are each at 100% line coverage; the loop's backoff and circuit breaker are tested with an injected clock, so the suite runs in under a second with no network.

```bash
node --test --experimental-test-coverage "test/**/*.test.js"
```

## How it fits together

```
cli.js         commands, flag parsing, the two-key execute rule
 └ agent.js    one cycle: scan → plan → execute → remember → journal
    ├ scanner.js    RPC: read token accounts (both SPL token programs)
    ├ planner.js    THE BRAIN — pure decisions, no I/O
    ├ executor.js   build and send close transactions, batched
    ├ memory.js     what keeps coming back (quarantine)
    └ journal.js    append-only record of every run
```

### What it touches on chain

Exactly two programs, both scanned and both closed through the standard `CloseAccount` instruction — no custom program is deployed and nothing else is ever signed:

| Program | Address |
|---|---|
| SPL Token | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` |
| SPL Token-2022 | `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` |

They are declared in [`src/constants.js`](src/constants.js) and nowhere else.

`planner.js`, `policy.js`, `lamports.js` and `format.js` are pure functions — no network, no clock, no disk. That is why the interesting behaviour is cheap to test and safe to reason about.

## Disclosure

**All code in this repository was written during the HACKA APE hackathon window.** No pre-hackathon code was carried in. The only third-party code is the two declared dependencies, `@solana/web3.js` (MIT) and `@solana/spl-token` (Apache-2.0) — both unmodified, installed from npm. No fonts, images, music or other assets are used anywhere in this repo or in the video.

**The demo was recorded against a local Solana validator** (`solana-test-validator`) rather than public devnet, because the public devnet faucet was rate-limited and returning *"the airdrop faucet has run dry"* at the time of recording. It is the same validator software, the same SPL Token program and the same real transactions — and the agent runs identically against devnet by setting `APE_CLUSTER=devnet`.

**The video is a terminal playback rendered from the captured session, not a screen capture.** The same statement is the first thing on screen in `demo.mp4`. Every line of terminal text in it is the real, unedited output of the run described above: the commands were run against the local validator, their stdout was captured to files, and the renderer only draws those captured lines one at a time. Nothing was re-typed, re-ordered or staged. The capture files and the renderer are reproducible from [RUN.md](RUN.md#reproducing-the-demo-run-yourself).

## Licence

MIT — see [LICENSE](LICENSE).

---

Built by **Warung Ops** · [@issue0x](https://x.com/issue0x)
