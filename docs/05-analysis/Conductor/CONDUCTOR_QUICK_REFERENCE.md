# Conductor Hooks Quick Reference

Note: Conductor documentation lives at `Conductor/` (root-level). This quick reference and related guides are referenced there (previously under `docs/Conductor`).

## Setup (Automatic)

When you create a new Conductor workspace:
```
[SETUP] K1.node1 workspace setup start
[SETUP] Node detected: v20.11.0
[SETUP] Created .env from .env.example
[SETUP] Installing webapp deps…
[SETUP] PlatformIO detected: PlatformIO Core, version 6.1.14
[SETUP] Done.
```

✅ Automatic — no action needed. Workspace is ready when setup completes.

---

## Run (Manual — Choose One)

Set `RUN_TARGET` environment variable in Conductor UI, then click "Run":

### Web Development

```bash
RUN_TARGET=web:dev
# Starts Vite dev server on $CONDUCTOR_PORT
# Hot reload on file changes
# Access: http://localhost:5173/
```

### Web Testing

```bash
RUN_TARGET=web:test
# Runs Jest/Vitest unit tests with --runInBand
# Output: test results, coverage
```

### Web E2E

```bash
RUN_TARGET=web:e2e
# Runs Playwright E2E tests
# Output: test results, trace files
```

### Firmware Monitoring

```bash
RUN_TARGET=fw:monitor
# Opens serial monitor at 115200 baud
# Displays device logs in real-time
# Exit with Ctrl+C
```

### Firmware Testing

```bash
RUN_TARGET=fw:test
# Runs PlatformIO tests (esp32-s3-devkitc-1)
# Output: unit test results
```

### Firmware Build

```bash
RUN_TARGET=fw:build
# Builds firmware for esp32-s3-devkitc-1 (release)
# Output: firmware.bin in firmware/.pio/build/
```

---

## Archive (Automatic)

When you close the workspace:
```
[ARCHIVE] Cleaning workspace-local caches…
[ARCHIVE] Done.
```

✅ Automatic — cleans `node_modules/.cache`, `.vite`, `firmware/.pio`, etc.
✅ Safe — preserves `.env` and global caches.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Another run appears active" | `rm -f .conductor-run.lock` |
| "PlatformIO not found" | `pipx install platformio` |
| "Node version mismatch" | `nvm use` |
| ".env not created" | `cp .env.example .env` |
| Dev server won't start | Check port: `lsof -i :5173` |
| Serial monitor shows garbage | Check baud rate (should be 115200) |

---

## Files

- `conductor.json` — Conductor configuration (root level)
- `ops/scripts/conductor-setup.sh` — Setup hook
- `ops/scripts/conductor-run.sh` — Run hook
- `ops/scripts/conductor-archive.sh` — Archive hook

---

## Full Documentation

- [K1NCond_GUIDE_HOOKS_v1.0_20251108.md](../../../Conductor/K1NCond_GUIDE_HOOKS_v1.0_20251108.md) — Complete usage guide
- [K1NCond_REPORT_HOOKS_v1.0_20251108.md](../../../Conductor/rules/K1NCond_REPORT_HOOKS_v1.0_20251108.md) — Technical details

---

## Key Features

✅ **Idempotent setup** — Safe to re-run
✅ **Multi-target run** — 6 command modes
✅ **$CONDUCTOR_PORT support** — Parallel dev servers
✅ **Nonconcurrent guard** — Prevents duplicate runs
✅ **Smart cleanup** — Removes only workspace caches
✅ **No secrets** — Never echoes .env values

---

**Last updated:** 2025-11-08
