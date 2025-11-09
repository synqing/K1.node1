#!/usr/bin/env bash
# TOON CLI wrapper for firmware workflows
#
# Requirements:
# - Node.js >= 20 (ESM-compatible)
# - Network access for first-time npx run or use local pinned install in tools/toon
#
# Usage examples:
#   tools/toon/toon.sh input.json --stats -o output.toon
#   tools/toon/toon.sh input.json --delimiter "\t" --length-marker -o output.toon
#   jq '.results' data.json | tools/toon/toon.sh --delimiter "\t" --length-marker > results.toon
#   cat data.toon | tools/toon/toon.sh --decode --no-strict > output.json

set -euo pipefail

# Warn if Node version is < 20
if command -v node >/dev/null 2>&1; then
  NV=$(node -v | sed 's/^v//')
  MAJOR=${NV%%.*}
  if [ "${MAJOR}" -lt 20 ]; then
    echo "[toon] Warning: Node ${NV} detected; Node 20+ recommended for @toon-format/cli." >&2
  fi
else
  echo "[toon] Error: node is not installed or not in PATH." >&2
  exit 1
fi

# Prefer local pinned CLI if available
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_BIN="${SCRIPT_DIR}/node_modules/.bin/toon"
if [ -x "${LOCAL_BIN}" ]; then
  # shellcheck disable=SC2068
  "${LOCAL_BIN}" "$@"
  exit $?
fi

# Fallback to npx
if command -v npx >/dev/null 2>&1; then
  # shellcheck disable=SC2068
  npx @toon-format/cli "$@"
else
  echo "[toon] Error: npx not found and no local install at ${LOCAL_BIN}." >&2
  echo "        Install locally: (cd tools/toon && pnpm install) or install globally." >&2
  exit 1
fi
