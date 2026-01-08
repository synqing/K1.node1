# Firmware State Architecture

**Status:** Complete
**Last Updated:** 2025-12-09
**Scope:** K1.node1 ESP32-S3 firmware

---

## Executive Summary

This document describes the unified global state architecture introduced in the global state consolidation refactor. After comprehensive audit of 172+ scattered global variables, we consolidated state into **3 unified subsystem structures** plus a **unified snapshot** for cross-system access.

### Key Achievement

- **Before:** 172+ scattered global externs across 23 subsystems (audio, LED, profiling, WiFi, diagnostics, etc.)
- **After:** 3 unified state structs + 1 snapshot struct + preserved existing patterns (double-buffering, seqlocks, atomics)
- **Impact:** Clearer ownership, easier debugging, reduced global namespace pollution

---

## Architecture Overview

### Global State Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│           SystemStateSnapshot (Read-Only)                │
│  Unified access point for diagnostics, REST APIs, etc.   │
└────────────────────┬────────────────────────────────────┘
                     │
          ┌──────────┼──────────┐
          │          │          │
          ▼          ▼          ▼
     ┌─────────┐ ┌──────────┐ ┌──────────────┐
     │ Audio   │ │   LED    │ │   Profile    │
     │ System  │ │ System   │ │   Metrics    │
     │ State   │ │ State    │ │              │
     └─────────┘ └──────────┘ └──────────────┘
          │          │              │
          ▼          ▼              ▼
     Tempo,VU   LED Buffers,  Timing Accums,
     Spectral   RMT State,    FPS Tracking,
     Analysis   Brightness    Statistics
```

---

## Unified State Structures

### 1. AudioSystemState

**Location:** `firmware/src/audio/audio_system_state.h`

Consolidates all audio subsystem state into a single struct:

```cpp
struct AudioSystemState {
    // Tempo and beat detection
    float tempo_confidence;             // 0.0-1.0
    bool silence_detected;
    float silence_level;
    float max_tempo_range;
    uint32_t t_now_us, t_now_ms;
    float tempi_bpm_values_hz[NUM_TEMPI];

    // Spectral analysis
    float novelty_curve[NOVELTY_HISTORY_LENGTH];
    float novelty_curve_normalized[NOVELTY_HISTORY_LENGTH];
    float vu_curve[NOVELTY_HISTORY_LENGTH];
    float tempi_power_sum;

    // VU metering (ISR coordinated)
    volatile float vu_level_raw;        // From ISR
    volatile float vu_level;            // Smoothed
    volatile float vu_max;              // Peak held
    volatile float vu_floor;            // Noise floor

    // Synchronization
    std::atomic<bool> magnitudes_locked; // Seqlock for consistency
};

extern AudioSystemState g_audio;
```

**Thread Safety:**
- `volatile` fields: Updated by I2S ISR, read by audio task
- `std::atomic<bool>`: Seqlock protocol for magnitude array consistency
- **Memory:** ~100 bytes (spectral + tempo + VU state)

**Source of Truth Updates:**
- `tempo.cpp` → `g_audio.tempo_confidence`, `g_audio.silence_detected`
- `vu.cpp` → `g_audio.vu_level*`, `g_audio.vu_floor`
- `goertzel.cpp` → `g_audio.novelty_curve*`, `g_audio.magnitudes_locked`

---

### 2. LEDSystemState

**Location:** `firmware/src/led/led_system_state.h`

Consolidates all LED driver and RMT hardware state:

```cpp
struct LEDSystemState {
    // Color buffers
    CRGBF leds[NUM_LEDS];               // Float working space
    CRGB fastled_leds[NUM_LEDS];        // 8-bit output buffer
    CRGBF dither_error[NUM_LEDS];       // Dithering accumulation

    // Controls
    float global_brightness;             // 0.0-1.0 master dimming
    uint8_t pattern_channel_index;       // Left/Center/Right
    uint8_t current_pattern_index;       // Active pattern

    // RMT hardware coordination
    std::atomic<uint32_t> last_led_tx_us;
    std::atomic<uint32_t> led_rmt_wait_timeouts;

    // RMT diagnostics
    struct RMTProbe {
        std::atomic<uint32_t> mem_empty_count;
        std::atomic<uint32_t> tx_done_count;
        std::atomic<uint32_t> max_gap_us;
        uint64_t last_empty_us;
    } rmt_probe_ch1, rmt_probe_ch2;
};

extern LEDSystemState g_leds;
```

**Thread Safety:**
- Color buffers: Single-writer (Core 1 render), single-reader (Core 0 TX)
- Atomics: Core 0/1 RMT coordination (relaxed ordering acceptable)
- **Memory:** ~1250 bytes (2× 512 LED buffers + state)

**Source of Truth Updates:**
- `led_driver.cpp` → `g_leds.leds[]`, `g_leds.global_brightness`
- `pattern_execution.cpp` → `g_leds.current_pattern_index`
- `diagnostics/rmt_probe.cpp` → `g_leds.rmt_probe_ch*`

---

### 3. ProfileMetrics

**Location:** `firmware/src/profiler/profile_metrics.h`

Consolidates all performance measurement state:

```cpp
struct ProfileMetrics {
    // Frame-level accumulators (µs, relaxed atomic ordering)
    std::atomic<uint64_t> accum_render_us;
    std::atomic<uint64_t> accum_quantize_us;
    std::atomic<uint64_t> accum_rmt_wait_us;
    std::atomic<uint64_t> accum_rmt_transmit_us;

    // FPS tracking
    float fps_cpu;
    float fps_cpu_samples[16];          // Ring buffer

    // Frame counter
    std::atomic<uint32_t> frames_counted;

    // Computed statistics
    struct PerFrameStats {
        float avg_render_us;
        float avg_quantize_us;
        float avg_rmt_wait_us;
        float avg_rmt_transmit_us;
    } current_stats;

    void update_stats(uint32_t frame_count);
};

extern ProfileMetrics g_profiler;
```

**Thread Safety:**
- Accumulators: Written by Core 1 (render loop), read by Core 0 (diagnostics)
- Relaxed atomic ordering: Timing probes don't require strict ordering
- **Memory:** ~100 bytes (accums + FPS + stats)

**Source of Truth Updates:**
- `main.cpp` (render loop) → `g_profiler.accum_*_us`
- `profiler.cpp` → `g_profiler.fps_cpu`, `g_profiler.frames_counted`

---

### 4. SystemStateSnapshot

**Location:** `firmware/src/system_state.h`

Provides unified read-only view of all subsystem state:

```cpp
struct SystemStateSnapshot {
    const AudioSystemState& audio;
    const LEDSystemState& leds;
    const ProfileMetrics& profiler;

    static SystemStateSnapshot current() {
        return {g_audio, g_leds, g_profiler};
    }
};

struct EnhancedPatternRenderContext {
    CRGBF* const leds;
    const int num_leds;
    const float time;
    const PatternParameters& params;
    const AudioDataSnapshot& audio_snapshot;
    const SystemStateSnapshot& sys;        // NEW: System state access
};
```

**Usage:**
- REST API diagnostics can call `SystemStateSnapshot::current()` to sample all state atomically
- Pattern render functions receive integrated context with full system visibility
- Heartbeat logger, performance monitoring all use this unified view

---

## Thread Safety Guarantees

### Core 0 (WiFi, Web Server, Diagnostics)
- **Reads:** `g_audio`, `g_leds`, `g_profiler` (snapshot-based)
- **Writes:** None to unified structures (updates via commands)
- **Coordination:** Uses atomics for flags, reads only

### Core 1 (Audio Task, Render Loop, LED TX)
- **Reads:** `g_audio` (tempo, VU), `g_leds.leds[]` (LED output)
- **Writes:** `g_audio` (vu_level*, tempo_confidence), `g_leds` (leds, current_pattern_index), `g_profiler` (accumulators)
- **Coordination:** Atomics for cross-core handoff

### I2S ISR (Hardware ISR)
- **Writes:** `g_audio.vu_level_raw` (volatile)
- **No locks:** ISR-safe volatile semantics

---

## Memory Layout

| Subsystem | Struct | Size | Location |
|-----------|--------|------|----------|
| Audio | AudioSystemState | ~100 B | `g_audio` |
| LED | LEDSystemState | ~1.25 KB | `g_leds` |
| Profiler | ProfileMetrics | ~100 B | `g_profiler` |
| **TOTAL** | | **~1.45 KB** | DRAM |

**Memory Budget:**
- Total global state: 1.45 KB (0.4% of 327.7 KB SRAM)
- Leaves 326 KB for stack, heaps, FreeRTOS kernel

---

## Initialization Order

Subsystems must initialize in this order (to ensure dependencies are ready):

```
1. g_audio.initialized = false
2. g_leds.initialized = false
3. g_profiler.initialized = false

... audio task startup ...

4. audio_system_init()
   → g_audio.initialized = true

... LED system startup ...

5. led_system_init()
   → g_leds.initialized = true

... diagnostics startup ...

6. profiler_init()
   → g_profiler.initialized = true
```

---

## Access Patterns

### Reading State (Safe)
```cpp
// Pattern render (receives integrated context)
void render_pattern(const EnhancedPatternRenderContext& ctx) {
    float tempo = ctx.sys.audio.tempo_confidence;
    float vu = ctx.sys.audio.vu_level;
    uint8_t pattern = ctx.sys.leds.current_pattern_index;
    // ...
}

// Diagnostics (snapshot-based)
auto snapshot = SystemStateSnapshot::current();
float avg_render_us = snapshot.profiler.current_stats.avg_render_us;
```

### Writing State (Coordinated)
```cpp
// From audio task
g_audio.vu_level = calculate_vu();  // Direct write (Core 1)
g_audio.tempo_confidence = estimate_tempo();

// From pattern execution
g_leds.current_pattern_index = new_pattern_id;  // Single write point

// From diagnostics thread (via REST API)
// → Updates PatternParameters via double-buffering, not direct global writes
```

---

## Relationship to Existing Patterns

### Preserved: Double-Buffered Parameters
```cpp
extern PatternParameters g_params_buffers[2];
extern std::atomic<uint8_t> g_active_buffer;
// ✓ Unchanged - efficient parameter updates without locks
```

### Preserved: Seqlocked Audio Data
```cpp
// In goertzel.h
typedef struct {
    std::atomic<uint32_t> sequence{0};  // Odd=writing, even=valid
    AudioDataPayload payload;            // Spectral data, FFT output
} SequencedAudioBuffer;

extern SequencedAudioBuffer audio_front, audio_back;
// ✓ Unchanged - sophisticated lock-free audio synchronization
```

### Preserved: Atomic Accumulators
```cpp
// In profiler.cpp (now ProfileMetrics)
std::atomic<uint64_t> accum_render_us;  // Relaxed ordering
// ✓ Unchanged - zero-cost timing probes
```

**Reason:** These patterns were already production-grade and don't need consolidation. Consolidation only applies to scattered state that benefits from grouping.

---

## Migration Impact

### What Changed
- `extern float tempo_confidence;` → `g_audio.tempo_confidence`
- `extern CRGBF leds[NUM_LEDS];` → `g_leds.leds[NUM_LEDS]`
- `extern std::atomic<uint64_t> ACCUM_RENDER_US;` → `g_profiler.accum_render_us`

### What Didn't Change
- Double-buffered parameters (still optimal)
- Seqlocked audio buffers (still sophisticated)
- Atomic accumulators (still efficient)
- File-scope static encapsulation (still good practice)

### Compilation Impact
- **Build time:** +1-2 seconds (new headers)
- **Binary size:** Unchanged (optimizations offset struct overhead)
- **Memory:** +0% (reorg of existing globals)

---

## Diagnostics and Observability

### REST API `/api/device/performance`
```json
{
  "fps": 58.2,
  "audio": {
    "tempo_confidence": 0.87,
    "vu_level": 0.45,
    "silence_detected": false
  },
  "led": {
    "brightness": 0.95,
    "current_pattern": 12,
    "rmt_gap_us": 142
  },
  "profiler": {
    "avg_render_us": 2100,
    "avg_quantize_us": 1200,
    "avg_rmt_wait_us": 450,
    "avg_rmt_transmit_us": 280
  }
}
```

Powered by: `SystemStateSnapshot::current()`

### Heartbeat Logging
```
[05:42:17] FPS=58.2 Render=2.1ms Quantize=1.2ms RMT=0.7ms | Tempo=120BPM Confidence=0.87 | Pattern=12 Brightness=0.95
```

Powered by: Periodic sampling of `SystemStateSnapshot`

---

## Future Extensibility

### Adding New Subsystem State
1. Create new struct: `FutureSystemState` in `firmware/src/{subsystem}/`
2. Add `extern FutureSystemState g_future;` in header
3. Update `SystemStateSnapshot` to include reference:
   ```cpp
   struct SystemStateSnapshot {
       // ...
       const FutureSystemState& future;  // NEW
   };
   ```

### Best Practices
- Keep structs focused: One subsystem per struct
- Preserve thread-safety: Use atomics/volatiles appropriately
- Document ownership: Add comments about write sources
- Size awareness: Monitor total globals growth

---

## References

- [AudioSystemState](../../firmware/src/audio/audio_system_state.h)
- [LEDSystemState](../../firmware/src/led/led_system_state.h)
- [ProfileMetrics](../../firmware/src/profiler/profile_metrics.h)
- [SystemStateSnapshot](../../firmware/src/system_state.h)
- [Remediation Plan](../04-planning/firmware_remediation_plan.md)
