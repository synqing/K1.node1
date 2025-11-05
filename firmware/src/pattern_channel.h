#pragma once
#include <stdint.h>

// Global channel index used by pattern render functions to select
// the correct per-channel slice of dualized static buffers.
extern uint8_t g_pattern_channel_index;

inline uint8_t get_pattern_channel_index() { return g_pattern_channel_index; }

