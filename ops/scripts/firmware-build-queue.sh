#!/usr/bin/env bash
set -euo pipefail

# Simple build semaphore limiting concurrent PlatformIO builds to N tokens (default 4).
# Usage: ops/scripts/firmware-build-queue.sh platformio run -e esp32-s3-devkitc-1

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

TOKENS_DIR=".conductor/build_tokens"
MAX_TOKENS="${BUILD_MAX_TOKENS:-4}"

mkdir -p "$TOKENS_DIR"

# Initialize tokens if none exist
if [[ $(ls -1 "$TOKENS_DIR"/token* 2>/dev/null | wc -l | tr -d ' ') -eq 0 ]]; then
  for i in $(seq 1 "$MAX_TOKENS"); do
    : > "$TOKENS_DIR/token$i"
  done
fi

ACQUIRED=""
attempt=0
while [[ -z "$ACQUIRED" ]]; do
  for t in "$TOKENS_DIR"/token*; do
    # Try to move token to in-use file atomically
    if mv "$t" "$t.inuse.$$" 2>/dev/null; then
      ACQUIRED="$t.inuse.$$"
      break
    fi
  done
  if [[ -z "$ACQUIRED" ]]; then
    attempt=$((attempt+1))
    sleep 2
    if (( attempt % 15 == 0 )); then
      echo "[build-queue] Waiting for build slot... (attempt $attempt)"
    fi
  fi
done

cleanup() {
  if [[ -n "$ACQUIRED" ]]; then
    base="${ACQUIRED%.inuse.*}"
    mv "$ACQUIRED" "$base" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "[build-queue] Slot acquired. Running: $*"
"$@"
EXIT_CODE=$?
exit $EXIT_CODE

