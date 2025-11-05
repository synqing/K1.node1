#pragma once

#include <Arduino.h>
#include <stdint.h>

// VU meter state (mirrors Emotiscope implementation)
extern volatile float vu_level_raw;
extern volatile float vu_level;
extern volatile float vu_max;
extern volatile float vu_floor;

void init_vu();
void run_vu();
