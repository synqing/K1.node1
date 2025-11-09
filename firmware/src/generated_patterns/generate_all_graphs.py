#!/usr/bin/env python3
"""
Generate node graph JSONs for 10 high-value LED patterns.
Converts analyzed C++ pattern code into semantic node graphs.
"""

import json
import os
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent

PATTERN_GRAPHS = {
    "lava": {
        "version": "1.0",
        "pattern_id": "lava",
        "pattern_name": "Lava Pattern - Node Graph",
        "description": "Static heat-map palette from black through red to white-hot, center-origin mapped",
        "metadata": {
            "author": "K1.node1 Pattern System",
            "created": "2025-11-10",
            "scope": "PoC - Static palette mapping",
            "quality_gates": ["120+ FPS", "No state", "Simple palette"],
            "original_loc": 40
        },
        "state_variables": [],
        "input_nodes": [
            {
                "node_id": "input_params",
                "node_type": "builtin_struct",
                "output_type": "PatternParameters",
                "description": "Pattern parameters (brightness primarily used)"
            }
        ],
        "computation_nodes": [
            {
                "node_id": "led_loop",
                "node_type": "loop",
                "description": "Iterate over all LEDs",
                "loop_type": "for i in 0..NUM_LEDS-1",
                "body": [
                    {
                        "node_id": "center_distance",
                        "node_type": "calculation",
                        "operation": "position = abs(i - NUM_LEDS/2.0f) / (NUM_LEDS/2.0f)",
                        "inputs": ["i"],
                        "outputs": ["position (0.0-1.0)"]
                    },
                    {
                        "node_id": "palette_lookup",
                        "node_type": "palette_operation",
                        "operation": "interpolate_palette(position, lava_palette)",
                        "palette": "lava",
                        "inputs": ["position"],
                        "outputs": ["color"]
                    },
                    {
                        "node_id": "brightness_apply",
                        "node_type": "scaling",
                        "operation": "color *= params.brightness",
                        "inputs": ["color", "params.brightness"],
                        "outputs": ["final_color"]
                    },
                    {
                        "node_id": "led_assign",
                        "node_type": "output",
                        "operation": "leds[i] = final_color",
                        "inputs": ["final_color"]
                    }
                ]
            }
        ],
        "output_nodes": [
            {
                "node_id": "background_overlay",
                "node_type": "post_process",
                "operation": "apply_background_overlay(params)",
                "description": "Apply uniform background overlay"
            }
        ],
        "palettes": {
            "lava": [
                {"r": 0.00, "g": 0.00, "b": 0.00},
                {"r": 0.07, "g": 0.00, "b": 0.00},
                {"r": 0.44, "g": 0.00, "b": 0.00},
                {"r": 0.56, "g": 0.01, "b": 0.00},
                {"r": 0.69, "g": 0.07, "b": 0.00},
                {"r": 0.84, "g": 0.17, "b": 0.01},
                {"r": 1.00, "g": 0.32, "b": 0.02},
                {"r": 1.00, "g": 0.45, "b": 0.02},
                {"r": 1.00, "g": 0.61, "b": 0.02},
                {"r": 1.00, "g": 0.80, "b": 0.02},
                {"r": 1.00, "g": 1.00, "b": 0.02},
                {"r": 1.00, "g": 1.00, "b": 0.28},
                {"r": 1.00, "g": 1.00, "b": 1.00}
            ]
        }
    },

    "departure": {
        "version": "1.0",
        "pattern_id": "departure",
        "pattern_name": "Departure Pattern - Node Graph",
        "description": "Journey palette from dark earth through golden light to emerald green, center-origin mapped",
        "metadata": {
            "author": "K1.node1 Pattern System",
            "created": "2025-11-10",
            "scope": "PoC - Static palette mapping",
            "quality_gates": ["120+ FPS", "No state", "12-color palette"],
            "original_loc": 43
        },
        "state_variables": [],
        "input_nodes": [
            {
                "node_id": "input_params",
                "node_type": "builtin_struct",
                "output_type": "PatternParameters",
                "description": "Pattern parameters (brightness primarily used)"
            }
        ],
        "computation_nodes": [
            {
                "node_id": "led_loop",
                "node_type": "loop",
                "description": "Iterate over all LEDs",
                "loop_type": "for i in 0..NUM_LEDS-1",
                "body": [
                    {
                        "node_id": "center_distance",
                        "node_type": "calculation",
                        "operation": "position = abs(i - NUM_LEDS/2.0f) / (NUM_LEDS/2.0f)",
                        "inputs": ["i"],
                        "outputs": ["position (0.0-1.0)"]
                    },
                    {
                        "node_id": "palette_lookup",
                        "node_type": "palette_operation",
                        "operation": "interpolate_palette(position, departure_palette)",
                        "palette": "departure",
                        "inputs": ["position"],
                        "outputs": ["color"]
                    },
                    {
                        "node_id": "brightness_apply",
                        "node_type": "scaling",
                        "operation": "color *= params.brightness",
                        "inputs": ["color", "params.brightness"],
                        "outputs": ["final_color"]
                    },
                    {
                        "node_id": "led_assign",
                        "node_type": "output",
                        "operation": "leds[i] = final_color",
                        "inputs": ["final_color"]
                    }
                ]
            }
        ],
        "output_nodes": [
            {
                "node_id": "background_overlay",
                "node_type": "post_process",
                "operation": "apply_background_overlay(params)",
                "description": "Apply uniform background overlay"
            }
        ],
        "palettes": {
            "departure": [
                {"r": 0.03, "g": 0.01, "b": 0.00},
                {"r": 0.09, "g": 0.03, "b": 0.00},
                {"r": 0.29, "g": 0.15, "b": 0.02},
                {"r": 0.66, "g": 0.39, "b": 0.15},
                {"r": 0.84, "g": 0.66, "b": 0.47},
                {"r": 1.00, "g": 1.00, "b": 1.00},
                {"r": 0.53, "g": 1.00, "b": 0.54},
                {"r": 0.09, "g": 1.00, "b": 0.09},
                {"r": 0.00, "g": 1.00, "b": 0.00},
                {"r": 0.00, "g": 0.53, "b": 0.00},
                {"r": 0.00, "g": 0.22, "b": 0.00},
                {"r": 0.00, "g": 0.22, "b": 0.00}
            ]
        }
    },

    "pulse": {
        "version": "1.0",
        "pattern_id": "pulse",
        "pattern_name": "Pulse Pattern - Node Graph",
        "description": "Audio-driven wave spawning system with energy gates and traveling wave fronts",
        "metadata": {
            "author": "K1.node1 Pattern System",
            "created": "2025-11-10",
            "scope": "PoC - Audio-driven state machine",
            "quality_gates": ["120+ FPS", "Audio reactive", "Wave state management"],
            "original_loc": 143
        },
        "state_variables": [
            {
                "id": "pulse_waves",
                "type": "array",
                "size": "MAX_PULSE_WAVES",
                "element_type": "PulseWave",
                "description": "Array of active wave fronts with position, speed, hue, brightness"
            }
        ],
        "input_nodes": [
            {
                "node_id": "input_time",
                "node_type": "builtin_scalar",
                "output_type": "float",
                "description": "Frame time for delta-time calculation"
            },
            {
                "node_id": "input_params",
                "node_type": "builtin_struct",
                "output_type": "PatternParameters",
                "description": "Pattern parameters (speed, softness, brightness, palette)"
            },
            {
                "node_id": "input_audio",
                "node_type": "builtin_audio",
                "available_when": "AUDIO_IS_AVAILABLE()",
                "description": "Audio features: VU, kick, novelty"
            }
        ],
        "computation_nodes": [
            {
                "node_id": "audio_check",
                "node_type": "conditional",
                "condition": "!AUDIO_IS_AVAILABLE()",
                "branches": {
                    "true": "ambient_fallback",
                    "false": "energy_gate_calc"
                }
            },
            {
                "node_id": "ambient_fallback",
                "node_type": "rendering",
                "operation": "fill_palette(params.palette_id, 0.5f)",
                "description": "Fallback to ambient palette when no audio"
            },
            {
                "node_id": "energy_gate_calc",
                "node_type": "audio_processing",
                "operation": "energy_gate = clamp(VU*0.8 + KICK*0.6 + NOVELTY*0.4, 0.0, 1.0)",
                "description": "Calculate energy gate from multiple audio sources"
            },
            {
                "node_id": "spawn_check",
                "node_type": "conditional",
                "condition": "energy_gate > spawn_threshold",
                "branches": {
                    "true": "spawn_wave",
                    "false": "skip_spawn"
                }
            },
            {
                "node_id": "spawn_wave",
                "node_type": "state_update",
                "operation": "find first inactive wave and initialize with energy_gate params",
                "description": "Spawn new wave on energy threshold"
            },
            {
                "node_id": "led_clear",
                "node_type": "memory_op",
                "operation": "memset(leds, 0, NUM_LEDS * sizeof(CRGBF))",
                "description": "Clear LED buffer for additive rendering"
            },
            {
                "node_id": "wave_loop",
                "node_type": "loop",
                "description": "Update and render all active waves",
                "loop_type": "for each active wave",
                "body": [
                    {
                        "node_id": "update_wave",
                        "node_type": "calculation",
                        "operation": "wave.position += wave.speed * dt; wave.age++",
                        "description": "Advance wave position over time"
                    },
                    {
                        "node_id": "wave_brightness",
                        "node_type": "calculation",
                        "operation": "brightness = wave.brightness * exp(-decay_factor * wave.age)",
                        "description": "Apply exponential decay to wave brightness"
                    },
                    {
                        "node_id": "render_wave",
                        "node_type": "rendering",
                        "operation": "render gaussian-shaped wave centered at wave.position",
                        "description": "Render wave to LED buffer (additive)"
                    }
                ]
            }
        ],
        "output_nodes": [
            {
                "node_id": "background_overlay",
                "node_type": "post_process",
                "operation": "apply_background_overlay(params)",
                "description": "Apply uniform background overlay"
            }
        ]
    },

    "metronome": {
        "version": "1.0",
        "pattern_id": "metronome",
        "pattern_name": "Metronome Pattern - Node Graph",
        "description": "Beat-driven tempo-synced flash pattern with frequency coloring",
        "metadata": {
            "author": "K1.node1 Pattern System",
            "created": "2025-11-10",
            "scope": "PoC - Beat-driven state machine",
            "quality_gates": ["120+ FPS", "Beat-synced", "Tempo-driven"],
            "original_loc": 61
        },
        "state_variables": [
            {
                "id": "last_beat",
                "type": "float",
                "description": "Timestamp of last detected beat"
            }
        ],
        "input_nodes": [
            {
                "node_id": "input_time",
                "node_type": "builtin_scalar",
                "output_type": "float",
                "description": "Frame time"
            },
            {
                "node_id": "input_params",
                "node_type": "builtin_struct",
                "output_type": "PatternParameters",
                "description": "Pattern parameters"
            },
            {
                "node_id": "input_audio",
                "node_type": "builtin_audio",
                "available_when": "AUDIO_IS_AVAILABLE()",
                "description": "Audio features for beat detection and frequency mapping"
            }
        ],
        "computation_nodes": [
            {
                "node_id": "beat_detection",
                "node_type": "audio_processing",
                "operation": "detect beat event from AUDIO_KICK()",
                "description": "Detect beat from audio kick feature"
            },
            {
                "node_id": "beat_flash_calc",
                "node_type": "calculation",
                "operation": "time_since_beat = time - last_beat; flash = exp(-decay * time_since_beat)",
                "description": "Calculate flash decay from beat time"
            },
            {
                "node_id": "led_loop",
                "node_type": "loop",
                "description": "Iterate over all LEDs",
                "loop_type": "for i in 0..NUM_LEDS-1",
                "body": [
                    {
                        "node_id": "freq_map",
                        "node_type": "calculation",
                        "operation": "progress = i / NUM_LEDS; magnitude = interpolate_spectrum(progress)",
                        "description": "Map LED to spectrum frequency"
                    },
                    {
                        "node_id": "color_select",
                        "node_type": "palette_operation",
                        "operation": "color = palette(progress, flash * magnitude * params.brightness)",
                        "description": "Select color from palette scaled by beat flash"
                    },
                    {
                        "node_id": "led_assign",
                        "node_type": "output",
                        "operation": "leds[i] = color",
                        "inputs": ["color"]
                    }
                ]
            }
        ]
    }
}

# Add remaining 6 patterns with simplified structures
PATTERN_GRAPHS.update({
    "twilight": {
        "version": "1.0",
        "pattern_id": "twilight",
        "pattern_name": "Twilight Pattern - Node Graph",
        "description": "Peaceful transition palette from amber through purple to midnight blue",
        "metadata": {
            "author": "K1.node1 Pattern System",
            "created": "2025-11-10",
            "scope": "PoC - Static palette",
            "original_loc": 54
        },
        "state_variables": [],
        "input_nodes": [
            {"node_id": "input_params", "node_type": "builtin_struct", "output_type": "PatternParameters"}
        ],
        "computation_nodes": [{
            "node_id": "palette_map_loop",
            "node_type": "loop",
            "loop_type": "center-origin palette interpolation",
            "palette": "twilight"
        }],
        "palettes": {
            "twilight": [
                {"r": 1.00, "g": 0.65, "b": 0.00},
                {"r": 0.94, "g": 0.50, "b": 0.00},
                {"r": 0.86, "g": 0.31, "b": 0.08},
                {"r": 0.71, "g": 0.24, "b": 0.47},
                {"r": 0.39, "g": 0.16, "b": 0.71},
                {"r": 0.12, "g": 0.08, "b": 0.55},
                {"r": 0.04, "g": 0.06, "b": 0.31}
            ]
        }
    },

    "octave": {
        "version": "1.0",
        "pattern_id": "octave",
        "pattern_name": "Octave Pattern - Node Graph",
        "description": "Audio-driven chromagram visualization with 12-note musical spectrum",
        "metadata": {
            "author": "K1.node1 Pattern System",
            "created": "2025-11-10",
            "scope": "PoC - Audio spectrum visualization",
            "original_loc": 67
        },
        "state_variables": [],
        "input_nodes": [
            {"node_id": "input_time", "node_type": "builtin_scalar", "output_type": "float"},
            {"node_id": "input_params", "node_type": "builtin_struct", "output_type": "PatternParameters"},
            {"node_id": "input_audio", "node_type": "builtin_audio", "output_type": "AudioDataSnapshot"}
        ],
        "computation_nodes": [
            {
                "node_id": "audio_availability",
                "node_type": "conditional",
                "condition": "!AUDIO_IS_AVAILABLE()",
                "branches": {"true": "time_fallback", "false": "chromagram_render"}
            },
            {
                "node_id": "chromagram_render",
                "node_type": "spectrum_loop",
                "description": "Render 12-note chromagram with energy emphasis"
            }
        ]
    },

    "perlin": {
        "version": "1.0",
        "pattern_id": "perlin",
        "pattern_name": "Perlin Pattern - Node Graph",
        "description": "Smooth procedural noise-based animation with natural-looking transitions",
        "metadata": {
            "author": "K1.node1 Pattern System",
            "created": "2025-11-10",
            "scope": "PoC - Noise-driven spatial effects",
            "original_loc": 76
        },
        "state_variables": [],
        "input_nodes": [
            {"node_id": "input_time", "node_type": "builtin_scalar", "output_type": "float"},
            {"node_id": "input_params", "node_type": "builtin_struct", "output_type": "PatternParameters"}
        ],
        "computation_nodes": [
            {
                "node_id": "noise_loop",
                "node_type": "loop",
                "description": "Generate and interpolate Perlin noise across strip"
            }
        ]
    },

    "beat_tunnel": {
        "version": "1.0",
        "pattern_id": "beat_tunnel",
        "pattern_name": "Beat Tunnel Pattern - Node Graph",
        "description": "Expanding tunnel effect from center driven by audio beats",
        "metadata": {
            "author": "K1.node1 Pattern System",
            "created": "2025-11-10",
            "scope": "PoC - Beat-driven spatial expansion",
            "original_loc": 73
        },
        "state_variables": [
            {"id": "tunnel_wave_position", "type": "float", "description": "Current tunnel expansion position"},
            {"id": "tunnel_wave_intensity", "type": "float", "description": "Intensity of tunnel wave"}
        ],
        "input_nodes": [
            {"node_id": "input_time", "node_type": "builtin_scalar", "output_type": "float"},
            {"node_id": "input_params", "node_type": "builtin_struct", "output_type": "PatternParameters"},
            {"node_id": "input_audio", "node_type": "builtin_audio", "output_type": "AudioDataSnapshot"}
        ],
        "computation_nodes": [
            {
                "node_id": "wave_expansion",
                "node_type": "calculation",
                "description": "Expand tunnel wave from center outward"
            }
        ]
    },

    "tempiscope": {
        "version": "1.0",
        "pattern_id": "tempiscope",
        "pattern_name": "Tempiscope Pattern - Node Graph",
        "description": "Temperature-driven audio visualization with thermal color mapping",
        "metadata": {
            "author": "K1.node1 Pattern System",
            "created": "2025-11-10",
            "scope": "PoC - Thermal audio visualization",
            "original_loc": 92
        },
        "state_variables": [
            {"id": "thermal_buffer", "type": "float_array", "size": "NUM_LEDS", "description": "Thermal values per LED"}
        ],
        "input_nodes": [
            {"node_id": "input_params", "node_type": "builtin_struct", "output_type": "PatternParameters"},
            {"node_id": "input_audio", "node_type": "builtin_audio", "output_type": "AudioDataSnapshot"}
        ],
        "computation_nodes": [
            {
                "node_id": "thermal_update",
                "node_type": "loop",
                "description": "Update thermal buffer based on audio energy"
            }
        ]
    }
})

def generate_graphs():
    """Generate all pattern graphs"""
    for pattern_name, graph_data in PATTERN_GRAPHS.items():
        output_file = OUTPUT_DIR / f"{pattern_name}_graph.json"

        with open(output_file, 'w') as f:
            json.dump(graph_data, f, indent=2)

        print(f"Generated: {output_file}")
        print(f"  - Pattern: {graph_data['pattern_name']}")
        print(f"  - LOC: {graph_data['metadata'].get('original_loc', '?')}")
        print()

if __name__ == "__main__":
    generate_graphs()
    print(f"SUCCESS: Generated {len(PATTERN_GRAPHS)} pattern graphs")
