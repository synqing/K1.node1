#!/usr/bin/env python3
"""
K1.node1 Stress Test Results Analyzer
Analyzes telemetry CSV and determines PASS/FAIL with detailed diagnostics.
Usage: python3 analyze_stress_results.py stress_results/stress_results.csv --config tools/stress_test.json
"""

import argparse
import json
import csv
import sys
from pathlib import Path
from typing import Dict, List, Tuple
from dataclasses import dataclass


@dataclass
class TestMetrics:
    """Aggregated metrics for a single test."""
    test_name: str
    num_samples: int
    fps_min: float
    fps_max: float
    fps_avg: float
    fps_degradation_percent: float
    heap_min_bytes: int
    heap_max_bytes: int
    heap_delta_bytes: int
    heap_delta_percent: float
    error_count_total: int
    cpu_percent_avg: float
    thermal_max_celsius: int


class StressResultsAnalyzer:
    def __init__(self, csv_path: str, config_path: str):
        self.csv_path = Path(csv_path)
        self.config = self._load_config(config_path)
        self.raw_metrics = self._load_csv(csv_path)
        self.test_results: Dict[str, TestMetrics] = {}

        print(f"[LOAD] CSV: {self.csv_path} ({len(self.raw_metrics)} samples)")

    def _load_config(self, config_path: str) -> Dict:
        with open(config_path) as f:
            return json.load(f)

    def _load_csv(self, csv_path: str) -> List[Dict]:
        """Load telemetry CSV."""
        metrics = []
        with open(csv_path) as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Convert numeric fields
                try:
                    row["fps"] = float(row.get("fps", 0))
                    row["heap_free_bytes"] = int(row.get("heap_free_bytes", 0))
                    row["cpu_percent"] = float(row.get("cpu_percent", 0))
                    row["error_count"] = int(row.get("error_count", 0))
                    row["thermal_celsius"] = int(row.get("thermal_celsius", 25))
                except (ValueError, TypeError):
                    continue
                metrics.append(row)
        return metrics

    def _group_by_test(self) -> Dict[str, List[Dict]]:
        """Group metrics by test name."""
        grouped = {}
        for metric in self.raw_metrics:
            test_name = metric.get("test_name", "unknown")
            if test_name not in grouped:
                grouped[test_name] = []
            grouped[test_name].append(metric)
        return grouped

    def analyze_all_tests(self) -> Dict[str, TestMetrics]:
        """Analyze all tests and produce metrics."""
        grouped = self._group_by_test()

        for test_name, metrics in grouped.items():
            if not metrics:
                continue

            fps_values = [m["fps"] for m in metrics if m["fps"] > 0]
            heap_values = [m["heap_free_bytes"] for m in metrics if m["heap_free_bytes"] > 0]
            cpu_values = [m["cpu_percent"] for m in metrics if m["cpu_percent"] > 0]
            thermal_values = [m["thermal_celsius"] for m in metrics]
            error_count = sum(m["error_count"] for m in metrics)

            # Calculate FPS degradation (linear regression slope)
            fps_degradation = self._calculate_fps_degradation(fps_values) if fps_values else 0.0

            # Heap leak detection (negative = leak, positive = reclaim)
            heap_delta = (heap_values[-1] - heap_values[0]) if heap_values else 0
            heap_delta_percent = (100.0 * heap_delta / heap_values[0]) if heap_values and heap_values[0] > 0 else 0

            self.test_results[test_name] = TestMetrics(
                test_name=test_name,
                num_samples=len(metrics),
                fps_min=min(fps_values) if fps_values else 0.0,
                fps_max=max(fps_values) if fps_values else 0.0,
                fps_avg=sum(fps_values) / len(fps_values) if fps_values else 0.0,
                fps_degradation_percent=fps_degradation,
                heap_min_bytes=min(heap_values) if heap_values else 0,
                heap_max_bytes=max(heap_values) if heap_values else 0,
                heap_delta_bytes=heap_delta,
                heap_delta_percent=heap_delta_percent,
                error_count_total=error_count,
                cpu_percent_avg=sum(cpu_values) / len(cpu_values) if cpu_values else 0.0,
                thermal_max_celsius=max(thermal_values) if thermal_values else 25
            )

        return self.test_results

    def _calculate_fps_degradation(self, fps_values: List[float]) -> float:
        """Calculate FPS degradation % using linear regression."""
        if len(fps_values) < 2:
            return 0.0

        n = len(fps_values)
        x_vals = list(range(n))
        x_avg = sum(x_vals) / n
        y_avg = sum(fps_values) / n

        numerator = sum((x_vals[i] - x_avg) * (fps_values[i] - y_avg) for i in range(n))
        denominator = sum((x_vals[i] - x_avg) ** 2 for i in range(n))

        if denominator == 0:
            return 0.0

        slope = numerator / denominator
        total_change = slope * (n - 1)
        degradation_percent = (total_change / y_avg * 100) if y_avg > 0 else 0.0

        return degradation_percent

    def validate_against_criteria(self, test_name: str) -> Tuple[bool, List[str]]:
        """Validate test results against config criteria."""
        metrics = self.test_results.get(test_name)
        if not metrics:
            return False, ["Test not found in results"]

        # Find test config
        test_config = next(
            (t for t in self.config["stress_tests"] if t["name"] == test_name),
            None
        )
        if not test_config:
            return True, ["No criteria defined (auto-pass)"]

        failures = []

        # FPS criteria
        if "target_fps" in test_config:
            target_fps = test_config["target_fps"]
            tolerance = test_config.get("fps_tolerance_percent", 5)
            min_fps = target_fps * (100 - tolerance) / 100
            if metrics.fps_avg < min_fps:
                failures.append(f"FPS too low: {metrics.fps_avg:.1f} < {min_fps:.1f}")

        if "fps_min" in test_config["success_criteria"]:
            min_fps = test_config["success_criteria"]["fps_min"]
            if metrics.fps_avg < min_fps:
                failures.append(f"Avg FPS {metrics.fps_avg:.1f} < {min_fps:.1f}")

        # Heap criteria
        if "heap_leak_bytes_max" in test_config.get("success_criteria", {}):
            max_leak = test_config["success_criteria"]["heap_leak_bytes_max"]
            if abs(metrics.heap_delta_bytes) > max_leak:
                failures.append(f"Heap leak {metrics.heap_delta_bytes} > {max_leak} bytes")

        if "heap_leak_percent_max" in test_config.get("success_criteria", {}):
            max_leak_pct = test_config["success_criteria"]["heap_leak_percent_max"]
            if abs(metrics.heap_delta_percent) > max_leak_pct:
                failures.append(f"Heap leak {metrics.heap_delta_percent:.1f}% > {max_leak_pct}%")

        # Error criteria
        if "errors_max" in test_config.get("success_criteria", {}):
            max_errors = test_config["success_criteria"]["errors_max"]
            if metrics.error_count_total > max_errors:
                failures.append(f"Error count {metrics.error_count_total} > {max_errors}")

        # Thermal criteria
        if metrics.thermal_max_celsius > self.config["thermal_limits"]["sustained_max_celsius"]:
            failures.append(
                f"Thermal max {metrics.thermal_max_celsius}°C > "
                f"{self.config['thermal_limits']['sustained_max_celsius']}°C"
            )

        return len(failures) == 0, failures

    def print_detailed_report(self) -> None:
        """Print detailed analysis report."""
        print("\n" + "=" * 80)
        print("K1.NODE1 STRESS TEST ANALYSIS REPORT")
        print(f"Generated: {self._get_timestamp()}")
        print("=" * 80)

        all_passed = True

        for test_name, metrics in self.test_results.items():
            print(f"\n[TEST] {test_name.upper()}")
            print("-" * 80)

            # Metrics summary
            print(f"  Samples collected: {metrics.num_samples}")
            print(f"  FPS: min={metrics.fps_min:.1f}, max={metrics.fps_max:.1f}, "
                  f"avg={metrics.fps_avg:.1f}")
            print(f"  FPS degradation: {metrics.fps_degradation_percent:.2f}% over test duration")
            print(f"  Heap: {metrics.heap_min_bytes:,} KB (min) to "
                  f"{metrics.heap_max_bytes:,} KB (max)")
            print(f"  Heap delta: {metrics.heap_delta_bytes:+,} bytes "
                  f"({metrics.heap_delta_percent:+.2f}%)")
            print(f"  Errors: {metrics.error_count_total}")
            print(f"  CPU avg: {metrics.cpu_percent_avg:.1f}%")
            print(f"  Thermal max: {metrics.thermal_max_celsius}°C")

            # Validation
            passed, failures = self.validate_against_criteria(test_name)
            if passed:
                print(f"  Status: PASS")
            else:
                print(f"  Status: FAIL")
                for failure in failures:
                    print(f"    - {failure}")
                all_passed = False

        print("\n" + "=" * 80)
        overall_status = "PASS" if all_passed else "FAIL"
        print(f"OVERALL VERDICT: {overall_status}")
        print("=" * 80 + "\n")

        return all_passed

    def print_summary_table(self) -> None:
        """Print concise summary table."""
        print("\n" + "-" * 100)
        print(f"{'Test':<25} {'FPS':<12} {'Heap Delta':<18} {'Errors':<10} {'Thermal':<12} {'Status':<10}")
        print("-" * 100)

        for test_name, metrics in self.test_results.items():
            passed, _ = self.validate_against_criteria(test_name)
            status = "PASS" if passed else "FAIL"

            fps_str = f"{metrics.fps_avg:.1f}"
            heap_str = f"{metrics.heap_delta_bytes:+,}B ({metrics.heap_delta_percent:+.1f}%)"
            thermal_str = f"{metrics.thermal_max_celsius}°C"

            print(f"{test_name:<25} {fps_str:<12} {heap_str:<18} "
                  f"{metrics.error_count_total:<10} {thermal_str:<12} {status:<10}")

        print("-" * 100)

    @staticmethod
    def _get_timestamp() -> str:
        from datetime import datetime
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def main():
    parser = argparse.ArgumentParser(description="Analyze K1.node1 stress test results")
    parser.add_argument("csv_file", help="Input CSV file with telemetry")
    parser.add_argument("--config", default="tools/stress_test.json",
                        help="Stress test configuration file")
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="Print detailed diagnostics")

    args = parser.parse_args()

    # Load and analyze
    analyzer = StressResultsAnalyzer(args.csv_file, args.config)
    analyzer.analyze_all_tests()

    # Print results
    analyzer.print_summary_table()
    all_passed = analyzer.print_detailed_report()

    if args.verbose:
        print("[VERBOSE] Raw metrics history:")
        for i, metric in enumerate(analyzer.raw_metrics[:10]):  # First 10 samples
            print(f"  {i}: FPS={metric.get('fps', 0)}, Heap={metric.get('heap_free_bytes', 0)}")

    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
