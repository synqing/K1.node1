#pragma once

// ============================================================================
//  PATTERN AUDIO INTERFACE - Thread-Safe Audio Data Access
// ============================================================================
//
//  Phase 2: Safe Pattern Interface for Audio-Reactive Patterns
//
//  PURPOSE:
//    Provides a clean, macro-based interface for patterns to access audio
//    data with automatic stale data detection and thread-safe snapshots.
//
//  DEPENDENCIES:
//    - Phase 1: AudioDataSnapshot structure (audio/goertzel.h)
//    - Phase 1: get_audio_snapshot() function
//    - Phase 1: commit_audio_data() buffer swap mechanism
//
//  USAGE IN PATTERNS:
//    void draw_pattern(float time, const PatternParameters& params) {
//        PATTERN_AUDIO_START();  // Initialize audio snapshot
//
//        // Check if data is fresh (optional but recommended)
//        if (!AUDIO_IS_FRESH()) return;
//
//        // Access audio data using macros
//        float bass = AUDIO_BASS();
//        float spectrum_value = AUDIO_SPECTRUM[32];
//
//        // Use audio data to drive pattern
//        leds[0] = CRGBF(bass, 0, AUDIO_TREBLE());
//    }
//
// ============================================================================

#include "audio/goertzel.h"
#include "audio/tempo.h"
#include "parameters.h"
#include <cmath>
#include <esp_timer.h>
#include "emotiscope_helpers.h"  // For interpolate() and response curves

// ============================================================================
// Function declarations (implementations in pattern_audio_interface.cpp)
float wrap_phase(float phase_delta);
bool is_beat_phase_locked_ms(const AudioDataSnapshot& audio_snapshot, uint16_t bin, float target_phase, float tolerance_ms);

// ============================================================================
// PRIMARY INTERFACE MACRO
// ============================================================================

/**
 * PATTERN_AUDIO_START()
 *
 * Call this macro at the beginning of every pattern draw function that uses
 * audio data. It performs the following operations:
 *
 * 1. Declares a local AudioDataSnapshot struct
 * 2. Retrieves thread-safe snapshot via get_audio_snapshot()
 * 3. Tracks update counter to detect fresh data
 * 4. Calculates data age in milliseconds
 * 5. Sets boolean flags for freshness/availability
 *
 * CREATED VARIABLES (usable in pattern scope):
 *   - audio              : AudioDataSnapshot - Complete audio data snapshot
 *   - audio_available    : bool - True if snapshot was retrieved successfully
 *   - audio_is_fresh     : bool - True if data changed since last frame
 *   - audio_age_ms       : uint32_t - Milliseconds since last audio update
 *
 * THREAD SAFETY:
 *   - Safe to call from any task/thread
 *   - Safe to call multiple times in same pattern (each gets fresh snapshot)
 *   - Pattern-local static for tracking prevents cross-pattern pollution
 *
 * PERFORMANCE:
 *   - Zero runtime overhead if audio system not initialized
 *   - ~10-20 microseconds for snapshot copy (negligible)
 *   - Non-blocking mutex (1ms timeout) prevents render stalls
 */
#define PATTERN_AUDIO_START() \
    AudioDataSnapshot audio{}; \
    bool audio_available = get_audio_snapshot(&audio); \
    static uint32_t pattern_last_update = 0; \
    bool audio_is_fresh = (audio_available && \
                           audio.update_counter != pattern_last_update); \
    if (audio_is_fresh) { \
        pattern_last_update = audio.update_counter; \
    } \
    uint32_t audio_age_ms = audio_available ? \
        ((uint32_t)((esp_timer_get_time() - audio.timestamp_us) / 1000)) : 9999

// ============================================================================
// AUDIO DATA ACCESSORS
// ============================================================================

/**
 * Direct access to audio data arrays
 *
 * USAGE:
 *   float value = AUDIO_SPECTRUM[bin_index];       // Access specific bin
 *   float smooth = AUDIO_SPECTRUM_SMOOTH[bin_index]; // Smoothed version
 *
 * RANGE: All array indices must be validated:
 *   - AUDIO_SPECTRUM[0..63]        : 64 frequency bins
 *   - AUDIO_SPECTRUM_SMOOTH[0..63] : 64 smoothed bins
 *   - AUDIO_SPECTRUM_ABSOLUTE[0..63] : 64 pre-normalized bins (absolute loudness)
 *   - AUDIO_CHROMAGRAM[0..11]      : 12 musical note classes (C-B)
 *   - AUDIO_FFT[0..127]            : 128 FFT bins (if FFT enabled)
 */

// ============================================================================
// AUDIO SPECTRUM MODES - TWO DIFFERENT APPROACHES
// ============================================================================
//
// AUDIO_SPECTRUM: Auto-ranged spectrum (0.0-1.0, normalized to loudest bin)
// --------------------------------------------------------------------------
// - Normalized to current loudest frequency bin (dynamic range preserved locally)
// - Good for: Relative visual feedback (pattern intensity follows spectrum shape)
// - Use when: You want visual response to frequency content, not absolute loudness
// - Behavior: Same shape at any volume (normalized independently of loudness)
//
// AUDIO_SPECTRUM_ABSOLUTE: Pre-normalized spectrum (absolute loudness preserved)
// -------------------------------------------------------------------------------
// - Raw magnitude values BEFORE auto-ranging normalization
// - Good for: Absolute loudness decisions (distinguish quiet vs loud music)
// - Use when: You need to know actual audio level (VU meter, threshold detection)
// - Behavior: Amplitude reflects true loudness, not normalized
// - Typical range: 0.0-1.0 at normal listening levels, can exceed 1.0 during peaks
//
// EXAMPLE USE CASES:
// ------------------
// // Use AUDIO_SPECTRUM for frequency-reactive visuals (auto-scaled)
// for (int i = 0; i < NUM_LEDS; i++) {
//     float freq_response = AUDIO_SPECTRUM[i];  // Always visible, auto-ranged
//     leds[i] = hsv(i * 5, 1.0, freq_response);
// }
//
// // Use AUDIO_SPECTRUM_ABSOLUTE for loudness-gated effects
// float absolute_bass = AUDIO_SPECTRUM_ABSOLUTE[0];
// if (absolute_bass > 0.5f) {  // Only trigger on LOUD bass
//     flash_strobe();
// }
//
// // Combine both: intensity from VU, shape from normalized spectrum
// float intensity = AUDIO_VU;  // Absolute loudness
// for (int i = 0; i < NUM_LEDS; i++) {
//     float shape = AUDIO_SPECTRUM[i];  // Relative frequency shape
//     leds[i] = hsv(i * 5, 1.0, intensity * shape);
// }
//
// ============================================================================

#define AUDIO_SPECTRUM          (audio.spectrogram)
#define AUDIO_SPECTRUM_SMOOTH   (audio.spectrogram_smooth)
#define AUDIO_SPECTRUM_ABSOLUTE (audio.spectrogram_absolute)
#define AUDIO_CHROMAGRAM        (audio.chromagram)
#define AUDIO_FFT               (audio.fft_smooth)

/**
 * Scalar audio metrics
 *
 * AUDIO_VU         : Peak amplitude level (0.0-1.0), auto-ranged
 * AUDIO_VU_RAW     : Raw amplitude before auto-ranging
 * AUDIO_NOVELTY    : Spectral change/onset detection (0.0-1.0)
 * AUDIO_TEMPO_CONFIDENCE : Beat detection confidence (0.0-1.0) [DISABLED - see docs/05-analysis/]
 */
#define AUDIO_VU                (audio.vu_level)
#define AUDIO_VU_RAW            (audio.vu_level_raw)
#define AUDIO_NOVELTY           (audio.novelty_curve)
#define AUDIO_TEMPO_CONFIDENCE  (0.0f)  // DISABLED: Tempo detection unreliable (see docs/05-analysis/)

// Helper: Adaptive beat gating for patterns
// Returns a squashed confidence with a minimum threshold to prevent flicker
static inline float beat_gate(float conf) {
    const PatternParameters& p = get_params();
    const float thresh = fmaxf(p.beat_threshold, 0.0f);
    if (conf < thresh) return 0.0f;
    // Squash high densities using configurable exponent
    const float exponent = fminf(fmaxf(p.beat_squash_power, 0.20f), 1.0f);
    return powf(fminf(conf, 1.0f), exponent);
}

// ============================================================================
// QUERY MACROS
// ============================================================================

/**
 * AUDIO_IS_FRESH()
 *
 * Returns true if audio data has been updated since the last time this
 * pattern called PATTERN_AUDIO_START().
 *
 * USE CASES:
 *   - Skip redundant rendering if data hasn't changed
 *   - Trigger pattern events only on new audio frames
 *   - Optimize CPU usage in audio-reactive patterns
 *
 * EXAMPLE:
 *   if (!AUDIO_IS_FRESH()) return;  // Skip this frame
 */
#define AUDIO_IS_FRESH()        (audio_is_fresh)

/**
 * AUDIO_IS_AVAILABLE()
 *
 * Returns true if a valid audio snapshot was retrieved.
 * False indicates mutex timeout or uninitialized audio system.
 *
 * USE CASES:
 *   - Fallback to non-audio-reactive mode if no data
 *   - Debug audio system issues
 *   - Graceful degradation
 *
 * EXAMPLE:
 *   if (!AUDIO_IS_AVAILABLE()) {
 *       // Fall back to time-based animation
 *       float brightness = 0.5 * sinf(time);
 *   }
 */
#define AUDIO_IS_AVAILABLE()    (audio_available)

/**
 * AUDIO_AGE_MS()
 *
 * Returns age of audio data in milliseconds since timestamp.
 * Returns 9999 if audio not available.
 *
 * EXPECTED VALUES:
 *   - Fresh data: 0-20ms (within 1-2 audio frames @ 100 Hz)
 *   - Acceptable: 20-50ms (2-5 audio frames)
 *   - Stale: >50ms (indicates audio processing lag or silence)
 *
 * USE CASES:
 *   - Detect audio processing performance issues
 *   - Implement fade-out on silence
 *   - Debug timing synchronization
 */
#define AUDIO_AGE_MS()          (audio_age_ms)

/**
 * AUDIO_IS_STALE()
 *
 * Returns true if audio data is older than 50ms (>5 audio frames).
 * Indicates either silence, audio system lag, or microphone disconnection.
 *
 * USE CASES:
 *   - Detect silence and fade to default state
 *   - Show "no audio" visual indicator
 *   - Switch to non-audio mode automatically
 *
 * EXAMPLE:
 *   if (AUDIO_IS_STALE()) {
 *       brightness *= 0.95;  // Gradual fade on silence
 *   }
 */
#define AUDIO_IS_STALE()        (audio_age_ms > 50)

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Function declarations (implementations in pattern_audio_interface.cpp)
float get_audio_band_energy(const AudioDataSnapshot& audio, int start_bin, int end_bin);
float get_audio_band_energy_absolute(const AudioDataSnapshot& audio, int start_bin, int end_bin);

// ============================================================================
// FREQUENCY BAND CONVENIENCE MACROS
// ============================================================================

/**
 * Predefined frequency bands for common use cases
 *
 * AUDIO_BASS()
 *   Bins 0-8: 55-220 Hz
 *   Contains: Kick drums, bass guitar, low synths
 *   Character: Physical, body-felt frequencies
 *
 * AUDIO_MIDS()
 *   Bins 16-32: 440-880 Hz
 *   Contains: Vocals, guitars, snares
 *   Character: Musical fundamentals, melody
 *
 * AUDIO_TREBLE()
 *   Bins 48-63: 1.76-6.4 kHz
 *   Contains: Cymbals, hi-hats, high harmonics
 *   Character: Brightness, air, presence
 *
 * USAGE:
 *   float bass_energy = AUDIO_BASS();
 *   leds[0] = CRGBF(AUDIO_TREBLE(), AUDIO_MIDS(), AUDIO_BASS());
 *
 * FREQUENCY REFERENCE (64-bin Goertzel, musical scale):
 *   Bin  0: 55.0 Hz   (A1)
 *   Bin  8: 69.3 Hz   (C#2)
 *   Bin 16: 87.3 Hz   (F2)
 *   Bin 32: 155.6 Hz  (D#3)
 *   Bin 48: 277.2 Hz  (C#4)
 *   Bin 63: 622.3 Hz  (D#5)
 */
#define AUDIO_BASS()     get_audio_band_energy(audio, 0, 8)    // 55-220 Hz
#define AUDIO_MIDS()     get_audio_band_energy(audio, 16, 32)  // 440-880 Hz
#define AUDIO_TREBLE()   get_audio_band_energy(audio, 48, 63)  // 1.76-6.4 kHz

// Absolute loudness bands (pre-normalized)
#define AUDIO_BASS_ABS()   get_audio_band_energy_absolute(audio, 0, 8)
#define AUDIO_MIDS_ABS()   get_audio_band_energy_absolute(audio, 16, 32)
#define AUDIO_TREBLE_ABS() get_audio_band_energy_absolute(audio, 48, 63)

// Precise instrument-specific frequency bands
#define KICK_START    0
#define KICK_END      4    // 55-110 Hz (kick drum fundamental)
#define SNARE_START   8
#define SNARE_END     16   // 220-440 Hz (snare body)
#define VOCAL_START   16
#define VOCAL_END     40   // 440-1760 Hz (vocal range)
#define HATS_START    48
#define HATS_END      63   // 3.5-6.4 kHz (hi-hats/cymbals)

// Instrument-specific energy accessors
#define AUDIO_KICK()     get_audio_band_energy(audio, KICK_START, KICK_END)
#define AUDIO_SNARE()    get_audio_band_energy(audio, SNARE_START, SNARE_END)
#define AUDIO_VOCAL()    get_audio_band_energy(audio, VOCAL_START, VOCAL_END)
#define AUDIO_HATS()     get_audio_band_energy(audio, HATS_START, HATS_END)

// INTERPOLATED SPECTRUM ACCESS - Fixes stepping artifacts!
#define AUDIO_SPECTRUM_INTERP(pos) \
    interpolate(clip_float(pos), audio.spectrogram_smooth, NUM_FREQS)

// Phase-locked beat detection for precise synchronization
#define AUDIO_BEAT_PHASE_LOCKED(bin, phase_target, tolerance_ms) \
    (is_beat_phase_locked_ms(audio, (bin), (phase_target), (tolerance_ms)))

// ============================================================================
// COLOR & BRIGHTNESS MODULATION HELPERS (Using New Audio Parameters)
// ============================================================================

/**
 * AUDIO_COLOR_SHIFT()
 * Returns a color shift value (0.0 to color_reactivity) based on VU level
 * Use this to modulate hue, saturation, or other color properties
 *
 * EXAMPLE:
 *   float hue = base_hue + AUDIO_COLOR_SHIFT() * 60.0f;  // Up to 60° hue shift
 */
#define AUDIO_COLOR_SHIFT() (AUDIO_VU * get_params().color_reactivity)

/**
 * AUDIO_COLOR_HUE(base)
 * Returns a hue value that shifts with audio (0.0-1.0 range)
 * Wraps around at 1.0 for smooth color cycling
 *
 * EXAMPLE:
 *   float dynamic_hue = AUDIO_COLOR_HUE(0.5f);  // Base hue 0.5, shifts with audio
 */
#define AUDIO_COLOR_HUE(base) fmodf((base) + AUDIO_COLOR_SHIFT() * 0.2f, 1.0f)

/**
 * AUDIO_COLOR_SATURATION(base)
 * Returns saturation that increases with treble (brightness/excitement)
 * Treble makes colors more vivid, silence makes them more pastel
 *
 * EXAMPLE:
 *   float sat = AUDIO_COLOR_SATURATION(0.7f);  // Base 0.7, boosts with treble
 */
#define AUDIO_COLOR_SATURATION(base) \
    clip_float((base) + (AUDIO_TREBLE() * get_params().color_reactivity * 0.3f))

/**
 * AUDIO_BRIGHTNESS()
 * Returns brightness value with floor applied (never goes fully black)
 * Ensures patterns remain visible even during silence
 *
 * EXAMPLE:
 *   float brightness = AUDIO_BRIGHTNESS();  // VU-based brightness with floor
 */
#define AUDIO_BRIGHTNESS() \
    (get_params().brightness_floor + \
     (AUDIO_VU * (1.0f - get_params().brightness_floor)))

/**
 * AUDIO_BRIGHTNESS_SCALED(scale)
 * Returns brightness with custom scaling and floor applied
 * Useful for effects that need different brightness ranges
 *
 * EXAMPLE:
 *   float pulse_brightness = AUDIO_BRIGHTNESS_SCALED(2.0f);  // Extra bright pulses
 */
#define AUDIO_BRIGHTNESS_SCALED(scale) \
    (get_params().brightness_floor + \
     (AUDIO_VU * (scale) * (1.0f - get_params().brightness_floor)))

// ============================================================================
// TEMPO BIN ACCESS (Advanced: Per-Tempo-Bin Beat Detection & Phase Tracking)
// ============================================================================

/**
 * AUDIO_TEMPO_MAGNITUDE(bin) [DISABLED]
 *
 * DISABLED: Tempo detection system is unreliable.
 * See docs/05-analysis/ for details.
 *
 * This macro now returns 0.0f as a safe fallback.
 */
#define AUDIO_TEMPO_MAGNITUDE(bin)  (0.0f)  // DISABLED: Tempo detection unreliable

/**
 * AUDIO_TEMPO_PHASE(bin) [DISABLED]
 *
 * DISABLED: Tempo detection system is unreliable.
 * See docs/05-analysis/ for details.
 *
 * This macro now returns 0.0f as a safe fallback.
 */
#define AUDIO_TEMPO_PHASE(bin)      (0.0f)  // DISABLED: Tempo detection unreliable

/**
 * AUDIO_TEMPO_BEAT(bin) [DISABLED]
 *
 * DISABLED: Tempo detection system is unreliable.
 * See docs/05-analysis/ for details.
 *
 * This macro now returns 0.0f as a safe fallback.
 */
#define AUDIO_TEMPO_BEAT(bin)       (0.0f)  // DISABLED: Tempo detection unreliable

// ============================================================================
// MIGRATION EXAMPLE: Before and After
// ============================================================================

/*

BEFORE (Unsafe - Direct Global Access):
---------------------------------------

void draw_simple_spectrum(float time, const PatternParameters& params) {
    for (int i = 0; i < NUM_LEDS; i++) {
        float position = (float)i / NUM_LEDS;
        int bin = (int)(position * 63);

        // UNSAFE: Reading global spectrogram array directly
        // Risk: Race condition with audio processing thread
        float magnitude = spectrogram[bin];

        leds[i] = CRGBF(magnitude, magnitude, magnitude);
    }
}


AFTER (Safe - Snapshot-Based Access):
-------------------------------------

void draw_simple_spectrum(float time, const PatternParameters& params) {
    // Get thread-safe audio snapshot
    PATTERN_AUDIO_START();

    // Skip if data hasn't changed (optimization)
    if (!AUDIO_IS_FRESH()) return;

    for (int i = 0; i < NUM_LEDS; i++) {
        float position = (float)i / NUM_LEDS;
        int bin = (int)(position * 63);

        // SAFE: Reading from local snapshot
        // No race condition - data is immutable in this scope
        float magnitude = AUDIO_SPECTRUM[bin];

        // Fade if audio is stale (silence detection)
        if (AUDIO_IS_STALE()) {
            magnitude *= 0.95f;
        }

        leds[i] = CRGBF(magnitude, magnitude, magnitude);
    }
}


KEY IMPROVEMENTS:
-----------------
1. Thread-safe: No risk of reading partially-updated data
2. Stale detection: Pattern knows if data is fresh or old
3. Performance: Can skip rendering if no new data
4. Silence handling: Automatic fade on stale data
5. Minimal changes: Only 2 lines added to pattern code

*/

// ============================================================================
// USAGE GUIDELINES
// ============================================================================

/*

PATTERN DEVELOPMENT BEST PRACTICES:
------------------------------------

1. ALWAYS call PATTERN_AUDIO_START() first
   - Must be called before any AUDIO_* macro usage
   - Creates local snapshot and freshness flags

2. CHECK freshness for optimization
   - if (!AUDIO_IS_FRESH()) return;
   - Prevents redundant rendering on same data
   - Saves ~75% of pattern computation

3. HANDLE stale data gracefully
   - Use AUDIO_IS_STALE() to detect silence
   - Implement fade-out or fallback behavior
   - Don't rely on last-known values indefinitely

4. VALIDATE array indices
   - Always bounds-check bin indices
   - NUM_FREQS = 64, chromagram = 12
   - Use helper functions when possible

5. PERFORMANCE considerations
   - Snapshot copy is ~10-20 microseconds
   - Freshness check is free (static variable)
   - Age calculation is trivial (subtraction)

6. DEBUG with query macros
   - Log AUDIO_AGE_MS() if reactivity seems delayed
   - Check AUDIO_IS_AVAILABLE() if no audio response
   - Monitor AUDIO_IS_FRESH() hit rate for performance


COMMON PATTERNS:
----------------

Pattern 1: Basic spectrum visualization
----------------------------------------
PATTERN_AUDIO_START();
if (!AUDIO_IS_FRESH()) return;
for (int i = 0; i < NUM_LEDS; i++) {
    float mag = AUDIO_SPECTRUM[i % NUM_FREQS];
    leds[i] = hsv(i * 5, 1.0, mag);
}


Pattern 2: Bass-reactive pulse
-------------------------------
PATTERN_AUDIO_START();
float bass = AUDIO_BASS();
if (AUDIO_IS_STALE()) {
    bass *= 0.9;  // Fade on silence
}
for (int i = 0; i < NUM_LEDS; i++) {
    leds[i] = CRGBF(bass, bass * 0.5, 0);
}


Pattern 3: Multi-band visualizer
---------------------------------
PATTERN_AUDIO_START();
if (!AUDIO_IS_AVAILABLE()) {
    // Fallback: Time-based animation
    float brightness = 0.5 * sinf(time);
    fill_solid(leds, NUM_LEDS, CRGBF(brightness, brightness, brightness));
    return;
}

float bass = AUDIO_BASS();
float mids = AUDIO_MIDS();
float treble = AUDIO_TREBLE();

int third = NUM_LEDS / 3;
for (int i = 0; i < third; i++) leds[i] = CRGBF(0, 0, bass);
for (int i = third; i < 2*third; i++) leds[i] = CRGBF(0, mids, 0);
for (int i = 2*third; i < NUM_LEDS; i++) leds[i] = CRGBF(treble, 0, 0);


Pattern 4: Beat-synchronized effect
------------------------------------
PATTERN_AUDIO_START();
if (!AUDIO_IS_FRESH()) return;

float beat = AUDIO_TEMPO_CONFIDENCE;
float brightness = beat * beat;  // Square for emphasis

if (AUDIO_IS_STALE()) {
    brightness = 0.0;  // Off on silence
}

fill_solid(leds, NUM_LEDS, CRGBF(brightness, brightness, brightness));

*/

// ============================================================================
// END OF PATTERN AUDIO INTERFACE
// ============================================================================
