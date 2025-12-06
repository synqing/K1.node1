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
    {
        "Bloom (SB Parity)",
        "bloom_sb",
        "Strict SB 4.0.0 bloom parity (A/B validation)",
        draw_bloom_sb,
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
	},
	// Domain 4: Light Guide Plate Physics Simulations (from K1.Ambience)
	{
		"Gravitational Lensing",
		"gravitational_lensing",
		"Light bends around invisible masses (Einstein rings)",
		draw_lgp_gravitational_lensing,
		false
	},
	{
		"Sierpinski Fractal",
		"sierpinski",
		"Self-similar fractal triangle patterns",
		draw_lgp_sierpinski,
		false
	},
	{
		"Beam Collision",
		"beam_collision",
		"Laser beams shoot from edges and EXPLODE when they meet",
		draw_lgp_beam_collision,
		false
	},
	{
		"Quantum Tunneling",
		"quantum_tunneling",
		"Particles tunnel through energy barriers with probability waves",
		draw_lgp_quantum_tunneling,
		false
	},
	{
		"Time Crystal",
		"time_crystal",
		"Perpetual motion patterns with non-repeating periods",
		draw_lgp_time_crystal,
		false
	},
	{
		"Soliton Waves",
		"soliton_waves",
		"Self-reinforcing wave packets that maintain shape",
		draw_lgp_soliton_waves,
		false
	},
	{
		"Metamaterial Cloak",
		"metamaterial_cloak",
		"Negative refractive index creates invisibility effects",
		draw_lgp_metamaterial_cloaking,
		false
	},
	{
		"Laser Duel",
		"laser_duel",
		"Opposing laser beams fight with power struggles and sparks",
		draw_lgp_laser_duel,
		false
	},
	{
		"Sonic Boom",
		"sonic_boom",
		"Supersonic Mach cone patterns with shock diamonds",
		draw_lgp_sonic_boom,
		false
	},

	// Domain 5: Light Guide Plate Geometric Patterns (from K1.Ambience)
	{
		"Diamond Lattice",
		"diamond_lattice",
		"Diamond/rhombus patterns through angular interference",
		draw_lgp_diamond_lattice,
		false
	},
	{
		"Hexagonal Grid",
		"hexagonal_grid",
		"Honeycomb-like patterns using 3-wave interference",
		draw_lgp_hexagonal_grid,
		false
	},
	{
		"Spiral Vortex",
		"spiral_vortex",
		"Rotating spiral patterns with helical phase fronts",
		draw_lgp_spiral_vortex,
		false
	},
	{
		"Chevron Waves",
		"chevron_waves",
		"V-shaped patterns moving through the light guide",
		draw_lgp_chevron_waves,
		false
	},
	{
		"Concentric Rings",
		"concentric_rings",
		"Ring patterns through radial standing waves",
		draw_lgp_concentric_rings,
		false
	},
	{
		"Star Burst",
		"star_burst",
		"Star-like patterns radiating from center",
		draw_lgp_star_burst,
		false
	},
	{
		"Mesh Network",
		"mesh_network",
		"Interconnected node patterns like neural networks",
		draw_lgp_mesh_network,
		false
	},
	{
		"Moiré Patterns",
		"moire_patterns",
		"Moiré interference from overlapping grids",
		draw_lgp_moire_patterns,
		false
	},
	// LGP Interference Effects
	{
		"Box Wave",
		"box_wave",
		"Rectangular standing wave patterns with controllable motion",
		draw_lgp_box_wave,
		false
	},
	{
		"Holographic",
		"holographic",
		"Multi-layer interference creating depth illusion",
		draw_lgp_holographic,
		false
	},
	{
		"Modal Resonance",
		"modal_resonance",
		"Optical cavity modes with harmonic series",
		draw_lgp_modal_resonance,
		false
	},
	{
		"Interference Scanner",
		"interference_scanner",
		"Multiple scanning interference sources",
		draw_lgp_interference_scanner,
		false
	},
	{
		"Wave Collision",
		"wave_collision",
		"Constructive and destructive interference patterns",
		draw_lgp_wave_collision,
		false
	},
	{
		"Soliton Explorer",
		"soliton_explorer",
		"Self-maintaining wave packets with collision dynamics",
		draw_lgp_soliton_explorer,
		false
	},
	{
		"Turing Patterns",
		"turing_patterns",
		"Reaction-diffusion pattern engine",
		draw_lgp_turing_patterns,
		false
	},
	{
		"Kelvin-Helmholtz",
		"kelvin_helmholtz",
		"Fluid vortex instabilities and turbulence",
		draw_lgp_kelvin_helmholtz,
		false
	}
};

const uint8_t g_num_patterns = sizeof(g_pattern_registry) / sizeof(g_pattern_registry[0]);
