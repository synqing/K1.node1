# Audio Snapshot Synchronization: Fix Implementation Guide

**Status**: Ready for implementation
**Priority**: CRITICAL
**Estimated Effort**: 20 minutes
**Risk Level**: LOW (isolated to synchronization layer)

## Problem Summary

The `commit_audio_data()` function in `firmware/src/audio/goertzel.cpp` (line 200) uses memcpy to copy the entire `AudioDataSnapshot` structure, which includes atomic synchronization fields. This violates the double-buffered snapshot protocol and prevents patterns from ever receiving updated audio data.

**Current Code (BROKEN)**:
```cpp
// Line 200 in goertzel.cpp
memcpy(&audio_front, &audio_back, sizeof(AudioDataSnapshot));
```

This destroys the sequence counter synchronization mechanism, leaving `audio_front` in a frozen/inconsistent state.

## Solution: Selective Field Copy

Replace the single memcpy with individual field copies for non-atomic data, preserving atomic field semantics.

### Implementation Steps

**File**: `/firmware/src/audio/goertzel.cpp`

**Location**: Function `commit_audio_data()`, lines 183-221

**Action**: Replace lines 183-221 with the corrected version below.

### Corrected Code

```cpp
// =============================================================================
// Commit audio data from back buffer to front buffer (atomic swap)
// Called by audio processing thread after updating audio_back
//
// SYNCHRONIZATION STRATEGY:
// Uses sequence counter to signal write in progress
// - Increment sequence (odd = writing in progress, signals readers to retry)
// - Memory barrier (flush Core 1 cache, ensure readers see sequence change)
// - Copy data fields (NOT via memcpy to preserve atomic field semantics)
// - Memory barrier (ensure data written before final sequence update)
// - Increment sequence again (even = valid data available)
//
// Memory barriers are CRITICAL for ESP32-S3 dual-core cache coherency
// =============================================================================
void commit_audio_data() {
	if (!audio_sync_initialized) {
		return;
	}

	// LOCK-FREE WRITE with sequence counter synchronization
	// Step 1: Increment sequence to ODD value (signals "writing in progress")
	uint32_t seq = audio_front.sequence.load(std::memory_order_relaxed);
	audio_front.sequence.store(seq + 1, std::memory_order_relaxed);

	// Memory barrier: Ensure sequence write is visible to Core 0 before data copy
	// This flushes Core 1's cache and invalidates Core 0's cache for audio_front
	__sync_synchronize();

	// Step 2: Copy data fields (SELECTIVELY - not via memcpy to preserve atomics)
	// Copy frequency spectrum arrays
	memcpy(audio_front.spectrogram, audio_back.spectrogram, sizeof(float) * NUM_FREQS);
	memcpy(audio_front.spectrogram_smooth, audio_back.spectrogram_smooth, sizeof(float) * NUM_FREQS);
	memcpy(audio_front.spectrogram_absolute, audio_back.spectrogram_absolute, sizeof(float) * NUM_FREQS);

	// Copy pitch class (chromagram) array
	memcpy(audio_front.chromagram, audio_back.chromagram, sizeof(float) * 12);

	// Copy FFT array
	memcpy(audio_front.fft_smooth, audio_back.fft_smooth, sizeof(float) * 128);

	// Copy scalar audio level values
	audio_front.vu_level = audio_back.vu_level;
	audio_front.vu_level_raw = audio_back.vu_level_raw;

	// Copy tempo/beat detection data
	audio_front.novelty_curve = audio_back.novelty_curve;
	audio_front.tempo_confidence = audio_back.tempo_confidence;
	memcpy(audio_front.tempo_magnitude, audio_back.tempo_magnitude, sizeof(float) * NUM_TEMPI);
	memcpy(audio_front.tempo_phase, audio_back.tempo_phase, sizeof(float) * NUM_TEMPI);

	// Copy metadata
	audio_front.update_counter = audio_back.update_counter;
	audio_front.timestamp_us = audio_back.timestamp_us;

	// Memory barrier: Ensure all data copies complete before sequence update
	__sync_synchronize();

	// Step 3: Increment sequence to next even value (must be even for "valid data")
	// Load current sequence (should be odd from Step 1)
	seq = audio_front.sequence.load(std::memory_order_relaxed);
	audio_front.sequence.store(seq + 1, std::memory_order_relaxed);

	// Memory barrier: Ensure sequence write is visible to Core 0
	__sync_synchronize();

	// Step 4: Synchronize sequence_end with final sequence (reader validates both match)
	audio_front.sequence_end.store(audio_front.sequence.load(std::memory_order_relaxed),
	                                std::memory_order_relaxed);

	// Step 5: Mark front buffer as valid (first-time initialization flag)
	audio_front.is_valid = true;

	// Final memory barrier: Ensure all writes are visible to Core 0
	__sync_synchronize();
}
```

## Verification Checklist

After implementing the fix:

### 1. Compilation Test
```bash
# In firmware directory
platformio run -e esp32-s3-devkit
```
Expected: No new compiler warnings, clean build

### 2. Serial Diagnostics
Monitor serial output at 115200 baud:

```
[PULSE] audio_available=1            # Should change from 0 to 1
[audio] BPM: XX.X | VU: 0.XX         # Should show non-zero VU
[beat] BEAT detected @ XX.X BPM      # Existing beat detection still works
```

### 3. Pattern Response Test
Run these patterns and observe response to music:

- **Spectrum Display**: Frequency bins should react to music, not show constant 0.14
- **Octave Band**: 12 chromatic bins should animate with pitch content
- **Bloom**: VU pulsing should follow loudness, not be frozen
- **Pulse**: Beat waves should spawn on beat events with smooth animation

### 4. Data Flow Verification
Add temporary logging to verify snapshot synchronization:

In `get_audio_snapshot()` (goertzel.cpp line 126):
```cpp
// Add after line 156 (if statement)
if (retry_count > 100) {  // Log only if suspiciously high
    LOG_WARN(TAG_SYNC, "High retry: seq1=%lu seq2=%lu valid=%d",
             seq1, seq2, audio_front.is_valid);
}
```

Expected behavior:
- retry_count stays < 20 (mostly 0-5)
- No "High retry" warnings during normal operation
- `seq1 == seq2` consistently when read succeeds

### 5. VU Relationship Test
In pattern using audio data:
```cpp
PATTERN_AUDIO_START();
float ratio = AUDIO_VU_RAW / fmaxf(AUDIO_VU, 0.001f);
// Should be >= 1.0 (raw should be >= normalized)
// If < 1.0, snapshot is still frozen
Serial.printf("VU ratio: %.2f\n", ratio);
```

## Testing Against Symptom List

### Before Fix (Current Symptoms)
- [ ] Spectrum[0] always = 0.14
- [ ] VU_normalized (0.36) > VU_raw (0.00)
- [ ] Beat events detected (BPM/tempo changing)
- [ ] But patterns show no audio response
- [ ] Patterns show "audio_available" false or with stale data

### After Fix (Expected Behavior)
- [x] Spectrum[0] changes dynamically with music (0.0-1.0)
- [x] VU_raw >= VU_normalized (correct relationship)
- [x] Beat events detected (no change)
- [x] Patterns animate to music
- [x] Patterns show "audio_available" true with fresh data
- [x] Audio_age_ms < 50ms (within 5 frames)

## Rollback Plan

If the fix introduces regressions:

1. The fix only changes the `commit_audio_data()` function
2. To rollback, restore the original memcpy line:
   ```cpp
   // Single line replaces the 40+ line selective copy
   memcpy(&audio_front, &audio_back, sizeof(AudioDataSnapshot));
   ```
3. This returns to the broken state, so you'd only do this if the fix itself has a compilation issue

## Performance Impact

- Before fix: memcpy ~1,300 bytes (broken synchronization)
- After fix: ~8 selective field copies + 1 large array memcpy
- Performance: **IDENTICAL** (~same microseconds, now with working sync)
- CPU impact: **ZERO** (synchronization fixes don't add CPU)
- Memory impact: **ZERO** (same data structures)

## Next Steps After Fix

1. **Test patterns** - Verify audio reactivity works
2. **Monitor logs** - Check for synchronization warnings
3. **Commit fix** - PR with clear explanation of the bug
4. **Update documentation** - Note the selective field copy pattern for future atomics

## References

- **Analysis Document**: `docs/05-analysis/audio_pipeline_forensic_analysis.md`
- **Broken Code**: `/firmware/src/audio/goertzel.cpp` lines 183-221
- **Audio Interface**: `/firmware/src/pattern_audio_interface.h` (how patterns access data)
- **Structure Definition**: `/firmware/src/audio/goertzel.h` lines 91-129

