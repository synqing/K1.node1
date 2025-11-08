# K1.node1 Pre-Merge Gates & Release Workflow

## Overview

This guide covers the two new GitHub Actions workflows that enforce quality gates before merging to main and automate releases via tags.

### Workflows

1. **pre-merge.yml** — Blocks merges unless both halves pass their respective gates
2. **release.yml** — Tag-driven releases for web and firmware (automatically publishes to GitHub Releases)

---

## Pre-Merge Gates (pre-merge.yml)

### What It Does

- **Triggers on:** Pull requests that touch `webapp/`, `firmware/`, or `ops/`
- **Jobs:** Conditional job gating based on path changes
  - **Gate — Web**: Runs if webapp changes detected
    - TypeScript typecheck
    - ESLint (if configured)
    - Unit tests
    - (Does NOT build; build happens only in release workflow)
  - **Gate — Firmware**: Runs if firmware changes detected
    - PlatformIO build (esp32-s3-devkitc-1)
    - Hardware tests (if configured)

### Behavior

**Scenario 1: PR touches only webapp/**
```
changes job → detects web=true, fw=false
↓
Gate — Web runs (typecheck, lint, test) ✓
Gate — Firmware skipped
↓
Status: PASS (if web gate passes)
```

**Scenario 2: PR touches only firmware/**
```
changes job → detects web=false, fw=true
↓
Gate — Web skipped
Gate — Firmware runs (build, test) ✓
↓
Status: PASS (if firmware gate passes)
```

**Scenario 3: PR touches both webapp/ and firmware/**
```
changes job → detects web=true, fw=true
↓
Gate — Web runs (all checks) ✓
Gate — Firmware runs (all checks) ✓
↓
Status: PASS (only if BOTH gates pass)
```

### Job Details

#### Gate — Web

**Node version:** From .nvmrc (currently 20)
**Cache:** npm dependencies (package-lock.json hash)
**Preflight:** Checks Node ≥20, npm, .env
**Steps:**
1. Checkout
2. Setup Node + cache
3. Prepare .env (copy from example if missing)
4. Preflight check (--scope web)
5. Install dependencies (auto-detects pnpm/yarn/npm)
6. TypeScript typecheck (`npm run typecheck` or `npx tsc --noEmit`)
7. Lint (`npm run lint` if present)
8. Unit tests (`npm test -- --runInBand` if present)

**Failure:** Any step failure blocks the merge

#### Gate — Firmware

**Python version:** 3.x
**Package manager:** PlatformIO (via pipx)
**Cache:** PlatformIO frameworks/toolchains (platformio.ini hash)
**Preflight:** Checks .env, PlatformIO availability
**Steps:**
1. Checkout
2. Setup Python + cache
3. Install PlatformIO via pipx
4. Cache PlatformIO
5. Prepare .env (copy from example if missing)
6. Preflight check (--scope firmware)
7. Build esp32-s3-devkitc-1 (or default env)
8. Tests (Phase A, if configured in platformio.ini)

**Failure:** Any step failure blocks the merge

---

## Release Workflow (release.yml)

### What It Does

- **Triggers on:** Pushing tags matching `web-v*` or `fw-v*`
- **Web releases** (tag: `web-v0.1.0`):
  - Installs web dependencies
  - Builds React app (npm run build)
  - Creates GitHub Release with webapp/dist/** artifacts
- **Firmware releases** (tag: `fw-v0.1.0`):
  - Sets up PlatformIO
  - Builds firmware (esp32-s3-devkitc-1)
  - Creates GitHub Release with firmware.bin artifacts

### Behavior

**Publishing a web release:**
```bash
git tag web-v0.1.0
git push origin web-v0.1.0
↓
Release — Web job runs:
  1. Installs webapp deps
  2. Builds (npm run build)
  3. Creates GitHub Release with webapp/dist/**
↓
Release available at: https://github.com/<owner>/<repo>/releases/tag/web-v0.1.0
Download: Built React app (dist/)
```

**Publishing a firmware release:**
```bash
git tag fw-v0.1.0
git push origin fw-v0.1.0
↓
Release — Firmware job runs:
  1. Installs PlatformIO
  2. Builds firmware (esp32-s3-devkitc-1)
  3. Creates GitHub Release with firmware.bin
↓
Release available at: https://github.com/<owner>/<repo>/releases/tag/fw-v0.1.0
Download: Compiled firmware.bin files
```

### Job Details

#### Release — Web

**Triggers on:** Tags starting with `web-v`
**Node version:** From .nvmrc
**Cache:** npm dependencies
**Steps:**
1. Checkout
2. Setup Node + cache
3. Prepare .env
4. Preflight check (--scope web)
5. Install dependencies
6. Build (npm run build)
7. Create GitHub Release with artifacts

**Artifacts:** `webapp/dist/**` (all files in dist directory)

#### Release — Firmware

**Triggers on:** Tags starting with `fw-v`
**Python version:** 3.x
**Package manager:** PlatformIO
**Cache:** PlatformIO toolchain
**Steps:**
1. Checkout
2. Setup Python + cache
3. Install PlatformIO
4. Cache PlatformIO
5. Prepare .env
6. Preflight check (--scope firmware)
7. Build (esp32-s3-devkitc-1)
8. Create GitHub Release with artifacts

**Artifacts:**
- `firmware/.pio/build/**/firmware*.bin` (compiled binaries)
- `firmware/.pio/build/**/project.*` (build metadata)

---

## Branch Protection (One-Time Setup)

### What It Does

Requires **both** pre-merge gates to pass before merging to main.

### Setup Command

Run this once (requires GitHub CLI `gh` and admin scope):

```bash
gh api \
  -X PUT \
  repos/:owner/:repo/branches/main/protection \
  -f required_status_checks.strict=true \
  -F required_status_checks.contexts[]='Gate — Web' \
  -F required_status_checks.contexts[]='Gate — Firmware' \
  -F enforce_admins=true \
  -F required_pull_request_reviews.dismiss_stale_reviews=true \
  -F restrictions=null
```

**Replace:**
- `:owner` with your GitHub organization/username
- `:repo` with your repository name

### What This Configures

- ✅ Require status checks to pass before merging
- ✅ Both "Gate — Web" and "Gate — Firmware" must be green
- ✅ Dismiss stale reviews when commits are pushed
- ✅ Enforce admins (even admins can't force-push)
- ✅ No branch restrictions (anyone can push)

### Verification

After running the command, verify in GitHub:
1. Go to: `https://github.com/<owner>/<repo>/settings/branches`
2. Under "Branch protection rules" → "main"
3. Confirm:
   - ✅ "Require status checks to pass before merging" is enabled
   - ✅ "Gate — Web" and "Gate — Firmware" are listed
   - ✅ "Require branches to be up to date before merging" is checked

---

## Acceptance Tests (Verify Now)

Use these scenarios to test the workflows before production use.

### Test 1: PR with Only Webapp Changes

**Setup:**
```bash
git checkout -b test/webapp-only
echo "// test comment" >> webapp/src/App.tsx
git add webapp/src/App.tsx
git commit -m "test: webapp change only"
git push origin test/webapp-only
```

**Expected:**
- GitHub: Create a pull request
- Actions: "Gate — Web" runs
- Actions: "Gate — Firmware" is skipped
- Status: Green if web tests pass

**Verify:**
```bash
# In GitHub PR, check Status section:
# ✓ Gate — Web (passed)
# (Gate — Firmware not required)
```

### Test 2: PR with Only Firmware Changes

**Setup:**
```bash
git checkout -b test/firmware-only
echo "// test comment" >> firmware/src/main.cpp
git add firmware/src/main.cpp
git commit -m "test: firmware change only"
git push origin test/firmware-only
```

**Expected:**
- GitHub: Create a pull request
- Actions: "Gate — Firmware" runs
- Actions: "Gate — Web" is skipped
- Status: Green if firmware builds

**Verify:**
```bash
# In GitHub PR, check Status section:
# ✓ Gate — Firmware (passed)
# (Gate — Web not required)
```

### Test 3: PR with Both Changes

**Setup:**
```bash
git checkout -b test/both-changes
echo "// test" >> webapp/src/App.tsx
echo "// test" >> firmware/src/main.cpp
git add webapp/src/App.tsx firmware/src/main.cpp
git commit -m "test: both web and firmware changes"
git push origin test/both-changes
```

**Expected:**
- GitHub: Create a pull request
- Actions: Both "Gate — Web" and "Gate — Firmware" run
- Status: Green only if BOTH pass

**Verify:**
```bash
# In GitHub PR, check Status section:
# ✓ Gate — Web (passed)
# ✓ Gate — Firmware (passed)
# PR is mergeable if both are green
```

### Test 4: Web Release

**Setup:**
```bash
git tag web-v0.1.0
git push origin web-v0.1.0
```

**Expected:**
- Actions: "Release — Web" job runs
- Step: "Create GitHub Release (web)" creates a release
- Release: Available at https://github.com/<owner>/<repo>/releases/tag/web-v0.1.0
- Download: webapp/dist/** artifacts

**Verify:**
```bash
curl -s https://api.github.com/repos/<owner>/<repo>/releases/tags/web-v0.1.0 | jq '.assets[]'
# Should show dist files
```

### Test 5: Firmware Release

**Setup:**
```bash
git tag fw-v0.1.0
git push origin fw-v0.1.0
```

**Expected:**
- Actions: "Release — Firmware" job runs
- Step: "Create GitHub Release (firmware)" creates a release
- Release: Available at https://github.com/<owner>/<repo>/releases/tag/fw-v0.1.0
- Download: firmware.bin artifacts

**Verify:**
```bash
curl -s https://api.github.com/repos/<owner>/<repo>/releases/tags/fw-v0.1.0 | jq '.assets[]'
# Should show firmware.bin files
```

---

## Operational Notes

### Conductor Tasks Remain Daily Driver

Your existing Conductor tasks (`conductor run web:dev`, `conductor run fw:build:release`, etc.) are **unaffected**.

The CI workflows simply enforce that same contract in GitHub:
- ✅ `conductor run web:dev` validates web code locally
- ✅ `pre-merge.yml` validates web code in CI (gate before merge)
- ✅ `conductor run fw:build:release` builds firmware locally
- ✅ `pre-merge.yml` builds firmware in CI (gate before merge)

### .env Handling

Both workflows copy `.env` from `.env.example` on each run:
```bash
if [ ! -f .env ] && [ -f .env.example ]; then cp .env.example .env; fi
```

**Why:** Your `.env.example` contains no secrets (only placeholders). This ensures:
- ✅ Zero secret leakage in CI logs
- ✅ CI always has a valid .env for tests
- ✅ No hardcoded environment variables in code

### Caching Strategy

Both workflows cache dependencies to speed up runs:

**Web caching:**
- Key: `npm-<os>-<package-lock.json hash>`
- Path: `~/.npm` (npm cache dir)
- Restore: Falls back to `npm-<os>-` if hash miss

**Firmware caching:**
- Key: `pio-<os>-<platformio.ini hash>`
- Path: `~/.platformio` + `firmware/.pio`
- Restore: Falls back to `pio-<os>-` if hash miss

### Optional: Device E2E Testing

In the future, you can extend `diag:k1` to include device E2E:

```bash
# In pre-merge.yml or separate staging gate:
- name: Run E2E diagnostics (optional)
  run: DEVICE_IP=192.168.1.100 node ops/diag/k1_smoke.js
```

This would require:
1. A device running in staging environment
2. Network access from GitHub Actions (may require IP allowlisting)
3. Extension of `ops/diag/k1_smoke.js` to ping device API

---

## Troubleshooting

### "Gate — Web/Firmware not found" in Branch Protection Setup

**Cause:** The workflows haven't run yet, so GitHub doesn't know about the status checks.

**Fix:**
1. Create and push a test PR (as per acceptance tests above)
2. Wait for workflows to run and complete
3. Then set up branch protection (GitHub will now know about the status checks)

### Release Job Fails with "No artifacts found"

**Cause:** `npm run build` or `platformio run` didn't produce expected files.

**Fix:**
1. Check build output in GitHub Actions logs
2. Verify `webapp/dist/` or `firmware/.pio/build/*/` exist
3. Check `package.json` or `platformio.ini` for correct build targets

### "Gate — Firmware" Hangs on "Install PlatformIO"

**Cause:** PlatformIO download is slow (first run, no cache).

**Fix:**
1. This is normal on first run (can take 5+ minutes)
2. Subsequent runs will be faster (cached)
3. Check runner logs: `Installing platformio via pipx...`

---

## Summary

| Workflow | Trigger | Gates | Artifacts | Use Case |
|----------|---------|-------|-----------|----------|
| **pre-merge.yml** | PR changes | web, firmware (conditional) | None (validation only) | Block merges until both pass |
| **k1-node1-ci.yml** | Push, PR | changes → web + fw (conditional) | web-dist, firmware-binaries | Build & test on every push |
| **release.yml** | Tag push (web-vX, fw-vX) | None (builds always) | GitHub Release artifacts | Publish versioned releases |

---

## Quick Reference

### Merge to Main

1. Create PR (edit webapp/ or firmware/)
2. Wait for "Gate — Web" or "Gate — Firmware" to pass
3. ✅ Merge (GitHub requires gates to pass)

### Release Web

```bash
git tag web-v0.1.0
git push origin web-v0.1.0
# → Builds web, creates GitHub Release with dist/
```

### Release Firmware

```bash
git tag fw-v0.1.0
git push origin fw-v0.1.0
# → Builds firmware, creates GitHub Release with firmware.bin
```

### Check Gates Locally

```bash
# Web gate
bash ops/scripts/preflight.sh --scope web
cd webapp && npm install && npm run typecheck && npm run test

# Firmware gate
bash ops/scripts/preflight.sh --scope firmware
cd firmware && platformio run -e esp32-s3-devkitc-1
```

---

**Status:** Ready for production
**Next:** Run acceptance tests, then enable branch protection
