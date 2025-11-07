#!/usr/bin/env python3
"""
Generate a click track WAV for metronome testing.

Usage:
  python tools/metronome.py --bpm 120 --seconds 60 --outfile metronome_120bpm.wav

Defaults: 44100 Hz, 16-bit PCM, 60 seconds.
"""
import argparse, math, wave, struct, sys

def gen_click_track(bpm: float, seconds: int, sr: int = 44100, click_ms: int = 20, freq_hz: int = 2000):
  total = sr * seconds
  samples = [0.0] * total
  interval = int(sr * 60.0 / bpm)
  click_len = int(sr * click_ms / 1000.0)
  for i in range(0, total, interval):
    for n in range(click_len):
      t = (i+n) / sr
      amp = 0.9 * math.sin(2.0 * math.pi * freq_hz * t) * (1.0 - n / click_len)
      if i+n < total:
        samples[i+n] += amp
  # Clip
  for i in range(total):
    samples[i] = max(-1.0, min(1.0, samples[i]))
  return samples

def write_wav(path: str, samples, sr: int = 44100):
  with wave.open(path, 'wb') as wf:
    wf.setnchannels(1)
    wf.setsampwidth(2)
    wf.setframerate(sr)
    for s in samples:
      wf.writeframes(struct.pack('<h', int(s * 32767)))

def main():
  ap = argparse.ArgumentParser()
  ap.add_argument('--bpm', type=float, default=120.0)
  ap.add_argument('--seconds', type=int, default=60)
  ap.add_argument('--sr', type=int, default=44100)
  ap.add_argument('--outfile', type=str, default='metronome.wav')
  args = ap.parse_args()
  if args.bpm <= 0:
    print('BPM must be > 0', file=sys.stderr)
    sys.exit(2)
  samples = gen_click_track(args.bpm, args.seconds, args.sr)
  write_wav(args.outfile, samples, args.sr)
  print(f'Wrote {args.outfile} ({args.bpm} BPM, {args.seconds}s)')

if __name__ == '__main__':
  main()

