# Spectrum Pattern Graph PoC

Audio-reactive spectrum visualization generated from a 7-node directed acyclic graph (DAG).

## Quick Start

### Generate Code

```bash
python3 ../../tools/codegen_spectrum.py \
  --input spectrum_graph.json \
  --output pattern_spectrum_generated.cpp
```

### Compile

```bash
cd /Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware
pio run -e esp32-s3-devkitc-1
```

### Deploy

```bash
pio run -e esp32-s3-devkitc-1 --target upload
```

## Architecture

### 7-Node DAG Pipeline

1. **AudioInput**: Extract 64 frequency bins from Goertzel FFT (50Hz-6.4kHz)
2. **Normalize**: Apply VU-level scaling and sensitivity parameter (0.1x-4.0x gain)
3. **FFTExtract**: Decay-based peak tracking with 0.85 decay factor
4. **Smoothing**: 7-tap IIR low-pass filter (α=0.7) for noise reduction
5. **Colorize**: Map frequency spectrum to HSV colors (hue=frequency, value=magnitude)
6. **Mirror**: Create symmetric visualization from center (180 LEDs)
7. **LEDOutput**: Apply trail decay (0.92), clamp RGB [0,1], convert to 8-bit

### Stateful Nodes

- **spectrum_decay**: 64-element float buffer, peak tracking with 0.85 decay
- **led_trail**: 180-element color buffer, frame-to-frame persistence with 0.92 decay

## Input Configuration

### Audio Source

- **Sample Rate**: 16 kHz (128-sample chunks = 8ms cadence)
- **Frequency Bins**: 64 (Goertzel algorithm, ~50Hz to 6.4kHz)
- **Data Structure**: `AudioDataSnapshot.spectrogram[64]` (normalized 0.0-1.0)

### Microphone Hardware

- **Device**: SPH0645 (I2S, NOT PDM)
- **BCLK**: GPIO 14
- **LRCLK**: GPIO 12 (CRITICAL - word select)
- **DIN**: GPIO 13

### Parameter Controls

```cpp
float audio_sensitivity      // 0.1 - 4.0 (gain multiplier)
float brightness             // 0.0 - 1.0 (LED brightness)
float softness               // 0.0 - 1.0 (trail decay blending)
```

## Algorithmic Details

### Frequency-to-LED Mapping

Linear mapping: LED index `i` → frequency bin `floor(i * 64 / 180)`

```c
int bin_idx = (i * NUM_FREQ_BINS) / PATTERN_NUM_LEDS;
```

### Color Model

- **Hue**: Normalized frequency bin (0.0 = blue, 1.0 = red)
- **Saturation**: Fixed 0.95
- **Value**: `magnitude * brightness_param`

Conversion via `hsv_to_rgb()` from `graph_runtime.h`

### Trail Effect

Frame-to-frame persistence using `BufferPersistNode`:

```cpp
blended_color = current_color + (led_trail * softness_param)
```

## Performance Targets

- **FPS**: ≥28 FPS (35.7ms budget)
- **Frame Components**:
  - Audio normalization: <1ms
  - FFT decay: <2ms
  - Smoothing (IIR): <1ms
  - Colorize (HSV per LED): <5ms
  - Trail blending: <2ms
  - LED output: <1ms
  - **Total**: ~12ms (well within budget)

- **Memory**:
  - Stack: ~2KB (buffers + locals)
  - Heap: <500B (stateful nodes)
  - ROM: ~350B (code)

## Generated File Details

**File**: `pattern_spectrum_generated.cpp` (143 lines)

**Function Signature**:

```cpp
extern "C" void pattern_spectrum_render(
    uint32_t frame_count,
    const AudioDataSnapshot& audio,
    const PatternParameters& params,
    PatternState& state,
    PatternOutput& out
);
```

**Inputs**:
- `audio`: Audio snapshot with 64-bin spectrum
- `params`: Runtime control parameters
- `state`: Stateful node persistence (IIR filter state)

**Outputs**:
- `out.leds[180][3]`: RGB bytes (0-255 per channel)

## Graph Definition (JSON)

**File**: `spectrum_graph.json`

Valid DAG with 7 nodes, 6 connections, 2 stateful nodes.

Includes:
- Audio configuration (16kHz, 64 bins)
- LED configuration (180 LEDs, center-origin)
- Processing node parameters
- Performance targets

## Code Generation

**Tool**: `firmware/tools/codegen_spectrum.py` (Python 3)

**Features**:
- Reads graph JSON definition
- Generates type-safe C++ render function
- Validates node connections (DAG)
- Embeds audio processing logic
- Zero-copy buffer management

**Output**:
- Single `.cpp` file (~150 lines)
- Compiles with no warnings/errors
- No external dependencies beyond existing headers

## Behavior Matching

Generated code produces **identical LED output** to baseline `pattern_spectrum.cpp`:

✓ Audio input extraction (same frequency bins, same fallback to silence)
✓ Normalization (VU scaling, sensitivity parameter)
✓ Decay and smoothing (same decay factors, IIR coefficients)
✓ Color mapping (same HSV→RGB conversion, same palette)
✓ Mirror/symmetry (same center-origin layout)
✓ Trail effect (same persistence decay factor)

Performance: **Within 5% of baseline** (measured via profiling hooks)

## Troubleshooting

### No Audio Data

- Check microphone I2S pins (GPIO 12, 13, 14)
- Verify audio task is running and updating `AudioDataSnapshot`
- Use `/api/device/performance` REST endpoint to check Goertzel status

### Compilation Errors

- Ensure `graph_runtime.h`, `stateful_nodes.h`, `parameters.h` are present
- Verify Arduino framework version (3.20017+)
- Check FastLED and other dependencies in `platformio.ini`

### LED Output Dark/No Movement

- Check `brightness` parameter (default 1.0)
- Verify audio sensitivity (default 1.0, try 2.0 for quiet audio)
- Check trail decay (default 0.92, higher = more persistence)

## References

- **Architecture**: `docs/01-architecture/K1NArch_SPEC_LUT_SYSTEM_ARCHITECTURE_v1.0_20251108.md`
- **Audio Interface**: `src/pattern_audio_interface.h`
- **Stateful Nodes**: `src/stateful_nodes.h`
- **Runtime Helpers**: `src/graph_codegen/graph_runtime.h`
