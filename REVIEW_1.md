# REVIEW_1 — hostile-judge audit of `ape-groom` (HACKA APE)

Reviewer: Judge 1 (adversarial). Date: 2026-09-24. Score: **88 / 100**. Verdict: **not disqualifiable as it stands**, but two items must be fixed before submit.

Rules re-read from <https://hackalaunch.com/h/hacka-ape>: public GitHub repo with explanatory README; demo video <= 3 min on YouTube/Loom/Vimeo/X; brief description; solo or team <= 4; pre-hackathon work must be marked; one submission per person, updatable until close (Sep 30, 15:06 UTC); 24-hour token-weighted holder vote after close, ties favour the earlier submission. Removal from voting for: **plagiarism, non-functional demo, malicious code**.

## Disqualifier sweep — what I tried to kill it with

| Attack | Result | Evidence |
|---|---|---|
| Secrets in the repo | **Clean** | `git ls-files` = 38 files, no `.env`, no keypair, no `.ape/`. `.gitignore` covers `.env`, `*-keypair.json`, `id.json`, `*.pem`, `.ape/`. Regex sweep for keys/long base58 found only the two devnet signatures printed in the README. |
| Mainnet money | **Clean** | `assertNotMainnet()` in `src/config.js` runs before any `Connection` is opened; `MAINNET_MARKERS` in `src/constants.js`; asserted by `test/config.test.js` and end-to-end in `test/cli.test.js`. Demo ran on a local validator, one step safer than devnet. |
| Admin backdoor / drain | **Clean** | `src/executor.js` hardcodes both destination and authority to `owner`. No configurable destination, no fee split, no upgrade authority. `test/executor.test.js` asserts no third-party address can appear in a close transaction. |
| Malicious code | **Clean** | Only two deps, both from npm, unmodified. No network egress beyond the configured RPC, no telemetry, no `child_process`, no dynamic `eval`. |
| Non-functional demo | **Survives, with a caveat** — see F1 | `npm test` → **100 tests, 100 pass, 0 fail, 849 ms**. Coverage re-run matches the claim to the decimal: 89.74 % line / 92.31 % branch. `demo.mp4` is 120.5 s (inside the 3-min cap), 1280x720 h264. |
| Plagiarism | **Clean** | Single commit authored in-window, original prose, pre-hackathon status explicitly declared as "none carried in". |
| Unlicensed assets | **Clean** | No fonts, images, audio or third-party media anywhere. `ffprobe` shows the video has **one stream, video only** — no music bed to license. MIT `LICENSE` present. |
| Missing `.env.example` | **Clean** | Present, documents every variable, explicitly tells the user to keep the keypair outside the repo and that mainnet is not an option. |
| Missing human-approval gate | **Clean** | No outreach/social feature exists, so the outreach gate is N/A. The money-moving gate is real and doubled: `APE_EXECUTE=true` **and** `--execute`; either alone prints that it is staying a dry run. Dry run is the default for every command. |

## Findings

**F1 — HIGH — the video's provenance is disclosed in `SUBMISSION.md` but not in the README or on screen.**
`SUBMISSION.md` states the video is "a terminal playback rendered from the captured session, not a screen capture". The README never says this. A judge who reads only the repo (which is what the platform links) sees a slick terminal video and a README claiming a "Verified real run", and the cheapest hostile read is *staged demo* — the exact wording of a removal criterion. The disclosure is honest; it is just in the wrong file.
Fix: move the paragraph into the README's disclosure section, and add a 2-second title card at the head of the video reading "terminal playback of a real run — solana-test-validator, unedited output".

**F2 — HIGH — two `<your-org>` placeholders will ship a dead repo link if anyone submits in a hurry.**
`README.md:73` and `SUBMISSION.md:4`. `RUN.md` step 3 covers it, but a broken repo URL in the submission field is a self-inflicted removal.
Fix: after the push in RUN.md step 1, `sed -i 's|<your-org>|<real-org>|g' README.md SUBMISSION.md` and re-push, before step 4.

**F3 — MEDIUM — factual error in the licence claim, in the one section whose whole job is credibility.**
Both README:184 and SUBMISSION.md say the two dependencies are "both Apache-2.0". `@solana/web3.js` is **MIT**; only `@solana/spl-token` is Apache-2.0. Verified from the installed `package.json` files. Small, but a judge who checks one fact and finds it wrong discounts the other claims (coverage, on-chain balance delta) that they cannot check as cheaply.
Fix: "`@solana/web3.js` (MIT) and `@solana/spl-token` (Apache-2.0)".

**F4 — MEDIUM — README:30 says the run was "against a live cluster"; the localnet disclosure is 156 lines below it.**
Technically true, but the gap between the claim and its qualifier is exactly where a bad-faith reading lives.
Fix: "against a live local validator (see Disclosure)".

**F5 — LOW — a silent, voiceless 2-minute terminal video is weak for a token-weighted popularity vote.**
Not a rules problem; a winning problem. The vote is 24 hours of holders skimming. The strongest 15 seconds of this project — "it quarantines a mint that keeps respawning, so a spammer cannot farm your fees" — is buried in the middle of a text scroll.
Fix: open on the net-SOL-returned number, add burned-in captions for the three decision moments (frozen account spared, token-holding account spared, quarantine), keep it under 2:00.

**F6 — LOW — `RUN.md` names the exact local-validator ports and scratch ledger path.**
Harmless operationally, but it reads as internal ops notes rather than judge-facing material. Trim the last section, or move it to `docs/`.

## What is genuinely strong

The memory/quarantine behaviour is the real answer to "why is this an agent and not a cron job", and it is backed by tests rather than asserted in prose. The refusal to act at a net loss, the circuit breaker, and the hardcoded rent destination are the three things a sceptical judge actually wants to see in something that signs unattended. Coverage claims reproduce exactly, which is rare enough to be worth trusting.

Fix F1 and F2 before submitting; F3 and F4 are one-line edits worth doing in the same pass.
