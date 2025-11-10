#include "pattern_codegen_bridge.h"
#include "pattern_registry.h"
#include "pattern_audio_interface.h"
#include "graph_codegen/graph_runtime.h"
#include "audio/goertzel.h"
#include "logging/logger.h"
#include "led_driver.h"

extern CRGBF leds[NUM_LEDS];

// Forward declarations for the new, optimized, generated pattern functions
void draw_spectrum_generated(float time, const PatternParameters& params);
void draw_bloom_generated(float time, const PatternParameters& params);


void apply_codegen_overrides() {
#if defined(USE_GENERATED_BLOOM_PATTERN) || defined(USE_GENERATED_SPECTRUM_PATTERN)
    for (uint8_t i = 0; i < g_num_patterns; ++i) {
        const char* id = g_pattern_registry[i].id;
#ifdef USE_GENERATED_SPECTRUM_PATTERN
        if (strcmp(id, "spectrum") == 0) {
            // Point directly to the new, optimized, generated function
            const_cast<PatternInfo&>(g_pattern_registry[i]).draw_fn = draw_spectrum_generated;
            LOG_INFO(TAG_GPU, "Pattern override: spectrum -> OPTIMIZED generated");
            continue;
        }
#endif
#ifdef USE_GENERATED_BLOOM_PATTERN
        if (strcmp(id, "bloom") == 0) {
            // Point directly to the new, optimized, generated function
            const_cast<PatternInfo&>(g_pattern_registry[i]).draw_fn = draw_bloom_generated;
            LOG_INFO(TAG_GPU, "Pattern override: bloom -> OPTIMIZED generated");
            continue;
        }
#endif
    }
#else
    // No-op when flags are not defined
#endif
}

