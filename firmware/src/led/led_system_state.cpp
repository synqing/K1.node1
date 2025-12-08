#include "led_system_state.h"

/**
 * @brief Global LED system state instance
 *
 * Holds all LED buffers, hardware state, and RMT diagnostics.
 * Initialized at startup. Pattern render task writes, LED TX task reads.
 */
LEDSystemState g_leds;
