#!/bin/bash
# Graph system profiling benchmark runner
# Builds firmware, flashes to device, runs 5 pattern benchmarks
# Collects metrics via REST API, generates summary report

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIRMWARE_DIR="$REPO_ROOT/firmware"
TOOLS_DIR="$REPO_ROOT/tools"

# Configuration
DEVICE_IP="${1:-192.168.1.104}"  # Default: OTA upload IP
DEVICE_PORT=80
PATTERNS=("gradient" "spectrum" "bloom" "noise" "idle")
FRAMES_PER_PATTERN=1000
TIMEOUT_SECONDS=120

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Allow overriding build/upload environments via env vars
BUILD_ENV="${BUILD_ENV:-esp32-s3-devkitc-1-metrics}"
UPLOAD_ENV="${UPLOAD_ENV:-esp32-s3-devkitc-1-metrics-ota}"

# Step 1: Build firmware
log_info "Building firmware ($BUILD_ENV)..."
cd "$FIRMWARE_DIR"
pio run -e "$BUILD_ENV" > /dev/null 2>&1 || {
    log_error "Build failed"
    exit 1
}
log_info "Build successful"

# Step 2: Flash to device (OTA)
log_info "Flashing device at $DEVICE_IP ($UPLOAD_ENV)..."
pio run -e "$UPLOAD_ENV" -t upload -x "upload_port=http://$DEVICE_IP" > /dev/null 2>&1 || {
    log_warn "OTA upload failed, attempting USB flash..."
    pio run -e "$BUILD_ENV" -t upload > /dev/null 2>&1 || {
        log_error "Flash failed"
        exit 1
    }
}
log_info "Flash successful"

# Wait for device to boot
log_info "Waiting for device to boot..."
sleep 3

# Step 3: Run benchmarks
OUTPUT_DIR="$REPO_ROOT/benchmark_results"
mkdir -p "$OUTPUT_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_FILE="$OUTPUT_DIR/benchmark_${TIMESTAMP}.csv"

log_info "Running benchmarks (collecting metrics)..."

# CSV header
echo "timestamp,pattern,frame_index,render_us,quantize_us,rmt_wait_us,rmt_tx_us,total_us,heap_free_kb,fps" > "$RESULTS_FILE"

# Helper: select pattern via REST
select_pattern() {
    local id="$1"
    local resp
    resp=$(curl -sf -m 10 -X POST \
        -H "Content-Type: application/json" \
        -d "{\"id\":\"${id}\"}" \
        "http://$DEVICE_IP/api/select") || return 1
    grep -q "\"id\":\"${id}\"" <<<"$resp"
}

# Benchmark each pattern
for pattern in "${PATTERNS[@]}"; do
    log_info "Benchmarking pattern: $pattern"

    # Select pattern
    if ! select_pattern "$pattern"; then
        log_warn "Pattern $pattern not selectable; skipping"
        continue
    fi

    # Wait for pattern to settle
    sleep 1

    # Collect metrics from device (frame-metrics endpoint)
    METRICS_JSON=$(curl -sf -m $TIMEOUT_SECONDS "http://$DEVICE_IP/api/frame-metrics") || {
        log_error "Failed to fetch /api/frame-metrics"
        exit 1
    }

    if [ -z "$METRICS_JSON" ]; then
        log_error "Failed to retrieve metrics for pattern: $pattern"
        continue
    fi

    # Parse JSON and write CSV rows
    FRAME_COUNT=$(python3 - "$METRICS_JSON" <<'PY'
import sys, json
payload = json.loads(sys.argv[1])
print(payload.get('frame_count') or 0)
PY
)
    if [ -z "$FRAME_COUNT" ] || [ "$FRAME_COUNT" -le 0 ]; then
        log_error "Frame metrics buffer empty. Ensure FRAME_METRICS_ENABLED=1 build is running."
        exit 1
    fi

    # Extract frame data using Python for JSON parsing
    python3 - "$METRICS_JSON" "$TIMESTAMP" "$pattern" << 'ENDPYTHON' >> "$RESULTS_FILE"
import json
import sys

try:
    data = json.loads(sys.argv[1])
    timestamp = sys.argv[2]
    pattern = sys.argv[3]
except:
    sys.exit(0)

frames = data.get('frames', [])
for i, frame in enumerate(frames):
    row = f"{timestamp},{pattern},{i},{frame.get('render_us', 0)},{frame.get('quantize_us', 0)}," \
          f"{frame.get('rmt_wait_us', 0)},{frame.get('rmt_tx_us', 0)},{frame.get('total_us', 0)}," \
          f"{frame.get('heap_free', 0) // 1024},{frame.get('fps', 0):.1f}"
    print(row)
ENDPYTHON

    log_info "Collected ${FRAME_COUNT} frames for $pattern"
done

# Step 4: Analyze results
log_info "Analyzing results..."
python3 "$TOOLS_DIR/analyze_metrics.py" "$RESULTS_FILE" || true

# Generate summary report
SUMMARY_FILE="$OUTPUT_DIR/summary_${TIMESTAMP}.txt"
log_info "Generating summary report: $SUMMARY_FILE"

{
    echo "K1.node1 Graph System Profiling Benchmark"
    echo "=========================================="
    echo "Timestamp: $TIMESTAMP"
    echo "Device IP: $DEVICE_IP"
    echo "Patterns benchmarked: ${#PATTERNS[@]}"
    echo ""
    echo "Results file: $RESULTS_FILE"
    echo ""

    if [ -f "$RESULTS_FILE" ]; then
        # Calculate statistics
        echo "Summary Statistics:"
        echo "===================="
        tail -n +2 "$RESULTS_FILE" | while IFS=',' read -r ts pattern idx render quantize wait tx total heap fps; do
            echo "Pattern: $pattern | Render: ${render}us | Quantize: ${quantize}us | FPS: ${fps}"
        done | sort | uniq -c | awk '{print $3, "Count:", $1, "| Avg Render:", $5, "| Avg Quantize:", $7}'
    fi

    echo ""
    echo "Metrics collected in: $RESULTS_FILE"
} | tee "$SUMMARY_FILE"

log_info "Benchmark complete!"
log_info "Results: $RESULTS_FILE"
log_info "Summary: $SUMMARY_FILE"
