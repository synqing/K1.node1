# PHASE 0 CRITICAL FIX: BLOCK SIZE CALCULATION

**Date:** 2025-11-14  
**Issue:** All tempo bins using 1024-sample window (20.48s) - averaging over 39 beat cycles  
**Root Cause:** Block size calculated from frequency spacing instead of beat period  
**Impact:** System picks up harmonics/false peaks, misses actual beat  

## 🔍 **Problem Identified**

From debug output:
```
bin 83 (114.8 BPM): 0.0033     ← ACTUAL BEAT (115 BPM) - INVISIBLE
bin 104 (131.2 BPM): 1.0000    ← FALSE PEAK - MAXED OUT
```

**All block sizes = 1024** = entire NOVELTY_HISTORY_LENGTH = 20.48 seconds

**115 BPM = 1.917 Hz** → Block spans **39 beat cycles** instead of 1-2 cycles

## 🔧 **Root Cause Analysis**

**Original broken code (lines 119-127):**
```cpp
float neighbor_left_distance_hz = fabsf(neighbor_left - tempi[i].target_tempo_hz);
float neighbor_right_distance_hz = fabsf(neighbor_right - tempi[i].target_tempo_hz);
float max_distance_hz = fmaxf(neighbor_left_distance_hz, neighbor_right_distance_hz);

tempi[i].block_size = static_cast<uint32_t>(NOVELTY_LOG_HZ / (max_distance_hz * 0.5f));

if (tempi[i].block_size > NOVELTY_HISTORY_LENGTH) {
    tempi[i].block_size = NOVELTY_HISTORY_LENGTH;  // ← CAPPING HERE
}
```

**Problem:** Calculating block size from **frequency bin spacing** instead of **beat period**

## ✅ **Fix Applied**

**New tempo-adaptive code:**
```cpp
// ====================================================================
// PHASE 0 FIX: Block size = 1-2 beat cycles, NOT frequency spacing
// ====================================================================
// Block size should adapt to the beat period, not bin resolution
// One beat cycle = 1 / target_tempo_hz seconds
// At NOVELTY_LOG_HZ (50 Hz), convert to sample count
// Use 1.5x beat period for responsive but stable detection
float beat_period_samples = NOVELTY_LOG_HZ / tempi[i].target_tempo_hz;
uint32_t block_size_ideal = (uint32_t)(beat_period_samples * 1.5f);

// Clamp to reasonable range [32, 512]
// Min: Need sufficient data for Goertzel computation
// Max: ~10 seconds of history, captures slow variations without aliasing
tempi[i].block_size = block_size_ideal;
if (tempi[i].block_size < 32) tempi[i].block_size = 32;
if (tempi[i].block_size > 512) tempi[i].block_size = 512;
```

## 📊 **Expected Results**

**Before fix:**
- 115 BPM (1.917 Hz): block_size = 1024 samples (20.48s)
- 50 BPM (0.833 Hz): block_size = 1024 samples (20.48s) 
- 150 BPM (2.5 Hz): block_size = 1024 samples (20.48s)

**After fix:**
- 115 BPM (1.917 Hz): block_size = **39 samples** (~0.78s) ✅
- 50 BPM (0.833 Hz): block_size = **90 samples** (~1.8s) ✅  
- 150 BPM (2.5 Hz): block_size = **30 samples** (~0.6s) ✅

## 🎯 **Test Validation**

**Expected test results on 115 BPM track:**
```
[T] BLOCK SIZES:
[T]   bin 83 (115 BPM): block_size=39    ← Was 1024, NOW 39
[T]   bin 100 (128 BPM): block_size=36   ← Was 1024, NOW 36
[T]   bin 103 (130.5 BPM): block_size=35 ← Was 1024, NOW 35

[T] TEMPI_SMOOTH SPECTRUM:
[T]   bin 83 (114.8 BPM): 0.95+          ← Now peaked! (was 0.0033)
[T]   bin 104 (131.2 BPM): 0.01-         ← Now buried! (was 1.0000)

[T] tempo classic bpm=115.0 conf=0.75 lock=UNLOCKED
```

**Validation criteria:**
- ✅ BPM stabilizes at 115.0 ±2 BPM
- ✅ Confidence >= 0.65 (was 0.04-0.24)
- ✅ power_sum grows to 20-50 range (was 2-8)
- ✅ Block sizes are tempo-adaptive (30-90, not 1024)

## 🚀 **Next Steps**

1. **Flash this firmware** to ESP32-S3
2. **Run 60-second test** on 115 BPM track
3. **Verify all criteria** above are met
4. **If successful** → Phase 0 baseline validated ✅
5. **Then proceed** to Phase 1 entropy implementation

**This is the critical fix that should resolve the entire Phase 0 baseline issue.**