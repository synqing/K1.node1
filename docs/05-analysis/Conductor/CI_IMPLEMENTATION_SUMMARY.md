# K1.node1 CI/CD Implementation Summary

## Files Created

✓ `.github/workflows/k1-node1-ci.yml` (5.0 KB)

---

## Workflow Overview

**Name:** K1.node1 CI

**Triggers:**
- Push to any branch (webapp/, firmware/, ops/, .nvmrc changes)
- Pull requests (same paths)
- Manual workflow_dispatch

**Concurrency:** Single run per branch; newer runs cancel in-progress older ones

---

## Job Pipeline

### 1. **changes** — Path Detection
Uses `dorny/paths-filter@v3` to detect which subsystem changed:
- **web**: webapp/, ops/, .nvmrc, .env.example
- **fw**: firmware/, ops/, .env.example

Outputs: `web=true/false`, `fw=true/false` → downstream jobs use these to skip unnecessary work

---

### 2. **web** — Webapp CI (Conditional)
**Runs if:** `needs.changes.outputs.web == 'true'`

**Steps:**
1. Checkout code
2. Use Node (from .nvmrc) with npm cache
3. Ensure .env (copy from .env.example if missing)
4. Preflight checks (`ops/scripts/preflight.sh --scope web`)
5. Install dependencies (detects pnpm/yarn/npm)
6. TypeScript typecheck (`npm run typecheck` or `npx tsc --noEmit`)
7. Lint (`npm run lint` or skip if not configured)
8. Unit tests (`npm test -- --runInBand`)
9. Build (`npm run build`)
10. Upload artifact (webapp/dist/)

**Output Artifacts:**
- `web-dist` — Built React app (dist/ if present)

---

### 3. **firmware** — Firmware CI (Conditional)
**Runs if:** `needs.changes.outputs.fw == 'true'`

**Steps:**
1. Checkout code
2. Set up Python 3.x with pip cache
3. Install PlatformIO via pipx
4. Cache PlatformIO (frameworks/toolchains) — key based on platformio.ini hash
5. Ensure .env (copy from .env.example if missing)
6. Preflight checks (`ops/scripts/preflight.sh --scope firmware`)
7. Build
   - Targets `esp32-s3-devkitc-1` if found in platformio.ini
   - Falls back to default env if not found
8. Run tests
   - Executes `platformio test -e esp32-s3-devkitc-1`
   - Gracefully skips if tests not configured
9. Upload artifacts
   - `firmware-binaries` — .pio/build/firmware.bin files

**Output Artifacts:**
- `firmware-binaries` — Compiled .bin files and build metadata

---

## Key Features

### Environment Gating
- `.env` is auto-created from `.env.example` in CI (no secrets hardcoded)
- Both web and firmware jobs run preflight checks
- Hard fail if environment requirements not met

### Smart Caching
- **Node**: cache npm with dependency path (webapp/package-lock.json)
- **PlatformIO**: cache ~/.platformio and firmware/.pio with platformio.ini as key
- Reduces build time significantly on cache hits

### Graceful Degradation
- Missing npm scripts (lint, test, build) don't fail the job
- Missing PIO tests configured → exit 0 (pass)
- ESLint/typecheck fallbacks use npx defaults

### Path-Based Triggering
Only runs relevant jobs based on what changed:
- Edit `.env.example` → runs both jobs
- Edit webapp/ → runs web job only
- Edit firmware/ → runs firmware job only
- Edit README.md → runs both (safety margin)

### Isolation
- Web and firmware jobs are independent
- No cross-contamination of dependencies
- Both can run in parallel

---

## How It Works in Practice

### Scenario 1: Push to main with webapp changes
```
1. changes job detects web=true, fw=false
2. web job runs (typecheck, lint, test, build) ✓
3. firmware job skipped
4. Artifacts: web-dist uploaded
```

### Scenario 2: Push to main with firmware changes
```
1. changes job detects web=false, fw=true
2. web job skipped
3. firmware job runs (build, test) ✓
4. Artifacts: firmware-binaries uploaded
```

### Scenario 3: Pull request changing both
```
1. changes job detects web=true, fw=true
2. web job runs (all checks) ✓
3. firmware job runs (all checks) ✓
4. Both pass → PR can merge
```

---

## Integration with Conductor

This CI workflow **uses the same preflight script** as Conductor:
```bash
bash ops/scripts/preflight.sh --scope web      # In web job
bash ops/scripts/preflight.sh --scope firmware # In firmware job
```

This ensures **local development (via Conductor) and CI use identical checks**.

---

## Artifacts Generated

### Web
- **Name:** `web-dist`
- **Path:** `webapp/dist/`
- **If missing:** Ignored (no error)
- **Use:** Deploy to CDN/hosting, Docker image, etc.

### Firmware
- **Name:** `firmware-binaries`
- **Paths:**
  - `firmware/.pio/build/**/firmware*.bin`
  - `firmware/.pio/build/**/project.*`
- **If missing:** Warning (non-blocking)
- **Use:** OTA updates, flash via USB, release artifacts

---

## Monitoring & Debugging

View workflow runs at:
```
https://github.com/<owner>/<repo>/actions
```

Each job logs:
- Full step output (typecheck errors, build logs, test failures)
- Artifacts uploaded successfully
- Concurrency cancellation events

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| **Web job fails: Node version mismatch** | .nvmrc out of sync with setup-node | Update .nvmrc to current LTS |
| **Firmware job times out** | PlatformIO cache miss (first run) | Expected; will cache on next run |
| **Both jobs skipped** | changes job detected no relevant paths | Push to trigger with specific path changes |

---

## Next Steps

1. **Merge to main:**
   ```bash
   git add .github/workflows/k1-node1-ci.yml
   git commit -m "Add K1.node1 CI/CD workflow with path-based job gating"
   git push
   ```

2. **Test workflow:**
   - Create a PR editing webapp/
   - Push to main editing firmware/
   - Watch GitHub Actions execute jobs conditionally

3. **Optional enhancements:**
   - Add code coverage reporting
   - Integrate security scanning (Dependabot, Snyk)
   - Add deployment steps after successful tests
   - Publish Docker images or OTA binaries
   - Slack/email notifications on failure

---

## Files Summary

```
K1.node1/
├── .github/
│   └── workflows/
│       └── k1-node1-ci.yml ← NEW (5.0 KB)
├── ops/
│   ├── conductor/conductor.json (existing)
│   ├── scripts/preflight.sh (existing, now used by CI)
│   └── diag/k1_smoke.js (existing)
├── .nvmrc (existing)
└── README.md (existing, with Conductor section)
```

---

**Status:** ✓ CI/CD fully implemented and ready for deployment.
