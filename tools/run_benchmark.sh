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

# Step 1: Build firmware
log_info "Building firmware..."
cd "$FIRMWARE_DIR"
pio run -e esp32-s3-devkitc-1 > /dev/null 2>&1 || {
    log_error "Build failed"
    exit 1
}
log_info "Build successful"

# Step 2: Flash to device (OTA)
log_info "Flashing device at $DEVICE_IP..."
pio run -e esp32-s3-devkitc-1-ota upload -x "upload_port=http://$DEVICE_IP" > /dev/null 2>&1 || {
    log_warn "OTA upload failed, attempting USB flash..."
    pio run -e esp32-s3-devkitc-1 -t upload > /dev/null 2>&1 || {
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

# Benchmark each pattern
for pattern in "${PATTERNS[@]}"; do
    log_info "Benchmarking pattern: $pattern"

    # Send pattern selection via REST API
    PATTERN_ID=$(curl -s "http://$DEVICE_IP/api/patterns" | grep -o "\"name\":\"$pattern\"" | head -1)
    if [ -z "$PATTERN_ID" ]; then
        log_warn "Pattern $pattern not found, skipping"
        continue
    fi

    # Wait for pattern to settle
    sleep 1

    # Collect metrics from device
    METRICS_JSON=$(curl -s -m $TIMEOUT_SECONDS "http://$DEVICE_IP/api/metrics")

    if [ -z "$METRICS_JSON" ]; then
        log_error "Failed to retrieve metrics for pattern: $pattern"
        continue
    fi

    # Parse JSON and write CSV rows
    FRAME_COUNT=$(echo "$METRICS_JSON" | grep -o '"frame_count":[0-9]*' | cut -d: -f2)
    if [ -z "$FRAME_COUNT" ]; then
        log_warn "No frames recorded for pattern: $pattern"
        continue
    fi

    # Extract frame data using Python for JSON parsing
    python3 << EOF
import json
import sys
import re

try:
    data = json.loads('$METRICS_JSON')
except:
    sys.exit(0)

frames = data.get('frames', [])
for i, frame in enumerate(frames):
    row = f"{TIMESTAMP},$pattern,{i},{frame.get('render_us', 0)},{frame.get('quantize_us', 0)}," \
          f"{frame.get('rmt_wait_us', 0)},{frame.get('rmt_tx_us', 0)},{frame.get('total_us', 0)}," \
          f"{frame.get('heap_free', 0) // 1024},{frame.get('fps', 0):.1f}"
    print(row)
EOF >> "$RESULTS_FILE" || true

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
