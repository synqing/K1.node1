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
    """Emit C++ header with includes and constants."""
    return f'''#include "graph_runtime.h"
#include "../stateful_nodes.h"
#include "../parameters.h"
#include "../pattern_audio_interface.h"

extern "C" void pattern_bloom_render(
    uint32_t frame_count,
    const AudioDataSnapshot& audio,
    const PatternParameters& params,
    PatternState& state,
    PatternOutput& out
) {{
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
    """Emit Mirror node (horizontal flip)."""
    return f"""    // Node: Mirror
    mirror_buffer(tmp_rgb0, tmp_rgb1, PATTERN_NUM_LEDS);
"""


def emit_led_output_node(node: Dict[str, Any], num_leds: int) -> str:
    """Emit LedOutput terminal (clamp and write to output)."""
    return f"""    // Terminal: LedOutput
    // Clamp and quantize final buffer to 8-bit RGB
    const CRGBF* final_buf = tmp_rgb1;
    for (int i = 0; i < PATTERN_NUM_LEDS; ++i) {{
        CRGBF c = clamped_rgb(final_buf[i]);
        out.leds[i][0] = (uint8_t)std::floor(c.r * 255.0f + 0.5f);
        out.leds[i][1] = (uint8_t)std::floor(c.g * 255.0f + 0.5f);
        out.leds[i][2] = (uint8_t)std::floor(c.b * 255.0f + 0.5f);
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
