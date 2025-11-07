#!/usr/bin/env python3
"""
Compare performance metrics between baseline and optimized builds.

Usage:
    # Capture baseline
    curl http://192.168.1.104/api/performance > baseline.json

    # Apply optimizations, rebuild, upload

    # Capture optimized metrics
    curl http://192.168.1.104/api/performance > optimized.json

    # Compare
    python3 tools/compare_perf.py baseline.json optimized.json
"""

import json
import sys
from pathlib import Path

# ANSI color codes for terminal output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

# Performance thresholds (define acceptable limits)
THRESHOLDS = {
    'goertzel_avg_us':    {'target': 1200, 'acceptable': 1500},  # <1.2ms ideal, <1.5ms acceptable
    'goertzel_max_us':    {'target': 2000, 'acceptable': 2500},
    'tempo_avg_us':       {'target': 3200, 'acceptable': 4000},  # <3.2ms ideal (with 4-bin stagger)
    'tempo_max_us':       {'target': 5000, 'acceptable': 6000},
    'free_heap_kb':       {'target': 250,  'acceptable': 200},   # >250KB ideal, >200KB min
    'min_free_heap_kb':   {'target': 200,  'acceptable': 150},
    'audio_age_ms':       {'target': 20,   'acceptable': 50},    # <20ms ideal (frame budget)
}

def load_json(filepath):
    """Load JSON file with error handling."""
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"{RED}Error: File not found: {filepath}{RESET}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"{RED}Error: Invalid JSON in {filepath}: {e}{RESET}", file=sys.stderr)
        sys.exit(1)

def format_delta(value, baseline_value, metric_name, lower_is_better=True):
    """Format delta with color coding based on improvement/regression."""
    if baseline_value == 0:
        return f"{YELLOW}N/A (baseline=0){RESET}"

    delta = value - baseline_value
    pct = (delta / baseline_value) * 100

    # Determine if this is an improvement
    improved = (delta < 0) if lower_is_better else (delta > 0)

    # Color code: green = good, red = bad, yellow = neutral
    if abs(pct) < 2:
        color = YELLOW  # <2% change = neutral
        symbol = "~"
    elif improved:
        color = GREEN
        symbol = "✓"
    else:
        color = RED
        symbol = "✗"

    sign = "+" if delta > 0 else ""
    return f"{color}{sign}{delta:+.1f} ({sign}{pct:+.1f}%) {symbol}{RESET}"

def format_threshold_status(value, metric_name):
    """Check value against thresholds and return status."""
    if metric_name not in THRESHOLDS:
        return ""

    thresholds = THRESHOLDS[metric_name]
    target = thresholds['target']
    acceptable = thresholds['acceptable']

    # Determine comparison direction (some metrics are "higher is better")
    higher_is_better = metric_name.endswith('_kb') or metric_name == 'free_heap_kb'

    if higher_is_better:
        if value >= target:
            return f"{GREEN}✓ TARGET{RESET}"
        elif value >= acceptable:
            return f"{YELLOW}~ ACCEPTABLE{RESET}"
        else:
            return f"{RED}✗ BELOW THRESHOLD{RESET}"
    else:
        if value <= target:
            return f"{GREEN}✓ TARGET{RESET}"
        elif value <= acceptable:
            return f"{YELLOW}~ ACCEPTABLE{RESET}"
        else:
            return f"{RED}✗ ABOVE THRESHOLD{RESET}"

def compare_metrics(baseline, optimized):
    """Compare metrics and print formatted report."""
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}PERFORMANCE COMPARISON REPORT{RESET}")
    print(f"{BLUE}{'='*80}{RESET}\n")

    # Metrics to compare (ordered by importance)
    metrics = [
        ('goertzel_avg_us', 'Goertzel Avg Time', True, 'μs'),
        ('goertzel_max_us', 'Goertzel Peak Time', True, 'μs'),
        ('tempo_avg_us', 'Tempo Avg Time', True, 'μs'),
        ('tempo_max_us', 'Tempo Peak Time', True, 'μs'),
        ('audio_age_ms', 'Audio Latency', True, 'ms'),
        ('free_heap_kb', 'Free Heap', False, 'KB'),
        ('min_free_heap_kb', 'Min Free Heap', False, 'KB'),
        ('audio_frame_count', 'Frame Count', False, ''),
    ]

    results = []
    regressions = 0
    improvements = 0

    for key, label, lower_is_better, unit in metrics:
        baseline_val = baseline.get(key)
        optimized_val = optimized.get(key)

        if baseline_val is None or optimized_val is None:
            print(f"⚠️  {label:30s}  MISSING DATA")
            continue

        # Format values
        baseline_str = f"{baseline_val:8.1f} {unit}"
        optimized_str = f"{optimized_val:8.1f} {unit}"
        delta_str = format_delta(optimized_val, baseline_val, key, lower_is_better)
        threshold_str = format_threshold_status(optimized_val, key)

        print(f"{label:30s}  {baseline_str:15s} → {optimized_str:15s}  {delta_str:30s}  {threshold_str}")

        # Track improvements/regressions
        if baseline_val != 0:
            delta_pct = ((optimized_val - baseline_val) / baseline_val) * 100
            improved = (delta_pct < -2) if lower_is_better else (delta_pct > 2)
            regressed = (delta_pct > 2) if lower_is_better else (delta_pct < -2)

            if improved:
                improvements += 1
            elif regressed:
                regressions += 1

        results.append({
            'metric': key,
            'baseline': baseline_val,
            'optimized': optimized_val,
            'passes_threshold': threshold_str.startswith(f"{GREEN}")
        })

    # Summary
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}SUMMARY{RESET}")
    print(f"{BLUE}{'='*80}{RESET}\n")

    print(f"Improvements:  {GREEN}{improvements}{RESET}")
    print(f"Regressions:   {RED}{regressions}{RESET}")

    passing = sum(1 for r in results if r['passes_threshold'])
    total = len([r for r in results if r['metric'] in THRESHOLDS])
    print(f"Passing Thresholds: {passing}/{total}")

    # Overall verdict
    if regressions == 0 and passing >= total * 0.8:
        print(f"\n{GREEN}✓ OPTIMIZATION SUCCESSFUL{RESET}\n")
        return 0
    elif regressions <= 2 and passing >= total * 0.6:
        print(f"\n{YELLOW}~ CONDITIONAL PASS (review regressions){RESET}\n")
        return 1
    else:
        print(f"\n{RED}✗ OPTIMIZATION FAILED (too many regressions){RESET}\n")
        return 2

def main():
    """Main entry point."""
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <baseline.json> <optimized.json>", file=sys.stderr)
        return 1

    baseline_path = Path(sys.argv[1])
    optimized_path = Path(sys.argv[2])

    baseline = load_json(baseline_path)
    optimized = load_json(optimized_path)

    return compare_metrics(baseline, optimized)

if __name__ == "__main__":
    sys.exit(main())
