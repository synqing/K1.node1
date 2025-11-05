#include "vu.h"

#include <cmath>
#include <cstring>

#include "goertzel.h"
#include "microphone.h"

#define NUM_VU_LOG_SAMPLES 20
#define NUM_VU_SMOOTH_SAMPLES 12

static float vu_log[NUM_VU_LOG_SAMPLES] = {0.0f};
static uint16_t vu_log_index = 0;

static float vu_smooth[NUM_VU_SMOOTH_SAMPLES] = {0.0f};
static uint16_t vu_smooth_index = 0;

volatile float vu_level_raw = 0.0f;
volatile float vu_level = 0.0f;
volatile float vu_max = 0.0f;
volatile float vu_floor = 0.0f;

static uint32_t last_vu_log = 0;

void init_vu() {
    std::memset(vu_log, 0, sizeof(vu_log));
    std::memset(vu_smooth, 0, sizeof(vu_smooth));
    vu_log_index = 0;
    vu_smooth_index = 0;
    vu_level_raw = 0.0f;
    vu_level = 0.0f;
    vu_max = 0.0f;
    vu_floor = 0.0f;
    last_vu_log = 0;
}

void run_vu() {
    profile_function([&]() {
        static float max_amplitude_cap = 0.0000001f;
        float* samples = &sample_history[(SAMPLE_HISTORY_LENGTH - 1) - CHUNK_SIZE];

        float max_amplitude_now = 0.000001f;
        for (uint16_t i = 0; i < CHUNK_SIZE; i++) {
            float sample_abs = std::fabs(samples[i]);
            max_amplitude_now = fmaxf(max_amplitude_now, sample_abs * sample_abs);
        }
        max_amplitude_now = clip_float(max_amplitude_now);

        uint32_t now_ms = millis();
        if (now_ms < 2000) {
            for (uint16_t i = 0; i < NUM_VU_LOG_SAMPLES; i++) {
                vu_log[i] = max_amplitude_now;
            }
        } else if (now_ms - last_vu_log >= 250) {
            last_vu_log = now_ms;
            vu_log[vu_log_index] = max_amplitude_now;
            vu_log_index = (vu_log_index + 1) % NUM_VU_LOG_SAMPLES;

            float vu_sum = 0.0f;
            for (uint16_t i = 0; i < NUM_VU_LOG_SAMPLES; i++) {
                vu_sum += vu_log[i];
            }
            float avg = vu_sum / NUM_VU_LOG_SAMPLES;
            // Configurable floor multiplier: lower => more sensitive at low levels
            float floor_pct = configuration.vu_floor_pct;
            if (floor_pct < 0.5f) floor_pct = 0.5f;     // safety clamp
            if (floor_pct > 0.98f) floor_pct = 0.98f;   // avoid over-subtraction
            vu_floor = avg * floor_pct;
        }

        max_amplitude_now = fmaxf(max_amplitude_now - vu_floor, 0.0f);

        if (max_amplitude_now > max_amplitude_cap) {
            float distance = max_amplitude_now - max_amplitude_cap;
            max_amplitude_cap += distance * 0.25f;  // Increased from 0.1f (10%) to 0.25f (25%) for faster rise time (30-50ms vs 80ms)
        } else if (max_amplitude_cap > max_amplitude_now) {
            float distance = max_amplitude_cap - max_amplitude_now;
            max_amplitude_cap -= distance * 0.1f;  // Keep fall time slower for smoother fadeouts
        }
        max_amplitude_cap = clip_float(max_amplitude_cap);

        if (max_amplitude_cap < 0.000010f) {
            max_amplitude_cap = 0.000010f;  // Lowered from 0.000025f to allow quieter signals to scale up
        }

        float auto_scale = 1.0f / fmaxf(max_amplitude_cap, 0.00001f);
        float vu_raw = clip_float(max_amplitude_now * auto_scale);

        // Quiet-level boost: make slider have a stronger effect when signals are quiet.
        // Lower vu_floor_pct => higher boost, gated to quiet regions so loud audio is unaffected.
        float boost = 1.0f;
        float pct = configuration.vu_floor_pct;
        if (pct < 0.5f) pct = 0.5f;
        if (pct > 0.98f) pct = 0.98f;
        if (pct <= 0.90f) {
            // Map [0.50..0.90] → boost [2.0..1.0]
            float t = (0.90f - pct) / 0.40f;  // 0 at 0.90, 1 at 0.50
            boost = 1.0f + (t * 1.0f);
        }
        // Apply boost only when auto-scale cap indicates a quiet region
        if (max_amplitude_cap < 0.00002f) {
            vu_raw = clip_float(vu_raw * boost);
        }
        vu_level_raw = vu_raw;

        vu_smooth[vu_smooth_index] = vu_level_raw;
        vu_smooth_index = (vu_smooth_index + 1) % NUM_VU_SMOOTH_SAMPLES;

        float vu_sum = 0.0f;
        for (uint16_t i = 0; i < NUM_VU_SMOOTH_SAMPLES; i++) {
            vu_sum += vu_smooth[i];
        }
        vu_level = vu_sum / NUM_VU_SMOOTH_SAMPLES;

        vu_max = fmaxf(vu_max, vu_level);
    }, __func__);
}
