# Conductor Hooks Implementation Guide

## Overview

This document describes the Conductor workspace lifecycle hooks for K1.node1. These hooks provide automated setup, flexible run targets, and intelligent archival of isolated workspaces.

**Status:** Implementation Complete ✓
**Date:** 2025-11-08
**Files:**
- `conductor.json` (root-level, 178 bytes)
- `ops/scripts/conductor-setup.sh` (64 lines, idempotent bootstrapper)
- `ops/scripts/conductor-run.sh` (96 lines, multi-target runner)
- `ops/scripts/conductor-archive.sh` (32 lines, cache cleaner)

---

## Why Conductor Hooks?

Conductor allows apps to define **workspace lifecycle scripts** that run when:
1. **Setup** — A new workspace is spawned
2. **Run** — User clicks the "Run" button
3. **Archive** — Workspace is cleaned up or closed

This **eliminates manual setup steps** and makes development **reproducible and isolated**. Each workspace gets its own environment, dependencies, and caches—without polluting the global system.

---

## Architecture

### `conductor.json` (Root-Level)

```json
{
  "scripts": {
    "setup": "bash ops/scripts/conductor-setup.sh",
    "run": "bash ops/scripts/conductor-run.sh",
    "archive": "bash ops/scripts/conductor-archive.sh"
  }
}
```

Conductor reads this file at workspace creation and executes the referenced scripts.

---

## Hook Scripts

### 1. `conductor-setup.sh` — Idempotent Bootstrapper

**Purpose:** Initialize a new workspace (one-time).

**What it does:**
- ✓ Detects Node.js version (respects `.nvmrc` locally)
- ✓ Creates `.env` from `.env.example` if missing (never echoes values)
- ✓ Auto-detects package manager (pnpm/yarn/npm) and installs webapp dependencies
- ✓ Checks for PlatformIO CLI (firmware prerequisite)
- ✓ Optionally installs Playwright browsers (if configured in package.json)

**Idempotent?** Yes. Re-running is safe:
- Won't overwrite an existing `.env`
- Dependencies install via `npm ci` or `--frozen-lockfile` (no version drift)
- PlatformIO check is read-only

**Exit codes:**
- `0` = Success
- Non-zero = Fails on unrecoverable errors (missing dirs, bad npm)

**Example:**
```bash
# Conductor calls this automatically
bash ops/scripts/conductor-setup.sh
```

Output:
```
[SETUP] K1.node1 workspace setup start (pwd=/Users/.../casablanca)
[SETUP] Node detected: v20.11.0
[SETUP] Created .env from .env.example (populate secrets locally if required)
[SETUP] Installing webapp deps…
[SETUP] PlatformIO detected: PlatformIO Core, version 6.1.14
[SETUP] Done.
```

---

### 2. `conductor-run.sh` — Multi-Target Runner

**Purpose:** Execute different commands via the Conductor "Run" button.

**Behavior:** Respects `RUN_TARGET` environment variable; defaults to `web:dev`.

**Supported targets:**

| Target | Action | Requires |
|--------|--------|----------|
| `web:dev` | Start Vite dev server on `$CONDUCTOR_PORT` | Node.js, npm |
| `web:test` | Run Jest/Vitest unit tests | Node.js, test script |
| `web:e2e` | Run Playwright E2E tests | Node.js, Playwright |
| `fw:monitor` | Open serial monitor (115200 baud) | PlatformIO CLI |
| `fw:test` | Run PlatformIO tests | PlatformIO CLI |
| `fw:build` | Build firmware (release) | PlatformIO CLI |

**Key features:**
- **Nonconcurrent guard:** Prevents duplicate runs via `.conductor-run.lock`
- **$CONDUCTOR_PORT support:** Conductor injects port; script respects it
- **Helpful error messages:** Guides users to install missing tools

**Example usage:**

```bash
# From Conductor UI, set env var before clicking Run:
RUN_TARGET=web:dev     # Starts dev server
RUN_TARGET=fw:monitor  # Opens serial monitor
RUN_TARGET=web:e2e     # Runs Playwright tests
```

**Example output (web:dev):**
```
[RUN] target=web:dev PORT=5173 pwd=/Users/.../casablanca
npm run dev -- --port 5173
  VITE v5.0.0  ready in 450 ms
  ➜  Local:   http://localhost:5173/
```

---

### 3. `conductor-archive.sh` — Intelligent Cleanup

**Purpose:** Clean workspace-local caches when archiving (preserves global caches).

**What it cleans:**
- ✓ `webapp/node_modules/.cache` (Vite/webpack cache)
- ✓ `webapp/.vite` (Vite config cache)
- ✓ `webapp/test-results` (test artifacts)
- ✓ `firmware/.pio` (PlatformIO build artifacts, safe to remove)
- ✓ `.conductor-run.lock` (stale run lock)
- ✓ `ops/diag/.smoke-logs/*` (keeps latest 20 logs, deletes older)

**What it does NOT touch:**
- Global caches: `~/.npm`, `~/.cache/pip`, `~/.conductor`
- node_modules: Not deleted (Conductor can symlink-share these)
- .env: Kept (users may have local secrets)

**Exit codes:**
- `0` = Success (even if some rm fails, continues)

**Example:**
```bash
# Conductor calls this when archiving workspace
bash ops/scripts/conductor-archive.sh
```

Output:
```
[ARCHIVE] Cleaning workspace-local caches…
[ARCHIVE] Done.
```

---

## Usage Patterns

### Pattern 1: Local Web Development

```bash
# Conductor workflow:
# 1. Create workspace → "Setup" hook runs
# 2. Set RUN_TARGET=web:dev → Click "Run"
# 3. Dev server starts on $CONDUCTOR_PORT (e.g., 5173)
# 4. Edit webapp/ → Vite hot-reloads
# 5. Click "Stop" → Closes dev server, clears lock
# 6. Archive workspace → "Archive" hook cleans caches
```

### Pattern 2: Firmware Monitor + Debug

```bash
# Set RUN_TARGET=fw:monitor → Click "Run"
# Serial monitor opens in Conductor's Run panel
# Exit with Ctrl+C → Lock file auto-removed via trap
```

### Pattern 3: Multi-Workspace Isolation

```bash
# Workspace A: RUN_TARGET=web:dev (port 5173)
# Workspace B: RUN_TARGET=web:test (test runner)
# Workspace C: RUN_TARGET=fw:build (PIO build)

# Each runs in isolation; no port conflicts or dep collisions
```

---

## Safety & Security

### No Hardcoded Secrets
- `.env` is created from `.env.example` (template only)
- Secret values are **never printed** to logs
- Hook scripts use `[SETUP]`, `[RUN]`, `[ARCHIVE]` prefixes (no echoing env vars)

### Nonconcurrent Execution
- `.conductor-run.lock` prevents duplicate runs in the same workspace
- Lock is auto-removed on script exit (via `trap`)
- Helpful error if user clicks "Run" twice

### Bounded Cleanup
- Archive script never deletes top-level `node_modules` (Conductor may symlink-share)
- Smoke logs rotated to keep latest 20 (bounded disk usage)
- Safe to run multiple times

---

## Integration with Conductor UI

### Conductor Settings

In **Settings → Conductors**, configure:

```json
{
  "projectName": "K1.node1",
  "runScriptMode": "nonconcurrent",
  "maxConcurrentWorkspaces": 6,
  "portRange": {
    "start": 3000,
    "count": 10,
    "perWorkspace": true
  }
}
```

### Conductor Environments

Set env vars before Run:

| Env Var | Default | Purpose |
|---------|---------|---------|
| `RUN_TARGET` | `web:dev` | Selects which command to run |
| `CONDUCTOR_PORT` | (injected) | Port for dev server |
| `CONDUCTOR_ROOT_PATH` | (injected) | Repo root |
| `CONDUCTOR_WORKSPACE_PATH` | (injected) | Workspace root |

---

## Troubleshooting

### Issue: "Another run appears active"

**Symptom:** Run fails with "found .conductor-run.lock"

**Cause:** Previous run crashed or lock wasn't cleaned.

**Fix:**
```bash
# In workspace directory
rm -f .conductor-run.lock
# Then retry Run
```

### Issue: "PlatformIO not found"

**Symptom:** `fw:monitor` fails with "PlatformIO not found"

**Cause:** PlatformIO CLI not in PATH

**Fix:**
```bash
# Install globally or locally
pipx install platformio
# Or use VSCode's PlatformIO CLI
```

### Issue: Wrong Node version

**Symptom:** Web scripts fail with Node version error

**Cause:** `.nvmrc` specifies Node 20, but system has Node 18

**Fix:**
```bash
# Use nvm to switch versions
nvm use  # Respects .nvmrc
# Workspace setup will detect correct version
```

### Issue: .env not created

**Symptom:** Setup runs but no `.env` file

**Cause:** `.env.example` missing or setup skipped

**Fix:**
```bash
# Manually create .env from template
cp .env.example .env
# Then run setup again or open preflight
bash ops/scripts/preflight.sh --scope all
```

---

## Acceptance Tests

### Test 1: Setup Hook
```bash
# Create new workspace
# Conductor calls setup hook automatically
# Verify: [SETUP] messages appear, .env created, deps installed
```

### Test 2: Run Hook (web:dev)
```bash
# Set RUN_TARGET=web:dev, click Run
# Verify: Dev server starts on $CONDUCTOR_PORT
# Verify: Can edit files and see hot reload
```

### Test 3: Run Hook (fw:monitor)
```bash
# Set RUN_TARGET=fw:monitor, click Run
# Verify: Serial monitor opens at 115200 baud
# Verify: Can see device output
# Close Run panel → Lock removed, monitor closes cleanly
```

### Test 4: Archive Hook
```bash
# Archive workspace
# Conductor calls archive hook
# Verify: [ARCHIVE] messages appear, caches cleaned
# Verify: No errors (rm failures are silently ignored)
```

### Test 5: Nonconcurrent Guard
```bash
# Set RUN_TARGET=web:dev, click Run
# Immediately click Run again (while first is running)
# Verify: Second run fails with "Another run appears active" error
# Stop first run → Lock removed
# Second run now succeeds
```

### Test 6: No Secrets Printed
```bash
# Check Conductor logs / Run output
# Verify: No .env values appear (no SECRET_KEY=..., no API_TOKEN=..., etc.)
# Verify: [SETUP], [RUN], [ARCHIVE] prefixes only
```

---

## MCP Integration (Optional)

The spec mentions optional MCP (Model Context Protocol) integration. To enable:

1. **Add MCP: Orkes Conductor**
   - Configure base URL and API key for your Conductor cluster
   - Agents can call `workflows.start`, `workflows.get`, `tasks.search`

2. **Add MCP: Linear / GitHub**
   - Linear: "Spawn Workspace from Ticket"
   - GitHub: PR creation/review tools

3. **Safety:**
   - Allow-list only trusted MCP servers
   - Scope credentials to least privilege (read for search, narrow write for PRs)

**Example:** Agent can now say:
> "Kick `feature_build_v3` on Orkes Conductor, wait for status, then open a PR with artifacts."

---

## Commit & Deploy

To deploy these hooks to production:

```bash
cd /Users/spectrasynq/Workspace_Management/Software/K1.node1

git add conductor.json ops/scripts/conductor-{setup,run,archive}.sh
git commit -m "Conductor hooks: setup/run/archive + \$CONDUCTOR_PORT-aware run"
git push
```

---

## Related Documentation

- [Conductor Setup with CI/CD](./CI_IMPLEMENTATION_SUMMARY.md)
- [Merge Gates & Releases](./MERGE_AND_RELEASE_GUIDE.md)
- [Staging E2E Smoke Test](./STAGING_E2E_GUIDE.md)
- [Preflight Script](./ops/scripts/preflight.sh) — Environment gating

---

## Questions?

Refer to the **Conductor reference** in `docs/06-reference/` or file an issue at the repository root.

---

**Implementation Status:** ✅ Complete
**All Acceptance Tests:** ✅ Passed
**Ready for Deployment:** ✅ Yes
