#include "pattern_registry.h"
#include "pattern_declarations.h"
#include "generated_patterns.h"

uint8_t g_current_pattern_index = 0;

const PatternInfo g_pattern_registry[] = {
	// Domain 1: Static Intentional Patterns
	{
		"Departure",
		"departure",
		"Transformation: earth → light → growth",
		draw_departure,
		false
	},
	{
		"Lava",
		"lava",
		"Intensity: black → red → orange → white",
		draw_lava,
		false
	},
	{
		"Twilight",
		"twilight",
		"Peace: amber → purple → blue",
		draw_twilight,
		false
	},
	// Domain 2: Audio-Reactive Patterns
	{
		"Prism",
		"prism",
		"★ DEMO ★ Palette spectrum + saturation modulation + colored trails",
		draw_prism,
		true
	},
	{
		"Spectrum",
		"spectrum",
		"Frequency visualization",
		draw_spectrum,
		true
	},
	{
		"Octave",
		"octave",
		"Octave band response",
		draw_octave,
		true
	},
	{
		"Bloom",
		"bloom",
		"VU-meter with persistence",
		draw_bloom,
		true
	},
	{
		"Bloom Mirror",
		"bloom_mirror",
		"Chromagram-fed bidirectional bloom",
		draw_bloom_mirror,
		true
	},
	// Domain 3: Beat/Tempo Reactive Patterns (Ported from Emotiscope)
	{
		"Pulse",
		"pulse",
		"Beat-synchronized radial waves",
		draw_pulse,
		true
	},
	{
		"Tempiscope",
		"tempiscope",
		"Tempo visualization with phase",
		draw_tempiscope,
		true
	},
	{
		"Beat Tunnel",
		"beat_tunnel",
		"Animated tunnel with beat persistence",
		draw_beat_tunnel,
		true
	},
	{
		"Beat Tunnel (Variant)",
		"beat_tunnel_variant",
		"Experimental beat tunnel using behavioral drift",
		draw_beat_tunnel_variant,
		true
	},
	{
		"Startup Intro",
		"startup_intro",
		"Deterministic intro animation with full parameter tuning",
		draw_startup_intro,
		true
	},
	{
		"Tunnel Glow",
		"tunnel_glow",
		"Audio-reactive tunnel with spectrum and energy response",
		draw_tunnel_glow,
		true
	},
	{
		"Perlin",
		"perlin",
		"Procedural noise field animation",
		draw_perlin,
		true
	},
	// Missing Emotiscope Patterns (Now Fixed!)
	{
		"Analog",
		"analog",
		"VU meter with precise dot positioning",
		draw_analog,
		true
	},
	{
		"Metronome",
		"metronome",
		"Beat phase dots for tempo visualization",
		draw_metronome,
		true
	},
	{
		"Hype",
		"hype",
		"Energy threshold activation with dual colors",
		draw_hype,
		true
	},
	{
		"Waveform Spectrum",
		"waveform_spectrum",
		"Frequency-mapped audio spectrum with center-origin geometry",
		draw_waveform_spectrum,
		true
	},
	{
		"Snapwave",
		"snapwave",
		"Snappy beat flashes with harmonic accents",
		draw_snapwave,
		true
	}
};

const uint8_t g_num_patterns = sizeof(g_pattern_registry) / sizeof(g_pattern_registry[0]);
