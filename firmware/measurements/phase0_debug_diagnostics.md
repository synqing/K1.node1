# PHASE 0 DEBUG DIAGNOSTICS

**Date:** 2025-11-14  
**Issue:** Phase 0 baseline broken - locked to 130.5 BPM instead of 115 BPM  
**Confidence:** 0.15-0.20 (should be 0.60-0.80)  

## Debug Output Added

Every 100 frames (~1 second), the firmware will print:

### 1. Top 5 Tempo Bins
Shows which bins are actually peaking and their values:
```
TOP TEMPI:
  [0] bin=X bpm=XXX.X smooth=X.XXX
  [1] bin=X bpm=XXX.X smooth=X.XXX
  ...
```

### 2. Target Bin 83 (115 BPM)
Shows the bin closest to 115 BPM:
```
BIN XX (115 BPM target): smooth=X.XXX magnitude=X.XXX (diff=X.X BPM)
```

### 3. Current Peak Bin (130.5 BPM)
Shows the bin closest to where it's currently peaking:
```
BIN XX (130.5 BPM current): smooth=X.XXX magnitude=X.XXX (diff=X.X BPM)
```

### 4. Novelty Curve (last 10 samples)
Shows if the novelty curve is converging or just noise:
```
NOVELTY CURVE (last 10):
  [0] raw=X.XXX norm=X.XXX
  [1] raw=X.XXX norm=X.XXX
  ...
```

### 5. Power Sum and Confidence
Key metrics:
```
POWER SUM: X.XXX (should be 10-50 for clear beat)
CONFIDENCE: X.XXX (should be 0.60-0.80 for clear beat)
```

### 6. Block Sizes
Critical check - if block_size > NOVELTY_HISTORY_LENGTH, Goertzel reads garbage:
```
BLOCK SIZES:
  BIN XX (115 BPM): XXXX
  BIN XX (130.5 BPM): XXXX
  NOVELTY_HISTORY_LENGTH: XXX
```

## What to Look For

**If 115 BPM bin is DARK (smooth ~0.001):**
- Block size issue (too large or too small)
- Novelty curve not converging
- Goertzel parameters wrong

**If 115 BPM bin is VISIBLE but buried:**
- Novelty curve is noise, not beat
- Autoranging is wrong
- Magnitude calculation broken

**If power_sum is low (< 5):**
- All bins are weak - systemic issue
- Novelty curve amplitude problem
- Goertzel scaling issue

**If block_size > NOVELTY_HISTORY_LENGTH:**
- Goertzel reads past array bounds
- Immediate fix required

## Expected vs Actual

**Expected for 115 BPM clear beat:**
- Bin 83 (or closest) smooth: 0.8-1.5
- Power sum: 10-50
- Confidence: 0.70-0.85
- Novelty curve: clear peaks every ~0.52s (115 BPM)

**Current (broken):**
- Locked to 130.5 BPM bin
- Confidence: 0.15-0.20
- Power sum: 3-12 (10-20x too low)

Run the test and paste the debug output - I'll analyze what's actually broken.