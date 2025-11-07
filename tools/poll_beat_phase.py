#!/usr/bin/env python3
"""
Polls a device endpoint and logs beat_phase to CSV.

Usage examples:
  python tools/poll_beat_phase.py \
    --device http://192.168.1.50 \
    --endpoint /api/device/performance \
    --field beat_phase \
    --interval 0.25 \
    --count 120 \
    --out beat_phase_log.csv

Notes:
  - `--field` supports dotted paths (e.g., audio.beat.phase).
  - Timestamp comes from JSON field `timestamp_s` if present and numeric; otherwise host time.
  - Writes CSV header: timestamp_s,beat_phase
"""
import argparse, time, sys, json
from urllib.request import urlopen
from urllib.error import URLError, HTTPError

def get_field(obj, dotted):
  cur = obj
  for part in dotted.split('.'):
    if isinstance(cur, dict) and part in cur:
      cur = cur[part]
    else:
      return None
  return cur

def fetch_json(url: str):
  with urlopen(url, timeout=2.5) as r:
    if r.status != 200:
      raise RuntimeError(f'HTTP {r.status}')
    data = r.read()
    return json.loads(data.decode('utf-8'))

def main():
  ap = argparse.ArgumentParser()
  ap.add_argument('--device', required=False, help='Base URL, e.g., http://192.168.1.50. Defaults to $K1_DEVICE_URL or $DEVICE if set.')
  ap.add_argument('--endpoint', default='/api/device/performance')
  ap.add_argument('--field', default='beat_phase', help='Dotted path for beat phase in JSON')
  ap.add_argument('--interval', type=float, default=0.25)
  ap.add_argument('--count', type=int, default=0, help='Number of samples; 0 = until Ctrl-C')
  ap.add_argument('--out', default='beat_phase_log.csv')
  args = ap.parse_args()

  import os
  device_url = args.device or os.environ.get('K1_DEVICE_URL') or os.environ.get('DEVICE')
  if not device_url:
    print('error: --device is required (or set K1_DEVICE_URL/DEVICE env var)', file=sys.stderr)
    sys.exit(2)
  base = device_url.rstrip('/')
  url = base + args.endpoint

  # Open CSV file and write header
  wrote_header = False
  out = open(args.out, 'w', buffering=1)
  try:
    n = 0
    while True:
      try:
        obj = fetch_json(url)
        beat = get_field(obj, args.field)
        if not isinstance(beat, (int, float)):
          print(f'[warn] field {args.field} not found or not numeric; got={beat}', file=sys.stderr)
          beat = None
        ts = obj.get('timestamp_s')
        if not isinstance(ts, (int, float)):
          ts = time.time()
        if not wrote_header:
          out.write('timestamp_s,beat_phase\n')
          wrote_header = True
        if beat is not None:
          out.write(f'{ts:.6f},{float(beat):.6f}\n')
      except (URLError, HTTPError, RuntimeError, json.JSONDecodeError) as e:
        print(f'[warn] fetch error: {e}', file=sys.stderr)
      n += 1
      if args.count and n >= args.count:
        break
      time.sleep(max(0.01, args.interval))
  finally:
    out.close()
    print(f'Wrote {args.out}')

if __name__ == '__main__':
  main()
