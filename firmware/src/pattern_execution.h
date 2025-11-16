#pragma once

#include "pattern_render_context.h"
#include "pattern_types.h"

void init_pattern_registry();
void draw_current_pattern(const PatternRenderContext& context);
const PatternInfo& get_current_pattern();

// Pattern selection helpers used by webserver / UI
bool select_pattern(uint8_t index);
bool select_pattern_by_id(const char* id);
