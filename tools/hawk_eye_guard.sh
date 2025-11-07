#!/usr/bin/env bash
# Hawk-Eye local guard: scan for std::mutex-style usage in hot paths (informational only)
# Usage: ./tools/hawk_eye_guard.sh [scan_dir]
# Default scan_dir: firmware/src

set -euo pipefail

SCAN_DIR="${1:-firmware/src}"
if [[ ! -d "$SCAN_DIR" ]]; then
  echo "warn: scan dir not found: $SCAN_DIR" >&2
  exit 0
fi

echo "[hawk-eye] scanning $SCAN_DIR for std::mutex/lock usages (non-blocking)" >&2
MATCHES=$(grep -RIn --include='*.c' --include='*.cc' --include='*.cpp' --include='*.h' --include='*.hpp' --include='*.ino' -E 'std::(mutex|lock_guard|unique_lock|condition_variable)' "$SCAN_DIR" || true)

if [[ -n "$MATCHES" ]]; then
  echo "[hawk-eye] potential hot-path mutex usage detected:" >&2
  echo "$MATCHES" | while IFS= read -r line; do
    f=$(echo "$line" | cut -d: -f1); l=$(echo "$line" | cut -d: -f2)
    echo "  $f:$l  -> prefer seqlock + atomic sequence counters in hot paths" >&2
  done
  echo "[hawk-eye] review recommended (informational; not blocking)." >&2
else
  echo "[hawk-eye] no std::mutex-style usage found in $SCAN_DIR" >&2
fi

exit 0
