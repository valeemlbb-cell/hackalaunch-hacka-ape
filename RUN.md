# RUN.md — what a human still has to do

The agent built, tested and committed this repo, and recorded the demo. It is **not** authorised to create accounts, push to GitHub, upload video or submit on the platform. Those four steps are below, in order.

Everything here runs from `D:\warung-ops\hacka\hacka-ape`.

---

## 1. Publish the repo

`gh` is currently unauthenticated on this machine. Authenticate once:

```bash
gh auth login
```

Then create the public repo and push the existing commit in one line:

```bash
gh repo create ape-groom --public --source=. --remote=origin --push --description "An Autonomous Primate Engine that grooms your Solana wallet and hands you back the SOL locked in dead SPL token accounts. Built for HACKA APE."
```

If the name is taken, prefix it with the org or a suffix, e.g. `warung-ops/ape-groom` or `ape-groom-solana`.

Verify, and note the org/user the repo actually landed under:

```bash
gh repo view --web
gh repo view --json nameWithOwner -q .nameWithOwner
```

**Immediately after the push**, replace the `<your-org>` placeholder everywhere and push the fix, so no dead repo link can reach the submission field:

```bash
sed -i 's|<your-org>|<real-org>|g' README.md SUBMISSION.md
grep -rn '<your-org>' README.md SUBMISSION.md && echo "STILL PLACEHOLDERS — fix before submitting" || echo "clean"
git commit -am "docs: real repo URL" && git push
```

Substitute the owner from `gh repo view` above for `<real-org>`. On macOS use `sed -i ''` instead of `sed -i`.

## 2. Upload the demo video

- `demo.mp4` — 1280×720, **2:00**, 2.2 MB (the submission copy)
- `demo_small.mp4` — 960×540, 0.5 MB (for anywhere with a tight size cap)

The platform accepts YouTube, Loom, Vimeo or X. YouTube unlisted is the safest:

1. youtube.com/upload → select `demo.mp4`
2. Title: `ape-groom — an Autonomous Primate Engine for Solana (HACKA APE)`
3. Visibility: **Unlisted**
4. Copy the link.

## 3. Fill in the video link

Step 1 already removed the repo placeholder. The remaining one is the video:

In `SUBMISSION.md`, replace the **Demo video** line with the real URL from step 2, then:

```bash
grep -rn '<your-org>\|demo.mp4` — 2:00' README.md SUBMISSION.md   # must print nothing
git commit -am "docs: add demo video link" && git push
```

## 4. Submit on the platform

Go to <https://hackalaunch.com/h/hacka-ape> and submit:

| Field | Value |
|---|---|
| Repo | the URL from step 1 |
| Video | the URL from step 2 |
| Description | the **"The short description"** section of `SUBMISSION.md` |
| Payout wallet | `7W31iaCmjerN1jkpEnmZevn74SZxv83yEQvLsnc4PS7Q` |

**Deadline: 30 September, 3:06 PM UTC.** Voting runs the 24 hours after that. Submissions can be updated until close, so it is worth submitting early and refining later.

---

## Reproducing the demo run yourself

The public devnet faucet was dry during recording, so the run used a local validator. To repeat it:

```bash
# 1. a local cluster with a working faucet
solana-test-validator --ledger /tmp/apeledger --reset --quiet \
  --rpc-port 8799 --faucet-port 9800 --faucet-sol 5000

# 2. a throwaway wallet, funded from the ledger's faucet keypair
solana-keygen new --no-bip39-passphrase -o /tmp/ape-demo.json
solana transfer --from /tmp/apeledger/faucet-keypair.json \
  $(solana-keygen pubkey /tmp/ape-demo.json) 5 \
  --url http://127.0.0.1:8799 --fee-payer /tmp/apeledger/faucet-keypair.json --allow-unfunded-recipient

# 3. point the agent at it
export APE_RPC_URL=http://127.0.0.1:8799 APE_CLUSTER=localnet
export APE_KEYPAIR=/tmp/ape-demo.json APE_EXECUTE=true

# 4. the run from the video
npm test
node src/cli.js doctor
node scripts/seed-devnet.mjs
node src/cli.js plan
node src/cli.js run --execute --batch-size 5 --max-accounts 20
node src/cli.js scan
node src/cli.js journal
```

Against real devnet instead, drop `APE_RPC_URL`, set `APE_CLUSTER=devnet`, and fund the wallet from <https://faucet.solana.com> when the faucet is up.

## Note on the local validator

The recording used a `solana-test-validator` on ports **8799 / 9800** with its ledger in the session scratchpad. It is disposable — kill it and delete the ledger directory whenever you like. Two other validators from sibling workflow packets were running on 8899 and 8999 and were deliberately left untouched.
