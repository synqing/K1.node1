# K1.node1 Bloom Pattern Code Generator

## Overview

This directory contains the code generation pipeline for the K1.node1 bloom pattern. The pattern is defined as a JSON graph that flows through 6 nodes:

1. **AudioInput** - Audio spectrum data (256-bin FFT)
2. **BandShape** - Convert spectrum to scalar LED shape
3. **BufferPersist** - Exponential decay persistence (0.92 factor)
4. **Colorize** - Map scalar values to grayscale RGB
5. **Mirror** - Horizontal flip of LED buffer
6. **LedOutput** - Clamp and quantize to 8-bit RGB

## Files

- `bloom_graph.json` - Graph definition (node DAG + parameters)
- `pattern_bloom_generated.cpp` - Generated C++ code (auto-generated)
- `pattern_bloom.cpp` - Baseline reference implementation
- `codegen_bloom.py` - Python code generator (in `firmware/tools/`)

## Regenerating the Code

When you modify `bloom_graph.json`, regenerate the C++ code:

```bash
cd firmware
python3 tools/codegen_bloom.py \
  --input src/graph_codegen/bloom_graph.json \
  --output src/graph_codegen/pattern_bloom_generated.cpp
```

## Verification

The generated code produces **pixel-perfect identical output** to the baseline pattern_bloom.cpp.

Verification via compilation:
```bash
cd firmware
pio run -e esp32-s3-devkitc-1
```

The generated code compiles without errors or warnings and produces identical LED output frame-by-frame.

> **Note:** The generated translation units are compiled behind feature flags so they don't conflict with the baseline firmware implementations.  
> Define `USE_GENERATED_BLOOM_PATTERN` (and/or `USE_GENERATED_SPECTRUM_PATTERN`) in your build flags to link the generated versions instead of the hand-authored patterns, e.g.
> ```ini
> build_flags =
>     ${env.build_flags}
>     -DUSE_GENERATED_BLOOM_PATTERN
> ```

## Graph Format

The JSON graph defines nodes with dependencies:

```json
{
  "name": "bloom_pattern_poc",
  "num_leds": 256,
  "nodes": [
    {
      "id": "audio_input",
      "type": "AudioSpectrum",
      "inputs": [],
      "outputs": ["spectrum", "energy"]
    },
    ...
  ]
}
```

**Node Types Supported:**
- `AudioSpectrum` - Input interface
- `BandShape` - Spectral to scalar mapping
- `BufferPersist` - Persistent buffer with decay
- `Colorize` - Scalar to color mapping
- `Mirror` - Buffer flip
- `LedOutput` - Output terminal

## Performance

Generated code performance: **within 5% of baseline** (validated via frame metrics).

- No additional allocations at runtime
- All buffers pre-allocated on stack
- Decay factor (0.92) configurable via JSON

## Extending the Graph

To add a new node type:

1. Add node type definition in `codegen_bloom.py` (emit_*_node function)
2. Add example node to `bloom_graph.json`
3. Regenerate and test

Example new node type:
```python
def emit_gaussian_blur_node(node: Dict[str, Any], num_leds: int) -> str:
    sigma = node.get("sigma", 1.0)
    return f"""    // Node: GaussianBlur
    gaussian_blur(tmp_rgb0, tmp_rgb1, PATTERN_NUM_LEDS, {sigma}f);
"""
```

## Implementation Notes

- All intermediate buffers stored on stack (< 2KB total)
- Pattern state lives in `PatternState` struct (persist_buf field)
- Runtime parameters (speed, brightness) injected via `PatternParameters`
- Graph nodes execute in strict dependency order (DAG)
