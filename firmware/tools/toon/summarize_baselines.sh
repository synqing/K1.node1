#!/usr/bin/env bash
# Summarize baseline stats logs into a CSV and overall totals
#
# Usage:
#   tools/toon/summarize_baselines.sh [baselines_dir]
#
set -euo pipefail
DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/baselines}"
if [ ! -d "${DIR}" ]; then
  echo "No baselines dir found at ${DIR}" >&2
  exit 1
fi

csv="${DIR}/summary.csv"
: > "${csv}"
echo "file,json_tokens,toon_tokens,saved,reduction_pct" >> "${csv}"

total_json=0
total_toon=0

shopt -s nullglob
for log in "${DIR}"/*.log; do
  # Extract the last occurrence of the token estimates line
  line=$(grep -E "Token estimates: ~[0-9,]+ \(JSON\) .* ~[0-9,]+ \(TOON\)" -h "$log" | tail -n1 || true)
  if [ -z "$line" ]; then
    echo "Skipping (no stats): $log" >&2
    continue
  fi
  # Parse numbers, strip commas
  json=$(echo "$line" | sed -E 's/.*Token estimates: ~([0-9,]+) \(JSON\).*/\1/' | tr -d ',')
  toon=$(echo "$line" | sed -E 's/.*\) .* ~([0-9,]+) \(TOON\).*/\1/' | tr -d ',')
  saved=$((json - toon))
  # Compute reduction percent with awk for floating point
  pct=$(awk -v j="$json" -v t="$toon" 'BEGIN { if (j>0) printf "%.1f", (j-t)*100.0/j; else print "0.0" }')
  echo "$(basename "${log}")","$json","$toon","$saved","$pct" >> "${csv}"
  total_json=$((total_json + json))
  total_toon=$((total_toon + toon))
  echo "${log}: JSON=${json} TOON=${toon} saved=${saved} (${pct}%)"
done

if [ $total_json -gt 0 ]; then
  total_saved=$((total_json - total_toon))
  total_pct=$(awk -v j="$total_json" -v t="$total_toon" 'BEGIN { printf "%.1f", (j-t)*100.0/j }')
  echo "Totals: JSON=${total_json} TOON=${total_toon} saved=${total_saved} (${total_pct}%)"
  echo >> "${csv}"
  echo "TOTAL","$total_json","$total_toon","$total_saved","$total_pct" >> "${csv}"
else
  echo "No totals computed; no valid logs parsed." >&2
fi

echo "Summary CSV: ${csv}"
