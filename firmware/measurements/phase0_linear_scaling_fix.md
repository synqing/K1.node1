# PHASE 0 LINEAR SCALING FIX

**Date:** 2025-11-14  
**Issue:** Cubic scaling crushing competing peaks exponentially  
**Root Cause:** x³ scaling turns 0.2 vs 1.0 (5x difference) into 0.008 vs 1.0 (125x difference)  
**Impact:** 115 BPM bin invisible (0.0033) while false peak at 130.5 BPM maxed (1.0)  

## 🔍 **Problem Identified**

**Cubic scaling effect:**
```
Before cubic: bin 83 = 0.2, bin 120 = 1.0  (5x ratio)
After cubic:  bin 83 = 0.008, bin 120 = 1.0 (125x ratio)
```

**Result:** 115 BPM bin crushed to invisibility while false peak dominates

## 🔧 **Root Cause Analysis**

**Original code (lines 227-229):**
```cpp
// EMOTISCOPE VERBATIM: Cubic scaling (x³) for proper dynamic range compression
float cubed = scaled_magnitude * scaled_magnitude * scaled_magnitude;
tempi[i].magnitude = cubed;
```

**Problem:** Cubic amplification crushes anything not at absolute peak

## ✅ **Fix Applied**

**New linear scaling code:**
```cpp
// ====================================================================
// PHASE 0 FIX: Linear scaling instead of cubic
// ====================================================================
// Cubic scaling (x³) was crushing competing peaks
// Linear scaling preserves relative differences better
// Example: If bin 83 = 0.2 and bin 120 = 1.0:
//   - Cubic: 0.008 vs 1.0 (125x difference) - CRUSHING
//   - Linear: 0.2 vs 1.0 (5x difference) - PRESERVES RATIO

tempi[i].magnitude = scaled_magnitude;  // Direct linear assignment
```

## 📊 **Expected Results**

**Before fix:**
- bin 83 (115 BPM): magnitude = 0.008 (after cubic crushing)
- bin 120 (130.5 BPM): magnitude = 1.0 (false peak)

**After fix:**
- bin 83 (115 BPM): magnitude = 0.2 (preserved ratio)
- bin 120 (130.5 BPM): magnitude = 1.0 (maintained)

## 🎯 **Test Validation**

**Expected test results on 115 BPM track:**
```
[T] TEMPI_SMOOTH SPECTRUM:
[T]   bin 83 (114.8 BPM): 0.70+  ← NOW VISIBLE (was 0.20 after cubic crush)
[T]   bin 120 (143.8 BPM): 0.20-  ← NOW REASONABLE (was 1.0 autoranger peak)
[T] tempo classic bpm=115.0 conf=0.75+ lock=UNLOCKED power_sum=25+
```

**Validation criteria:**
- ✅ 115 BPM bin becomes visible (magnitude > 0.5)
- ✅ Confidence increases to 0.65+ (was 0.04-0.24)
- ✅ power_sum grows to 20-50 range (was 2-8)
- ✅ System locks to correct 115 BPM instead of 130.5 BPM

## 🚀 **Next Steps**

1. **Flash this firmware** to ESP32-S3
2. **Run 60-second test** on 115 BPM track
3. **Verify all criteria** above are met
4. **If successful** → Phase 0 baseline validated ✅
5. **Then proceed** to Phase 1 entropy implementation

**Combined with block size fix, this should resolve Phase 0 baseline issues.**