#!/bin/bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <device-ip-or-url>" >&2
  exit 1
fi

DEVICE="$1"
if [[ "$DEVICE" != http* ]]; then
  DEVICE="http://$DEVICE"
fi

PATTERNS=(
  spectrum
  spectronome
  bloom
  metronome
  fft
  pitch
  neutral
  debug
)

curl_json() {
  curl -sf -m 10 -H "Content-Type: application/json" "$@"
}

for pattern in "${PATTERNS[@]}"; do
  echo "[TEST] Selecting pattern: $pattern"
  curl_json -X POST \
    -d "{\"id\":\"$pattern\"}" \
    "$DEVICE/api/select" >/dev/null
  sleep 2

  metrics=$(curl -sf -m 10 "$DEVICE/api/frame-metrics") || {
    echo "  [FAIL] Unable to fetch frame metrics" >&2
    exit 1
  }

  if ! printf '%s' "$metrics" | python3 - <<'PY'; then
import json, sys
payload = json.loads(sys.stdin.read())
if payload.get("frame_count", 0) <= 0:
    raise SystemExit(1)
PY
  then
    echo "  [FAIL] Frame metrics empty for pattern $pattern" >&2
    exit 1
  fi

done

echo "[PASS] Patterns cycled successfully"
