#!/bin/bash
##############################################################################
# Hardware Validation Test Runner
#
# Builds and runs all 12 hardware validation tests on ESP32-S3 device
#
# Usage: ./run_hw_tests.sh [--device /dev/ttyXXX] [--skip-build]
##############################################################################

set -e

# Configuration
FIRMWARE_DIR="firmware"
TESTS=(
    "test_hw_led_driver"
    "test_hw_audio_input"
    "test_hw_graph_integration"
)
DEVICE="/dev/tty.usbmodem212401"
SKIP_BUILD=0
BAUD_RATE=2000000

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --device)
            DEVICE="$2"
            shift 2
            ;;
        --skip-build)
            SKIP_BUILD=1
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Verify device exists
if [ ! -e "$DEVICE" ]; then
    echo "ERROR: Device $DEVICE not found"
    echo "Available devices:"
    ls -la /dev/tty.* 2>/dev/null || echo "  No /dev/tty.* devices found"
    exit 1
fi

echo "=========================================="
echo "HARDWARE VALIDATION TEST SUITE"
echo "=========================================="
echo "Device: $DEVICE"
echo "Baud rate: $BAUD_RATE"
echo ""

# Create log directory
mkdir -p test_logs
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_DIR="test_logs/$TIMESTAMP"
mkdir -p "$LOG_DIR"

echo "Logs: $LOG_DIR"
echo ""

# Summary tracking
TOTAL_TESTS=12
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0
DURATION_SECONDS=0

# Function to run a single test
run_test() {
    local test_name=$1
    local test_file="$FIRMWARE_DIR/test/test_${test_name}.cpp"
    local log_file="$LOG_DIR/${test_name}.log"

    echo "=========================================="
    echo "TEST: $test_name"
    echo "=========================================="

    # Build test
    if [ $SKIP_BUILD -eq 0 ]; then
        echo "  [1/3] Building..."
        cd "$FIRMWARE_DIR"
        if ! pio test -e esp32-s3-devkitc-1 --without-uploading -f "$test_name" > "$log_file" 2>&1; then
            echo "  [FAIL] Compilation failed"
            cd - > /dev/null
            return 1
        fi
        cd - > /dev/null
    fi

    # Flash device
    echo "  [2/3] Flashing device..."
    if ! pio run -e esp32-s3-devkitc-1 -t upload >> "$log_file" 2>&1; then
        echo "  [FAIL] Flash failed"
        return 1
    fi

    # Run test with timeout (each test ~5 minutes max)
    echo "  [3/3] Running test (timeout: 10 minutes)..."

    timeout 600 python3 "tools/parse_test_output.py" \
        --device "$DEVICE" \
        --baud "$BAUD_RATE" \
        --timeout 600 \
        --output "$log_file" \
        >> "$log_file" 2>&1

    local exit_code=$?

    if [ $exit_code -eq 0 ]; then
        echo "  [PASS]"
        return 0
    elif [ $exit_code -eq 124 ]; then
        echo "  [TIMEOUT]"
        return 1
    else
        echo "  [FAIL] Exit code: $exit_code"
        return 1
    fi
}

# Run all tests
START_TIME=$(date +%s)

for test in "${TESTS[@]}"; do
    if run_test "$test"; then
        ((PASSED_TESTS++))
    else
        ((FAILED_TESTS++))
    fi
    echo ""
done

END_TIME=$(date +%s)
DURATION_SECONDS=$((END_TIME - START_TIME))

# Print summary
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo "Total tests: $TOTAL_TESTS"
echo "Passed: $PASSED_TESTS"
echo "Failed: $FAILED_TESTS"
echo "Skipped: $SKIPPED_TESTS"
echo "Duration: $((DURATION_SECONDS / 60))m $((DURATION_SECONDS % 60))s"
echo ""
echo "Results saved to: $LOG_DIR"
echo ""

# Exit with appropriate code
if [ $FAILED_TESTS -eq 0 ]; then
    echo "All tests PASSED!"
    exit 0
else
    echo "Some tests FAILED. Check logs in $LOG_DIR"
    exit 1
fi
