#!/usr/bin/env python3
"""
Graph system profiling metrics analyzer
Processes CSV benchmark data and generates performance report
"""

import sys
import csv
from pathlib import Path
from statistics import mean, stdev
from collections import defaultdict

def analyze_metrics(csv_file):
    """Analyze benchmark metrics from CSV file"""

    if not Path(csv_file).exists():
        print(f"Error: File not found: {csv_file}")
        return

    data = defaultdict(list)

    # Read CSV
    with open(csv_file, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            pattern = row['pattern']
            data[pattern].append({
                'render_us': int(row['render_us']),
                'quantize_us': int(row['quantize_us']),
                'rmt_wait_us': int(row['rmt_wait_us']),
                'rmt_tx_us': int(row['rmt_tx_us']),
                'total_us': int(row['total_us']),
                'heap_free_kb': int(row['heap_free_kb']),
                'fps': float(row['fps'])
            })

    # Analyze each pattern
    print("\nDetailed Performance Analysis")
    print("=" * 80)

    for pattern in sorted(data.keys()):
        frames = data[pattern]
        if not frames:
            continue

        render_times = [f['render_us'] for f in frames]
        quantize_times = [f['quantize_us'] for f in frames]
        total_times = [f['total_us'] for f in frames]
        fps_values = [f['fps'] for f in frames]
        heap_free = [f['heap_free_kb'] for f in frames]

        print(f"\nPattern: {pattern}")
        print("-" * 80)
        print(f"  Frames captured: {len(frames)}")
        print(f"\n  Render Time (microseconds):")
        print(f"    Min:  {min(render_times):8d} us")
        print(f"    Max:  {max(render_times):8d} us")
        print(f"    Avg:  {mean(render_times):8.1f} us")
        if len(render_times) > 1:
            print(f"    StDev:{stdev(render_times):8.1f} us")

        print(f"\n  Quantize Time (microseconds):")
        print(f"    Min:  {min(quantize_times):8d} us")
        print(f"    Max:  {max(quantize_times):8d} us")
        print(f"    Avg:  {mean(quantize_times):8.1f} us")
        if len(quantize_times) > 1:
            print(f"    StDev:{stdev(quantize_times):8.1f} us")

        print(f"\n  Total Frame Time (microseconds):")
        print(f"    Min:  {min(total_times):8d} us")
        print(f"    Max:  {max(total_times):8d} us")
        print(f"    Avg:  {mean(total_times):8.1f} us")
        if len(total_times) > 1:
            print(f"    StDev:{stdev(total_times):8.1f} us")

        # Calculate FPS statistics
        print(f"\n  Frame Rate (FPS):")
        print(f"    Min:  {min(fps_values):8.1f} FPS")
        print(f"    Max:  {max(fps_values):8.1f} FPS")
        print(f"    Avg:  {mean(fps_values):8.1f} FPS")
        if len(fps_values) > 1:
            print(f"    StDev:{stdev(fps_values):8.1f} FPS")

        # Memory analysis
        print(f"\n  Memory (Free Heap):")
        print(f"    Min:  {min(heap_free):8d} KB")
        print(f"    Max:  {max(heap_free):8d} KB")
        print(f"    Avg:  {mean(heap_free):8.1f} KB")
        if len(heap_free) > 1:
            delta = max(heap_free) - min(heap_free)
            print(f"    Delta:{delta:8d} KB (memory consumption)")

    # Cross-pattern comparison
    print("\n\nCross-Pattern Comparison (Averages)")
    print("=" * 80)
    print(f"{'Pattern':<15} {'Render (us)':<15} {'Quantize (us)':<15} {'FPS':<10} {'Mem (KB)':<10}")
    print("-" * 80)

    for pattern in sorted(data.keys()):
        frames = data[pattern]
        if frames:
            avg_render = mean([f['render_us'] for f in frames])
            avg_quantize = mean([f['quantize_us'] for f in frames])
            avg_fps = mean([f['fps'] for f in frames])
            avg_mem = mean([f['heap_free_kb'] for f in frames])
            print(f"{pattern:<15} {avg_render:>14.1f} {avg_quantize:>14.1f} {avg_fps:>9.1f} {avg_mem:>9.1f}")

    # Performance metrics
    print("\n\nPerformance Assessment")
    print("=" * 80)

    if data:
        all_frames = [f for frames in data.values() for f in frames]
        total_render = mean([f['render_us'] for f in all_frames])
        total_quantize = mean([f['quantize_us'] for f in all_frames])
        total_time = mean([f['total_us'] for f in all_frames])
        avg_fps = mean([f['fps'] for f in all_frames])

        # Calculate frame budget (assuming 60 FPS target = 16667us per frame)
        frame_budget_us = 16667
        budget_used = (total_time / frame_budget_us) * 100
        headroom = 100 - budget_used

        print(f"\nAssuming 60 FPS target (16,667 us per frame):")
        print(f"  Render:        {total_render:8.1f} us ({(total_render/frame_budget_us)*100:5.1f}%)")
        print(f"  Quantize:      {total_quantize:8.1f} us ({(total_quantize/frame_budget_us)*100:5.1f}%)")
        print(f"  Total:         {total_time:8.1f} us ({budget_used:5.1f}%)")
        print(f"  Headroom:      {headroom:8.1f}%")

        if avg_fps > 55:
            print(f"\n  Status: PASS (Avg FPS: {avg_fps:.1f})")
        else:
            print(f"\n  Status: NEEDS OPTIMIZATION (Avg FPS: {avg_fps:.1f})")

    print("\n" + "=" * 80)


if __name__ == '__main__':
    if len(sys.argv) > 1:
        analyze_metrics(sys.argv[1])
    else:
        print("Usage: python3 analyze_metrics.py <csv_file>")
        sys.exit(1)
