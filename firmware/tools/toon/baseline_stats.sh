#!/usr/bin/env bash
# Generate token-savings baselines using the TOON CLI
#
# Usage:
#   tools/toon/baseline_stats.sh <input.json|directory> [extra TOON flags]
#
# Examples:
#   tools/toon/baseline_stats.sh data/sample.json --delimiter "\t" --length-marker
#   tools/toon/baseline_stats.sh data/ --delimiter "|" --length-marker
#
# Notes:
# - First argument is a JSON file or a directory containing *.json files.
# - Remaining arguments are passed to tools/toon/toon.sh (e.g., delimiter, length-marker).
# - Outputs are written to tools/toon/baselines/<name>.<timestamp>.{toon,log}

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
WRAPPER="${SCRIPT_DIR}/toon.sh"
OUT_DIR="${SCRIPT_DIR}/baselines"
mkdir -p "${OUT_DIR}"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <input.json|directory> [extra TOON flags]" >&2
  exit 1
fi

INPUT="$1"; shift || true
EXTRA_ARGS=("$@")

# Resolve list of files
FILES=()
if [ -d "${INPUT}" ]; then
  while IFS= read -r -d '' f; do FILES+=("$f"); done < <(find "${INPUT}" -type f -name "*.json" -print0 | sort -z)
else
  FILES=("${INPUT}")
fi

if [ ${#FILES[@]} -eq 0 ]; then
  echo "No JSON files found in '${INPUT}'." >&2
  exit 1
fi

TS="$(date +%Y%m%d-%H%M%S)"

for f in "${FILES[@]}"; do
  if [ ! -f "${f}" ]; then
    echo "Skipping non-file: ${f}" >&2
    continue
  fi
  base="$(basename "${f}")"
  name="${base%.json}"
  out_toon="${OUT_DIR}/${name}.${TS}.toon"
  out_log="${OUT_DIR}/${name}.${TS}.log"

  echo "[toon] Encoding with stats: ${f} -> ${out_toon}" | tee -a "${out_log}"
  # shellcheck disable=SC2068
  if ! "${WRAPPER}" "${f}" ${EXTRA_ARGS[@]} --stats -o "${out_toon}" | tee -a "${out_log}"; then
    echo "[toon] Error during encoding for ${f}" | tee -a "${out_log}"
  fi
  echo >> "${out_log}"

done

echo "Baseline logs and outputs in: ${OUT_DIR}"
