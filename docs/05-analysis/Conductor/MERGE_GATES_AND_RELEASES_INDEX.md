# K1.node1 Merge Gates & Release Workflows — Complete Index

## What Was Implemented

Two new GitHub Actions workflows + automation for quality enforcement and versioned releases.

| Component | File | Size | Purpose |
|-----------|------|------|---------|
| **Pre-Merge Gate** | `.github/workflows/pre-merge.yml` | 3.8 KB | Conditional gates on PR (web & firmware) |
| **Release Workflow** | `.github/workflows/release.yml` | 3.1 KB | Tag-driven releases (web-vX, fw-vX) |
| **Setup Script** | `ops/scripts/setup-branch-protection.sh` | 4.4 KB | One-command branch protection config |
| **Documentation** | `MERGE_AND_RELEASE_GUIDE.md` | 12 KB | Comprehensive guide + acceptance tests |

---

## Pre-Merge Gate Workflow (pre-merge.yml)

### Purpose
Block merges to main unless quality gates pass. Conditional: only run relevant job for what changed.

### Triggers
- Pull requests touching `webapp/`, `firmware/`, or `ops/`

### Jobs

#### Gate — Web
Runs if: `webapp/`, `ops/`, `.nvmrc`, or `.env.example` changed

**Steps:**
1. Checkout code
2. Setup Node (from .nvmrc)
3. Prepare .env (copy from example)
4. Preflight (Node ≥20, npm, .env)
5. Install deps (auto-detects pnpm/yarn/npm)
6. TypeScript typecheck
7. ESLint (if configured)
8. Jest tests (--runInBand)

**Status check name:** `Gate — Web`

#### Gate — Firmware
Runs if: `firmware/`, `ops/`, or `.env.example` changed

**Steps:**
1. Checkout code
2. Setup Python 3.x
3. Install PlatformIO (via pipx)
4. Cache PlatformIO
5. Prepare .env (copy from example)
6. Preflight (PlatformIO availability)
7. Build esp32-s3-devkitc-1
8. Tests Phase A (if configured)

**Status check name:** `Gate — Firmware`

### Caching
- **Web:** npm dependencies (by package-lock.json hash)
- **Firmware:** PlatformIO toolchain (by platformio.ini hash)

---

## Release Workflow (release.yml)

### Purpose
Create versioned GitHub Releases with compiled artifacts. Triggered by git tags.

### Triggers
- Push tags matching:
  - `web-v*` (e.g., web-v0.1.0, web-v1.0.0)
  - `fw-v*` (e.g., fw-v0.1.0, fw-v1.0.0)

### Jobs

#### Release — Web
Runs if: Tag starts with `web-v`

**Steps:**
1. Checkout code
2. Setup Node (from .nvmrc)
3. Prepare .env
4. Preflight (--scope web)
5. Install webapp deps
6. Build (npm run build)
7. Create GitHub Release with `webapp/dist/**`

**Release assets:** All files in `webapp/dist/`

#### Release — Firmware
Runs if: Tag starts with `fw-v`

**Steps:**
1. Checkout code
2. Setup Python 3.x
3. Install PlatformIO
4. Cache PlatformIO
5. Prepare .env
6. Preflight (--scope firmware)
7. Build esp32-s3-devkitc-1
8. Create GitHub Release with firmware.bin files

**Release assets:** 
- `firmware/.pio/build/**/firmware*.bin`
- `firmware/.pio/build/**/project.*`

### Publishing

```bash
# Web release
git tag web-v0.1.0
git push origin web-v0.1.0
# → Release — Web runs, creates GitHub Release

# Firmware release
git tag fw-v0.1.0
git push origin fw-v0.1.0
# → Release — Firmware runs, creates GitHub Release
```

---

## Branch Protection Setup (setup-branch-protection.sh)

### Purpose
Automate one-time GitHub configuration to enforce merge gates.

### What It Does
```bash
bash ops/scripts/setup-branch-protection.sh
```

Configures main branch to:
1. Require `Gate — Web` AND `Gate — Firmware` status checks to pass
2. Dismiss stale reviews when commits are pushed
3. Enforce protection even for admins (no force-push)
4. Require branches to be up to date before merging

### Prerequisites
- GitHub CLI (`gh`) installed and authenticated
- Admin access to repository
- Pre-merge gates must have run at least once (so GitHub knows about the status checks)

---

## Acceptance Tests

### Test 1: PR with Only Webapp Changes
```bash
git checkout -b test/webapp
echo "// test" >> webapp/src/App.tsx
git commit -m "test: webapp change"
git push origin test/webapp
# → Create PR in GitHub

# Expected:
# - Gate — Web runs
# - Gate — Firmware skipped
# - Status: Green if web tests pass
```

### Test 2: PR with Only Firmware Changes
```bash
git checkout -b test/firmware
echo "// test" >> firmware/src/main.cpp
git commit -m "test: firmware change"
git push origin test/firmware
# → Create PR in GitHub

# Expected:
# - Gate — Firmware runs
# - Gate — Web skipped
# - Status: Green if firmware builds
```

### Test 3: PR with Both Changes
```bash
git checkout -b test/both
echo "// test" >> webapp/src/App.tsx
echo "// test" >> firmware/src/main.cpp
git commit -m "test: both changes"
git push origin test/both
# → Create PR in GitHub

# Expected:
# - Gate — Web runs
# - Gate — Firmware runs
# - Status: Green only if BOTH pass
```

### Test 4: Web Release
```bash
git tag web-v0.1.0
git push origin web-v0.1.0

# Expected:
# - Release — Web runs
# - Build completes
# - GitHub Release created with dist/ artifacts
# - Available at: https://github.com/<owner>/<repo>/releases/tag/web-v0.1.0
```

### Test 5: Firmware Release
```bash
git tag fw-v0.1.0
git push origin fw-v0.1.0

# Expected:
# - Release — Firmware runs
# - Build completes
# - GitHub Release created with firmware.bin
# - Available at: https://github.com/<owner>/<repo>/releases/tag/fw-v0.1.0
```

---

## Integration with Existing Components

### Conductor Tasks
✅ **Unaffected.** Your existing Conductor tasks remain the daily driver:
```bash
conductor run web:dev           # Still works
conductor run fw:build:release  # Still works
conductor run fw:monitor        # Still works
```

### Pre-Merge CI Workflow
✅ **Complementary.** The k1-node1-ci.yml (main build workflow) still runs on all pushes. Pre-merge gates are stricter checks for PRs only.

### Preflight Script
✅ **Reused.** Both pre-merge and release workflows call the same preflight script:
```bash
bash ops/scripts/preflight.sh --scope web
bash ops/scripts/preflight.sh --scope firmware
```

### .env Handling
✅ **Secure.** Both workflows copy `.env` from `.env.example` (no secrets):
```bash
if [ ! -f .env ] && [ -f .env.example ]; then cp .env.example .env; fi
```

---

## File Locations

```
K1.node1/
├── .github/workflows/
│   ├── k1-node1-ci.yml .................. (existing, no changes)
│   ├── pre-merge.yml ................... ✅ NEW (gates)
│   └── release.yml ..................... ✅ NEW (releases)
│
├── ops/scripts/
│   ├── preflight.sh .................... (existing, reused)
│   └── setup-branch-protection.sh ...... ✅ NEW (setup)
│
├── MERGE_AND_RELEASE_GUIDE.md ......... ✅ NEW (docs)
├── MERGE_GATES_AND_RELEASES_tab5/K1NAnalysis_INDEX_TAB5_v1.0_20251108.md .. ✅ NEW (this file)
└── ... (all others unchanged)
```

---

## Workflow Comparison

| Workflow | Trigger | Gates | Purpose | Artifacts |
|----------|---------|-------|---------|-----------|
| **k1-node1-ci.yml** | push to any branch | conditional (web/fw) | Build & test on every push | web-dist, firmware-binaries |
| **pre-merge.yml** | PR on specific paths | conditional (web/fw) | Block merges unless gates pass | None (validation only) |
| **release.yml** | Tag push (web-v*, fw-v*) | None (always runs) | Create versioned releases | GitHub Release assets |

---

## Operational Flow

### Development → Main

```
1. Create feature branch (from main)
   git checkout -b feature/my-feature

2. Make changes (webapp/ or firmware/ or both)
   git add .
   git commit -m "feat: ..."
   git push origin feature/my-feature

3. Create Pull Request
   → pre-merge.yml gates run automatically
   → Gate — Web and/or Gate — Firmware runs (conditional)
   → Status check(s) must pass

4. Review & Merge (once gates pass)
   git merge feature/my-feature
   git push origin main

5. Auto-builds with k1-node1-ci.yml
   → Full build + test runs
   → web-dist, firmware-binaries published as artifacts
```

### Main → Release

```
1. Tag release
   git tag web-v0.1.0
   git push origin web-v0.1.0

2. release.yml runs automatically
   → Builds webapp/dist
   → Creates GitHub Release
   → Attaches artifacts

3. Release is published
   https://github.com/<owner>/<repo>/releases/tag/web-v0.1.0
   → Available for download
```

---

## Status Check Names (for Branch Protection)

When you configure branch protection, use these exact names:
```
Gate — Web
Gate — Firmware
```

Both must pass before merging to main.

---

## Troubleshooting

### "Gate — Web/Firmware not found" in Branch Protection

**Cause:** Workflows haven't run yet.

**Fix:**
1. Create and push a test PR (see Acceptance Tests)
2. Wait for workflow to run
3. Then configure branch protection
4. GitHub will now know about the status checks

### Release Job Fails

**Cause:** Build step failed.

**Fix:**
1. Check GitHub Actions logs for error
2. Verify build runs locally: `npm run build` or `pio run`
3. Check paths: `webapp/dist/` or `firmware/.pio/build/*/`

### Caching Issues

**Cause:** stale or corrupted cache

**Fix:**
1. Go to Actions → clear cache (or wait 7 days)
2. Re-run workflow

---

## Configuration Reference

| Setting | Value | Location |
|---------|-------|----------|
| Node version | 20 | .nvmrc |
| Web root | webapp/ | hardcoded in workflows |
| Firmware root | firmware/ | hardcoded in workflows |
| PlatformIO env | esp32-s3-devkitc-1 | platformio.ini |
| npm cache hash | package-lock.json | pre-merge.yml |
| PIO cache hash | platformio.ini | pre-merge.yml |

---

## Next Steps

1. **Commit workflows**
   ```bash
   git add .github/workflows/pre-merge.yml .github/workflows/release.yml \
           ops/scripts/setup-branch-protection.sh MERGE_AND_RELEASE_GUIDE.md
   git commit -m "Add pre-merge gates and release workflows"
   git push origin main
   ```

2. **Run acceptance tests** (from MERGE_AND_RELEASE_GUIDE.md)

3. **Enable branch protection** (one-time)
   ```bash
   bash ops/scripts/setup-branch-protection.sh
   ```

4. **Verify in GitHub**
   - Check: https://github.com/<owner>/<repo>/settings/branches
   - Confirm main has branch protection configured

---

## Status

✅ **Complete**
- [x] Both workflows created
- [x] Setup script provided
- [x] Documentation comprehensive
- [x] Acceptance tests defined
- [x] Ready for deployment

**Last Updated:** November 7, 2025
**Next:** Deploy to main, run tests, enable branch protection
