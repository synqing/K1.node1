#!/usr/bin/env python3
import re
import sys
import time

DEFAULT_PORT = "/dev/tty.usbmodem11401"
BAUD = 115200
DURATION_SEC = 5.0

line_re = re.compile(r"RMS:\s*([0-9.]+)\s*\|\s*Min:\s*(-?\d+)\s*\|\s*Max:\s*(-?\d+)")

def main():
    port = DEFAULT_PORT
    duration = DURATION_SEC
    if len(sys.argv) > 1:
        port = sys.argv[1]
    if len(sys.argv) > 2:
        try:
            duration = float(sys.argv[2])
        except Exception:
            pass

    try:
        import serial
    except ImportError:
        print("pyserial not installed. Install with: pip install pyserial", file=sys.stderr)
        sys.exit(1)

    ser = serial.Serial(port, BAUD, timeout=0.1)
    # Flush any partial line
    ser.reset_input_buffer()

    rms_vals = []
    min_vals = []
    max_vals = []
    err_lines = 0
    total_lines = 0

    start = time.time()
    while (time.time() - start) < duration:
        try:
            line = ser.readline().decode(errors="ignore").strip()
        except Exception:
            continue
        if not line:
            continue
        total_lines += 1
        if "Read error" in line:
            err_lines += 1
        m = line_re.search(line)
        if m:
            rms = float(m.group(1))
            mn = int(m.group(2))
            mx = int(m.group(3))
            rms_vals.append(rms)
            min_vals.append(mn)
            max_vals.append(mx)

    ser.close()

    def mean(vals):
        return sum(vals) / len(vals) if vals else 0.0
    def std(vals):
        if len(vals) < 2:
            return 0.0
        m = mean(vals)
        return (sum((v - m) ** 2 for v in vals) / (len(vals) - 1)) ** 0.5

    print("Summary ({:.1f}s):".format(duration))
    print("  lines_read: {} ({} errors)".format(total_lines, err_lines))
    print("  lines_per_sec: {:.1f}".format(total_lines / duration))
    print("  samples: {}".format(len(rms_vals)))
    print("  rms_mean: {:.5f}".format(mean(rms_vals)))
    print("  rms_std: {:.5f}".format(std(rms_vals)))
    print("  min_of_min: {}".format(min(min_vals) if min_vals else 0))
    print("  max_of_max: {}".format(max(max_vals) if max_vals else 0))

if __name__ == "__main__":
    main()