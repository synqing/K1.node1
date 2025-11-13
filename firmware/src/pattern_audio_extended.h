#ifndef PATTERN_AUDIO_EXTENDED_H
#define PATTERN_AUDIO_EXTENDED_H

#include "pattern_audio_interface.h"
#include "pattern_effects.h"
#include <cstring>

// ============================================================================
// EXTENDED AUDIO DATA ACCESS
// ============================================================================

/**
 * Access to chromagram (musical note energy)
 * 12 bins representing: C, C#, D, D#, E, F, F#, G, G#, A, A#, B
 * USAGE: float c_energy = AUDIO_CHROMAGRAM[0];  // C note
 * NOTE: Already defined in pattern_audio_interface.h, just included for reference
 */

/**
 * Access novelty curve (spectral flux for beat detection)
 * Single value updated every frame with spectral change
 * Already defined in pattern_audio_interface.h as AUDIO_NOVELTY (object-like macro)
 * USAGE: float novelty = AUDIO_NOVELTY;
 */

/**
 * Access per-tempo-bin magnitudes (64 tempo bins from 32-192 BPM)
 * Adds new function-like macro for easier bin access
 * USAGE: float tempo_mag = AUDIO_TEMPO_MAGNITUDE_BIN(bin_index);
 */
#define AUDIO_TEMPO_MAGNITUDE_BIN(bin) (audio.tempo_magnitude[bin])

/**
 * Access per-tempo-bin phases
 * Adds new function-like macro for easier bin access
 * USAGE: float tempo_phase = AUDIO_TEMPO_PHASE_BIN(bin_index);
 */
#define AUDIO_TEMPO_PHASE_BIN(bin) (audio.tempo_phase[bin])

/**
 * Calculate beat value (sin of phase) for a tempo bin
 * Positive when beat is "on", negative when "off"
 * USAGE: float beat = AUDIO_BEAT_BIN(bin_index);
 */
#define AUDIO_BEAT_BIN(bin) (sinf(audio.tempo_phase[bin]))

/**
 * Access raw FFT bins (128 frequency bins across full spectrum)
 * More granular than spectrogram (64 bins)
 * Already defined in pattern_audio_interface.h as AUDIO_FFT
 * USAGE: float fft_bin = AUDIO_FFT[bin_index];
 */

/**
 * Access VU level metrics (already defined in pattern_audio_interface.h)
 * vu_level = smoothed RMS level (0..1)
 * vu_level_raw = unfiltered instantaneous level
 * USAGE: float smooth_level = AUDIO_VU;  (already available)
 *        float raw_level = AUDIO_VU_RAW;  (already available)
 */

// ============================================================================
// FRAME-PERSISTENT STATE FOR TEMPORAL SMOOTHING
// ============================================================================

/**
 * Persistent smoothing state for pattern effects
 * Each pattern should have its own instance to track previous frames
 */
struct PatternSmoothingState {
    // Spectrum smoothing (64 bins)
    float spectrum_smooth[NUM_FREQS] = {0};
    float spectrum_prev[NUM_FREQS] = {0};

    // Tempo smoothing (64 bins)
    float tempo_smooth[NUM_TEMPI] = {0};
    float tempo_prev[NUM_TEMPI] = {0};

    // Novelty history for beat detection
    float novelty_history[16] = {0};  // Last 16 novelty values

    // VU smoothing
    float vu_smooth = 0.0f;
    float vu_prev = 0.0f;

    // Chromagram smoothing
    float chroma_smooth[12] = {0};
    float chroma_prev[12] = {0};

    // Beat detection state
    uint32_t last_beat_frame = 0;
    float last_beat_novelty = 0.0f;
    bool beat_detected_this_frame = false;

    /**
     * Update all smoothing states with current audio data
     * Call this once per frame, before using smoothed values
     * @param audio - Current audio snapshot
     * @param alpha - Smoothing factor (0.8 = slow, 0.95 = very slow)
     */
    void update(const AudioDataSnapshot& audio, float alpha = 0.8f) {
        // Spectrum smoothing
        for (uint16_t i = 0; i < NUM_FREQS; i++) {
            spectrum_smooth[i] = temporal_smooth(audio.spectrogram_smooth[i], spectrum_prev[i], alpha);
            spectrum_prev[i] = spectrum_smooth[i];
        }

        // Tempo smoothing
        for (uint16_t i = 0; i < NUM_TEMPI; i++) {
            tempo_smooth[i] = temporal_smooth(audio.tempo_magnitude[i], tempo_prev[i], alpha);
            tempo_prev[i] = tempo_smooth[i];
        }

        // VU smoothing
        vu_smooth = temporal_smooth(audio.vu_level, vu_prev, alpha);
        vu_prev = vu_smooth;

        // Chromagram smoothing
        for (uint16_t i = 0; i < 12; i++) {
            chroma_smooth[i] = temporal_smooth(audio.chromagram[i], chroma_prev[i], alpha);
            chroma_prev[i] = chroma_smooth[i];
        }

        // Novelty history (shift and add)
        for (uint16_t i = 15; i > 0; i--) {
            novelty_history[i] = novelty_history[i - 1];
        }
        novelty_history[0] = audio.novelty_curve;

        // Detect beat from novelty peak
        beat_detected_this_frame = (audio.novelty_curve > last_beat_novelty * 1.5f) &&
                                   (audio.novelty_curve > 0.1f);
        last_beat_novelty = audio.novelty_curve;
    }

    /**
     * Detect if a beat occurred recently (within N frames)
     * @param frames_ago - How many frames back to check (0 = this frame, 5 = last 5 frames)
     * @return true if beat detected in that window
     */
    bool beat_detected_ago(uint16_t frames_ago = 0) {
        if (frames_ago == 0) return beat_detected_this_frame;
        if (frames_ago >= 16) return false;
        return novelty_history[frames_ago] > novelty_history[(frames_ago + 1) % 16] * 1.5f;
    }

    /**
     * Get smoothed spectrum value
     * @param bin - Frequency bin (0..NUM_FREQS-1)
     * @return Smoothed spectrum magnitude
     */
    float get_spectrum_smooth(uint16_t bin) const {
        if (bin >= NUM_FREQS) return 0.0f;
        return spectrum_smooth[bin];
    }

    /**
     * Get smoothed tempo value
     * @param bin - Tempo bin (0..NUM_TEMPI-1)
     * @return Smoothed tempo magnitude
     */
    float get_tempo_smooth(uint16_t bin) const {
        if (bin >= NUM_TEMPI) return 0.0f;
        return tempo_smooth[bin];
    }

    /**
     * Get smoothed chromagram value
     * @param note - Note index (0=C, 1=C#, ..., 11=B)
     * @return Smoothed chroma energy
     */
    float get_chroma_smooth(uint16_t note) const {
        if (note >= 12) return 0.0f;
        return chroma_smooth[note];
    }
};

// ============================================================================
// PERSISTENCE BUFFER FOR TRAILS AND BLOOMS
// ============================================================================

/**
 * Per-LED persistence buffer for trailing effects
 * Used for bloom, pulse, and trail effects
 */
struct PersistenceBuffer {
    CRGBF leds[NUM_LEDS] = {};

    /**
     * Clear the buffer
     */
    void clear() {
        memset(leds, 0, sizeof(leds));
    }

    /**
     * Apply exponential decay to all LEDs
     * @param decay_factor - Decay per frame (0.9 = 10% decay, 0.95 = 5%)
     */
    void decay(float decay_factor = 0.95f) {
        fade_all(leds, NUM_LEDS, decay_factor);
    }

    /**
     * Accumulate another LED buffer onto this one
     * @param source - Source LED buffer to add
     * @param scale - Scale factor for source (1.0 = add as-is)
     */
    void accumulate(const CRGBF* source, float scale = 1.0f) {
        scale = clip_float(scale);
        for (uint16_t i = 0; i < NUM_LEDS; i++) {
            leds[i] += source[i] * scale;
        }
    }

    /**
     * Copy to output buffer
     * @param destination - Destination LED buffer
     */
    void copy_to(CRGBF* destination) {
        memcpy(destination, leds, NUM_LEDS * sizeof(CRGBF));
    }

    /**
     * Add to output buffer
     * @param destination - Destination LED buffer
     */
    void add_to(CRGBF* destination) {
        for (uint16_t i = 0; i < NUM_LEDS; i++) {
            destination[i] += leds[i];
        }
    }
};

// ============================================================================
// BEAT DETECTION HELPER
// ============================================================================

/**
 * Detect beat from novelty curve with hysteresis
 * Looks for peaks in spectral flux that indicate beat events
 * @param state - Smoothing state with novelty history
 * @param threshold - Minimum novelty value to register beat
 * @return true if beat detected this frame
 */
inline bool detect_beat_from_novelty(const PatternSmoothingState& state, float threshold = 0.15f) {
    // Peak detection: current > previous AND current > next
    if (state.novelty_history[0] < threshold) return false;
    if (state.novelty_history[0] <= state.novelty_history[1]) return false;  // Not a peak
    return true;
}

/**
 * Get dominant tempo bin (strongest beat)
 * @param audio - Audio snapshot
 * @return Tempo bin index (0..NUM_TEMPI-1) with highest magnitude
 */
inline uint16_t get_dominant_tempo_bin(const AudioDataSnapshot& audio) {
    float max_mag = 0.0f;
    uint16_t max_bin = 0;

    for (uint16_t i = 0; i < NUM_TEMPI; i++) {
        if (audio.tempo_magnitude[i] > max_mag) {
            max_mag = audio.tempo_magnitude[i];
            max_bin = i;
        }
    }

    return max_bin;
}

/**
 * Get dominant note (strongest chromagram bin)
 * @param audio - Audio snapshot
 * @return Note index (0=C, 1=C#, ..., 11=B)
 */
inline uint16_t get_dominant_note(const AudioDataSnapshot& audio) {
    float max_energy = 0.0f;
    uint16_t max_note = 0;

    for (uint16_t i = 0; i < 12; i++) {
        if (audio.chromagram[i] > max_energy) {
            max_energy = audio.chromagram[i];
            max_note = i;
        }
    }

    return max_note;
}

/**
 * Get octave of dominant note
 * @param audio - Audio snapshot
 * @return Octave (0..8, representing C0 to C8)
 */
inline uint16_t get_dominant_octave(const AudioDataSnapshot& audio) {
    // Simplified: use frequency bin ranges to estimate octave
    // Lower frequencies = lower octaves
    float max_low = 0.0f, max_mid = 0.0f, max_high = 0.0f;

    for (uint16_t i = 0; i < NUM_FREQS / 3; i++) {
        max_low = fmaxf(max_low, audio.spectrogram_smooth[i]);
    }
    for (uint16_t i = NUM_FREQS / 3; i < 2 * NUM_FREQS / 3; i++) {
        max_mid = fmaxf(max_mid, audio.spectrogram_smooth[i]);
    }
    for (uint16_t i = 2 * NUM_FREQS / 3; i < NUM_FREQS; i++) {
        max_high = fmaxf(max_high, audio.spectrogram_smooth[i]);
    }

    if (max_high > max_mid && max_high > max_low) return 5;
    if (max_mid > max_low) return 3;
    return 1;
}

#endif // PATTERN_AUDIO_EXTENDED_H
