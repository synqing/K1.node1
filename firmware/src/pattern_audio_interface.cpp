#include "pattern_audio_interface.h"
#include "audio/goertzel.h"
#include "audio/tempo.h"

// ============================================================================
// HELPER FUNCTION IMPLEMENTATIONS
// ============================================================================

/**
 * Phase wrapping helper for beat synchronization
 */
float wrap_phase(float phase_delta) {
	while (phase_delta > M_PI) {
		phase_delta -= static_cast<float>(2.0 * M_PI);
	}
	while (phase_delta < -M_PI) {
		phase_delta += static_cast<float>(2.0 * M_PI);
	}
	return phase_delta;
}

/**
 * Convert phase error to milliseconds and compare against tolerance
 */
bool is_beat_phase_locked_ms(const AudioDataSnapshot& audio_snapshot,
		uint16_t bin,
		float target_phase,
		float tolerance_ms) {
	if (bin >= NUM_TEMPI || tolerance_ms < 0.0f) {
		return false;
	}

	const float tempo_hz = tempi_bpm_values_hz[bin];
	if (tempo_hz <= 0.0f) {
		return false;
	}

	const float delta = wrap_phase(audio_snapshot.tempo_phase[bin] - target_phase);
	const float delta_time_ms = std::fabs(delta) * 1000.0f / (static_cast<float>(2.0 * M_PI) * tempo_hz);

	return delta_time_ms <= tolerance_ms;
}

/**
 * get_audio_band_energy()
 *
 * Calculate average energy across a frequency range.
 *
 * PARAMETERS:
 *   audio     : AudioDataSnapshot - Audio data snapshot
 *   start_bin : int - Starting frequency bin (0-63)
 *   end_bin   : int - Ending frequency bin (0-63)
 *
 * RETURNS:
 *   float - Average energy (0.0-1.0) across specified bins
 *
 * SAFETY:
 *   - Automatically clamps bin indices to valid range
 *   - Returns 0.0 if range is invalid
 *
 * EXAMPLE:
 *   float bass = get_audio_band_energy(audio, 0, 8);   // 55-220 Hz
 *   float mids = get_audio_band_energy(audio, 16, 32); // 440-880 Hz
 */
float get_audio_band_energy(const AudioDataSnapshot& audio, int start_bin, int end_bin) {
    // Validate bin range
    if (start_bin < 0 || start_bin >= NUM_FREQS ||
        end_bin < 0 || end_bin >= NUM_FREQS ||
        start_bin > end_bin) {
        return 0.0f;
    }

    // Sum energy across bins
    float sum = 0.0f;
    for (int i = start_bin; i <= end_bin; i++) {
        sum += audio.spectrogram[i];
    }

    // Return average
    int num_bins = end_bin - start_bin + 1;
    return sum / (float)num_bins;
}

/**
 * Absolute (pre-normalized) band energy using spectrogram_absolute
 */
float get_audio_band_energy_absolute(const AudioDataSnapshot& audio, int start_bin, int end_bin) {
    if (start_bin < 0 || start_bin >= NUM_FREQS ||
        end_bin < 0 || end_bin >= NUM_FREQS ||
        start_bin > end_bin) {
        return 0.0f;
    }
    float sum = 0.0f;
    for (int i = start_bin; i <= end_bin; i++) {
        sum += audio.spectrogram_absolute[i];
    }
    int num_bins = end_bin - start_bin + 1;
    return sum / (float)num_bins;
}