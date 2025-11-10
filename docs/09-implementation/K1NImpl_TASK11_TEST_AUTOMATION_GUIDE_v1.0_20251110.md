---
title: "K1.node1 Task 11: Test Automation & CI/CD Integration Guide"
type: "Implementation"
project: "K1.node1"
project_code: "K1N"
version: "v1.0"
date: "2025-11-10"
status: "draft"
intent: "Practical guide for automating hardware validation in CI/CD"
doc_id: "K1NImpl_TASK11_TEST_AUTOMATION_GUIDE_v1.0_20251110"
tags: ["implementation","automation","ci-cd","testing"]
related:
  - "K1NPlan_TASK11_HARDWARE_VALIDATION_STRATEGY_v1.0_20251110.md"
  - "K1NImpl_TASK11_HW_TEST_SPECIFICATIONS_v1.0_20251110.md"
---

# K1.node1 Task 11: Test Automation & CI/CD Integration Guide

**Document Status:** DRAFT - Practical implementation reference
**Companion Documents:**
- Strategy: K1NPlan_TASK11_HARDWARE_VALIDATION_STRATEGY_v1.0_20251110.md
- Specifications: K1NImpl_TASK11_HW_TEST_SPECIFICATIONS_v1.0_20251110.md

---

## Quick Start: Run Tests Locally

### Prerequisites
```bash
# Install PlatformIO
pip install platformio

# Connect ESP32-S3 via USB
# Verify device connection
pio device list
```

### Run Full Test Suite
```bash
cd /Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware

# Build and upload test firmware
pio run -e esp32-s3-hwtest -t upload

# Run all hardware validation tests
pio test -e esp32-s3-hwtest -f test_hardware_validation

# View results
cat .pio/test/esp32-s3-hwtest/output.txt
```

### Run Individual Test Categories
```bash
# LED driver tests only
pio test -e esp32-s3-hwtest -f test_hardware_validation/test_hw_led_driver.cpp

# Audio input tests only
pio test -e esp32-s3-hwtest -f test_hardware_validation/test_hw_audio_input.cpp

# Memory tests only
pio test -e esp32-s3-hwtest -f test_hardware_validation/test_hw_memory.cpp
```

---

## Test Automation Scripts

### 1. Automated Test Runner

**Location:** `tools/hw_test/run_hw_validation.py`

**Purpose:** Orchestrate all hardware tests with telemetry collection

**Usage:**
```bash
python tools/hw_test/run_hw_validation.py \
  --device k1-reinvented.local \
  --duration 300 \
  --output hw_test_results.json
```

**Implementation:**
```python
#!/usr/bin/env python3
"""
K1.node1 Hardware Validation Test Runner

Executes all hardware validation tests and collects telemetry.
Generates JSON report with pass/fail status and metrics.
"""

import requests
import subprocess
import json
import time
import argparse
import sys
from typing import Dict, List, Optional

class HardwareTestRunner:
    def __init__(self, device_ip: str):
        self.device_ip = device_ip
        self.base_url = f"http://{device_ip}"
        self.results = {
            'timestamp': time.time(),
            'device': device_ip,
            'tests': {},
            'metrics': {},
            'summary': {
                'total': 0,
                'passed': 0,
                'failed': 0,
                'skipped': 0
            }
        }

    def health_check(self) -> bool:
        """Verify device is reachable and responsive"""
        try:
            response = requests.get(f"{self.base_url}/api/device/info", timeout=5)
            if response.status_code == 200:
                info = response.json()
                print(f"✓ Device online: {info.get('device', 'Unknown')}")
                print(f"  Uptime: {info.get('uptime_ms', 0) / 1000:.1f}s")
                return True
        except Exception as e:
            print(f"✗ Device unreachable: {e}")
            return False

    def capture_baseline_metrics(self) -> Dict:
        """Capture baseline performance metrics before tests"""
        try:
            perf = requests.get(f"{self.base_url}/api/device/performance", timeout=5).json()
            print(f"\n📊 Baseline Metrics:")
            print(f"  FPS: {perf.get('fps', 0):.1f}")
            print(f"  Free Heap: {perf.get('heap_free', 0) / 1024:.1f} KB")
            print(f"  CPU Temp: {perf.get('cpu_temp_celsius', 0):.1f}°C")
            return perf
        except Exception as e:
            print(f"⚠ Failed to capture baseline: {e}")
            return {}

    def run_pio_tests(self) -> bool:
        """Execute PlatformIO test suite"""
        print("\n🔧 Running PlatformIO tests...")

        try:
            result = subprocess.run(
                ['pio', 'test', '-e', 'esp32-s3-hwtest', '-f', 'test_hardware_validation'],
                cwd='../firmware',
                capture_output=True,
                text=True,
                timeout=600  # 10 minute timeout
            )

            # Parse Unity test output
            lines = result.stdout.split('\n')
            for line in lines:
                if 'test' in line.lower():
                    print(f"  {line.strip()}")

            # Check exit code
            if result.returncode == 0:
                print("✓ All PlatformIO tests passed")
                return True
            else:
                print(f"✗ Tests failed (exit code {result.returncode})")
                return False

        except subprocess.TimeoutExpired:
            print("✗ Tests timed out after 10 minutes")
            return False
        except Exception as e:
            print(f"✗ Test execution failed: {e}")
            return False

    def run_rest_api_tests(self) -> Dict[str, bool]:
        """Execute REST API validation tests"""
        print("\n🌐 Running REST API tests...")

        tests = {}

        # TC-NET-001: API latency
        try:
            start = time.time()
            response = requests.get(f"{self.base_url}/api/params", timeout=2)
            latency_ms = (time.time() - start) * 1000

            passed = response.status_code == 200 and latency_ms < 100
            tests['api_latency'] = passed
            print(f"  API latency: {latency_ms:.1f}ms {'✓' if passed else '✗'}")
        except Exception as e:
            tests['api_latency'] = False
            print(f"  API latency: ✗ ({e})")

        # TC-NET-005: mDNS discovery
        try:
            response = requests.get(f"http://k1-reinvented.local/api/device/info", timeout=5)
            tests['mdns_discovery'] = response.status_code == 200
            print(f"  mDNS discovery: {'✓' if tests['mdns_discovery'] else '✗'}")
        except Exception as e:
            tests['mdns_discovery'] = False
            print(f"  mDNS discovery: ✗ ({e})")

        return tests

    def run_stress_test(self, duration_seconds: int = 300) -> Dict:
        """Run 5-minute stress test with pattern switching"""
        print(f"\n⏱ Running {duration_seconds}s stress test...")

        metrics = {
            'samples': [],
            'exceptions': 0,
            'pattern_switches': 0
        }

        start_time = time.time()
        sample_count = 0

        while time.time() - start_time < duration_seconds:
            try:
                # Capture metrics every 10 seconds
                perf = requests.get(f"{self.base_url}/api/device/performance", timeout=5).json()
                metrics['samples'].append({
                    'time': time.time() - start_time,
                    'fps': perf.get('fps', 0),
                    'heap_free': perf.get('heap_free', 0),
                    'cpu_temp': perf.get('cpu_temp_celsius', 0)
                })

                sample_count += 1

                # Switch pattern every 30 seconds
                if sample_count % 3 == 0:
                    pattern_id = (sample_count // 3) % 6
                    requests.post(f"{self.base_url}/api/pattern", json={'id': pattern_id}, timeout=5)
                    metrics['pattern_switches'] += 1

                time.sleep(10)

            except Exception as e:
                metrics['exceptions'] += 1
                print(f"  ⚠ Exception during stress test: {e}")

        # Analyze results
        if metrics['samples']:
            fps_values = [s['fps'] for s in metrics['samples']]
            temps = [s['cpu_temp'] for s in metrics['samples']]

            print(f"\n📊 Stress Test Results:")
            print(f"  Samples: {len(metrics['samples'])}")
            print(f"  FPS: avg={sum(fps_values)/len(fps_values):.1f}, min={min(fps_values):.1f}, max={max(fps_values):.1f}")
            print(f"  Temp: avg={sum(temps)/len(temps):.1f}°C, max={max(temps):.1f}°C")
            print(f"  Pattern switches: {metrics['pattern_switches']}")
            print(f"  Exceptions: {metrics['exceptions']}")

        return metrics

    def generate_report(self, output_file: str):
        """Generate JSON test report"""
        with open(output_file, 'w') as f:
            json.dump(self.results, f, indent=2)
        print(f"\n📄 Report saved to {output_file}")

    def run_all(self, duration: int = 300, output_file: str = 'hw_test_results.json'):
        """Execute full test suite"""
        print("=" * 60)
        print("K1.node1 Hardware Validation Test Suite")
        print("=" * 60)

        # Health check
        if not self.health_check():
            print("\n❌ ABORTED: Device unreachable")
            sys.exit(1)

        # Baseline metrics
        self.results['metrics']['baseline'] = self.capture_baseline_metrics()

        # PlatformIO tests
        pio_passed = self.run_pio_tests()
        self.results['tests']['platformio'] = pio_passed

        # REST API tests
        api_tests = self.run_rest_api_tests()
        self.results['tests'].update(api_tests)

        # Stress test
        stress_results = self.run_stress_test(duration)
        self.results['metrics']['stress_test'] = stress_results

        # Summary
        total = len(self.results['tests'])
        passed = sum(1 for v in self.results['tests'].values() if v)
        failed = total - passed

        self.results['summary'] = {
            'total': total,
            'passed': passed,
            'failed': failed,
            'skipped': 0,
            'success_rate': (passed / total * 100) if total > 0 else 0
        }

        # Generate report
        self.generate_report(output_file)

        # Print summary
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        print(f"Total:   {total}")
        print(f"Passed:  {passed} ✓")
        print(f"Failed:  {failed} ✗")
        print(f"Success: {self.results['summary']['success_rate']:.1f}%")
        print("=" * 60)

        return failed == 0


def main():
    parser = argparse.ArgumentParser(description='K1.node1 Hardware Validation Test Runner')
    parser.add_argument('--device', default='k1-reinvented.local', help='Device IP or hostname')
    parser.add_argument('--duration', type=int, default=300, help='Stress test duration (seconds)')
    parser.add_argument('--output', default='hw_test_results.json', help='Output report file')

    args = parser.parse_args()

    runner = HardwareTestRunner(args.device)
    success = runner.run_all(args.duration, args.output)

    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
```

---

### 2. Telemetry Analysis Script

**Location:** `tools/hw_test/analyze_telemetry.py`

**Purpose:** Parse test results and generate human-readable reports

**Implementation:**
```python
#!/usr/bin/env python3
"""
K1.node1 Telemetry Analysis

Parses hardware test results and generates formatted reports.
"""

import json
import sys
import argparse
from typing import Dict

def analyze_test_results(results: Dict) -> str:
    """Generate formatted test report"""

    report = []
    report.append("=" * 70)
    report.append("K1.node1 Hardware Validation Test Report")
    report.append("=" * 70)
    report.append(f"Device: {results.get('device', 'Unknown')}")
    report.append(f"Timestamp: {results.get('timestamp', 0)}")
    report.append("")

    # Summary
    summary = results.get('summary', {})
    report.append("SUMMARY:")
    report.append(f"  Total Tests:   {summary.get('total', 0)}")
    report.append(f"  Passed:        {summary.get('passed', 0)} ✓")
    report.append(f"  Failed:        {summary.get('failed', 0)} ✗")
    report.append(f"  Success Rate:  {summary.get('success_rate', 0):.1f}%")
    report.append("")

    # Baseline metrics
    baseline = results.get('metrics', {}).get('baseline', {})
    if baseline:
        report.append("BASELINE METRICS:")
        report.append(f"  FPS:       {baseline.get('fps', 0):.1f}")
        report.append(f"  Free Heap: {baseline.get('heap_free', 0) / 1024:.1f} KB")
        report.append(f"  CPU Temp:  {baseline.get('cpu_temp_celsius', 0):.1f}°C")
        report.append("")

    # Stress test results
    stress = results.get('metrics', {}).get('stress_test', {})
    if stress.get('samples'):
        samples = stress['samples']
        fps_values = [s['fps'] for s in samples]
        temps = [s['cpu_temp'] for s in samples]

        report.append("STRESS TEST (5 min):")
        report.append(f"  Samples:          {len(samples)}")
        report.append(f"  FPS (avg):        {sum(fps_values)/len(fps_values):.1f}")
        report.append(f"  FPS (min/max):    {min(fps_values):.1f} / {max(fps_values):.1f}")
        report.append(f"  Temp (avg):       {sum(temps)/len(temps):.1f}°C")
        report.append(f"  Temp (max):       {max(temps):.1f}°C")
        report.append(f"  Pattern switches: {stress.get('pattern_switches', 0)}")
        report.append(f"  Exceptions:       {stress.get('exceptions', 0)}")
        report.append("")

    # Individual test results
    tests = results.get('tests', {})
    if tests:
        report.append("TEST RESULTS:")
        for test_name, passed in tests.items():
            status = "✓ PASS" if passed else "✗ FAIL"
            report.append(f"  {test_name:30s} {status}")
        report.append("")

    report.append("=" * 70)

    return "\n".join(report)


def main():
    parser = argparse.ArgumentParser(description='Analyze K1.node1 hardware test results')
    parser.add_argument('input', help='Input JSON results file')
    parser.add_argument('--output', help='Output report file (default: stdout)')

    args = parser.parse_args()

    # Load results
    with open(args.input, 'r') as f:
        results = json.load(f)

    # Generate report
    report = analyze_test_results(results)

    # Output
    if args.output:
        with open(args.output, 'w') as f:
            f.write(report)
        print(f"Report saved to {args.output}")
    else:
        print(report)


if __name__ == '__main__':
    main()
```

---

### 3. Audio Test Signal Generator

**Location:** `tools/hw_test/audio_test_generator.py`

**Purpose:** Generate test audio signals for FFT and beat detection tests

**Implementation:**
```python
#!/usr/bin/env python3
"""
K1.node1 Audio Test Signal Generator

Generates pure sine waves and metronome tracks for audio validation.
"""

import numpy as np
import wave
import argparse

def generate_sine_wave(freq_hz: float, duration_sec: float, sample_rate: int = 44100) -> np.ndarray:
    """Generate pure sine wave at specified frequency"""
    t = np.linspace(0, duration_sec, int(sample_rate * duration_sec))
    amplitude = 0.8  # Prevent clipping
    return amplitude * np.sin(2 * np.pi * freq_hz * t)


def generate_metronome(bpm: int, duration_sec: float, sample_rate: int = 44100) -> np.ndarray:
    """Generate metronome click track"""
    samples = np.zeros(int(sample_rate * duration_sec))

    # Click every beat
    beat_interval = 60.0 / bpm
    click_duration = 0.01  # 10ms click

    for beat in range(int(duration_sec / beat_interval)):
        start_idx = int(beat * beat_interval * sample_rate)
        end_idx = start_idx + int(click_duration * sample_rate)
        if end_idx < len(samples):
            # Generate click (1 kHz pulse)
            t_click = np.linspace(0, click_duration, end_idx - start_idx)
            samples[start_idx:end_idx] = 0.8 * np.sin(2 * np.pi * 1000 * t_click)

    return samples


def save_wav(filename: str, audio: np.ndarray, sample_rate: int = 44100):
    """Save audio array to WAV file"""
    # Convert to 16-bit PCM
    audio_int = np.int16(audio * 32767)

    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)  # Mono
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_int.tobytes())

    print(f"✓ Saved {filename}")


def main():
    parser = argparse.ArgumentParser(description='Generate audio test signals')
    parser.add_argument('--type', choices=['sine', 'metronome'], required=True, help='Signal type')
    parser.add_argument('--freq', type=float, help='Frequency (Hz) for sine wave')
    parser.add_argument('--bpm', type=int, help='BPM for metronome')
    parser.add_argument('--duration', type=float, default=10.0, help='Duration (seconds)')
    parser.add_argument('--output', required=True, help='Output WAV file')

    args = parser.parse_args()

    if args.type == 'sine':
        if not args.freq:
            print("Error: --freq required for sine wave")
            return 1
        audio = generate_sine_wave(args.freq, args.duration)
        print(f"Generated {args.duration}s sine wave at {args.freq} Hz")

    elif args.type == 'metronome':
        if not args.bpm:
            print("Error: --bpm required for metronome")
            return 1
        audio = generate_metronome(args.bpm, args.duration)
        print(f"Generated {args.duration}s metronome at {args.bpm} BPM")

    save_wav(args.output, audio)
    return 0


if __name__ == '__main__':
    sys.exit(main())
```

**Usage:**
```bash
# Generate 440 Hz sine wave (10 seconds)
python tools/hw_test/audio_test_generator.py --type sine --freq 440 --duration 10 --output test_440hz.wav

# Generate 120 BPM metronome (5 minutes)
python tools/hw_test/audio_test_generator.py --type metronome --bpm 120 --duration 300 --output test_120bpm.wav
```

---

## CI/CD Integration

### GitHub Actions Workflow

**Location:** `.github/workflows/hardware-validation.yml`

**Purpose:** Automated hardware testing on self-hosted runner

**Implementation:**
```yaml
name: Hardware Validation Tests

on:
  push:
    branches: [main, develop]
    paths:
      - 'firmware/**'
      - 'codegen/**'
      - '.github/workflows/hardware-validation.yml'
  pull_request:
    paths:
      - 'firmware/**'
      - 'codegen/**'
  workflow_dispatch:  # Manual trigger

jobs:
  hardware-smoke-tests:
    name: Hardware Smoke Tests (5 min)
    runs-on: [self-hosted, esp32-s3-test-bench]
    timeout-minutes: 10

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'

      - name: Install PlatformIO
        run: pip install platformio

      - name: Build firmware (hardware test mode)
        run: |
          cd firmware
          pio run -e esp32-s3-hwtest

      - name: Upload firmware to test device
        run: |
          cd firmware
          pio run -e esp32-s3-hwtest -t upload

      - name: Run smoke tests
        run: |
          cd firmware
          pio test -e esp32-s3-hwtest -f test_hardware_validation/test_hw_led_driver.cpp
          pio test -e esp32-s3-hwtest -f test_hardware_validation/test_hw_audio_input.cpp

      - name: Collect test results
        run: |
          cat firmware/.pio/test/esp32-s3-hwtest/output.txt > smoke_test_results.txt

      - name: Upload test artifacts
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: smoke-test-results
          path: smoke_test_results.txt

  hardware-full-validation:
    name: Full Hardware Validation (2-3 hours)
    runs-on: [self-hosted, esp32-s3-test-bench]
    timeout-minutes: 200
    if: github.event_name == 'workflow_dispatch' || github.ref == 'refs/heads/main'

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'

      - name: Install dependencies
        run: |
          pip install platformio requests numpy

      - name: Build and upload firmware
        run: |
          cd firmware
          pio run -e esp32-s3-hwtest -t upload

      - name: Run full test suite
        run: |
          python tools/hw_test/run_hw_validation.py \
            --device k1-reinvented.local \
            --duration 300 \
            --output hw_test_results.json

      - name: Generate test report
        run: |
          python tools/hw_test/analyze_telemetry.py \
            hw_test_results.json \
            --output hw_test_report.txt

      - name: Upload results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: hw-validation-results
          path: |
            hw_test_results.json
            hw_test_report.txt

      - name: Check for failures
        run: |
          if grep -q "Failed:" hw_test_report.txt; then
            echo "❌ Hardware tests failed"
            exit 1
          else
            echo "✓ All tests passed"
          fi

  regression-check:
    name: Performance Regression Check
    runs-on: [self-hosted, esp32-s3-test-bench]
    needs: hardware-full-validation
    if: github.event_name != 'pull_request'

    steps:
      - name: Download current results
        uses: actions/download-artifact@v3
        with:
          name: hw-validation-results
          path: current/

      - name: Download baseline results
        run: |
          # Fetch baseline from last successful main branch run
          gh run download --name hw-validation-results --dir baseline/ || echo "No baseline found"

      - name: Compare metrics
        run: |
          python tools/hw_test/check_regression.py \
            baseline/hw_test_results.json \
            current/hw_test_results.json

      - name: Update baseline (if main branch)
        if: github.ref == 'refs/heads/main'
        run: |
          cp current/hw_test_results.json firmware/test/baselines/hw_baseline_$(date +%Y%m%d).json
          git add firmware/test/baselines/
          git commit -m "Update hardware test baseline [skip ci]" || echo "No changes"
```

---

### Self-Hosted Runner Setup

**Prerequisites:**
- Raspberry Pi 4 (4GB+ RAM) or Linux PC
- ESP32-S3 DevKitC-1 connected via USB
- LED strips and microphone connected

**Installation:**
```bash
# 1. Install GitHub Actions runner
cd ~
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-arm64-2.311.0.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-arm64-2.311.0.tar.gz
tar xzf actions-runner-linux-arm64-2.311.0.tar.gz

# 2. Configure runner (use token from GitHub repo settings)
./config.sh --url https://github.com/YOUR_ORG/K1.node1 --token YOUR_TOKEN --labels esp32-s3-test-bench

# 3. Install as service
sudo ./svc.sh install
sudo ./svc.sh start

# 4. Install PlatformIO
pip3 install platformio

# 5. Add udev rules for ESP32-S3
echo 'SUBSYSTEM=="usb", ATTR{idVendor}=="303a", MODE="0666"' | sudo tee /etc/udev/rules.d/99-platformio-udev.rules
sudo udevadm control --reload-rules
```

---

## Test Execution Workflows

### Workflow 1: Developer Pre-Commit

**Trigger:** Developer makes firmware changes
**Duration:** 5 minutes

**Steps:**
```bash
# 1. Build locally
cd firmware
pio run -e esp32-s3-hwtest

# 2. Run quick tests (LED + audio only)
pio test -e esp32-s3-hwtest -f test_hardware_validation/test_hw_led_driver.cpp
pio test -e esp32-s3-hwtest -f test_hardware_validation/test_hw_audio_input.cpp

# 3. Commit only if tests pass
git add .
git commit -m "feat: Add new LED pattern"
git push
```

---

### Workflow 2: Nightly Full Validation

**Trigger:** Scheduled (every night at 2 AM)
**Duration:** 2-3 hours

**Steps:**
```yaml
# .github/workflows/nightly-validation.yml
on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM daily

jobs:
  nightly-tests:
    runs-on: [self-hosted, esp32-s3-test-bench]
    steps:
      - uses: actions/checkout@v3
      - run: python tools/hw_test/run_hw_validation.py --duration 3600
      - uses: actions/upload-artifact@v3
        with:
          name: nightly-results
          retention-days: 30
```

---

### Workflow 3: Pre-Release Validation

**Trigger:** Git tag (e.g., `v1.0.0-rc1`)
**Duration:** 8 hours (includes long-duration soak test)

**Steps:**
```bash
# 1. Tag release candidate
git tag v1.0.0-rc1
git push origin v1.0.0-rc1

# 2. CI runs full validation + 8-hour soak test
# (automatically triggered by tag)

# 3. Review test results
gh run view  # View latest run
gh run download --name hw-validation-results

# 4. If passed, promote to release
git tag v1.0.0
git push origin v1.0.0
```

---

## Troubleshooting

### Issue: Tests fail with "Device unreachable"

**Symptoms:**
```
✗ Device unreachable: Connection refused
```

**Solutions:**
1. Check WiFi credentials in firmware
2. Verify device is connected to network: `ping k1-reinvented.local`
3. Check mDNS service: `dns-sd -B _http._tcp`
4. Fallback to IP address: `--device 192.168.1.104`

---

### Issue: PlatformIO upload fails

**Symptoms:**
```
Error: Could not open /dev/ttyUSB0
```

**Solutions:**
1. Check USB connection: `ls /dev/tty*`
2. Add user to dialout group: `sudo usermod -a -G dialout $USER`
3. Reload udev rules: `sudo udevadm trigger`
4. Specify port manually: `pio run -e esp32-s3-hwtest -t upload --upload-port /dev/ttyUSB0`

---

### Issue: Tests time out

**Symptoms:**
```
✗ Tests timed out after 10 minutes
```

**Solutions:**
1. Increase timeout in workflow: `timeout-minutes: 30`
2. Check device serial output for hangs
3. Reduce test duration: `--duration 60`
4. Run individual test categories

---

## Performance Optimization

### Reduce Test Execution Time

**Strategy 1: Parallel Execution**
```yaml
# Run test categories in parallel jobs
jobs:
  test-led:
    steps: [pio test -f test_hw_led_driver.cpp]
  test-audio:
    steps: [pio test -f test_hw_audio_input.cpp]
  test-memory:
    steps: [pio test -f test_hw_memory.cpp]
```

**Strategy 2: Smart Test Selection**
```python
# Only run tests affected by code changes
def select_tests(changed_files):
    if any('led_driver' in f for f in changed_files):
        return ['test_hw_led_driver.cpp']
    elif any('audio' in f for f in changed_files):
        return ['test_hw_audio_input.cpp']
    else:
        return ['all']
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| v1.0 | 2025-11-10 | DevOps + QA | Initial automation guide |

**Next Steps:**
1. Set up self-hosted runner
2. Deploy test scripts to `tools/hw_test/`
3. Configure GitHub Actions workflows
4. Execute first automated test run
5. Monitor and refine automation
