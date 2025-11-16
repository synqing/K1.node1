#pragma once

#include <cstdint>
#include "pattern_types.h"

// Pattern registry metadata table (defined in pattern_registry.cpp)
extern const PatternInfo g_pattern_registry[];
extern const uint8_t g_num_patterns;

// Current pattern selection
extern uint8_t g_current_pattern_index;

// Note: implementations of registry functions live in pattern_execution.cpp
