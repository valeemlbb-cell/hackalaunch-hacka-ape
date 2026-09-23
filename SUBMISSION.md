<!-- generated-header v2 -->
# SUBMISSION — hacka-ape

Paste-ready. Five fields, in the order the HackaLaunch form asks for them.
Refreshed 2026-09-24T05:06:10+07:00.

---

## TITLE  (65/80 chars)

```
ape-groom — an autonomous primate that closes dead token accounts
```

## DESCRIPTION  (1492 chars)

```
ape-groom grooms a Solana wallet and hands back the SOL locked in dead token accounts.

What it does: every SPL token account is rent-exempt, which means roughly 0.002 SOL sits locked inside it forever until somebody closes it. Every airdrop you ignored, every token you sold, every pool you exited left an empty account behind with your SOL in it, and nobody closes them by hand — an active wallet has hundreds. ape-groom runs the loop: look at every token account, decide which are dead, close them in batches, remember what it did, write it down.

How it works: it enumerates token accounts, classifies each, and closes only what is provably safe. Accounts holding a balance are left alone; so are frozen ones, which the token program will not close anyway. Closes are batched into transactions, every signature is recorded, and the run report prints rent reclaimable, network fee and net to wallet in both SOL and lamports, so the arithmetic can be checked against the chain rather than believed.

Real vs mocked: real. The recorded run in the README is a live run against a Solana validator — 10 accounts scanned, 8 closed, 2 correctly left alone (one frozen, one holding 1,250 tokens), 0.016314 SOL reclaimed for 10,000 lamports of fees across 2 transactions. The first transaction is confirmed on chain, 5 close instructions, err: null, wallet balance moved by exactly 5 × 0.00203928 SOL minus the fee. Devnet/local only.

How to run: `npm install && npm test`, then the groom command.
```

## REPO URL

```
https://github.com/valeemlbb-cell/hackalaunch-hacka-ape
```

## VIDEO URL

```
VIDEO_URL_PENDING
```

> The main session posts `demo_x.mp4` from this folder to X and replaces the
> line above with the public post URL. The form needs a **link**; a file is useless.

## SOLANA PAYOUT ADDRESS

```
7W31iaCmjerN1jkpEnmZevn74SZxv83yEQvLsnc4PS7Q
```

---

## Appendix — earlier submission notes (kept verbatim)

# HACKA APE submission — `ape-groom`

**Team:** Warung Ops (solo) · [@issue0x](https://x.com/issue0x) · rakavaleeqa@warungsosmed.store
**Repo:** `https://github.com/<your-org>/ape-groom` *(fill in after the repo is pushed — see RUN.md)*
**Demo video:** `demo.mp4` — 2:00 *(upload to YouTube/X and paste the link here)*
**Payout wallet:** `7W31iaCmjerN1jkpEnmZevn74SZxv83yEQvLsnc4PS7Q`

---

## The short description

**ape-groom is an Autonomous Primate Engine that grooms your Solana wallet and gives you back your own SOL.**

Every SPL token account on Solana is rent-exempt, which means roughly **0.002 SOL is locked inside it until somebody closes it**. Every airdrop you ignored, every token you fully sold, every NFT you burned, every LP you exited — each one left an empty account behind with your SOL sitting in it. An active wallet accumulates hundreds. Nobody closes them by hand, because doing it by hand is miserable.

So I built the ape that does it while you sleep: it **looks** at every token account, **decides** which ones are genuinely dead, **closes** them in batches, **remembers** what it did, and **writes it down**. Primates groom each other to pick off parasites — this one picks the dead accounts off your wallet.

In the demo it scans 10 accounts, closes 8, leaves 2 alone, and returns **0.016304 SOL** net of fees in 2 transactions.

## Why it is an agent and not a cron job

**It reasons, and it shows its work.** Ten ordered rules run before anything is closed, and every account gets a stated reason it was touched or spared: frozen, uninitialized, still holds tokens, wrapped SOL, close authority belongs to someone else, a delegate still has an allowance, protected mint, quarantined, below threshold, over the run cap. The demo shows it correctly sparing a frozen account and one holding 1,250 tokens without being told to.

**It remembers, so it cannot be farmed.** A spammer can recreate the same empty account every hour. A naive loop would close it forever and pay a fee every single time — the agent would quietly bleed SOL to an attacker. `ape-groom` counts how often a mint comes back and **quarantines** it after three closes. That single behaviour is why `memory.json` exists, and it is the difference between an agent and a script.

**It refuses to act at a loss.** Fees are modelled per batch; if the fee would exceed the rent recovered, the plan comes back empty.

And the unglamorous autonomy that makes an unattended loop survivable: exponential backoff, a circuit breaker that stops after five consecutive failures instead of hammering a dead RPC, jitter so a fleet doesn't stampede one node, and an append-only journal of every run.

## Why you can trust it with a wallet

This thing signs transactions on a loop while nobody is watching, so the guarantees are structural, not promises:

- **Rent always goes back to the wallet that owned the account.** No configurable destination, no fee split, no admin key, no upgrade authority. `src/executor.js` hardcodes the destination to `owner`, and `test/executor.test.js` asserts that no third-party address can appear anywhere in a close transaction.
- **Mainnet is refused at startup** — any endpoint containing `mainnet` throws before a connection opens.
- **Signing needs two independent keys**: `APE_EXECUTE=true` in the environment *and* `--execute` on the command line. Either alone stays a dry run and says so.
- **Dry run is the default** for every command.
- **No secrets in the repo** — the keypair path is supplied by you; `.env` and `*-keypair.json` are gitignored.

## Evidence it actually works

- **100 tests, all passing. 89.7% line coverage, 92.3% branch coverage.** The decision engine, policy validation, memory, journal and the autonomous loop are each at 100% line coverage. The backoff and circuit breaker are tested with an injected clock, so the whole suite runs in under a second with no network.
- **Real transactions, verified on chain.** The first batch of the demo run carried 5 close instructions, returned `err: null`, and moved the wallet's balance by exactly **+0.0101914 SOL** — 5 × 0.00203928 rent minus the 5,000-lamport fee. A follow-up `ape scan` shows only the 2 accounts that should have survived.
- Everything in the video is the **verbatim captured output of that real run**.

## Honest disclosure

- **All code here was written during the HACKA APE window.** No pre-hackathon code was carried in. The only third-party code is `@solana/web3.js` (MIT) and `@solana/spl-token` (Apache-2.0) — both unmodified, installed from npm. No fonts, images, music or other assets are used in the repo or the video.
- **The demo was recorded against a local Solana validator** (`solana-test-validator`), not public devnet, because the public devnet faucet was returning *"the airdrop faucet has run dry"* while I was recording. Same validator software, same SPL Token program, same real transactions. The agent runs identically against devnet with `APE_CLUSTER=devnet`.
- **The video is a terminal playback rendered from the captured session**, not a screen capture. Every line of terminal text in it is the real, unedited output of the run described above; nothing was re-typed or staged. This is stated on the first card of the video itself and in the README's Disclosure section, not only here.

## Try it in four lines

```bash
npm install
cp .env.example .env          # point APE_KEYPAIR at a throwaway devnet wallet
npm run seed                  # optional: make the wallet messy on purpose
npm run ape -- plan           # never signs anything
```

MIT licensed.
