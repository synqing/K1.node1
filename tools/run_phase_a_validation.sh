#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT_DIR"

echo "[1/4] Building seqlock_stress (g++)"
if ! command -v g++ >/dev/null 2>&1; then
  echo "error: g++ not found. Please install a C++ compiler." >&2
  exit 2
fi
g++ -O3 -std=c++17 -pthread "$ROOT_DIR/tools/seqlock_stress.cpp" -o "$OUT_DIR/seqlock_stress"

echo "[2/4] Running seqlock_stress (10M attempts)"
"$OUT_DIR/seqlock_stress" --attempts 10000000 --readers 2 --bins 64 --writer-hz 200 --out "$OUT_DIR/stress.csv"
echo "wrote: $OUT_DIR/stress.csv"

echo "[3/4] Generating 120 BPM metronome (60s)"
python3 "$ROOT_DIR/tools/metronome.py" --bpm 120 --seconds 60 --outfile "$OUT_DIR/metronome_120bpm.wav"

echo "[4/4] Analyzing beat_phase (if beat_phase_log.csv exists)"
if [[ -f "$OUT_DIR/beat_phase_log.csv" ]]; then
  python3 "$ROOT_DIR/tools/beat_phase_analyzer.py" --bpm 120 --log "$OUT_DIR/beat_phase_log.csv" --out "$OUT_DIR/beat_phase_report.csv"
  echo "wrote: $OUT_DIR/beat_phase_report.csv"
else
  cat <<EOF
No beat_phase_log.csv found.
To collect:
  python3 tools/poll_beat_phase.py --device http://DEVICE \
    --endpoint /api/device/performance --field beat_phase \
    --interval 0.25 --count 240 --out beat_phase_log.csv
EOF
fi

echo "Done. Attach stress.csv and beat_phase_report.csv to K1NReport_VALIDATION_SECURITY_FIX_v1.0_20251108.md if applicable."

