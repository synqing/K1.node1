#pragma once

#include "pattern_render_context.h"

typedef void (*PatternFunction)(const PatternRenderContext& context);

struct PatternInfo {
	const char* name;
	const char* id;
	const char* description;
	PatternFunction draw_fn;
	bool is_audio_reactive;
};
