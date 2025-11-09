#!/usr/bin/env bash
# Validate JSON -> TOON -> JSON roundtrip for a directory or single file
# Requires: tools/toon/toon.sh, optional: jq for deep equality comparison
#
# Usage:
#   tools/toon/roundtrip_validate.sh <input.json|directory> [--delimiter <c>] [--length-marker] [--strict|--no-strict]
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WRAPPER="${SCRIPT_DIR}/toon.sh"
TMP_DIR="${SCRIPT_DIR}/.tmp_roundtrip"
OUT_DIR="${SCRIPT_DIR}/roundtrip"
mkdir -p "${TMP_DIR}" "${OUT_DIR}"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <input.json|directory> [extra TOON flags]" >&2
  exit 1
fi

INPUT="$1"; shift || true
EXTRA_ARGS=("$@")

# Collect files
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

have_jq=0
if command -v jq >/dev/null 2>&1; then have_jq=1; fi

pass=0; fail=0

for f in "${FILES[@]}"; do
  base="$(basename "${f}")"; name="${base%.json}"
  toon_out="${OUT_DIR}/${name}.toon"
  json_out="${TMP_DIR}/${name}.decoded.json"

  echo "[toon] Encode: ${f} -> ${toon_out}"
  # shellcheck disable=SC2068
  "${WRAPPER}" "${f}" ${EXTRA_ARGS[@]} -o "${toon_out}" >/dev/null

  echo "[toon] Decode: ${toon_out} -> ${json_out}"
  "${WRAPPER}" "${toon_out}" --decode -o "${json_out}" >/dev/null || true

  if [ ${have_jq} -eq 1 ]; then
    if diff -u <(jq -S . "${f}") <(jq -S . "${json_out}") >/dev/null; then
      echo "PASS: ${base}"
      pass=$((pass+1))
    else
      echo "FAIL (diff): ${base}"
      fail=$((fail+1))
    fi
  else
    # Fallback: simple non-empty check
    if [ -s "${json_out}" ]; then
      echo "PASS (no jq): ${base}"
      pass=$((pass+1))
    else
      echo "FAIL (empty decode): ${base}"
      fail=$((fail+1))
    fi
  fi
  echo

done

echo "Summary: PASS=${pass} FAIL=${fail}"
[ ${fail} -eq 0 ]
