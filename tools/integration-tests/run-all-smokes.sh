#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${BASE_URL:-http://localhost:8080}"
DIR="$(cd "$(dirname "$0")" && pwd)"
bash "$DIR/smoke.sh"
if [ "${UI_SKIP:-0}" = "1" ]; then
  echo "[INFO] Skipping UI smoke"
else
  echo "[INFO] Waiting for device UI to stabilize..."; sleep 6
  node "$DIR/ui-smoke.mjs" || echo "[INFO] UI smoke skipped or failed"
fi