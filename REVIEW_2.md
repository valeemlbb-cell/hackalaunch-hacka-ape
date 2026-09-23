# REVIEW_2 — deliverables checklist audit (judge 2)

Hackathon: HACKA APE (hackalaunch.com/h/hacka-ape). Rules re-read 2026-09-24.
Required: public GitHub repo + explanatory README · demo video <= 3 min (YouTube/Loom/Vimeo/X) ·
brief description/rationale · prior work clearly marked. Disqualifiers: plagiarism,
non-functional demo, malicious code. Deadline 30 Sep 15:06 UTC.

## Checklist

| Artefact | State | Evidence |
|---|---|---|
| Public GitHub repo | NOT DONE (human step, documented) | `gh` unauthenticated; exact `gh repo create ape-groom --public --source=. --remote=origin --push` line present in RUN.md §1 |
| Repo public-ready | YES | 38 tracked files, `node_modules/` + `.ape/` + `.env`/`*-keypair.json` gitignored; no secrets tracked; 1 clean commit `bd1b318` |
| Explanatory README | YES, strong | install / configure / run / all-commands table / architecture map / disclosure / MIT |
| Setup, networks | YES | `.env.example` fully commented; cluster localnet/devnet/testnet, mainnet refused at startup |
| Program IDs | PARTIAL | no custom program deployed; README never states the two SPL Token program IDs it scans |
| Tests run and pass | YES, verified by me | `npm test` → 100 pass / 0 fail, 837 ms |
| Coverage claim | VERIFIED EXACT | `all files 89.74 lines / 92.31 branches` — matches README's 89.7 / 92.3 |
| Demo video <= 3 min | YES | `demo.mp4` 120.53 s, 2.18 MB (+ `demo_small.mp4` 0.48 MB) |
| Video hosted | NOT DONE (human step) | RUN.md §2 gives YouTube-unlisted steps |
| Brief description | YES | SUBMISSION.md "The short description" is submit-ready |
| Prior work marked | YES | explicit disclosure: all code written in window, only deps `@solana/web3.js` + `@solana/spl-token` (Apache-2.0) |
| No admin backdoor | VERIFIED | `src/executor.js:28-29` destination and authority both hardcoded to `owner`; `test/executor.test.js` asserts no third-party address appears |
| Licence | YES | MIT, LICENSE present |

## Blocking / risk findings

1. **Placeholder URLs still in submission text.** `https://github.com/<your-org>/ape-groom`
   appears in README (Install) and SUBMISSION.md; the demo-video line is still a local filename.
   If anything is submitted before RUN.md §3 runs, the entry is effectively broken.
2. **Demo is a rendered terminal playback, not a screen capture.** Disclosed honestly in
   SUBMISSION.md, and the text is verbatim captured output — but "non-functional demos" is an
   explicit disqualifier, and a text-only playback is the weakest possible proof to a voter who
   skims. It needs on-screen, verifiable anchors (a real explorer/tx signature visible).
3. **Demo ran on `solana-test-validator`, not devnet.** Disclosed (faucet dry). Acceptable and
   within the devnet-only constraint, but it means no publicly checkable transaction exists.
4. **No verifiable artefact of the claimed run.** README quotes a signature
   `2gwXkuT…vbSSZ` that nobody can look up, because it lived on a disposable local ledger.

## Concrete fixes (ranked)

1. Run RUN.md §1–§3 and replace both `<your-org>` placeholders and the video line before submitting.
2. Re-record, or append ~20 s, against **public devnet** when the faucet is up, and show one real
   signature open in explorer.solana.com?cluster=devnet. This converts finding 2+3+4 into a
   strength and removes the only disqualification surface.
3. Commit the captured run log (e.g. `docs/demo-run.txt` — `docs/` is currently an empty,
   untracked directory) so a voter can diff the video text against a file in the repo.
4. Add `"test:coverage": "node --test --experimental-test-coverage \"test/**/*.test.js\""` to
   package.json so the README's coverage claim is one command, not a pasted invocation.
5. State the two SPL Token program IDs (`Tokenkeg…` and `TokenzQd…`) in the README's
   "How it fits together" section — a reviewer should not have to read `src/constants.js`.
6. Add a 10-line GitHub Actions workflow running `npm ci && npm test`, so the "100 tests pass"
   claim is green on the public repo page rather than asserted in prose.
7. Delete the empty `docs/` and `test/fixtures/` directories or fill them; empty dirs vanish on
   push anyway and the README implies fixtures exist.

## Score

**86 / 100.** Everything that the agent was allowed to produce is present, correct and verified:
tests genuinely run and pass, the coverage number is exact to the decimal, the no-backdoor claim
holds in the source, the video is under the cap, and prior-work disclosure is unusually honest.
Points come off only for the three human steps still outstanding (repo push, video upload,
placeholder swap) and for a demo whose evidence cannot be independently checked by a voter.
