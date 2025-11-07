#!/usr/bin/env python3
"""
Beat Phase Analyzer

Parses a CSV log with timestamps and observed beat_phase (0..1), compares against
expected phase progression for a given BPM, and outputs accuracy metrics.

Input CSV columns (header required):
  timestamp_s,beat_phase

Usage:
  python tools/beat_phase_analyzer.py --bpm 120 --log beat_phase_log.csv --out report.csv

Accuracy metric (per request): (expected_phase - actual_phase) / expected_phase
Notes: when expected_phase approaches 0, skip to avoid division by ~0. Also report
wrapped absolute phase error (min(|d|, 1-|d|)).
"""
import argparse, csv, math

def expected_phase_at(t_sec: float, bpm: float) -> float:
  bps = bpm / 60.0
  phase = (t_sec * bps) % 1.0
  return phase

def wrap_phase_err(expected: float, actual: float) -> float:
  d = abs(expected - actual) % 1.0
  return min(d, 1.0 - d)

def analyze(bpm: float, log_path: str, out_path: str):
  rows = []
  with open(log_path, 'r') as f:
    r = csv.DictReader(f)
    for row in r:
      t = float(row['timestamp_s'])
      phase = float(row['beat_phase'])
      exp = expected_phase_at(t, bpm)
      ratio = None
      if exp > 1e-6:
        ratio = (exp - phase) / exp
      abs_err = wrap_phase_err(exp, phase)
      rows.append({ 'timestamp_s': t, 'expected_phase': exp, 'actual_phase': phase, 'accuracy_ratio': ratio, 'abs_phase_error': abs_err })
  # Summary
  valid_ratios = [r['accuracy_ratio'] for r in rows if r['accuracy_ratio'] is not None]
  mean_ratio = sum(valid_ratios)/len(valid_ratios) if valid_ratios else None
  mean_abs_err = sum(r['abs_phase_error'] for r in rows)/len(rows) if rows else None
  with open(out_path, 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=['timestamp_s','expected_phase','actual_phase','accuracy_ratio','abs_phase_error'])
    w.writeheader()
    for r in rows: w.writerow(r)
  print(f'Wrote {out_path}.')
  print(f'Mean accuracy_ratio: {mean_ratio}')
  print(f'Mean abs_phase_error: {mean_abs_err}')

def main():
  ap = argparse.ArgumentParser()
  ap.add_argument('--bpm', type=float, required=True)
  ap.add_argument('--log', type=str, required=True)
  ap.add_argument('--out', type=str, default='beat_phase_report.csv')
  args = ap.parse_args()
  analyze(args.bpm, args.log, args.out)

if __name__ == '__main__':
  main()

