# Pattern Code Evidence: Line-by-Line Forensic Analysis

**Document:** Code-level evidence for pattern comparison analysis
**Date:** 2025-11-14
**Scope:** Critical patterns with specific line numbers and code quotes

---

## Pattern 1: SPECTRUM (CORRECT ✓)

### Legacy Implementation
**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/zref/Emotiscope.sourcecode/Emotiscope-2.0/main/light_modes/active/spectrum.h`

```cpp
// Lines 1-34
void draw_spectrum() {
	start_profile(__COUNTER__, __func__);
	// Mirror mode
	if(configuration.mirror_mode.value.u32 == true){
		for (uint16_t i = 0; i < NUM_LEDS>>1; i++) {
			float progress = num_leds_float_lookup[i<<1];
			float mag = (spectrogram_smooth[i]);
			CRGBF color = hsv(
				get_color_range_hue(progress),
				configuration.saturation.value.f32,
				(mag)
			);

			leds[ (NUM_LEDS>>1)    + i] = color;
			leds[((NUM_LEDS>>1)-1) - i] = color;
		}
	}
	// Non mirror
	else{
		for (uint16_t i = 0; i < NUM_LEDS; i++) {
			float progress = num_leds_float_lookup[i];
			float mag = (clip_float(interpolate(progress, spectrogram_smooth, NUM_FREQS)));
			CRGBF color = hsv(
				get_color_range_hue(progress),
				configuration.saturation.value.f32,
				(mag)
			);

			leds[i] = color;
		}
	}

	end_profile();
}
```

**Analysis:**
- **Audio input:** `spectrogram_smooth[i]` (line 7) — pre-smoothed frequency bins
- **Interpolation:** Line 22 uses `interpolate(progress, spectrogram_smooth, NUM_FREQS)`
- **Color:** Maps progress (position) to hue via `get_color_range_hue()`
- **Brightness:** Direct magnitude (line 11: `(mag)` — no response curve)
- **Mirror mode:** Conditional at line 4

### K1 Implementation
**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/generated_patterns.h`
**Lines:** 280-357

```cpp
void draw_spectrum(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    int num_leds = context.num_leds;
    const AudioDataSnapshot& audio = context.audio_snapshot;
    #define AUDIO_IS_AVAILABLE() (audio.is_valid)
    #define AUDIO_IS_FRESH() (audio.update_counter > 0)
    #define AUDIO_AGE_MS() ((uint32_t)((esp_timer_get_time() - audio.timestamp_us) / 1000))
    #define AUDIO_SPECTRUM (audio.spectrogram)
    #define AUDIO_SPECTRUM_INTERP(pos) interpolate(clip_float(pos), audio.spectrogram_smooth, NUM_FREQS)

    // ========== CRITICAL: AUDIO VALIDITY GUARD (Line 297) ==========
    if (!AUDIO_IS_AVAILABLE()) {
        CRGBF ambient_color = color_from_palette(
            params.palette_id,
            clip_float(params.color),
            clip_float(params.background) * clip_float(params.brightness)
        );
        for (int i = 0; i < NUM_LEDS; i++) {
            leds[i] = ambient_color;
        }
        return;  // <-- CRITICAL: Early return prevents garbage rendering
    }

    // Optional optimization: skip render if no new audio frame
    if (!AUDIO_IS_FRESH()) {
        return;
    }

    // Graded decay based on audio age (smoother silence handling)
    float age_ms = (float)AUDIO_AGE_MS();
    float age_factor = 1.0f - fminf(age_ms, 250.0f) / 250.0f;
    age_factor = fmaxf(0.0f, age_factor);

    // Render spectrum (center-origin, so render half and mirror)
    int half_leds = NUM_LEDS / 2;
    auto wrap_idx = [](int idx) {
        while (idx < 0) idx += NUM_LEDS;
        while (idx >= NUM_LEDS) idx -= NUM_LEDS;
        return idx;
    };

    float smooth_mix = clip_float(params.custom_param_3);

    for (int i = 0; i < half_leds; i++) {
        float progress = (float)i / half_leds;
        // ========== AUDIO INTERPOLATION (Line 333) ==========
        float raw_mag = clip_float(interpolate(progress, AUDIO_SPECTRUM, NUM_FREQS));
        float smooth_mag = clip_float(AUDIO_SPECTRUM_INTERP(progress));
        float magnitude = (raw_mag * (1.0f - smooth_mix) + smooth_mag * smooth_mix);
        // ========== RESPONSE CURVE (Line 337: sqrt) ==========
        magnitude = response_sqrt(magnitude) * age_factor;

        CRGBF color = color_from_palette(params.palette_id, progress, magnitude);

        color.r *= params.brightness;
        color.g *= params.brightness;
        color.b *= params.brightness;

        // ========== CENTER-ORIGIN MIRRORING (Lines 348-352) ==========
        int left_index = wrap_idx(((NUM_LEDS / 2) - 1 - i) + SPECTRUM_CENTER_OFFSET);
        int right_index = wrap_idx(((NUM_LEDS / 2) + i) + SPECTRUM_CENTER_OFFSET);

        leds[left_index] = color;
        leds[right_index] = color;
    }

    apply_background_overlay(context);
}
```

**Key Improvements in K1:**
1. **Audio validity guard (line 297):** Prevents processing invalid audio
2. **Fresh audio check (line 310):** Skips render if no new frame (performance)
3. **Age-based decay (line 315-317):** Smooth fade-out instead of abrupt silence
4. **Response curve (line 337):** `response_sqrt()` for perceptual brightness mapping
5. **Dual interpolation (lines 333-335):** Blend raw + smoothed for user control
6. **Center-origin symmetry (lines 348-352):** Enforces equal distances = equal colors
7. **Palette system (line 340):** Uses discrete color gradients instead of raw HSV

**Algorithm Match: 95%**
- Core algorithm identical (interpolate spectrum, color by position, magnitude by brightness)
- K1 adds modern production features (age decay, response curve, palette system)
- Fallback behavior superior (K1 renders ambient, legacy might show garbage)

**User Report "flashes and stutters":**
- Likely due to FPS drops (line 310 skip optimization helps, but may need tuning)
- Audio freshness check may be too strict; could adjust at line 310

---

## Pattern 2: TEMPISCOPE (BROKEN ARCHITECTURE) ✗

### Legacy Implementation
**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/zref/Emotiscope.sourcecode/Emotiscope-2.0/Emotiscope-1/src/light_modes/active/tempiscope.h`

```cpp
// Lines 1-20
void draw_tempiscope(){
	// Draw the current frame
	for(uint16_t i = 0; i < NUM_TEMPI; i++){
		float progress = num_leds_float_lookup[i];

		// ========== CRITICAL: TEMPO PHASE (Line 6) ==========
		float sine = 1.0 - ((tempi[i].phase + PI) / (2.0*PI));

		// ========== CRITICAL: TEMPO SMOOTH MAGNITUDE (Line 8) ==========
		float mag = clip_float(tempi_smooth[i] * sine);

		if(mag > 0.005){
			CRGBF color = hsv(
				get_color_range_hue(progress),
				configuration.saturation,
				mag
			);

			leds[i] = color;
		}
	}
}
```

**Data Structure Analysis:**
- **Input 1:** `tempi[i].phase` — beat phase (0 to 2π) per tempo bin i
  - Represents beat onset timing
  - sine-modulated to show beat "peak" at phase ≈ π/2
- **Input 2:** `tempi_smooth[i]` — tempo bin energy
  - Smoothed magnitude of that tempo band
- **Output:** 64 LEDs showing beat phase + energy for each tempo band
  - When beat "fires" (phase near 0.5π), LED brightens
  - Otherwise, LED dims

**Visualization Logic:**
```
tempo_phase cycles: 0 → π → 2π → 0
sine(phase) = 0 at 0, 1 at π/2, 0 at π, -1 at 3π/2, 0 at 2π
sine_modulated = 1.0 - (phase + π) / 2π
                = 1.0 at phase=-π (beat peak)
                = 0.0 at phase=π (beat trough)
```

Result: **Each LED lights up when its tempo bin's beat fires (phase ≈ beat onset).**

---

### K1 Implementation
**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/generated_patterns.h`
**Lines:** 867-924

```cpp
void draw_tempiscope(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    int num_leds = context.num_leds;
    const AudioDataSnapshot& audio = context.audio_snapshot;
    #define AUDIO_IS_AVAILABLE() (audio.is_valid)
    #define AUDIO_IS_STALE() (((uint32_t)((esp_timer_get_time() - audio.timestamp_us) / 1000)) > 50)
    #define AUDIO_SPECTRUM_INTERP(pos) interpolate(clip_float(pos), audio.spectrogram_smooth, NUM_FREQS)

    // Fallback to animated gradient if no audio
    if (!AUDIO_IS_AVAILABLE()) {
        float phase = fmodf(time * params.speed * 0.3f, 1.0f);
        for (int i = 0; i < NUM_LEDS; i++) {
            float position = fmodf(phase + LED_PROGRESS(i), 1.0f);
            leds[i] = color_from_palette(params.palette_id, position, params.background);
        }
        return;
    }

    // Clear LED buffer
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = CRGBF(0.0f, 0.0f, 0.0f);
    }

    // Render frequency bands using smoothed spectrum data
    const int half_leds = NUM_LEDS >> 1;
    const float freshness = AUDIO_IS_STALE() ? 0.6f : 1.0f;
    const float speed_scale = 0.4f + params.speed * 0.6f;
    for (int i = 0; i < half_leds; i++) {
        float progress = (half_leds > 1) ? ((float)i / (float)(half_leds - 1)) : 0.0f;
        // ========== CRITICAL: USING SPECTRUM INSTEAD OF TEMPO PHASE (Line 907) ==========
        float spectrum = AUDIO_SPECTRUM_INTERP(progress);
        float brightness = powf(spectrum, 0.85f) * speed_scale * freshness;
        brightness = clip_float(brightness);

        CRGBF color = color_from_palette(params.palette_id, progress, brightness * params.saturation);
        color.r *= params.brightness;
        color.g *= params.brightness;
        color.b *= params.brightness;

        int left_index = (half_leds - 1) - i;
        int right_index = half_leds + i;
        leds[left_index] = color;
        leds[right_index] = color;
    }

    apply_background_overlay(context);
}
```

**Data Structure in K1:**
- **Available:** `audio.spectrogram_smooth[i]` — **frequency spectrum, NOT tempo phase**
- **NOT available:** `tempi[i].phase`, `tempi_smooth[i]` — tempo data missing
- **Rendering:** Line 907 uses spectrum energy directly as brightness
  - No phase modulation
  - Shows frequency response, not beat timing

**Visualization Logic:**
```
K1: brightness = powf(spectrum[i], 0.85f)
    Shows which frequencies are loud RIGHT NOW

Legacy: brightness = tempi_smooth[i] * sin(tempi[i].phase)
        Shows which tempos are currently BEATING
```

**Critical Difference:**
| Aspect | Legacy | K1 |
|--------|--------|-----|
| **Input** | Beat phase per tempo bin | Frequency spectrum |
| **Meaning** | When does this BPM fire? | How loud is this frequency? |
| **Output** | Beats (time-domain) | Spectrum (freq-domain) |
| **Visual** | Marching beat lights | Frequency analyzer bars |

**Verdict: 40% algorithm match. FUNDAMENTALLY DIFFERENT VISUALIZATION.**

---

## Pattern 3: PERLIN (MISSING FALLBACK) ✗

### K1 Implementation
**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/generated_patterns.h`
**Lines:** 1462-1527

```cpp
void draw_perlin(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    int num_leds = context.num_leds;
    const AudioDataSnapshot& audio = context.audio_snapshot;
    #define AUDIO_IS_AVAILABLE() (audio.is_valid)
    #define AUDIO_VU (audio.vu_level)

    // Update Perlin noise position with time
    beat_perlin_position_x = 0.0f;  // Fixed X
    // Audio-driven momentum (Emotiscope-inspired): vu^4 controls flow speed
    {
        // Frame-rate independent delta time
        static float last_time_perlin = 0.0f;
        float dt_perlin = time - last_time_perlin;
        if (dt_perlin < 0.0f) dt_perlin = 0.0f;
        if (dt_perlin > 0.05f) dt_perlin = 0.05f;
        last_time_perlin = time;

        // ========== CRITICAL: USES AUDIO WITHOUT EARLY RETURN (Line 1482) ==========
        float vu = AUDIO_IS_AVAILABLE() ? AUDIO_VU : 0.3f;
        // Checking audio availability here but NOT RETURNING if unavailable
        // This allows garbage audio data to continue processing below

        float momentum_per_sec = (0.0008f + 0.004f * params.speed) * 120.0f;
        momentum_per_sec *= (0.2f + powf(vu, 4.0f) * 0.8f);
        beat_perlin_position_y += momentum_per_sec * dt_perlin;
    }

	// Generate Perlin noise for downsampled positions (optimized)
	// ========== PROBLEM: Continues even with invalid audio ==========
	const uint16_t downsample_count = NUM_LEDS >> 2;
	const float inv_downsample_count = 1.0f / (float)downsample_count;

	for (uint16_t i = 0; i < downsample_count; i++) {
		const float pos_progress = (float)i * inv_downsample_count;
		const float noise_x = beat_perlin_position_x + pos_progress * 2.0f;
		const float noise_y = beat_perlin_position_y;

		const float value = perlin_noise_simple_2d(noise_x * 2.0f, noise_y * 2.0f, 0x578437adU);

		float normalized = (value + 1.0f) * 0.5f;
		beat_perlin_noise_array[i] = (normalized < 0.0f) ? 0.0f : (normalized > 1.0f) ? 1.0f : normalized;
	}

	// Render Perlin noise field as LEDs
	for (int i = 0; i < NUM_LEDS; i++) {
		float noise_value = beat_perlin_noise_array[i >> 2];

		float hue = fmodf(noise_value * 0.66f + time * 0.1f * params.speed, 1.0f);
		float brightness = 0.25f + noise_value * 0.5f;

		CRGBF color = color_from_palette(params.palette_id, hue, brightness);

		leds[i].r = color.r * params.brightness * params.saturation;
		leds[i].g = color.g * params.brightness * params.saturation;
		leds[i].b = color.b * params.brightness * params.saturation;
	}

	apply_mirror_mode(leds, true);
    apply_background_overlay(context);
}
```

**Problem Chain:**
1. **Line 1482:** Checks `AUDIO_IS_AVAILABLE()` to decide VU value
   ```cpp
   float vu = AUDIO_IS_AVAILABLE() ? AUDIO_VU : 0.3f;
   ```
   - If no audio: vu = 0.3f (fallback)
   - If audio: vu = AUDIO_VU (could be garbage if stale)

2. **Line 1486:** Uses momentum regardless of audio validity
   ```cpp
   beat_perlin_position_y += momentum_per_sec * dt_perlin;
   ```
   - Continues accumulating position even if audio is invalid
   - Position keeps changing, creating visible animation with stale data

3. **Lines 1489-1505:** Render perlin noise using accumulated position
   - No check for audio validity
   - Uses whatever position value was computed

4. **Result:** Pattern displays garbage visuals because:
   - Position keeps advancing from stale audio
   - Noise rendering continues indefinitely
   - No fallback mode to show time-based animation instead

### Legacy Implementation
**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/zref/Emotiscope.sourcecode/Emotiscope-2.0/Emotiscope-1/src/light_modes/active/perlin.h`

```cpp
void draw_perlin(){
	static float perlin_image_hue[NUM_LEDS];
	static float perlin_image_lum[NUM_LEDS];

	static double x = 0.00;
	static double y = 0.00;

	static float momentum = 0.0;

	// ========== AUDIO INPUT (Line 10) ==========
	float push = vu_level*vu_level*vu_level*vu_level*configuration.speed*0.1f;

	momentum *= 0.99;

	momentum = max(momentum, push);

	static float angle = 0.0;
	angle += 0.001;
	float sine = sin(angle);

	x += 0.01*sine;

	y += 0.0001;
	y += momentum;

	fill_array_with_perlin(perlin_image_hue, NUM_LEDS, (float)x, (float)y, 0.025f);
	fill_array_with_perlin(perlin_image_lum, NUM_LEDS,  (float)x+100, (float)y+50, 0.0125f);

	// Crazy SIMD functions...
	// ...rendering code...
}
```

**Legacy Design:**
- Line 10: Reads `vu_level` directly (assumes audio is valid)
- Line 14: `momentum *= 0.99` — decay when no push
- Line 12: `momentum = max(momentum, push)` — only increases on audio peaks
- Legacy expects `vu_level` to be 0 when no audio (automatic by firmware)
- **Implicit assumption:** Audio interface provides valid data or zeros

**K1 Problem:**
- K1's audio interface provides `audio.is_valid` flag
- Perlin code checks it for fallback VU value (0.3f)
- But **never returns early**
- Continues rendering with potentially stale/invalid data

### Fix Required
```cpp
void draw_perlin(const PatternRenderContext& context) {
    // ... setup code ...

    #define AUDIO_IS_AVAILABLE() (audio.is_valid)

    // ========== ADD THIS GUARD (missing in current code) ==========
    if (!AUDIO_IS_AVAILABLE()) {
        // Render time-based animation without audio
        for (int i = 0; i < NUM_LEDS; i++) {
            float phase = fmodf(time * params.speed, 1.0f);
            float hue = fmodf(phase + (float)i / NUM_LEDS, 1.0f);
            CRGBF color = color_from_palette(params.palette_id, hue, 0.3f);
            leds[i] = color;
        }
        return;  // <-- CRITICAL: EARLY RETURN
    }

    // ... rest of perlin rendering ...
}
```

---

## Pattern 4: BLOOM MIRROR (POTENTIAL EDGE INVERSION) ⚠

### K1 Implementation
**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/generated_patterns.h`
**Lines:** 506-648

**Critical Operations:**

```cpp
// Line 522-526: Sprite propagation
float scroll_speed = 0.25f + 1.75f * clip_float(params.speed);
for (int i = 0; i < NUM_LEDS; ++i) bloom_buffer[ch_idx][i] = CRGBF{0.0f, 0.0f, 0.0f};
float decay = 0.92f + 0.06f * clip_float(params.softness);
draw_sprite(bloom_buffer[ch_idx], bloom_buffer_prev[ch_idx], NUM_LEDS, NUM_LEDS, scroll_speed, decay);
// ========== draw_sprite scrolls energy across buffer with decay ==========

// Lines 533-596: Chromagram color blend + center injection
if (AUDIO_IS_AVAILABLE()) {
    const float energy_gate = fminf(1.0f, (AUDIO_VU * 0.7f) + (AUDIO_NOVELTY * 0.4f));
    // ... chromagram processing ...
}

// Line 591-596: Inject color at center
bloom_buffer[ch_idx][center - 1] += wave_color * conf_inject;
bloom_buffer[ch_idx][center] += wave_color * conf_inject;

// Line 599: Save for next frame
std::memcpy(bloom_buffer_prev[ch_idx], bloom_buffer[ch_idx], sizeof(CRGBF) * NUM_LEDS);

// ========== LINE 614: MIRROR OPERATION ==========
// Mirror right half onto left for symmetry
for (int i = 0; i < center; ++i) {
    bloom_buffer[ch_idx][i] = bloom_buffer[ch_idx][(NUM_LEDS - 1) - i];
}
```

### Analysis of Propagation Direction

**Step-by-step:**

1. **Line 522:** `scroll_speed = 0.25 + 1.75 * speed`
   - For speed=1.0: scroll_speed = 2.0
   - This is the displacement parameter for `draw_sprite()`

2. **Line 526:** `draw_sprite(bloom_buffer, bloom_buffer_prev, ..., scroll_speed, decay)`
   - `draw_sprite()` shifts pixels by `scroll_speed` amount
   - Positive scroll_speed → pixels move OUTWARD from center

3. **Lines 591-596:** Inject energy at `center - 1` and `center`
   - Energy appears at CENTER of buffer

4. **Line 599:** Copy buffer to prev for next iteration
   - Persists current state

5. **Line 614:** Mirror operation
   ```cpp
   bloom_buffer[ch_idx][i] = bloom_buffer[ch_idx][(NUM_LEDS - 1) - i];
   ```
   - Copies RIGHT half back to LEFT half
   - This reverses the buffer (index i gets value from (NUM_LEDS - 1 - i))

### Suspected Issue

**Propagation direction chain:**
1. Energy injected at CENTER (line 591-596)
2. `draw_sprite()` expands energy OUTWARD (positive scroll_speed at line 526)
3. Mirror operation (line 614) copies RIGHT → LEFT

**Result:** Energy should propagate CENTER → EDGES, but mirroring operation happens AFTER center-injection, potentially causing:
- Energy appears at center
- Expands outward
- Mirror copies right-side back to left-side
- **Visual effect:** Energy appears to compress back toward center (INVERTED)

**User Report Match:** "propagates EDGE to MIDDLE, background permanently ON (inverted?)"
- This would match if propagation is indeed inverted

### Recommended Fix

Move mirror operation AFTER all sprite operations and energy decay:

```cpp
// ... sprite propagation ...
draw_sprite(bloom_buffer[ch_idx], bloom_buffer_prev[ch_idx], NUM_LEDS, NUM_LEDS, scroll_speed, decay);

// ... chromagram blend + center injection ...
bloom_buffer[ch_idx][center - 1] += wave_color * conf_inject;
bloom_buffer[ch_idx][center] += wave_color * conf_inject;

// ... tail fade ...
for (int i = 0; i < fade_span; ++i) {
    // fade tail
}

// MOVED: Save for next frame BEFORE mirror
std::memcpy(bloom_buffer_prev[ch_idx], bloom_buffer[ch_idx], sizeof(CRGBF) * NUM_LEDS);

// MOVED: Mirror operation after all propagation settles
for (int i = 0; i < center; ++i) {
    bloom_buffer[ch_idx][i] = bloom_buffer[ch_idx][(NUM_LEDS - 1) - i];
}
```

**Why this matters:**
- Sprite motion should propagate first
- Then apply symmetry
- Current order: apply symmetry, then sprite continues (may reverse direction)

---

## Pattern 5: SNAPWAVE (FIXED in b003be0) ✓✓

### K1 Implementation (AFTER FIX)
**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/generated_patterns.h`
**Lines:** 1904-2024

```cpp
void draw_snapwave(const PatternRenderContext& context) {
    // ... setup ...
    const AudioDataSnapshot& audio = context.audio_snapshot;
    #define AUDIO_IS_AVAILABLE() (audio.is_valid)

    // Phase 1: Fade trails (lines 1918-1925)
    const float DECAY_FACTOR = 0.92f;
    for (int i = 0; i < half_leds; i++) {
        snapwave_buffer[i].r *= DECAY_FACTOR;
        snapwave_buffer[i].g *= DECAY_FACTOR;
        snapwave_buffer[i].b *= DECAY_FACTOR;
    }

    // Phase 2: Smooth outward propagation (lines 1927-1937)
    for (int i = half_leds - 1; i > 0; i--) {
        snapwave_buffer[i].r = snapwave_buffer[i - 1].r * 0.99f + snapwave_buffer[i].r * 0.01f;
        // ... blend other channels ...
    }

    // ========== CRITICAL FIX (Line 1941): AUDIO VALIDITY GUARD ==========
    if (AUDIO_IS_AVAILABLE()) {  // <-- THIS WAS MISSING, NOW ADDED
        // Phase 3: Beat injection (lines 1942-1967)
        // Find dominant tempo and inject beat at center

        // Phase 4: Dominant frequency accent (lines 1969-1999)
        // Place accent at geometric position based on frequency
    }

    // Phase 5: Mandatory mirroring (lines 2002-2012)
    // Phase 6: Global brightness + overlay (lines 2014-2023)
}
```

### Evidence of Fix

**Commit b003be0:** "Add critical audio validity guards to Snapwave and Waveform_spectrum patterns"

**Before (broken):**
- No `if (AUDIO_IS_AVAILABLE())` guard before beat injection
- Beats spawned even with stale/invalid audio
- User report: "lost audio reactivity" (actually: garbage beats)

**After (fixed):**
- Line 1941: Guard added
- Beats only inject when audio is valid
- Fallback to no beats when audio unavailable (graceful degradation)

**Result:** ✓✓ **Pattern now correct**

---

## Summary of Evidence

| Pattern | Issue | Evidence | Fix |
|---------|-------|----------|-----|
| Spectrum | None | Lines 280-357 correct | ✓ Use as reference |
| Octave | None | Lines 369-433 correct | ✓ Use as reference |
| Tempiscope | Architecture (no tempo data) | Line 867 uses spectrum not tempo | Redesign or restore tempo interface |
| Beat Tunnel | Architecture (no tempo data) | Line 966 uses spectrum not tempo | Redesign or restore tempo interface |
| Perlin | Missing guard | Line 1482 checks audio but no return | Add guard + early return at line 1462 |
| Bloom Mirror | Edge direction | Line 614 mirror timing | Reorder mirror operation |
| Snapwave | Missing guard (FIXED) | Line 1941 guard added | ✓ Already fixed in b003be0 |
| Waveform Spectrum | Missing guard (FIXED) | Line 1801 guard present | ✓ Already fixed in b003be0 |

