# AGC Auto-Ranger Removal Refactor

## Date
2025-11-14

## Status
COMPLETED

## Problem Statement

The auto-ranger normalization in `calculate_magnitudes()` was crushing the dynamic range of the spectrum BEFORE CochlearAGC could process it, preventing AGC from boosting weak signals properly.

### Symptoms
- VU level stuck at 0.05 despite AGC gain showing 2.68x
- AGC unable to boost signals because it was receiving pre-normalized data (0.0-1.0 range)
- Expected VU of 0.4-0.6 with AGC boost never achieved

### Root Cause
The pipeline was processing data in this BROKEN order:
1. Calculate raw Goertzel magnitudes
2. Apply noise filtering
3. **Auto-range normalize** (max_val_smooth / autoranger_scale) ← PROBLEM
4. Apply CochlearAGC ← Sees normalized data (can't boost!)
5. Calculate VU

## Solution

### Files Modified

1. `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/goertzel.cpp`
   - Removed `max_val_smooth` static variable
   - Removed `max_val` accumulation loop
   - Removed auto-ranger scale calculation and application (lines ~466-497)
   - Updated `frequencies_musical[i].magnitude` to store raw values (not normalized)
   - Added comments explaining why auto-ranger was removed

2. `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/audio/cochlear_agc.h`
   - Removed line 298: `required_gain = std::max(required_gain, 1.0f);`
   - This allows AGC to attenuate (gain < 1.0) when signals are too strong
   - Added comment explaining the change

### Corrected Pipeline Order

The FIXED pipeline now processes data in this order:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Calculate Raw Goertzel Magnitudes                        │
│    magnitudes_raw[i] = calculate_magnitude_of_bin(i)        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Apply Noise Filtering                                    │
│    magnitudes_raw[i] = collect_and_filter_noise(...)        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Store RAW Magnitudes (NO NORMALIZATION)                  │
│    frequencies_musical[i].magnitude = magnitudes_raw[i]      │
│    frequencies_musical[i].magnitude_full_scale = ...         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Apply Moving Average Smoothing (Still Raw)               │
│    magnitudes_smooth[i] = avg(magnitudes_avg[][i])          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Copy to Spectrogram Array (Still Raw)                    │
│    spectrogram[i] = magnitudes_smooth[i]                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Apply Multi-Frame Averaging (Still Raw)                  │
│    spectrogram_smooth[i] = avg(spectrogram_average[][i])    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. *** COCHLEAR AGC PROCESSES RAW SPECTRUM ***              │
│    g_cochlear_agc->process(spectrogram_smooth)               │
│    - Receives FULL dynamic range (e.g., 0.0 - 50000.0)      │
│    - Can boost weak signals (gain > 1.0)                    │
│    - Can attenuate strong signals (gain < 1.0)              │
│    - Modifies spectrogram_smooth[] IN PLACE                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. Apply User Microphone Gain                               │
│    spectrogram_smooth[i] *= configuration.microphone_gain   │
│    (Range: 0.5x to 2.0x, default 1.0x)                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. Calculate VU from AGC-Processed Spectrum                 │
│    vu_sum += spectrogram_smooth[i] * weight                 │
│    audio_level = clip_float(vu_sum * audio_sensitivity)     │
└─────────────────────────────────────────────────────────────┘
```

## Key Changes

### Before (BROKEN)
- Spectrum was normalized to 0.0-1.0 range BEFORE AGC
- AGC saw crushed dynamic range and couldn't boost effectively
- VU calculated from normalized values (not representative of true loudness)

### After (FIXED)
- Spectrum maintains RAW dynamic range through to AGC
- AGC sees full signal dynamics (e.g., 0.0 - 50000.0 or whatever the actual range is)
- AGC can properly boost weak signals and attenuate strong signals
- VU calculated from AGC-processed values (reflects actual perceived loudness)

## Data Flow Verification

### Raw Magnitude Path
```cpp
// Line 411: Calculate raw Goertzel magnitude
magnitudes_raw[i] = calculate_magnitude_of_bin(i);

// Line 413: Apply noise filter (still preserves dynamic range)
magnitudes_raw[i] = collect_and_filter_noise(magnitudes_raw[i], i);

// Line 416-417: Store RAW values
frequencies_musical[i].magnitude_full_scale = magnitudes_raw[i];
frequencies_musical[i].magnitude = magnitudes_raw[i];  // NEW: No normalization

// Line 420: Moving average of RAW values
magnitudes_avg[iter % NUM_AVERAGE_SAMPLES][i] = magnitudes_raw[i];

// Line 427: Average is still RAW
magnitudes_avg_result /= NUM_AVERAGE_SAMPLES;

// Line 430: Store RAW averaged value
magnitudes_smooth[i] = magnitudes_avg_result;
```

### Spectrogram Path (No Normalization)
```cpp
// Line 453: Copy RAW magnitudes to spectrogram
spectrogram[i] = magnitudes_smooth[i];

// Line 462: Multi-frame averaging of RAW values
spectrogram_average[spectrogram_average_index][i] = spectrogram[i];

// Line 468: Averaged spectrogram still RAW
spectrogram_smooth[i] /= float(NUM_SPECTROGRAM_AVERAGE_SAMPLES);
```

### AGC Processing (Receives RAW Dynamic Range)
```cpp
// Line 475: AGC processes RAW spectrum IN-PLACE
if (g_cochlear_agc) {
    g_cochlear_agc->process(spectrogram_smooth);  // Modifies array in place
}

// Line 484: Apply user microphone gain AFTER AGC
spectrogram_smooth[i] = clip_float(spectrogram_smooth[i] * configuration.microphone_gain);
```

### VU Calculation (From AGC-Processed Values)
```cpp
// Line 505: VU calculated from AGC-boosted spectrum
vu_sum += spectrogram_smooth[i] * weight;  // AGC has already processed this

// Line 508: Final VU with sensitivity
audio_level = clip_float(vu_level_calculated);
```

## Removed Code Blocks

### Removed Variables
```cpp
// REMOVED: Line ~417
static float max_val_smooth = 0.0;

// REMOVED: Line ~422
float max_val = 0.0;
```

### Removed Max Value Tracking
```cpp
// REMOVED: Lines ~447-449
if (magnitudes_smooth[i] > max_val) {
    max_val = magnitudes_smooth[i];
}
```

### Removed Auto-Ranger Smoothing
```cpp
// REMOVED: Lines ~466-478
if (max_val > max_val_smooth) {
    float delta = max_val - max_val_smooth;
    max_val_smooth += delta * 0.005;
}
if (max_val < max_val_smooth) {
    float delta = max_val_smooth - max_val;
    max_val_smooth -= delta * 0.005;
}
if (max_val_smooth < 0.000001) {
    max_val_smooth = 0.000001;
}
```

### Removed Spectrogram Absolute Copy
```cpp
// REMOVED: Lines ~483-487
for (uint16_t i = 0; i < NUM_FREQS; i++) {
    spectrogram_absolute[i] = spectrogram[i];
}
```

### Removed Auto-Ranger Normalization
```cpp
// REMOVED: Lines ~490-497
float autoranger_scale = 1.0 / (max_val_smooth);

for (uint16_t i = 0; i < NUM_FREQS; i++) {
    frequencies_musical[i].magnitude = clip_float(magnitudes_smooth[i] * autoranger_scale);
    spectrogram[i] = frequencies_musical[i].magnitude;
}
```

## CochlearAGC Changes

### Removed Attenuation Prevention
```cpp
// BEFORE (Line 298 in cochlear_agc.h):
required_gain = std::max(required_gain, 1.0f); // Only boost or unity

// AFTER:
// REMOVED: Allows attenuation when needed
```

This change enables the AGC to attenuate (gain < 1.0) when signals are too strong, providing true automatic gain control instead of boost-only behavior.

## Expected Results

With these changes, the AGC should now:

1. **Receive full dynamic range signals**
   - No pre-normalization crushing the input
   - Can see true signal strength variations

2. **Properly boost weak signals**
   - VU levels should increase from 0.05 to expected 0.4-0.6 range
   - AGC gain of 2.68x will actually result in 2.68x signal boost

3. **Properly attenuate strong signals**
   - AGC can now reduce gain below 1.0 when needed
   - Prevents clipping on loud audio

4. **Accurate VU metering**
   - VU calculated from AGC-processed spectrum
   - Reflects actual perceived loudness after AGC boost/attenuation

## Testing Recommendations

1. **Monitor AGC gain and VU correlation**
   - With AGC gain 2.68x on weak signal, VU should be ~0.4-0.6
   - Verify VU increases proportionally with AGC gain

2. **Test dynamic range**
   - Play quiet music: AGC should boost (gain > 1.0), VU should be visible
   - Play loud music: AGC should attenuate (gain < 1.0), VU should be controlled

3. **Verify spectrum preservation**
   - Check that frequency content is preserved (no spectral artifacts)
   - Ensure bass and treble balance maintained through AGC

4. **Check clipping prevention**
   - VU should never exceed 1.0 even with loud inputs
   - AGC should attenuate before clipping occurs

## Traceability

- **Related Issue**: AGC not boosting weak signals (VU stuck at 0.05)
- **Root Cause**: Auto-ranger pre-normalization preventing AGC from seeing dynamic range
- **Solution**: Remove auto-ranger; let AGC process raw spectrum
- **Validation**: Monitor VU levels and AGC gain correlation on device

## Notes

- The `spectrogram_absolute` array may need to be removed or repurposed since it was storing normalized values for pattern consistency. This needs further investigation based on pattern requirements.
- Microphone gain is now the final user-adjustable parameter after AGC, allowing fine-tuning of the AGC output.
- VU calculation now properly reflects AGC-boosted signal, matching what beat detection and patterns will see.
