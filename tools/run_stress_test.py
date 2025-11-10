#!/usr/bin/env python3
"""
K1.node1 Stress Test Orchestrator
Runs stress tests on device and collects telemetry via REST API.
Usage: python3 run_stress_test.py --device 192.168.1.104 --duration 24h
"""

import argparse
import json
import time
import requests
import csv
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, List


class StressTestOrchestrator:
    def __init__(self, device_url: str, config_path: str, output_dir: str = "stress_results"):
        self.device_url = device_url.rstrip("/")
        self.config = self._load_config(config_path)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.telemetry_csv = self.output_dir / self.config["reporting"]["output_csv"]
        self.telemetry_json = self.output_dir / self.config["reporting"]["output_json"]
        self.metrics_history: List[Dict] = []

        print(f"[INIT] Device: {self.device_url}")
        print(f"[INIT] Output dir: {self.output_dir}")

    def _load_config(self, config_path: str) -> Dict:
        with open(config_path) as f:
            return json.load(f)

    def _health_check(self) -> bool:
        """Verify device is reachable via REST API."""
        try:
            resp = requests.get(f"{self.device_url}/api/device/info", timeout=5)
            return resp.status_code == 200
        except Exception as e:
            print(f"[ERROR] Device unreachable: {e}")
            return False

    def _get_metrics(self) -> Optional[Dict]:
        """Fetch current metrics from device."""
        try:
            resp = requests.get(f"{self.device_url}/api/metrics", timeout=5)
            if resp.status_code == 200:
                return resp.json()
            return None
        except Exception as e:
            print(f"[WARN] Metrics fetch failed: {e}")
            return None

    def _start_test(self, test_id: int) -> bool:
        """Trigger stress test on device (via REST)."""
        try:
            payload = {"test_id": test_id}
            resp = requests.post(f"{self.device_url}/api/stress/start", json=payload, timeout=5)
            return resp.status_code == 200
        except Exception as e:
            print(f"[ERROR] Failed to start test: {e}")
            return False

    def _get_test_status(self) -> Optional[Dict]:
        """Check current test status."""
        try:
            resp = requests.get(f"{self.device_url}/api/stress/status", timeout=5)
            if resp.status_code == 200:
                return resp.json()
            return None
        except Exception as e:
            print(f"[WARN] Status fetch failed: {e}")
            return None

    def _capture_telemetry(self, test_name: str) -> None:
        """Capture and store metrics snapshot."""
        metrics = self._get_metrics()
        if not metrics:
            return

        snapshot = {
            "timestamp": datetime.now().isoformat(),
            "test_name": test_name,
            **metrics
        }
        self.metrics_history.append(snapshot)

        # Log to console
        if "fps" in metrics and "heap_free_bytes" in metrics:
            print(f"  [METRIC] FPS={metrics.get('fps', 0):.1f}, "
                  f"Heap={metrics.get('heap_free_bytes', 0)/1024:.1f}KB, "
                  f"Errors={metrics.get('error_count', 0)}")

    def run_stress_test(self, test_id: int, duration_seconds: int) -> Dict:
        """Run single stress test and collect telemetry."""
        test_config = next(
            (t for t in self.config["stress_tests"] if t["id"] == test_id),
            None
        )
        if not test_config:
            print(f"[ERROR] Test {test_id} not found")
            return {"status": "FAIL", "reason": "test_not_found"}

        test_name = test_config["name"]
        print(f"\n[TEST {test_id}] Starting: {test_name}")
        print(f"  Duration: {duration_seconds}s")

        # Start test on device
        if not self._start_test(test_id):
            print(f"[ERROR] Failed to start test {test_id}")
            return {"status": "FAIL", "reason": "start_failed"}

        # Monitor test execution
        start_time = time.time()
        capture_interval = self.config["telemetry"]["capture_interval_ms"] / 1000.0
        last_capture = start_time
        error_count = 0
        crashes = 0

        while (time.time() - start_time) < duration_seconds:
            now = time.time()

            # Capture telemetry periodically
            if (now - last_capture) >= capture_interval:
                self._capture_telemetry(test_name)
                last_capture = now

            # Check test status
            status = self._get_test_status()
            if status:
                if status.get("crashed"):
                    crashes += 1
                    print(f"  [CRASH] Test crashed: {status.get('crash_reason', 'unknown')}")
                    if crashes > 1:
                        break

            time.sleep(1)  # Avoid hammering device

        elapsed = time.time() - start_time
        print(f"  [COMPLETE] Duration: {elapsed:.1f}s")

        # Capture final metrics
        self._capture_telemetry(test_name)

        return {
            "test_id": test_id,
            "test_name": test_name,
            "status": "PASS" if crashes == 0 else "FAIL",
            "duration_seconds": elapsed,
            "crashes": crashes
        }

    def run_all_stress_tests(self, duration_hours: float = 24.0) -> List[Dict]:
        """Run all stress tests sequentially."""
        print(f"\n=== K1.node1 STRESS TEST SUITE ===")
        print(f"Start time: {datetime.now()}")
        print(f"Device: {self.device_url}")

        # Pre-flight checks
        if not self._health_check():
            print("[ERROR] Device health check failed")
            sys.exit(1)

        results = []
        total_duration = 0

        for test_config in self.config["stress_tests"]:
            test_id = test_config["id"]

            # Use test-specific duration or calculate from total budget
            if "duration_test_seconds" in test_config:
                duration = test_config["duration_test_seconds"]
            else:
                duration = int(test_config.get("duration_seconds", 60))
                # Cap to prevent overnight tests during development
                if duration > 600:
                    duration = 60

            result = self.run_stress_test(test_id, duration)
            results.append(result)
            total_duration += result["duration_seconds"]

            # Brief pause between tests
            time.sleep(5)

        print(f"\n=== TEST SUITE COMPLETE ===")
        print(f"Total duration: {total_duration:.1f}s")
        print(f"Passed: {sum(1 for r in results if r['status'] == 'PASS')}/{len(results)}")

        return results

    def save_results(self, results: List[Dict]) -> None:
        """Save telemetry and results to files."""
        # Save telemetry CSV
        if self.metrics_history:
            keys = self.metrics_history[0].keys()
            with open(self.telemetry_csv, "w", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=keys)
                writer.writeheader()
                writer.writerows(self.metrics_history)
            print(f"[SAVED] Telemetry: {self.telemetry_csv}")

        # Save raw JSON
        with open(self.telemetry_json, "w") as f:
            json.dump({
                "timestamp": datetime.now().isoformat(),
                "test_results": results,
                "metrics_history": self.metrics_history
            }, f, indent=2)
        print(f"[SAVED] JSON results: {self.telemetry_json}")

    def print_summary(self, results: List[Dict]) -> None:
        """Print test summary."""
        print("\n=== STRESS TEST SUMMARY ===")
        for result in results:
            status_str = "PASS" if result["status"] == "PASS" else "FAIL"
            print(f"Test {result['test_id']}: {result['test_name']:<30} [{status_str}]")
            print(f"  Duration: {result['duration_seconds']:.1f}s")
            if result.get("crashes"):
                print(f"  Crashes: {result['crashes']}")

        all_passed = all(r["status"] == "PASS" for r in results)
        overall = "PASS" if all_passed else "FAIL"
        print(f"\nOverall result: {overall}")


def main():
    parser = argparse.ArgumentParser(description="K1.node1 Stress Test Orchestrator")
    parser.add_argument("--device", default="http://192.168.1.104",
                        help="Device URL (e.g., http://192.168.1.104)")
    parser.add_argument("--config", default="tools/stress_test.json",
                        help="Config file path")
    parser.add_argument("--output", default="stress_results",
                        help="Output directory")
    parser.add_argument("--duration", type=float, default=24.0,
                        help="Test duration in hours (for real runs)")
    parser.add_argument("--quick", action="store_true",
                        help="Use quick test durations (for development)")

    args = parser.parse_args()

    orchestrator = StressTestOrchestrator(args.device, args.config, args.output)
    results = orchestrator.run_all_stress_tests(args.duration)

    orchestrator.save_results(results)
    orchestrator.print_summary(results)

    # Exit with success only if all tests passed
    sys.exit(0 if all(r["status"] == "PASS" for r in results) else 1)


if __name__ == "__main__":
    main()
