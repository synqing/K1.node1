#ifndef PATTERN_RENDER_CONTEXT_H
#define PATTERN_RENDER_CONTEXT_H

#include "types.h"
#include "parameters.h"
#include "audio/goertzel.h"

/**
 * @brief A context object that provides patterns with all the necessary data for rendering.
 *
 * This struct is designed to be passed by const reference to a pattern's `draw` function.
 * It encapsulates the state that was previously accessed via global variables or passed
 * as multiple function arguments, promoting a cleaner, more modular architecture.
 */
struct PatternRenderContext {
    /**
     * @brief A pointer to the beginning of the LED buffer.
     *
     * Patterns should write their output directly to this buffer.
     */
    CRGBF* const leds;

    /**
     * @brief The total number of LEDs in the strip.
     */
    const int num_leds;

    /**
     * @brief The current animation time, in seconds.
     */
    const float time;

    /**
     * @brief A const reference to the current set of pattern parameters.
     *
     * This includes brightness, speed, color, and other user-configurable settings.
     */
    const PatternParameters& params;

    /**
     * @brief A const reference to a thread-safe snapshot of the latest audio data.
     *
     * This contains the spectrogram, VU level, beat information, and other audio features.
     */
    const AudioDataSnapshot& audio_snapshot;

    /**
     * @brief Constructor to initialize all members.
     */
    PatternRenderContext(
        CRGBF* led_buffer,
        int led_count,
        float current_time,
        const PatternParameters& pattern_params,
        const AudioDataSnapshot& audio_data)
        : leds(led_buffer),
          num_leds(led_count),
          time(current_time),
          params(pattern_params),
          audio_snapshot(audio_data) {}
};

#endif // PATTERN_RENDER_CONTEXT_H
