#pragma once

#include "types.h"
#include "led_driver.h"

// Shared pattern buffer pool to reduce memory usage
// Replaces individual static buffers in patterns with shared allocation

struct SharedPatternBuffers {
    // Dual-channel buffers for patterns that need previous frame data
    CRGBF shared_image_buffer[2][NUM_LEDS];      // Current frame
    CRGBF shared_image_buffer_prev[2][NUM_LEDS]; // Previous frame
    
    // Single-channel buffers for simpler patterns  
    CRGBF shared_simple_buffer[NUM_LEDS];
    CRGBF shared_simple_buffer_prev[NUM_LEDS];
    
    // Usage tracking to prevent conflicts
    volatile bool dual_channel_in_use[2];  // Track which dual-channel buffer is in use
    volatile bool simple_buffer_in_use;
};

// Global shared buffer instance
extern SharedPatternBuffers shared_pattern_buffers;

// Buffer allocation functions
bool acquire_dual_channel_buffer(int& buffer_id);
void release_dual_channel_buffer(int buffer_id);
bool acquire_simple_buffer();
void release_simple_buffer();

// Convenience macros for pattern developers
#define SHARED_DUAL_BUFFER(id) \
    shared_pattern_buffers.shared_image_buffer[id], \
    shared_pattern_buffers.shared_image_buffer_prev[id]

#define SHARED_SIMPLE_BUFFER \
    shared_pattern_buffers.shared_simple_buffer, \
    shared_pattern_buffers.shared_simple_buffer_prev

// Initialize shared pattern buffers
void init_shared_pattern_buffers();