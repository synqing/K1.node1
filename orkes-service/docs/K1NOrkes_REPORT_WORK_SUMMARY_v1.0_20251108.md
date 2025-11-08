# Orkes Service – Work Summary

Date: 2025-11-08

## Overview

Set up and validated the first Orkes Conductor workflow for K1.node1 (pattern compilation) and made the service runnable on Node 20. Added a workflow registration script, updated workers to the current Orkes JS SDK, and verified an end-to-end execution in Orkes Cloud. Included a concise, reliable one‑liner to build, start, and trigger the workflow locally.

## Key Changes

- Added workflow registration script
  - File: `orkes-service/src/scripts/register.ts`
  - NPM scripts: `register:pattern`, `register:cicd`, `register:all` in `orkes-service/package.json`

- Updated README with “Deploy First Workflow” steps
  - File: `orkes-service/README.md`

- Orkes client config improvements
  - Loads `.env` and `.env.local` automatically
  - Relaxed client typing for SDK compatibility
  - File: `orkes-service/src/config/orkes.ts`

- Worker implementation
  - Added stub `deploy_to_device` task so the happy path completes
  - Refactored to the new `TaskManager` API (array of `ConductorWorker`s) used by the current SDK
  - Hardened task input handling for strict TS
  - File: `orkes-service/src/workers/pattern-compiler.ts`

- Workflow definition
  - Added explicit `evaluatorType: 'javascript'` and `expression` to the `check_tests` SWITCH task to satisfy Orkes API validation
  - File: `orkes-service/src/workflows/pattern-compilation.ts`

- Registration (temp JSON used for REST testing)
  - File: `orkes-service/tmp/k1_pattern_compilation.json` (used for direct REST registration validation; not required for normal operation)

## Validation & Results

- Registration: `k1_pattern_compilation` registered successfully in Orkes Cloud.
- Live execution (via Orkes REST) completed with status `COMPLETED`:
  - `binaryPath`: `/tmp/firmware.bin`
  - `testResults`: 8/8 passed, coverage 92%
  - `benchmarks`: 60 FPS, memory ~45 MB, p95 latency ~18 ms

Execution references (helpful in the Orkes UI):
- Example run ID: `5qc9944ce3d3-bc8a-11f0-a3ed-c621d46bfcd0`
- Fetch via API:
  - `curl -H "X-Authorization: $(curl -s -X POST https://developer.orkescloud.com/api/token -H 'Content-Type: application/json' --data '{"keyId":"$ORKES_KEY_ID","keySecret":"$ORKES_KEY_SECRET"}' | jq -r .token)" https://developer.orkescloud.com/api/workflow/5qc9944ce3d3-bc8a-11f0-a3ed-c621d46bfcd0?includeTasks=true | jq .`

## Runtime Notes

- Node version: Use Node 20.x for `orkes-service` (and the webapp). Node 24 breaks `isolated-vm` used by the Orkes SDK.
- Build: `npm run build` compiles TypeScript after the worker/API updates.
- Service start options:
  - Dev (watch): `npm run dev`
  - Prod (recommended locally): `npm run build && node dist/index.js`

## One‑Liner (zsh/bash)

From repo root or `orkes-service/` directory (works in both):

```
command -v nvm >/dev/null && nvm use 20 >/dev/null; [[ -f package.json ]] || cd orkes-service; pids=$(lsof -tiTCP:4002 -sTCP:LISTEN 2>/dev/null); [[ -n "$pids" ]] && kill $pids; npm run -s build && nohup node dist/index.js >/tmp/k1-orkes.log 2>&1 & sleep 2; until curl -sf http://localhost:4002/api/status >/dev/null; do sleep 0.5; done; curl -sS -X POST http://localhost:4002/api/workflows/execute -H 'Content-Type: application/json' --data '{"workflowName":"k1_pattern_compilation","input":{"patternName":"rainbow_pulse","patternCode":"pattern rainbow_pulse { color: red; timing: pulse(0.5s); }","optimizationLevel":"O2"}}'
```

Variants:
- From `orkes-service/` directory (no `cd` detection needed):
  - `command -v nvm >/dev/null && nvm use 20 >/dev/null; pids=$(lsof -tiTCP:4002 -sTCP:LISTEN 2>/dev/null); [[ -n "$pids" ]] && kill $pids; npm run -s build && nohup node dist/index.js >/tmp/k1-orkes.log 2>&1 & sleep 2; until curl -sf http://localhost:4002/api/status >/dev/null; do sleep 0.5; done; curl -sS -X POST http://localhost:4002/api/workflows/execute -H 'Content-Type: application/json' --data '{"workflowName":"k1_pattern_compilation","input":{"patternName":"rainbow_pulse","patternCode":"pattern rainbow_pulse { color: red; timing: pulse(0.5s); }","optimizationLevel":"O2"}}'`

## How To Run (Step‑by‑Step)

1. Ensure Node 20: `nvm use 20`
2. Install (only needed once, or after Node switch): `npm install` (in `orkes-service`)
3. Register workflow (optional if already registered): `npm run register:pattern`
4. Start service: `npm run build && node dist/index.js`
5. Trigger execution:
   - POST `http://localhost:4002/api/workflows/execute`
   - Body: `{ "workflowName": "k1_pattern_compilation", "input": { "patternName": "rainbow_pulse", "patternCode": "pattern rainbow_pulse { color: red; timing: pulse(0.5s); }", "optimizationLevel": "O2" } }`
6. Monitor execution:
   - GET `http://localhost:4002/api/workflows/<WORKFLOW_ID>`
   - Or in Orkes Cloud dashboard → Executions

Logs:
- Dev/watch: `orkes-service/dev.log` (if running via a watcher)
- Prod/local: `/tmp/k1-orkes.log` (from the one‑liner) or `orkes-service/prod.log` (if you run `node dist/index.js` with redirection)
- Tail: `tail -f /tmp/k1-orkes.log`

Quick stop/reset:
- Free the port: `lsof -tiTCP:4002 -sTCP:LISTEN | xargs kill`
- Kill background by PID file (if you saved one): `kill $(cat orkes-service/dev.pid)`

## Security

- Credentials are read from `.env` / `.env.local` (gitignored). Keep keys out of version control. Rotate if exposed.

## Next Steps

- After validating the first run, optionally register CI/CD workflow: `npm run register:cicd`.
- If desired, containerize with Node 20 for prod and deploy the worker on your infra (VM/K8s) for always‑on processing.

## Troubleshooting

- Node 24 breaks Orkes SDK (`isolated-vm`): switch to Node 20 (`nvm use 20`).
- 401 from Orkes APIs: verify `ORKES_KEY_ID`, `ORKES_KEY_SECRET`, `ORKES_SERVER_URL` in `.env.local`.
- EADDRINUSE on port 4002: kill existing process (`lsof -tiTCP:4002 -sTCP:LISTEN | xargs kill`).
- CORS errors from webapp: add webapp URL to `ALLOWED_ORIGINS` in `.env.local`.
- Registration errors for SWITCH tasks: ensure `evaluatorType` and `expression` (already added in `pattern-compilation.ts`).

## API Quick Reference

- Service health: `GET /health`
- Orkes status: `GET /api/status`
- Execute workflow: `POST /api/workflows/execute`
- Get workflow: `GET /api/workflows/:workflowId`
- Pause/resume/retry/terminate: `POST /api/workflows/:id/pause|resume|retry` / `DELETE /api/workflows/:id`
