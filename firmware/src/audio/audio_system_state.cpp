#include "audio_system_state.h"

/**
 * @brief Global audio system state instance
 *
 * Initialized at startup with sensible defaults. All audio subsystems
 * read from and write to this single instance.
 */
AudioSystemState g_audio;
