#include "shared_pattern_buffers.h"

// Global shared buffer instance
SharedPatternBuffers shared_pattern_buffers;

// Initialize shared buffers
void init_shared_pattern_buffers() {
    // Clear all buffers
    for (int i = 0; i < 2; i++) {
        for (int j = 0; j < NUM_LEDS; j++) {
            shared_pattern_buffers.shared_image_buffer[i][j] = CRGBF(0.0f, 0.0f, 0.0f);
            shared_pattern_buffers.shared_image_buffer_prev[i][j] = CRGBF(0.0f, 0.0f, 0.0f);
        }
        shared_pattern_buffers.dual_channel_in_use[i] = false;
    }
    
    for (int i = 0; i < NUM_LEDS; i++) {
        shared_pattern_buffers.shared_simple_buffer[i] = CRGBF(0.0f, 0.0f, 0.0f);
        shared_pattern_buffers.shared_simple_buffer_prev[i] = CRGBF(0.0f, 0.0f, 0.0f);
    }
    shared_pattern_buffers.simple_buffer_in_use = false;
}

bool acquire_dual_channel_buffer(int& buffer_id) {
    // Find available dual-channel buffer
    for (int i = 0; i < 2; i++) {
        if (!shared_pattern_buffers.dual_channel_in_use[i]) {
            shared_pattern_buffers.dual_channel_in_use[i] = true;
            buffer_id = i;
            return true;
        }
    }
    return false;  // No buffer available
}

void release_dual_channel_buffer(int buffer_id) {
    if (buffer_id >= 0 && buffer_id < 2) {
        shared_pattern_buffers.dual_channel_in_use[buffer_id] = false;
    }
}

bool acquire_simple_buffer() {
    if (!shared_pattern_buffers.simple_buffer_in_use) {
        shared_pattern_buffers.simple_buffer_in_use = true;
        return true;
    }
    return false;  // Buffer in use
}

void release_simple_buffer() {
    shared_pattern_buffers.simple_buffer_in_use = false;
}