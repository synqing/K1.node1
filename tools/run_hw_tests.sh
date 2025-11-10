#!/bin/bash
# Hardware validation runner: builds and runs the three hardware suites in firmware/test

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIRMWARE_DIR="$REPO_ROOT/firmware"
TESTS=(test_hw_led_driver test_hw_audio_input test_hw_graph_integration)
DEVICE="/dev/tty.usbmodem212401"
BAUD=2000000
SKIP_BUILD=0

usage() {
    cat <<USAGE
Usage: $0 [--device /dev/ttyXXX] [--baud 2000000] [--skip-build]
USAGE
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --device)
            DEVICE="$2"
            shift 2
            ;;
        --baud)
            BAUD="$2"
            shift 2
            ;;
        --skip-build)
            SKIP_BUILD=1
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage
            exit 1
            ;;
    esac
done

if [ ! -e "$DEVICE" ]; then
    echo "Device $DEVICE not found" >&2
    ls -la /dev/tty.* || true
    exit 1
fi

log() { echo -e "\033[0;32m[HW]\033[0m $1"; }
err() { echo -e "\033[0;31m[HW]\033[0m $1"; }

run_test() {
    local test_name="$1"
    log "Running $test_name"
    if [ $SKIP_BUILD -eq 0 ]; then
        (cd "$FIRMWARE_DIR" && pio test -e esp32-s3-devkitc-1 --without-testing --filter "$test_name") || {
            err "Build/upload failed for $test_name"
            return 1
        }
    fi

    python3 "$REPO_ROOT/tools/parse_test_output.py" \
        --device "$DEVICE" \
        --baud "$BAUD" \
        --timeout 600 \
        --test "$test_name" || {
        err "Test execution failed for $test_name"
        return 1
    }
    return 0
}

PASS=0
FAIL=0
for test in "${TESTS[@]}"; do
    if run_test "$test"; then
        PASS=$((PASS+1))
    else
        FAIL=$((FAIL+1))
    fi
    echo
    sleep 2
done

log "Summary: $PASS passed, $FAIL failed"
if [ $FAIL -ne 0 ]; then
    exit 1
fi
