#!/usr/bin/env python3
"""
K1.node1 Bloom Pattern Code Generator

Converts a JSON graph definition to executable C++ pattern code.
Graph: AudioInput -> SpectralAnalysis -> BufferPersist -> Colorize -> Mirror -> LedOutput

Usage:
  python3 codegen_bloom.py --input bloom_graph.json --output pattern_bloom_generated.cpp
"""

import json
import sys
import argparse
from typing import Any, Dict, List


def emit_header(num_leds: int) -> str:
    """Emit C++ header with includes and new optimized function signature."""
    return f'''#include "graph_runtime.h"
#include "../stateful_nodes.h"
#include "../parameters.h"
#include "../pattern_audio_interface.h"

extern CRGBF leds[NUM_LEDS];

void draw_bloom_generated(float time, const PatternParameters& params) {{
    PATTERN_AUDIO_START();
    static PatternState state; // For nodes that require state
    static constexpr int PATTERN_NUM_LEDS = {num_leds};

    // Temporary buffers for intermediate stages
    float tmp_f0[PATTERN_NUM_LEDS] = {{0.0f}};
    CRGBF tmp_rgb0[PATTERN_NUM_LEDS];
    CRGBF tmp_rgb1[PATTERN_NUM_LEDS];

    // Initialize RGB buffers to black
    for (int i = 0; i < PATTERN_NUM_LEDS; ++i) {{
        tmp_rgb0[i] = {{0.0f, 0.0f, 0.0f}};
        tmp_rgb1[i] = {{0.0f, 0.0f, 0.0f}};
    }}

    // === Generated graph nodes ===
'''


def emit_audio_spectrum_node(node: Dict[str, Any]) -> str:
    """Emit AudioSpectrum node (input audio data)."""
    return """    // Node: AudioSpectrum
    // Audio input is available in: audio.spectrum[256] and audio.energy
    // (PoC: no-op, audio data used by downstream nodes)
"""


def emit_band_shape_node(node: Dict[str, Any], num_leds: int) -> str:
    """Emit BandShape node (scalar ramp)."""
    return f"""    // Node: BandShape
    // Convert audio spectrum to scalar ramp (PoC implementation)
    for (int i = 0; i < PATTERN_NUM_LEDS; ++i) {{
        tmp_f0[i] = (float)i / (float)(PATTERN_NUM_LEDS - 1);
    }}
"""


def emit_buffer_persist_node(node: Dict[str, Any], num_leds: int) -> str:
    """Emit BufferPersist node with decay."""
    decay = node.get("decay_factor", 0.92)
    return f"""    // Node: BufferPersist
    // Exponential decay: persist_buf = decay * persist_buf + (1 - decay) * input
    for (int i = 0; i < PATTERN_NUM_LEDS; ++i) {{
        state.persist_buf[i] = {decay}f * state.persist_buf[i] + (1.0f - {decay}f) * tmp_f0[i];
    }}
"""


def emit_colorize_node(node: Dict[str, Any], num_leds: int) -> str:
    """Emit Colorize node (scalar to grayscale RGB)."""
    return f"""    // Node: Colorize
    // Map scalar buffer to grayscale (PoC: simple value -> R=G=B)
    for (int i = 0; i < PATTERN_NUM_LEDS; ++i) {{
        float v = clamp_val(state.persist_buf[i], 0.0f, 1.0f);
        tmp_rgb0[i] = {{v, v, v}};
    }}
"""


def emit_mirror_node(node: Dict[str, Any], num_leds: int) -> str:
    """Emit Mirror node (center-origin symmetric mirror)."""
    return f"""    // Node: Mirror (Center-Origin)
    // Render the first half and write it symmetrically to the output.
    const int half_leds = PATTERN_NUM_LEDS / 2;
    for (int i = 0; i < half_leds; ++i) {{
        // Source is the first half of the input buffer
        const CRGBF& color = tmp_rgb0[i];
        // Write to both sides of the output buffer
        tmp_rgb1[half_leds - 1 - i] = color;
        tmp_rgb1[half_leds + i] = color;
    }}
"""


def emit_led_output_node(node: Dict[str, Any], num_leds: int) -> str:
    """Emit LedOutput terminal (optimized to write to global leds buffer)."""
    return f"""    // Terminal: LedOutput (OPTIMIZED)
    // Clamp and write final buffer to global leds array, applying brightness
    const CRGBF* final_buf = tmp_rgb1;
    for (int i = 0; i < PATTERN_NUM_LEDS; ++i) {{
        CRGBF final_color = clamped_rgb(final_buf[i]);
        leds[i].r = final_color.r * params.brightness;
        leds[i].g = final_color.g * params.brightness;
        leds[i].b = final_color.b * params.brightness;
    }}
"""


def emit_footer() -> str:
    """Emit C++ function closing."""
    return "}\n"


def generate_cpp(graph: Dict[str, Any]) -> str:
    """Generate complete C++ code from graph definition."""
    num_leds = graph.get("num_leds", 256)
    nodes = graph.get("nodes", [])

    # Build node lookup
    node_map = {node["id"]: node for node in nodes}

    code = emit_header(num_leds)

    # Emit nodes in dependency order
    for node in nodes:
        node_id = node["id"]
        node_type = node["type"]

        if node_type == "AudioSpectrum":
            code += emit_audio_spectrum_node(node)
        elif node_type == "BandShape":
            code += emit_band_shape_node(node, num_leds)
        elif node_type == "BufferPersist":
            code += emit_buffer_persist_node(node, num_leds)
        elif node_type == "Colorize":
            code += emit_colorize_node(node, num_leds)
        elif node_type == "Mirror":
            code += emit_mirror_node(node, num_leds)
        elif node_type == "LedOutput":
            code += emit_led_output_node(node, num_leds)
        else:
            raise ValueError(f"Unknown node type: {node_type}")

    code += "\n"
    code += emit_footer()
    return code


def load_graph(filepath: str) -> Dict[str, Any]:
    """Load and validate JSON graph definition."""
    with open(filepath, "r") as f:
        graph = json.load(f)

    # Validate required fields
    if "num_leds" not in graph:
        raise ValueError("Graph must have 'num_leds' field")
    if "nodes" not in graph:
        raise ValueError("Graph must have 'nodes' array")

    # Validate all nodes have required fields
    for node in graph["nodes"]:
        if "id" not in node or "type" not in node:
            raise ValueError(f"Node missing 'id' or 'type': {node}")

    return graph


def main():
    parser = argparse.ArgumentParser(
        description="Generate C++ pattern code from JSON graph definition"
    )
    parser.add_argument(
        "--input", required=True, help="Input JSON graph file"
    )
    parser.add_argument(
        "--output", required=True, help="Output C++ file"
    )

    args = parser.parse_args()

    try:
        graph = load_graph(args.input)
        cpp_code = generate_cpp(graph)

        with open(args.output, "w") as f:
            f.write(cpp_code)

        print(f"Generated {args.output} from {args.input}")
        print(f"  num_leds: {graph['num_leds']}")
        print(f"  nodes: {len(graph['nodes'])}")

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
