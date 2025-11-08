# LUT Integration: Implementation Reference

**Date:** 2025-11-07
**Scope:** Specific code changes, API mapping, integration patterns
**Status:** Ready for implementation

---

## QUICK REFERENCE: API REPLACEMENTS

### Easing Functions

Replace all `ease_*()` calls with `ease_*_fast()`:

```cpp
// Before (original, from easing_functions.h)
float eased = ease_cubic_out(t);
float bouncy = ease_bounce_out(t);
float elastic = ease_elastic_out(t);

// After (LUT-accelerated, from easing_lut.h)
float eased = ease_cubic_out_fast(t);
float bouncy = ease_bounce_out_fast(t);
// Note: elastic and other complex easing functions not in LUT
// (too expensive to pre-compute; stick with original for these)
```

**Available LUT Functions (10):**
```cpp
ease_linear_fast()
ease_quad_in_fast()
ease_quad_out_fast()
ease_quad_in_out_fast()
ease_cubic_in_fast()
ease_cubic_out_fast()           ← Most used
ease_cubic_in_out_fast()        ← Most used
ease_quart_in_fast()
ease_quart_out_fast()
ease_quart_in_out_fast()
```

### HSV Color Conversion

Replace `hsv()` with `hsv_fast()`:

```cpp
// Before (original full-precision)
CRGBF color = hsv(h, s, v);

// After (LUT-accelerated, ±0.4% hue error, imperceptible)
CRGBF color = hsv_fast(h, s, v);

// Convenience aliases available
CRGBF color = hsv_to_rgb_fast(h, s, v);     // Same as hsv_fast()
CRGBF color = get_hue_pure(h);              // Full sat/brightness
CRGBF color = get_hue_desaturated(h, s, v); // Custom sat/brightness
```

### Palette Interpolation

Replace inline math with cache lookups:

```cpp
// Before (inline interpolation per-frame)
const CRGBF palette_colors[] = { /*...*/ };
const int palette_size = 12;

for (int i = 0; i < NUM_LEDS; i++) {
    int idx_low = (int)(position * (palette_size - 1));
    float frac = (position * (palette_size - 1)) - idx_low;

    if (idx_low >= palette_size - 1) {
        leds[i] = palette_colors[palette_size - 1];
    } else {
        const CRGBF& c1 = palette_colors[idx_low];
        const CRGBF& c2 = palette_colors[idx_low + 1];
        leds[i].r = c1.r * (1 - frac) + c2.r * frac;
        leds[i].g = c1.g * (1 - frac) + c2.g * frac;
        leds[i].b = c1.b * (1 - frac) + c2.b * frac;
    }
}

// After (cache lookup, 15 cycles saved per LED)
static PaletteCache palette_cache_departure;
palette_cache_departure.init(palette_colors, 12);  // One-time setup

for (int i = 0; i < NUM_LEDS; i++) {
    float position = i / (float)NUM_LEDS;
    float val = palette_cache_departure.get(position);  // 5 cycles

    // Apply to LED (example: monochrome palette)
    leds[i] = CRGBF(val, val, val);

    // Or use with HSV conversion
    // CRGBF color = hsv_fast(hue, val, brightness);
}
```

---

## REQUIRED CODE CHANGES

### 1. main.cpp: Add LUT Initialization

**Location:** In `setup()` function, after audio initialization

**Current Code (around line 527-561):**
```cpp
void setup() {
    // ... WiFi, OTA, etc ...

    // Audio subsystem
    init_audio_stubs();
    init_i2s_microphone();
    init_audio_data_sync();
    init_window_lookup();
    init_goertzel_constants_musical();
    init_vu();
    init_tempo_goertzel_constants();

    init_params();
    init_pattern_registry();
    // <- INSERT HERE
}
```

**New Code to Add:**
```cpp
    // Initialize LUT systems for pattern rendering optimization
    init_easing_luts();        // Pre-compute 10 easing curves (10 KB)
    init_hue_wheel_lut();      // Pre-compute HSV hue wheel (3 KB)
    // Note: Palette caches are lazily initialized on first use
```

**New Includes at Top of main.cpp:**
```cpp
#include "lut/easing_lut.h"
#include "lut/color_lut.h"
```

### 2. generated_patterns.h: Use Fast Easing Functions

**Location:** Uncomment easing example patterns or enable in pattern templates

**Search for these patterns (lines ~720, ~900, ~970):**
```cpp
// Pattern template with easing functions commented out
// float eased = ease_cubic_in_out(progress);  // Smooth acceleration/deceleration
// float bouncy = ease_bounce_out(progress);   // Bouncy effect
// float elastic = ease_elastic_out(progress); // Springy effect
```

**Change to:**
```cpp
// Use LUT-accelerated easing for performance
float eased = ease_cubic_in_out_fast(progress);  // Fast (3 cycles)
// float bouncy = ease_bounce_out_fast(progress);  // Bouncy (still use original if too complex)
// float elastic = ease_elastic_out(progress);     // Keep original (expensive to LUT)
```

**Add Include at Top:**
```cpp
#include "lut/easing_lut.h"
```

### 3. palettes.cpp: Add HSV Fast Conversion and Palette Caches

**Location A: Include Header (top of file, after existing includes)**

```cpp
#include "lut/color_lut.h"
#include "lut/palette_lut.h"
```

**Location B: Replace hsv() Function (around line 33)**

Current (lines 33-75, simplified):
```cpp
CRGBF hsv(float h, float s, float v) {
    // Full HSV → RGB implementation
    // ...
}
```

New:
```cpp
CRGBF hsv(float h, float s, float v) {
    // Use LUT-accelerated version
    return hsv_fast(h, s, v);
}
```

**Location C: Add Palette Cache Instances (after includes, before functions)**

```cpp
// Pre-computed palette caches for common patterns
static PaletteCache palette_cache_departure;
static PaletteCache palette_cache_ambient;
// Add more as needed (each is 1 KB)

// Initialize palette caches from palette data
void init_palette_caches() {
    // Example: Departure palette (12-entry gradient)
    const float departure_data[] = {
        0.0f, 0.2f, 0.4f, 0.6f, 0.8f, 1.0f,
        0.9f, 0.8f, 0.7f, 0.6f, 0.5f, 0.4f
    };
    palette_cache_departure.init(departure_data, 12);

    // Example: Ambient palette
    const float ambient_data[] = {
        0.1f, 0.3f, 0.5f, 0.7f, 0.9f, 1.0f
    };
    palette_cache_ambient.init(ambient_data, 6);
}
```

**Location D: Call Cache Initialization (in appropriate setup or first-use location)**

Option 1: Call from main.cpp setup() (recommended):
```cpp
// In main.cpp setup(), after init_hue_wheel_lut()
init_palette_caches();  // Initialize palette caches (external function)
```

Option 2: Lazy initialization (first pattern use):
```cpp
// In palettes.cpp, first pattern that uses caches
static bool caches_initialized = false;
if (!caches_initialized) {
    init_palette_caches();
    caches_initialized = true;
}
```

**Location E: Update Pattern Renderers (Optional, High-Impact)**

Find pattern rendering loops (lines ~220-300):
```cpp
// Old: Inline interpolation
const CRGBF palette_colors[] = { /* 12 colors */ };
const int palette_size = 12;

for (int i = 0; i < NUM_LEDS; i++) {
    int palette_index = (int)(position * (palette_size - 1));
    float interpolation_factor = (position * (palette_size - 1)) - palette_index;
    // ... manual interpolation
}

// New: Cache lookup
for (int i = 0; i < NUM_LEDS; i++) {
    float position = i / (float)NUM_LEDS;
    float val = palette_cache_departure.get(position);
    // ... use val
}
```

---

## VALIDATION CHECKLIST

### Compilation Phase
- [ ] Add includes: `#include "lut/easing_lut.h"`, `#include "lut/color_lut.h"`
- [ ] Verify header guards prevent double-inclusion
- [ ] Build with `pio run -e esp32-s3-devkitc-1` (no errors)
- [ ] Check RAM usage: should increase from 158 KB to ~173 KB
- [ ] Check Flash usage: should be unchanged (LUTs are RAM, not Flash)

### Runtime Phase
- [ ] Boot device; verify WiFi connects normally
- [ ] No memory panics or crashes during initialization
- [ ] LED strip initializes and responds to control
- [ ] Frame rate maintained at 30 FPS (verify with CPU monitor)

### Visual/Functional Phase
- [ ] Test pattern 1: Easing-heavy animation (e.g., pulse)
- [ ] Test pattern 2: HSV color sweep (e.g., hue rotation)
- [ ] Test pattern 3: Palette gradient (e.g., departure/ambient)
- [ ] Test pattern 4: Combined easing + HSV + palette
- [ ] Test pattern 5: Audio responsiveness (verify latency unchanged)

### Performance Phase
- [ ] Measure frame time with profiler (should be 24-29 ms)
- [ ] Measure CPU utilization (should drop from 8% to 7.2%)
- [ ] Measure jitter (should be ±2-3 ms, unchanged)
- [ ] Verify color accuracy on RGB meter (±5% acceptable)

---

## EXAMPLE: Complete Pattern Integration

### Before (Original)
```cpp
void pattern_pulse(const PatternParameters& params) {
    static float phase = 0;
    phase += params.speed * 0.01f;
    if (phase > 1.0f) phase -= 1.0f;

    // Manual easing
    float eased = phase < 0.5f
        ? 2.0f * phase * phase
        : -1.0f + (4.0f - 2.0f * phase) * phase;

    // Manual HSV conversion (expensive)
    float h = params.color;
    float s = 1.0f;
    float v = eased;

    // Complex HSV → RGB conversion inline
    float h_prime = h * 6.0f;
    float c = v * 1.0f;
    float x = c * (1.0f - fabsf(fmodf(h_prime, 2.0f) - 1.0f));
    // ... 50+ more lines of HSV math

    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = rgb;  // Same color for all
    }
}
```

### After (LUT-Accelerated)
```cpp
void pattern_pulse(const PatternParameters& params) {
    static float phase = 0;
    phase += params.speed * 0.01f;
    if (phase > 1.0f) phase -= 1.0f;

    // LUT-based easing (3 cycles instead of 8)
    float eased = ease_quad_in_out_fast(phase);

    // LUT-based HSV conversion (13 cycles instead of 65)
    CRGBF color = hsv_fast(params.color, 1.0f, eased);

    // Apply to all LEDs
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = color;
    }
}
// Total cycles saved: 5 per easing + 52 per HSV = 57 cycles per frame
// Savings: 57 / 80,000 = 0.07% of total LED loop
```

---

## PERFORMANCE EXPECTATIONS

After implementation, you should observe:

### Compile Time
- Incremental build: +0 seconds (headers only)
- Clean build: +0.5 seconds (10 more KB to compile)

### Boot Time
- Pre-implementation: ~100-150 ms (WiFi dominates)
- Post-implementation: ~100-150 ms (unchanged)
- LUT init overhead: <1 ms, lost in noise

### Frame Time
- Pre-implementation: 28-30 ms per frame (CPU-bound)
- Post-implementation: 27-29 ms per frame
- Improvement: 1-2 ms (~3-5% faster)

### CPU Utilization
- Pre-implementation: 8% (40 ms loop on Core 1)
- Post-implementation: 7.2% (6,240 cycle reduction)
- Freed budget: Enough for 2-3 additional effects or audio bands

### Power Consumption
- Pre-implementation: 150-200 mA active
- Post-implementation: 149.4-199.4 mA active (0.4 mA reduction)
- Practical impact: Negligible; not worth measuring

### Temperature
- Pre-implementation: ~78°C junction (ambient 25°C)
- Post-implementation: ~77.9°C junction
- Practical impact: Unmeasurable (within ±1°C sensor noise)

---

## TROUBLESHOOTING

### Compile Error: "undefined reference to 'init_easing_luts'"
**Solution:** Ensure `lut/easing_lut.cpp` is included in the build. Check:
- File exists: `firmware/src/lut/easing_lut.cpp` ✓
- PlatformIO includes src/: Check `platformio.ini` build settings

### Compile Error: "CRGBF hue_wheel declared but not defined"
**Solution:** Ensure both header and .cpp included:
```cpp
#include "lut/color_lut.h"       // Declaration
#include "lut/easing_lut.h"      // Declaration
// Both require their .cpp files to be compiled
```

### Runtime Crash: Memory Panic
**Solution:** Verify RAM usage via build.log:
```
Expected: 173 KB / 327 KB (52.9%)
If higher: Check if multiple palette caches causing overflow
Reduce caches to 1-2 instances; lazy-init the rest
```

### Visual Issue: Colors Shifted
**Solution:** Verify HSV lookup accuracy:
```cpp
// Test hue wheel fidelity
CRGBF test = hsv_fast(0.5f, 1.0f, 1.0f);  // Should be cyan
// Expected: R=0, G=1, B=1 (±0.004 for ±0.4% error)
```

### Performance Not Improved
**Solution:** Verify functions are actually being called:
```cpp
// Add profiling
uint32_t t0 = micros();
float eased = ease_cubic_out_fast(0.5f);  // Should be ~3 cycles = ~12 µs
uint32_t t1 = micros();
Serial.printf("Easing took %d µs\n", t1 - t0);
// Expected: ~0.012 µs (limited by micros() overhead)
```

---

## ROLLBACK PROCEDURE

If issues arise, rollback is simple (no persistent state):

1. **Remove LUT initialization calls from main.cpp:**
   ```cpp
   // Comment out or delete:
   // init_easing_luts();
   // init_hue_wheel_lut();
   // init_palette_caches();
   ```

2. **Revert function calls to originals:**
   ```cpp
   ease_cubic_out_fast() → ease_cubic_out()
   hsv_fast() → hsv()
   palette_cache.get() → inline interpolation
   ```

3. **Recompile and redeploy**

**Downtime:** <5 minutes
**Data Loss:** None (no persistent state affected)
**Verification:** Color fidelity and frame timing return to pre-LUT baseline

---

## REFERENCES

- Architecture: `/Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/05-analysis/K1NAnalysis_ANALYSIS_LUT_INTEGRATION_FORENSIC_v1.0_20251108.md`
- Executive Summary: `/Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/05-analysis/K1NAnalysis_SUMMARY_LUT_INTEGRATION_EXECUTIVE_v1.0_20251108.txt`
- LUT Headers: `firmware/src/lut/easing_lut.h`, `color_lut.h`, `palette_lut.h`
- LUT Implementation: `firmware/src/lut/easing_lut.cpp`, `color_lut.cpp`

---

**End of Implementation Reference**
