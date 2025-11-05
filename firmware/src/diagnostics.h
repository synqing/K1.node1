#pragma once

#include <stdint.h>

// Runtime diagnostics control
// Provides an on/off toggle and a configurable print interval

void diag_set_enabled(bool enabled);
bool diag_is_enabled();

void diag_set_interval_ms(uint32_t interval_ms);
uint32_t diag_get_interval_ms();

