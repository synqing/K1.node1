#!/usr/bin/env bash
set -euo pipefail

# One Run script for Conductor's "Run" button.
# Select behavior via RUN_TARGET env var; defaults to web dev.
#
# Supported:
#   RUN_TARGET=web:dev        → run dev server (honors Vite config; set CONDUCTOR_PORT to override)
#   RUN_TARGET=web:test       → run unit tests
#   RUN_TARGET=web:e2e        → run Playwright tests
#   RUN_TARGET=fw:monitor     → serial monitor (115200)
#   RUN_TARGET=fw:test        → PlatformIO test (Phase A env if present)
#   RUN_TARGET=fw:build       → PlatformIO build (release env if present)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

TARGET="${RUN_TARGET:-web:dev}"
# Do not force a dev port; only use CONDUCTOR_PORT if explicitly provided
PORT="${CONDUCTOR_PORT:-}"
LOCK_FILE=".conductor-run.lock"

# simple nonconcurrent guard (Conductor can also run in nonconcurrent mode)
if [[ -f "${LOCK_FILE}" ]]; then
  echo "[RUN] Another run appears active (found ${LOCK_FILE}). Remove it if stale."
  exit 2
fi
trap 'rm -f "${LOCK_FILE}"' EXIT
echo $$ > "${LOCK_FILE}"

echo "[RUN] target=${TARGET} PORT=${PORT} pwd=$(pwd)"

case "${TARGET}" in
  web:dev)
    if [[ ! -d "webapp" ]]; then echo "[RUN] webapp/ missing"; exit 1; fi
    pushd webapp >/dev/null
    # If CONDUCTOR_PORT is set, pass it; otherwise honor Vite config (e.g., 3003)
    if npm run | grep -q "dev"; then
      if [[ -n "${PORT}" ]]; then
        npm run dev -- --port "${PORT}"
      else
        npm run dev
      fi
    else
      echo "[RUN] No 'dev' script in webapp/package.json"; exit 1
    fi
    ;;

  web:test)
    pushd webapp >/dev/null
    if npm run | grep -q "test"; then
      npm test -- --runInBand
    else
      echo "[RUN] No 'test' script"; exit 1
    fi
    ;;

  web:e2e)
    pushd webapp >/dev/null
    npx --yes playwright install --with-deps >/dev/null 2>&1 || true
    npx playwright test --reporter=list || exit $?
    ;;

  fw:monitor)
    if ! command -v platformio >/dev/null 2>&1; then
      echo "[RUN] PlatformIO not found. Install: pipx install platformio (or use VSCode PIO CLI)."; exit 1
    fi
    pushd firmware >/dev/null
    platformio device monitor --baud 115200
    ;;

  fw:test)
    if ! command -v platformio >/dev/null 2>&1; then
      echo "[RUN] PlatformIO not found. Install: pipx install platformio"; exit 1
    fi
    pushd firmware >/dev/null
    if grep -q "esp32-s3-devkitc-1" platformio.ini; then
      platformio test -e esp32-s3-devkitc-1
    else
      platformio test
    fi
    ;;

  fw:build)
    if ! command -v platformio >/dev/null 2>&1; then
      echo "[RUN] PlatformIO not found. Install: pipx install platformio"; exit 1
    fi
    pushd firmware >/dev/null
    if grep -q "esp32-s3-devkitc-1" platformio.ini; then
      "$ROOT_DIR/ops/scripts/firmware-build-queue.sh" platformio run -e esp32-s3-devkitc-1
    else
      "$ROOT_DIR/ops/scripts/firmware-build-queue.sh" platformio run
    fi
    ;;

  # Agent task execution pattern: agent:{AGENT_TYPE}:{TASK_ID}
  # Example: RUN_TARGET=agent:SecurityAgent:1
  agent:*)
    # Parse agent task target: agent:AgentType:TaskId
    IFS=':' read -r prefix agent_type task_id <<< "${TARGET}"

    if [[ -z "${agent_type}" ]] || [[ -z "${task_id}" ]]; then
      echo "[RUN] Invalid agent target format. Use: agent:AgentType:TaskId (e.g., agent:SecurityAgent:1)"
      exit 3
    fi

    echo "[RUN] Routing to agent task handler: ${agent_type} Task ${task_id}"
    bash "$ROOT_DIR/ops/scripts/agent-handler.sh" "${agent_type}" "${task_id}" "task:${task_id}"
    ;;

  *)
    echo "[RUN] Unknown RUN_TARGET='${TARGET}'. Supported:"
    echo "  Web:  web:dev | web:test | web:e2e"
    echo "  Firmware: fw:monitor | fw:test | fw:build"
    echo "  Agents: agent:AgentType:TaskId (e.g., agent:SecurityAgent:1)"
    exit 3
    ;;
esac
