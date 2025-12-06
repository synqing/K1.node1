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

// Light Guide Plate (LGP) Physics Patterns (from K1.Ambience)
void draw_lgp_gravitational_lensing(const PatternRenderContext& context);
void draw_lgp_sierpinski(const PatternRenderContext& context);
void draw_lgp_beam_collision(const PatternRenderContext& context);
void draw_lgp_quantum_tunneling(const PatternRenderContext& context);
void draw_lgp_time_crystal(const PatternRenderContext& context);
void draw_lgp_soliton_waves(const PatternRenderContext& context);
void draw_lgp_metamaterial_cloaking(const PatternRenderContext& context);
void draw_lgp_laser_duel(const PatternRenderContext& context);
void draw_lgp_sonic_boom(const PatternRenderContext& context);

// Light Guide Plate (LGP) Geometric Patterns (from K1.Ambience)
void draw_lgp_diamond_lattice(const PatternRenderContext& context);
void draw_lgp_hexagonal_grid(const PatternRenderContext& context);
void draw_lgp_spiral_vortex(const PatternRenderContext& context);
void draw_lgp_chevron_waves(const PatternRenderContext& context);
void draw_lgp_concentric_rings(const PatternRenderContext& context);
void draw_lgp_star_burst(const PatternRenderContext& context);
void draw_lgp_mesh_network(const PatternRenderContext& context);
void draw_lgp_moire_patterns(const PatternRenderContext& context);

// Light Guide Plate (LGP) Interference Patterns (from K1.Ambience)
void draw_lgp_box_wave(const PatternRenderContext& context);
void draw_lgp_holographic(const PatternRenderContext& context);
void draw_lgp_modal_resonance(const PatternRenderContext& context);
void draw_lgp_interference_scanner(const PatternRenderContext& context);
void draw_lgp_wave_collision(const PatternRenderContext& context);
void draw_lgp_soliton_explorer(const PatternRenderContext& context);
void draw_lgp_turing_patterns(const PatternRenderContext& context);
void draw_lgp_kelvin_helmholtz(const PatternRenderContext& context);
