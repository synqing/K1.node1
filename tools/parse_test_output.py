#!/usr/bin/env python3
"""
Hardware Validation Test Output Parser

Connects to device via serial, captures Unity test output, and produces
structured pass/fail reports for hardware validation tests.

Usage:
    parse_test_output.py --device /dev/ttyUSB0 --baud 2000000 --timeout 600
"""

import serial
import sys
import time
import re
import argparse
from datetime import datetime


class TestParser:
    def __init__(self, device, baud_rate=2000000, timeout=600):
        self.device = device
        self.baud_rate = baud_rate
        self.timeout = timeout
        self.ser = None
        self.test_results = []
        self.test_output = []

    def connect(self):
        """Connect to serial device"""
        try:
            self.ser = serial.Serial(
                port=self.device,
                baudrate=self.baud_rate,
                timeout=1.0,
                write_timeout=1.0
            )
            print(f"Connected to {self.device} at {self.baud_rate} baud")
            return True
        except serial.SerialException as e:
            print(f"ERROR: Failed to connect to {self.device}: {e}")
            return False

    def disconnect(self):
        """Close serial connection"""
        if self.ser:
            self.ser.close()
            print("Disconnected")

    def wait_for_pattern(self, pattern, timeout_s=None):
        """Wait for a specific pattern in serial output"""
        if timeout_s is None:
            timeout_s = self.timeout

        pattern_re = re.compile(pattern, re.IGNORECASE)
        start_time = time.time()

        while time.time() - start_time < timeout_s:
            try:
                if self.ser.in_waiting:
                    line = self.ser.readline().decode('utf-8', errors='ignore').strip()
                    if line:
                        self.test_output.append(line)
                        print(line)

                        if pattern_re.search(line):
                            return True
                else:
                    time.sleep(0.1)
            except Exception as e:
                print(f"ERROR reading serial: {e}")
                return False

        return False

    def parse_test_results(self):
        """Parse Unity test output and extract results"""
        pass_pattern = re.compile(r'\[PASS\](.+?)(?:$|\n)')
        fail_pattern = re.compile(r'\[FAIL\](.+?)(?:$|\n)')
        metric_pattern = re.compile(r'\[METRIC\](.+?):(.+?)(?:$|\n)')
        timing_pattern = re.compile(r'\[TIMING\](.+?):(.+?)(?:$|\n)')

        for line in self.test_output:
            if pass_pattern.search(line):
                test_name = pass_pattern.search(line).group(1).strip()
                self.test_results.append({
                    'name': test_name,
                    'status': 'PASS',
                    'value': None
                })
            elif fail_pattern.search(line):
                test_name = fail_pattern.search(line).group(1).strip()
                self.test_results.append({
                    'name': test_name,
                    'status': 'FAIL',
                    'value': None
                })
            elif metric_pattern.search(line):
                match = metric_pattern.search(line)
                metric_name = match.group(1).strip()
                metric_value = match.group(2).strip()
                self.test_results.append({
                    'name': metric_name,
                    'status': 'METRIC',
                    'value': metric_value
                })
            elif timing_pattern.search(line):
                match = timing_pattern.search(line)
                timing_name = match.group(1).strip()
                timing_value = match.group(2).strip()
                self.test_results.append({
                    'name': timing_name,
                    'status': 'TIMING',
                    'value': timing_value
                })

    def run(self):
        """Run test and capture output"""
        if not self.connect():
            return False

        print("\nWaiting for test suite to start...")
        print("(Waiting for 'TEST:' pattern or timeout)\n")

        # Wait for first test to appear
        if not self.wait_for_pattern(r'===.*TEST.*===', timeout_s=30):
            print("ERROR: Test suite did not start within 30 seconds")
            self.disconnect()
            return False

        # Wait for test completion
        print("\nRunning test suite...")
        test_complete = self.wait_for_pattern(
            r'Test Summary|========.*====',
            timeout_s=self.timeout
        )

        if test_complete:
            print("\nTest suite completed")
            self.parse_test_results()
            self.disconnect()
            return True
        else:
            print(f"\nERROR: Test suite did not complete within {self.timeout}s")
            self.disconnect()
            return False

    def print_report(self):
        """Print formatted test report"""
        print("\n" + "=" * 60)
        print("TEST REPORT")
        print("=" * 60)

        passed = 0
        failed = 0
        metrics = []
        timings = []

        for result in self.test_results:
            if result['status'] == 'PASS':
                passed += 1
                print(f"  [PASS] {result['name']}")
            elif result['status'] == 'FAIL':
                failed += 1
                print(f"  [FAIL] {result['name']}")
            elif result['status'] == 'METRIC':
                metrics.append((result['name'], result['value']))
                print(f"  [METRIC] {result['name']}: {result['value']}")
            elif result['status'] == 'TIMING':
                timings.append((result['name'], result['value']))
                print(f"  [TIMING] {result['name']}: {result['value']}")

        print("\n" + "-" * 60)
        print(f"Summary: {passed} passed, {failed} failed")
        print(f"Success Rate: {100 * passed / (passed + failed):.1f}%" if (passed + failed) > 0 else "N/A")
        print("=" * 60)

        return failed == 0

    def save_report(self, output_file):
        """Save report to file"""
        try:
            with open(output_file, 'a') as f:
                f.write("\n" + "=" * 60 + "\n")
                f.write(f"TEST REPORT - {datetime.now().isoformat()}\n")
                f.write("=" * 60 + "\n")

                passed = 0
                failed = 0

                for result in self.test_results:
                    if result['status'] == 'PASS':
                        passed += 1
                        f.write(f"  [PASS] {result['name']}\n")
                    elif result['status'] == 'FAIL':
                        failed += 1
                        f.write(f"  [FAIL] {result['name']}\n")
                    else:
                        f.write(f"  [{result['status']}] {result['name']}: {result['value']}\n")

                f.write("\n" + "-" * 60 + "\n")
                f.write(f"Summary: {passed} passed, {failed} failed\n")
                if (passed + failed) > 0:
                    f.write(f"Success Rate: {100 * passed / (passed + failed):.1f}%\n")
                f.write("=" * 60 + "\n")

            print(f"\nReport saved to: {output_file}")
        except Exception as e:
            print(f"ERROR saving report: {e}")


def main():
    parser = argparse.ArgumentParser(
        description="Parse hardware validation test output from ESP32 device"
    )
    parser.add_argument(
        '--device',
        default='/dev/tty.usbmodem212401',
        help='Serial device (default: /dev/tty.usbmodem212401)'
    )
    parser.add_argument(
        '--baud',
        type=int,
        default=2000000,
        help='Baud rate (default: 2000000)'
    )
    parser.add_argument(
        '--timeout',
        type=int,
        default=600,
        help='Test timeout in seconds (default: 600)'
    )
    parser.add_argument(
        '--output',
        help='Output file for test results'
    )

    args = parser.parse_args()

    # Run tests
    test_parser = TestParser(
        device=args.device,
        baud_rate=args.baud,
        timeout=args.timeout
    )

    success = test_parser.run()

    # Print report
    report_ok = test_parser.print_report()

    # Save report if requested
    if args.output:
        test_parser.save_report(args.output)

    # Exit with appropriate code
    sys.exit(0 if (success and report_ok) else 1)


if __name__ == '__main__':
    main()
