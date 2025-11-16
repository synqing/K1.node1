#include "pattern_execution.h"
#include "pattern_registry.h"
#include "logging/logger.h"
#include <cstring>

void init_pattern_registry() {
    g_current_pattern_index = 0;
    for (uint8_t i = 0; i < g_num_patterns; i++) {
        if (g_pattern_registry[i].is_audio_reactive) {
            g_current_pattern_index = i;
            break;
        }
    }
}

void draw_current_pattern(const PatternRenderContext& context) {
    g_pattern_registry[g_current_pattern_index].draw_fn(context);
}

const PatternInfo& get_current_pattern() {
    return g_pattern_registry[g_current_pattern_index];
}

bool select_pattern(uint8_t index) {
    if (index >= g_num_patterns) {
        return false;
    }
    g_current_pattern_index = index;
    return true;
}

bool select_pattern_by_id(const char* id) {
    if (!id) {
        return false;
    }
    for (uint8_t i = 0; i < g_num_patterns; ++i) {
        if (strcmp(g_pattern_registry[i].id, id) == 0) {
            g_current_pattern_index = i;
            LOG_INFO(TAG_GPU, "Pattern changed to: %s (index %d)",
                     g_pattern_registry[i].name, i);
            return true;
        }
    }
    LOG_ERROR(TAG_GPU, "Pattern '%s' not found", id);
    return false;
}
