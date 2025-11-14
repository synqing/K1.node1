# EMERGENCY FIX: Stride-Based Bin Processing

**Date:** 2025-11-14  
**Issue:** Phase 0 baseline failing due to stride-based bin processing  
**Root Cause:** Inconsistent auto-ranging causing confidence collapse  

## Problem Analysis

The stride-based bin processing in `update_tempo()` was causing:
- **Low confidence**: 0.09-0.23 (should be 0.60-0.80)
- **BPM jitter**: 51.6 → 133.6 → 89.8 → 113.3 (real song: 115 BPM)
- **Anemic power_sum**: 0.022-2.046 (should be 10-50 for clear beat)

## Root Cause

```cpp
// BROKEN: Each call does its own auto-ranging across all 128 bins
for (uint16_t k = 0; k < stride; ++k) {
    uint16_t bin = calc_bin + k;
    calculate_tempi_magnitudes((int16_t)bin);  // Single bin, inconsistent scaling
}
```

Each `calculate_tempi_magnitudes(single_bin)` call:
1. Does auto-ranging across ALL 128 bins
2. Updates only ONE bin with new scaling
3. Leaves other 127 bins with stale values
4. Next frame: different bin gets different scaling

**Result:** Magnitudes are wildly inconsistent; confidence metric collapses.

## Fix Applied

```cpp
// FIXED: Calculate ALL bins every frame with consistent auto-ranging
calculate_tempi_magnitudes(-1);  // -1 = all bins, one autoranger pass
```

This:
- Calculates all 128 bins in a single call
- One auto-ranging pass across the full spectrum (correct)
- CPU cost: ~2-3ms per frame (reasonable on 240 MHz core)

## Expected Results After Fix

- **Confidence**: Should return to 0.60-0.80 range on clear beats
- **BPM stability**: Should lock to correct tempo (±2 BPM)
- **Power sum**: Should be in 10-50 range for clear beats
- **Processing time**: +2-3ms per frame (acceptable)

## Validation Required

1. **Test with 115 BPM song** (the one that was failing)
2. **Monitor confidence**: Should be 0.60-0.80 (not 0.09-0.23)
3. **Monitor BPM**: Should lock to ~115 BPM (not jitter 51-133)
4. **Monitor power_sum**: Should be 10-50 (not 0.02-2.0)

## Rollback Plan

If fix causes issues:
```bash
git checkout src/audio/tempo.cpp  # Revert to stride-based processing
git checkout phase0_baseline      # Return to original baseline
```

## Next Steps

1. Flash firmware with fix
2. Test with the failing 115 BPM song
3. Verify confidence returns to expected range
4. If successful, proceed with Phase 1 entropy validation
5. If still failing, investigate deeper (novelty curve or Goertzel constants)