#pragma once

#include "pattern_render_context.h"

// Forward declarations for all pattern functions
void draw_departure(const PatternRenderContext& context);
void draw_lava(const PatternRenderContext& context);
void draw_twilight(const PatternRenderContext& context);
void draw_spectrum(const PatternRenderContext& context);
void draw_octave(const PatternRenderContext& context);
void draw_waveform_spectrum(const PatternRenderContext& context);
void draw_bloom(const PatternRenderContext& context);
void draw_bloom_mirror(const PatternRenderContext& context);
void draw_snapwave(const PatternRenderContext& context);
void draw_pulse(const PatternRenderContext& context);
void draw_tempiscope(const PatternRenderContext& context);
void draw_beat_tunnel(const PatternRenderContext& context);
void draw_beat_tunnel_variant(const PatternRenderContext& context);
void draw_startup_intro(const PatternRenderContext& context);
void draw_tunnel_glow(const PatternRenderContext& context);
void draw_perlin(const PatternRenderContext& context);
void draw_analog(const PatternRenderContext& context);
void draw_metronome(const PatternRenderContext& context);
void draw_hype(const PatternRenderContext& context);
void draw_prism(const PatternRenderContext& context);
void draw_pitch(float time, const PatternParameters& params);
