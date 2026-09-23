# REVIEW_3 — judge 3, token-holder lens

Reviewed 2026-09-24. Rules page re-read (hackalaunch.com/h/hacka-ape): public repo +
functional README, demo video <= 3 min on YouTube/Loom/Vimeo/X, short description,
one submission per person, updatable until close. Closes Sep 30 15:06 UTC. Judged by
24h token-weighted $HACKA vote; **earlier submissions win ties**. Pool ~0.0869 SOL
plus all future fee claims forwarded to the winner's payout address forever.
DQ: plagiarism, non-functional demo, malicious code.

**Score: 84 / 100.** I would vote for this over a typical submission.

## What I verified myself

- `npm test` → **100 tests, 100 pass, 0 fail**, 0.92 s, no network. Claim is true.
- `src/executor.js` hardcodes the close destination to `owner` (both destination and
  authority args). No configurable payout, no admin key. Claim is true.
- Mainnet guard exists (`src/config.js`, `MAINNET_MARKERS` in `src/constants.js`).
- `git ls-files` → 38 files, no `.env`, no keypair, no `node_modules`, `.ape/` ignored.
  `.env.example` present, MIT LICENSE present. Clean.
- `demo.mp4` = 1280x720, **120.5 s** — inside the 3-minute cap.
- Pre-hackathon disclosure present in both README and SUBMISSION.md.

No rule violations, no DQ risk that I can see.

## As a token holder deciding where the pool goes

**Obviously useful?** Yes, and unusually so for a hackathon. "Your dead token accounts
are holding your SOL hostage" is a problem every voter in this crowd personally has.
The payoff is denominated in the thing they care about. That is the strongest asset here.

**Well presented?** Mostly. README and SUBMISSION.md are genuinely good writing — the
"why it's an agent, not a cron job" section pre-empts the exact objection a sceptical
voter raises, and the quarantine/anti-farming argument is the single most convincing
paragraph in the packet. The safety section reads as structural rather than promised.

**Where it loses votes:**

1. **The demo ran on a local validator, not devnet.** Honestly disclosed, which I
   respect — but a voter skimming twenty submissions reads "not devnet, faucet was dry"
   as a hedge, and the rules explicitly DQ non-functional demos. There is nothing a
   voter can *click* to confirm a real transaction happened. The signatures in the
   README resolve to nothing on any public explorer.
2. **The video is silent, static terminal playback with a lot of dead frame.** At 0:08
   it is a title card; at 1:35 it is four lines of text in the top-left of a 720p frame.
   No voice, no audio track at all, no face, no motion. It is honest and it is boring,
   and 2:00 of that loses the scroll-past audience in the first ten seconds.
3. **Repo and video URLs are still `<your-org>` placeholders** in SUBMISSION.md. Correct
   for an agent that cannot push, but it is the thing most likely to get forgotten and
   submitted as-is.
4. **No hosted surface.** Every rival with a web page gets clicked; a CLI gets read.
   There is no "try it" path that does not involve npm install.
5. Ties break toward the earlier submission and the pool includes *perpetual* fee
   forwarding — submitting on the 30th is leaving real value on the table.

## The single change that would most raise its odds

**Re-run the whole demo against public devnet and put clickable explorer links at the
top of the README.** One line under the title:

> Verified on devnet: [tx 1](https://explorer.solana.com/tx/<sig>?cluster=devnet) ·
> [tx 2](...) · [wallet](https://explorer.solana.com/address/<pubkey>?cluster=devnet)

That converts the packet's weakest sentence ("recorded against a local validator
because the faucet was dry") into its strongest ("go click it yourself"), removes the
only plausible DQ argument, and gives a voter a five-second verification instead of a
five-minute read. Nothing else in this packet moves as many votes per hour of work.
The faucet at faucet.solana.com only needs to yield ~0.1 SOL for this.

## Concrete fixes, ranked

1. Re-record `run`/`scan`/`journal` on public devnet; replace the localnet signatures
   and the "faucet was dry" disclosure with live explorer links in README, SUBMISSION.md
   and the video's closing card. (Highest impact.)
2. Rebuild the first 10 seconds of the video: open on the result — `net to wallet
   0.016304 SOL`, `closed 8 accounts` — then cut back to the problem. Lead with the
   money, not with a title card.
3. Add a 60 s narration or at minimum an audio bed; the file currently has no audio
   stream at all, which reads as unfinished on YouTube and X.
4. Tighten the terminal frames: crop/zoom so text fills the frame instead of sitting in
   the top-left quarter of 1280x720.
5. Add a `demo.gif` (or an animated SVG terminal cast) to the top of the README, so the
   repo sells itself before anyone opens the video.
6. Fill the two `<your-org>` placeholders the moment the repo exists, and re-read
   SUBMISSION.md end-to-end before pasting the description into the form.
7. Add a one-paragraph "what this is NOT" to the README (it does not trade, does not
   move tokens, cannot send SOL anywhere but back to you) — voters scanning for rug
   risk will look for exactly that and it is currently spread across three bullets.
8. Submit as soon as the repo and video URLs exist. Ties go to the earlier submission,
   and the submission can be edited until close.
9. Optional, cheap: a `--json` badge or a short `ape doctor` output block in the README
   showing the two-key execute rule refusing to sign — it makes the safety claim visible
   rather than asserted.

## Scoring breakdown

| Dimension | /20 | Note |
|---|---|---|
| Usefulness of the idea | 18 | Real money, real annoyance, obvious to any holder |
| Does it work end-to-end | 16 | It does — but proven on localnet, not clickable |
| Presentation (README/desc) | 18 | Strong prose, well argued, honest |
| Demo video | 13 | In spec, truthful, silent and slow |
| Trust / safety posture | 19 | Hardcoded destination + mainnet refusal + two-key gate |
| **Total** | **84** | |
