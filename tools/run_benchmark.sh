#!/bin/bash
# Graph system profiling benchmark runner
# Builds firmware with frame metrics enabled, flashes to device, runs pattern benchmarks,
# and captures /api/frame-metrics output for offline analysis.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIRMWARE_DIR="$REPO_ROOT/firmware"
TOOLS_DIR="$REPO_ROOT/tools"

DEVICE_IP="${1:-192.168.1.104}"
BUILD_ENV="esp32-s3-devkitc-1-metrics"
UPLOAD_ENV="esp32-s3-devkitc-1-metrics-ota"
PATTERN_IDS=("gradient" "spectrum" "bloom" "noise" "idle")
TIMEOUT_SECONDS=120

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

select_pattern() {
    local pattern_id="$1"
    local response
    response=$(curl -sf -m 10 -X POST \
        -H "Content-Type: application/json" \
        -d "{\"id\":\"${pattern_id}\"}" \
        "http://$DEVICE_IP/api/select") || {
        log_error "Pattern selection failed for ${pattern_id}"
        return 1
    }

    if ! grep -q "\"id\":\"${pattern_id}\"" <<<"$response"; then
        log_error "Device rejected pattern '${pattern_id}': ${response}"
        return 1
    fi
    return 0
}

log_info "Building firmware ($BUILD_ENV)..."
cd "$FIRMWARE_DIR"
pio run -e "$BUILD_ENV" >/dev/null
log_info "Build succeeded"

log_info "Flashing device ($UPLOAD_ENV) at $DEVICE_IP..."
pio run -e "$UPLOAD_ENV" -t upload -x "upload_port=http://$DEVICE_IP" >/dev/null || {
    log_warn "OTA upload failed, attempting USB upload via $BUILD_ENV"
    pio run -e "$BUILD_ENV" -t upload >/dev/null
}
log_info "Flash successful"

log_info "Waiting for device to reboot..."
sleep 5

OUTPUT_DIR="$REPO_ROOT/benchmark_results"
mkdir -p "$OUTPUT_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_FILE="$OUTPUT_DIR/benchmark_${TIMESTAMP}.csv"
SUMMARY_FILE="$OUTPUT_DIR/summary_${TIMESTAMP}.txt"

log_info "Collecting metrics into $RESULTS_FILE"
echo "timestamp,pattern,frame_index,render_us,quantize_us,rmt_wait_us,rmt_tx_us,total_us,heap_free_kb,fps" > "$RESULTS_FILE"

for pattern in "${PATTERN_IDS[@]}"; do
    log_info "Benchmarking pattern: $pattern"

    if ! select_pattern "$pattern"; then
        log_warn "Skipping pattern ${pattern}"
        continue
    fi

    sleep 1  # allow pattern to settle

    METRICS_JSON=$(curl -sf -m $TIMEOUT_SECONDS "http://$DEVICE_IP/api/frame-metrics") || {
        log_error "Failed to fetch /api/frame-metrics"
        exit 1
    }

    FRAME_COUNT=$(python3 <<'PY'
import json,sys
try:
    data=json.loads(sys.stdin.read())
except json.JSONDecodeError:
    print(-1)
    raise SystemExit
frames=data.get("frames") or []
print(len(frames))
PY
<<<"$METRICS_JSON")

    if [ -z "$FRAME_COUNT" ] || [ "$FRAME_COUNT" -le 0 ]; then
        log_error "Frame metrics buffer empty. Ensure FRAME_METRICS_ENABLED=1 build is running."
        exit 1
    fi

    PATTERN="$pattern" TIMESTAMP="$TIMESTAMP" python3 <<'PY' >> "$RESULTS_FILE"
import json, os, sys
payload = json.loads(sys.stdin.read())
frames = payload.get("frames", [])
timestamp = os.environ["TIMESTAMP"]
pattern = os.environ["PATTERN"]
for idx, frame in enumerate(frames):
    row = [
        timestamp,
        pattern,
        idx,
        frame.get("render_us", 0),
        frame.get("quantize_us", 0),
        frame.get("rmt_wait_us", 0),
        frame.get("rmt_tx_us", 0),
        frame.get("total_us", 0),
        frame.get("heap_free", 0) // 1024,
        f"{frame.get('fps', 0.0):.1f}"
    ]
    print(",".join(str(x) for x in row))
PY
<<<"$METRICS_JSON"
    log_info "Collected ${FRAME_COUNT} frames for $pattern"
done

log_info "Analyzing metrics..."
python3 "$TOOLS_DIR/analyze_metrics.py" "$RESULTS_FILE" || true

log_info "Writing summary to $SUMMARY_FILE"
{
    echo "K1.node1 Graph System Profiling Benchmark"
    echo "=========================================="
    echo "Timestamp: $TIMESTAMP"
    echo "Device IP: $DEVICE_IP"
    echo "Patterns benchmarked: ${#PATTERN_IDS[@]}"
    echo "Results file: $RESULTS_FILE"
} > "$SUMMARY_FILE"

log_info "Benchmark complete"
log_info "Results CSV: $RESULTS_FILE"
log_info "Summary:   $SUMMARY_FILE"
