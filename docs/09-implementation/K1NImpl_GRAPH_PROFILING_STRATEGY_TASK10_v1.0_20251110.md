---
title: "K1.node1 Graph System Profiling Strategy (Task 10)"
type: "Implementation"
project: "K1.node1"
project_code: "K1N"
version: "v1.0"
date: "2025-11-10"
status: "specification"
intent: "Comprehensive profiling methodology to measure and validate graph system performance against targets (30+ FPS, <200KB heap, <16KB state, <12ms render budget)"
doc_id: "K1NImpl_GRAPH_PROFILING_STRATEGY_TASK10_v1.0_20251110"
owner: "Performance Engineering"
related:
  - "K1NPlan_TASK_ROADMAP_CORRECTED_v1.0_20251110.md"
  - "K1NAnalysis_RISK_SUMMARY_EXECUTIVE_v1.0_20251110.md"
tags: ["profiling","performance","task10","graph-system","metrics","benchmark"]
---

# K1.node1 Graph System Profiling Strategy (Task 10)

**Document Status:** SPECIFICATION - Detailed profiling methodology for graph system validation
**Updated:** November 10, 2025
**Scope:** Performance measurement, instrumentation design, benchmark suite, and regression detection
**Acceptance Gate:** Unblocks Task 18 (Integration Testing) and Phase 3 GO/NO-GO decision

---

## EXECUTIVE SUMMARY

Task 10 establishes performance baselines and validates that the graph code generation system meets targets:

| Metric | Target | Measurement Method | Acceptance Criteria |
|--------|--------|-------------------|-------------------|
| **FPS** | ≥30 (28+ margin) | Heartbeat logger frame count delta | ≥28 FPS on all patterns |
| **Heap Usage** | <200KB available | `heap_caps_get_free_size()` snapshots | ≥200KB free at peak |
| **State Size** | <16KB per pattern | `sizeof()` analysis + buffer allocation | <16KB max state |
| **Render Budget** | <12ms @ 30 FPS | Timing probes: render + quantize + wait + TX | <12ms per frame |
| **RMT Stability** | 0 refill gaps | RMT probe callbacks (mem_empty events) | Max gap <100µs, 0 stalls |
| **Generated vs Hand** | <2% FPS delta | Back-to-back FPS comparison | Hand-written baseline = 100% |

---

## PART 1: PERFORMANCE TARGETS FROM CODEBASE

### 1.1 System Constraints (Measured from Hardware & Firmware)

**ESP32-S3 Platform:**
- CPU: Dual-core Xtensa 240 MHz (Core 0: main, Core 1: reserved/optional)
- RAM: 512 KB SRAM (split: 320 KB DRAM + 192 KB IRAM)
- Available heap: ~200–250 KB (OS + stdlib overhead ~50 KB)
- Flash: 16 MB (partition: 4 MB app, 4 MB SPIFFS)
- RMT: 4 channels, 192 KB shared buffer (≥256 symbols/channel typical)

**LED System (from led_driver.h):**
- NUM_LEDS = 160 (6 bytes/LED = 960 bytes CRGBF buffer)
- Dual channel output (ch1 + ch2 160 LEDs each = 1.92 KB RGB data)
- RMT WS2812B @ 800 kHz: ~5 µs/LED, 4.8 ms/160 LEDs per channel
- Frame rate: 30 FPS → 33.3 ms per frame budget

**Audio System (from microphone.cpp):**
- I2S input: SPH0645 @ 16 kHz sampling rate
- FFT: 256-point spectrum (1024 bytes float buffer)
- Tempo bins: NUM_TEMPI (likely 32), Chroma: 12-point (48 bytes)
- Audio state: ~2 KB per audio snapshot

### 1.2 Performance Targets (From Documentation)

**Frame Timing Budget @ 30 FPS:**
```
Total frame time: 33.3 ms
├─ Render (pattern execution):        ≤10 ms   (30% budget)
├─ Quantize (float→uint8):            ≤1 ms    (3% budget)
├─ RMT wait (previous frame completion): ≤2 ms (6% budget)
├─ RMT transmit (dual channel):        ≤12 ms   (36% budget)
├─ Audio I2S capture:                  ≤2 ms    (6% budget, async)
└─ Sleep (frame sync):                 ≤6 ms    (18% budget, slop)
```

**Memory Budget @ Runtime:**
```
ESP32-S3 available heap: 200 KB
├─ FreeRTOS kernel + tasks:  ~40 KB (fixed)
├─ Audio system (FFT, state): ~10 KB (fixed)
├─ LED render state:         <16 KB (per pattern, measured)
├─ Networking (WiFi/web):    ~50 KB (WiFi off = 10 KB)
├─ Buffers (temp LED):       ~3 KB  (allocate once)
└─ Headroom:                 ~70 KB (safety margin)
```

**RMT/LED Transmission:**
- Dual-channel synchronized transmit (RMT v2, IDF5)
- Max refill gap: <100 µs (tolerance for 160 LEDs @ 800 kHz)
- Buffer geometry: ≥256 symbols/channel (448 bytes)

### 1.3 Documented Performance Assertions

From firmware source:
```cpp
static_assert(STRIP_LENGTH == NUM_LEDS, "STRIP_LENGTH must equal NUM_LEDS");
static_assert(STRIP_CENTER_POINT == (NUM_LEDS/2 - 1), "Center must be center index");
```

From pattern template:
```cpp
static constexpr int PATTERN_NUM_LEDS = 256;  // Codegen max
static constexpr int FRAME_RATE = 30;  // Hz
```

From graph runtime:
```cpp
struct PatternState {
    float lowpass_states[8];        // 32 B
    float ma_ring_buf[32];          // 128 B
    float persist_buf[256];         // 1024 B
    float beat_prev_envelope;       // 4 B
    uint32_t beat_count;            // 4 B
    float custom_state[64];         // 256 B
};  // Total: ~1.5 KB per pattern instance
```

---

## PART 2: EXISTING PROFILING INFRASTRUCTURE ANALYSIS

### 2.1 Profiling System (profiling.h)

**Current Capability:** Lock-free, zero-cost profiling (when `DEBUG_TELEMETRY` disabled)

| Feature | Implementation | Cost |
|---------|----------------|------|
| **ProfileScope macro** | RAII timer, fixed pool (32 sections max) | ~50 cycles entry/exit |
| **Atomic updates** | `std::atomic<>` with relaxed ordering | CAS loop on max update |
| **Statistics** | total_us, count, max_us per section | O(1) read/write |
| **Expansion** | Compile-time no-op when disabled | 0 bytes, 0 cycles |

**Metrics Available:**
- `ProfileScope::get_avg_us(name)` → average execution time
- `ProfileScope::get_max_us(name)` → peak execution time
- `ProfileScope::print_all_stats()` → formatted output
- `ProfileScope::reset_all()` → benchmark restart

**Limitations:**
- 32 section max (extensible via static array)
- Per-section only (no nested hierarchies)
- No thread ID tracking (assumes single call site)
- Max overflow handling (caps at MAX_SECTIONS, silent)

### 2.2 Profiler Global Variables (profiler.h)

**FPS Tracking:**
```cpp
extern float FPS_CPU;
extern float FPS_CPU_SAMPLES[16];
extern std::atomic<uint64_t> ACCUM_RENDER_US;
extern std::atomic<uint64_t> ACCUM_QUANTIZE_US;
extern std::atomic<uint64_t> ACCUM_RMT_WAIT_US;
extern std::atomic<uint64_t> ACCUM_RMT_TRANSMIT_US;
extern std::atomic<uint32_t> FRAMES_COUNTED;

void watch_cpu_fps();
void print_fps();
```

**Metrics Tracked:** FPS, per-phase accumulator (render/quantize/RMT wait/TX)

### 2.3 Heartbeat Logger (heartbeat_logger.cpp)

**Design:** Ring buffer (64 entries) + SPIFFS log file, 1 entry/second (configurable)

**Data Per Entry (22 fields):**
```
timestamp_ms, frame_total, frame_delta, audio_ticks, audio_delta,
audio_snapshot, snapshot_delta, loop_gpu_stall_ms, audio_stall_ms,
led_idle_ms, pattern_index, vu_level, vu_level_raw, tempo_confidence,
silence, beat_queue_depth, rmt_empty_ch1, rmt_empty_ch2,
rmt_maxgap_us_ch1, rmt_maxgap_us_ch2
```

**Access Methods:**
- `heartbeat_logger_note_frame()` → Increment frame counter (from render loop)
- `heartbeat_logger_note_audio()` → Increment audio counter + snapshot
- `heartbeat_logger_poll()` → Compute deltas, write log, store history
- `heartbeat_logger_dump_recent()` → Dump 64-entry ring buffer

**Limitations:**
- 1 Hz granularity (can't capture frame-by-frame jitter)
- SPIFFS I/O overhead (≤1% but blocking)
- 22 fields fixed (extensible via struct)

### 2.4 RMT Probe (rmt_probe.cpp)

**Design:** ISR-attached callbacks on RMT transmit complete + mem empty events

**Metrics:**
```cpp
struct RmtProbe {
    const char* name;              // "ch1" or "ch2"
    volatile uint32_t mem_empty_count;    // Refill events
    volatile uint32_t trans_done_count;   // Transmission completions
    volatile uint32_t max_gap_us;         // Max time between refills
    volatile uint64_t last_empty_us;      // Timestamp of last refill
};
```

**Access:** `rmt_probe_get(&ch1, &ch2)` → Returns pointers to global probes

**Limitations:**
- Volatile access only (not atomic)
- Max gap resets on overflow (16-bit safety)
- No per-pattern attribution

### 2.5 Diagnostics REST Endpoints

**Available:**
- `/device/info` → Build signature, platform, toolchain versions
- `/device/performance` → Current CPU, memory, RMT stats (stub)

**Telemetry Control:**
```cpp
void diag_set_enabled(bool enabled);
void diag_set_interval_ms(uint32_t interval_ms);
```

---

## PART 3: PROFILING METHODOLOGY

### 3.1 Memory Usage Profiling

#### Static Pattern Analysis

**Compile-time Calculation:**
1. Measure generated C++ code size: `wc -l pattern_*.cpp`
2. Calculate buffer allocations from AST:
   ```
   Persistent buffers = sum(sizof(CRGBF) * buffer_width + stateful_node_state)
   Scratch buffers = linear_scan_allocator_peak
   ```
3. Verify against budget: `Persistent + Scratch < 16 KB`

**Instrumentation Points:**
```cpp
// In generated pattern function
const size_t PATTERN_STATE_SIZE = sizeof(PatternState);
const size_t SCRATCH_BUDGET = 16384 - PATTERN_STATE_SIZE;
static_assert(PATTERN_STATE_SIZE < 16000, "Pattern state exceeds 16 KB budget");
```

#### Runtime Allocation Monitoring

**Heap Snapshots (5 per frame cycle, non-blocking):**

```cpp
// Probe 1: Frame start (pattern dispatch)
uint32_t heap_pre_render = heap_caps_get_free_size(MALLOC_CAP_DEFAULT);

// Probe 2: After render (before quantize)
uint32_t heap_post_render = heap_caps_get_free_size(MALLOC_CAP_DEFAULT);

// Probe 3: After quantize
uint32_t heap_post_quantize = heap_caps_get_free_size(MALLOC_CAP_DEFAULT);

// Probe 4: After RMT transmit
uint32_t heap_post_tx = heap_caps_get_free_size(MALLOC_CAP_DEFAULT);

// Probe 5: Frame end (sleep period)
uint32_t heap_frame_end = heap_caps_get_free_size(MALLOC_CAP_DEFAULT);

// Acceptance:
static_assert(HEAP_TARGET == 200000, "Target: 200 KB free");
if (heap_post_render < HEAP_TARGET) {
    LOG_WARN(TAG_PERF, "Heap dipped to %u KB, target %u KB",
             heap_post_render / 1024, HEAP_TARGET / 1024);
}
```

**Fragmentation Detection:**
```cpp
// Largest allocatable block (indicator of fragmentation)
size_t largest_free_block = heap_caps_get_largest_free_block(MALLOC_CAP_DEFAULT);

// Acceptance: Largest block ≥ 64 KB (enough for emergency allocations)
if (largest_free_block < 65536) {
    LOG_ERROR(TAG_PERF, "Fragmentation risk: largest free block %u KB",
              largest_free_block / 1024);
}
```

**Metric Collection Interval:** Every frame (1000 samples/33s @ 30 FPS)

#### Allocator Behavior Analysis

**Per-pattern instrumentation:**
```cpp
struct MemoryStats {
    uint32_t heap_before_ms;
    uint32_t heap_after_ms;
    uint32_t peak_usage_bytes;
    uint32_t fragmentation_percent;
};

// Store in heartbeat entry
```

### 3.2 CPU Timing Analysis

#### Frame-Level Breakdown

**Measurement Points:**

```cpp
// === FRAME RENDER ===
uint32_t t_frame_start = micros();
PROFILE_SECTION("render_pattern");
{
    pattern_render_func(frame_count, audio_snapshot, params, state, out);
}
uint32_t t_post_render = micros();

// === QUANTIZE (float → uint8) ===
PROFILE_SECTION("quantize_rgb");
{
    quantize_and_clamp(out.leds, rgb8_data, NUM_LEDS);
}
uint32_t t_post_quantize = micros();

// === RMT WAIT (previous frame done) ===
PROFILE_SECTION("rmt_wait");
{
    rmt_tx_wait_all_done(tx_chan, pdMS_TO_TICKS(8));
    rmt_tx_wait_all_done(tx_chan_2, pdMS_TO_TICKS(8));
}
uint32_t t_post_wait = micros();

// === RMT TRANSMIT ===
PROFILE_SECTION("rmt_transmit");
{
    rmt_transmit(tx_chan, encoder, raw_led_data, len1, &config);
    rmt_transmit(tx_chan_2, encoder_2, raw_led_data_ch2, len2, &config);
}
uint32_t t_post_tx = micros();

// === FRAME TIMING SUMMARY ===
uint32_t render_us = t_post_render - t_frame_start;
uint32_t quantize_us = t_post_quantize - t_post_render;
uint32_t wait_us = t_post_wait - t_post_quantize;
uint32_t tx_us = t_post_tx - t_post_wait;
uint32_t total_us = t_post_tx - t_frame_start;

// Log for analysis
g_frame_metrics.render_us = render_us;
g_frame_metrics.quantize_us = quantize_us;
g_frame_metrics.wait_us = wait_us;
g_frame_metrics.tx_us = tx_us;
g_frame_metrics.total_us = total_us;
```

**Acceptance Criteria:**

| Phase | Budget | Measured | Margin |
|-------|--------|----------|--------|
| **Render** | 10,000 µs | ACCUM_RENDER_US/count | ±1 ms |
| **Quantize** | 1,000 µs | ACCUM_QUANTIZE_US/count | ±100 µs |
| **RMT Wait** | 2,000 µs | ACCUM_RMT_WAIT_US/count | ±500 µs |
| **RMT TX** | 12,000 µs | ACCUM_RMT_TRANSMIT_US/count | ±1 ms |
| **Total** | 25,000 µs | sum | ≤33,300 µs (33.3 ms @ 30 FPS) |

#### Hot Path Identification

**Call frequency analysis:**

```cpp
// From profiling.h stats pool
for (uint8_t i = 0; i < num_sections; i++) {
    uint32_t call_count = stats[i].count;
    uint64_t total = stats[i].total_us;
    uint32_t avg = total / call_count;
    uint32_t max = stats[i].max_us;

    float percent_of_frame = (total * 100.0f) / (33300.0f); // @ 30 FPS

    if (percent_of_frame > 10.0f) {
        LOG_WARN(TAG_PERF, "HOT: %s (%.1f%% of frame, avg %u µs, max %u µs)",
                 stats[i].name, percent_of_frame, avg, max);
    }
}
```

**Optimization Targets:**
- Any path consuming >10% of frame time
- Variance (max - avg) >50% indicates non-determinism

### 3.3 Cache Behavior Profiling

#### Instruction Cache Misses

**Method:** Use ESP32-S3 PMU (Performance Monitoring Unit) if available, or estimate from code organization.

**Compile-time analysis:**

```bash
# Count function definitions in generated code
grep -c "^inline\|^static" firmware/src/graph_codegen/pattern_*.cpp

# Estimate code density (smaller = better cache fit)
wc -l firmware/src/graph_codegen/pattern_*.cpp
```

**Acceptance:** <5% i-cache misses (measured via profiler if PMU available)

#### Data Cache Behavior

**Buffer Allocation Pattern:**

```cpp
// Measure cache line alignment (64 bytes on ESP32-S3)
struct AlignmentStats {
    size_t buffer_address;
    bool cache_aligned; // address % 64 == 0
    size_t buffer_size;
    size_t cache_lines; // (size + 63) / 64
};

// Verify scratch allocator aligns buffers
if (buffer_address % 64 != 0) {
    LOG_WARN(TAG_PERF, "Unaligned buffer @ %p (cache efficiency loss)", buffer_address);
}
```

### 3.4 Power Consumption (Optional, Telemetry-Based)

**Measurement:** If voltage regulator telemetry available via ADC

```cpp
#ifdef POWER_TELEMETRY_ENABLED
static uint32_t g_power_samples[60];  // 60 sec @ 1 Hz
uint16_t adc_read = analogRead(ADC_POWER_PIN);
float voltage = adc_read * (3.3f / 4096.0f);  // ESP32 ADC
float current_ma = (voltage - V_BASELINE) / R_SENSE;  // Ohm's law
g_power_samples[heartbeat_index] = current_ma;

// Average over sample window
float avg_current = mean(g_power_samples, 60);
float power_watts = avg_current * 3.3f / 1000.0f;
#endif
```

**Acceptance:** <5 W average (quiet patterns) to <8 W (full brightness, bass sync)

---

## PART 4: INSTRUMENTATION PLAN

### 4.1 Code Probe Insertion Strategy

**Zero-Cost Principle:**
- All probes compile to no-op when `DEBUG_TELEMETRY` disabled
- Atomic counters use relaxed ordering (no barriers)
- Ring buffer allocation once at boot (no per-frame alloc)

**Probe Locations (8 total):**

| Probe | Location | Measurement | Cost | Frequency |
|-------|----------|-------------|------|-----------|
| **1. Render Entry** | `pattern_render_func` entry | Timestamp | 5 cycles | Per frame |
| **2. Render Exit** | `pattern_render_func` exit | Δt from entry | 5 cycles | Per frame |
| **3. Quantize** | `quantize_and_clamp()` | Δt, heap snapshot | 10 cycles | Per frame |
| **4. RMT Wait** | `rmt_tx_wait_all_done()` x2 | Δt, max gap from probe | 10 cycles | Per frame |
| **5. RMT TX** | `rmt_transmit()` x2 | Δt, ISR callback count | 5 cycles | Per frame |
| **6. Heap Check** | Frame end (sleep loop) | `heap_caps_get_free_size()` | 100 cycles | Per heartbeat (1 Hz) |
| **7. FPS Count** | Render loop | `FRAMES_COUNTED++` | 1 cycle | Per frame |
| **8. Audio Stall** | Audio task yield | Δt since last sample | 5 cycles | Per audio capture |

**Total Overhead:** ~50 µs per frame (0.15% @ 33 ms/frame) when all enabled

### 4.2 Instrumentation Code (Firmware Patches)

**File: `firmware/src/main.cpp` (render loop)**

```cpp
// Add after existing loop_control_task function:

// Profiling structure
struct FrameMetrics {
    uint32_t render_us;
    uint32_t quantize_us;
    uint32_t wait_us;
    uint32_t tx_us;
    uint32_t total_us;
    uint32_t heap_free_bytes;
    uint8_t pattern_id;
    uint8_t frame_sequence;
};

// Ring buffer for recent frames (256 frames = 8 sec @ 30 FPS)
static constexpr size_t METRICS_RING_SIZE = 256;
static FrameMetrics g_frame_metrics_ring[METRICS_RING_SIZE];
static size_t g_metrics_index = 0;

#define RECORD_FRAME_METRIC(metric, value) do { \
    if (g_metrics_index < METRICS_RING_SIZE) { \
        g_frame_metrics_ring[g_metrics_index].metric = value; \
    } \
} while(0)

// In main render loop:
void loop() {
    uint32_t t_frame_start = micros();

    // === RENDER ===
    {
        PROFILE_SECTION("pattern_render");
        // ... existing pattern_render call ...
    }
    uint32_t t_post_render = micros();

    // === QUANTIZE ===
    {
        PROFILE_SECTION("quantize");
        // ... existing quantize call ...
    }
    uint32_t t_post_quantize = micros();

    // === RMT WAIT ===
    {
        PROFILE_SECTION("rmt_wait");
        rmt_tx_wait_all_done(tx_chan, pdMS_TO_TICKS(8));
        rmt_tx_wait_all_done(tx_chan_2, pdMS_TO_TICKS(8));
    }
    uint32_t t_post_wait = micros();

    // === RMT TRANSMIT ===
    {
        PROFILE_SECTION("rmt_transmit");
        rmt_transmit(tx_chan, encoder, raw_led_data, NUM_LEDS * 3, &config);
        rmt_transmit(tx_chan_2, encoder_2, raw_led_data_ch2, NUM_LEDS * 3, &config);
    }
    uint32_t t_post_tx = micros();

    // === RECORD METRICS ===
    g_frame_metrics_ring[g_metrics_index].render_us = t_post_render - t_frame_start;
    g_frame_metrics_ring[g_metrics_index].quantize_us = t_post_quantize - t_post_render;
    g_frame_metrics_ring[g_metrics_index].wait_us = t_post_wait - t_post_quantize;
    g_frame_metrics_ring[g_metrics_index].tx_us = t_post_tx - t_post_wait;
    g_frame_metrics_ring[g_metrics_index].total_us = t_post_tx - t_frame_start;
    g_frame_metrics_ring[g_metrics_index].pattern_id = g_current_pattern_index;

    // Heap snapshot every 10 frames (reduced frequency)
    if ((FRAMES_COUNTED % 10) == 0) {
        g_frame_metrics_ring[g_metrics_index].heap_free_bytes =
            heap_caps_get_free_size(MALLOC_CAP_DEFAULT);
    }

    g_metrics_index = (g_metrics_index + 1) % METRICS_RING_SIZE;

    // === FRAME SYNC ===
    uint32_t elapsed_us = micros() - t_frame_start;
    uint32_t frame_budget_us = (1000000 + FRAME_RATE - 1) / FRAME_RATE;  // 33,333 µs @ 30 FPS
    if (elapsed_us < frame_budget_us) {
        delayMicroseconds(frame_budget_us - elapsed_us);
    }

    heartbeat_logger_poll();
}
```

**File: `firmware/src/webserver.cpp` (diagnostics endpoint)**

```cpp
// Add new REST endpoint to expose metrics

void handle_metrics_json(AsyncWebServerRequest* req) {
    // Gather recent statistics
    struct MetricsSnapshot {
        uint32_t avg_render_us;
        uint32_t max_render_us;
        uint32_t avg_total_us;
        uint32_t fps;
        uint32_t heap_min_bytes;
        uint32_t heap_max_bytes;
        float fps_variance;
    } snap = {};

    // Compute from ring buffer
    uint64_t sum_render = 0, sum_total = 0;
    uint32_t min_heap = 0xFFFFFFFFu, max_heap = 0;
    uint32_t max_render = 0;

    for (size_t i = 0; i < METRICS_RING_SIZE; i++) {
        const FrameMetrics& m = g_frame_metrics_ring[i];
        sum_render += m.render_us;
        sum_total += m.total_us;
        max_render = (m.render_us > max_render) ? m.render_us : max_render;

        if (m.heap_free_bytes > 0) {
            min_heap = (m.heap_free_bytes < min_heap) ? m.heap_free_bytes : min_heap;
            max_heap = (m.heap_free_bytes > max_heap) ? m.heap_free_bytes : max_heap;
        }
    }

    snap.avg_render_us = sum_render / METRICS_RING_SIZE;
    snap.max_render_us = max_render;
    snap.avg_total_us = sum_total / METRICS_RING_SIZE;
    snap.fps = (1000000 + snap.avg_total_us - 1) / snap.avg_total_us;
    snap.heap_min_bytes = (min_heap == 0xFFFFFFFFu) ? 0 : min_heap;
    snap.heap_max_bytes = max_heap;

    // Variance (simple: max deviation)
    uint32_t max_deviation = (snap.avg_total_us > snap.avg_render_us) ?
        snap.avg_total_us - snap.avg_render_us : snap.avg_render_us - snap.avg_total_us;
    snap.fps_variance = (max_deviation * 100.0f) / snap.avg_total_us;

    // Serialize to JSON
    String json = "{";
    json += "\"metrics\":{";
    json += "\"render_us_avg\":" + String(snap.avg_render_us) + ",";
    json += "\"render_us_max\":" + String(snap.max_render_us) + ",";
    json += "\"total_us_avg\":" + String(snap.avg_total_us) + ",";
    json += "\"fps\":" + String(snap.fps) + ",";
    json += "\"heap_min_kb\":" + String(snap.heap_min_bytes / 1024) + ",";
    json += "\"heap_max_kb\":" + String(snap.heap_max_bytes / 1024) + ",";
    json += "\"fps_variance_percent\":" + String(snap.fps_variance) + "";
    json += "}}\n";

    req->send(200, "application/json", json);
}

// Register endpoint in init_webserver()
server.on("/api/metrics", HTTP_GET, handle_metrics_json);
```

### 4.3 Integration with Existing Infrastructure

**Existing Profiling (profiling.h):**
- Use `PROFILE_SECTION()` for function-level timing
- Extend stats pool from 32 to 64 sections if needed
- Call `ProfileScope::print_all_stats()` on demand

**Existing Heartbeat Logger:**
- Add 4 new fields to HeartbeatEntry struct:
  ```cpp
  uint32_t avg_render_us;   // Most recent interval average
  uint32_t max_render_us;   // Peak in interval
  uint32_t avg_total_us;    // Total frame time
  uint32_t heap_min_bytes;  // Min free heap in interval
  ```
- Compute every heartbeat poll (1 Hz)

**Existing RMT Probe:**
- Already measures max gap and refill count
- Add to heartbeat entry (already implemented)
- Validate max_gap_us < 100 µs in acceptance tests

---

## PART 5: BENCHMARK SUITE DESIGN

### 5.1 Representative Test Patterns (3–5 Patterns)

**Selection Criteria:**
- Diversity of graph complexity (simple, moderate, complex)
- Audio reactivity levels (static, beat-synced, spectrum-driven)
- Memory pressure (light, moderate, heavy)

**Benchmark Patterns:**

#### Pattern 1: Static Gradient (Baseline)
**Complexity:** Simple (constant-time)
**Nodes:** 5–8 (color fill + quantize)
**Memory:** <1 KB state
**Expected FPS:** 45+ (headroom test)

```cpp
// Pseudo-code
float phase = frame_count / 30.0f;
float hue = fmod(phase, 1.0f);
CRGBF color = hsv_to_rgb(hue, 0.8f, 1.0f);
fill_buffer(out, color, NUM_LEDS);
```

**Rationale:** Validate baseline performance (no audio, no memory overhead)

#### Pattern 2: Spectrum Visualization (Moderate)
**Complexity:** Moderate (spectrum aggregation + rendering)
**Nodes:** 20–25 (band aggregators, spectrum gradient, quantize)
**Memory:** ~3 KB state (filter buffers, gradient tables)
**Expected FPS:** 32–35

```cpp
// Pseudo-code
for (i = 0; i < NUM_LEDS; i++) {
    float freq = audio.spectrum[map(i, 0, NUM_LEDS, 0, 256)];
    CRGBF color = gradient_map(freq, palette, 256);
    out[i] = color;
}
```

**Rationale:** Typical single-feature pattern, audio-driven

#### Pattern 3: Bloom Effect (Complex)
**Complexity:** High (multiple buffers, layers, blur)
**Nodes:** 40+ (beat envelope, blur, persist, compose layers)
**Memory:** ~12 KB state (persistent buffer + filter states)
**Expected FPS:** 28–32

```cpp
// Pseudo-code
float beat = audio.envelope;
// Layer 1: spectrum
for (i = 0; i < NUM_LEDS; i++) {
    out[i] = gradient_map(audio.spectrum[i], palette1, 256);
}
// Layer 2: beat bloom (persistent)
if (beat > 0.5f) {
    bloom_center = NUM_LEDS / 2;
    for (r = 1; r < 20; r++) {
        intensity = beat * exp(-r / 5.0f);
        out[bloom_center + r] += intensity * peak_color;
    }
}
// Layer 3: blur
blur_buffer(out, temp, 4);
```

**Rationale:** Maximum complexity, memory-heavy, tests state overhead

#### Pattern 4: Perlin Noise (Baseline Comparison)
**Complexity:** Moderate (RNG + filtering)
**Nodes:** 15–20 (noise gen, lowpass filter, color map)
**Memory:** ~2 KB state (filter ring buffer)
**Expected FPS:** 35–40

```cpp
// Pseudo-code
for (i = 0; i < NUM_LEDS; i++) {
    float noise = perlin_noise_1d(i + phase, 12345, 0.05f);
    noise = lowpass_filter(noise, 0.3f);
    out[i] = hsv_to_rgb(noise, 0.7f, 0.8f);
}
```

**Rationale:** Deterministic RNG behavior, non-audio pattern

#### Pattern 5: Idle/Silent (Stress)
**Complexity:** Minimal (no computation)
**Nodes:** 2–3 (fill black, output)
**Memory:** <512 B
**Expected FPS:** 60+ (upper bound test)

```cpp
// Pseudo-code
fill_buffer(out, {0, 0, 0}, NUM_LEDS);
```

**Rationale:** Verify no regressions in idle path, measure framework overhead

### 5.2 Test Harness Implementation

**File: `firmware/test/test_graph_profiling.cpp`**

```cpp
#include <unity.h>
#include "profiler.h"
#include "led_driver.h"
#include "pattern_registry.h"

// Forward declare generated pattern functions
extern void pattern_gradient_render(uint32_t, const AudioDataSnapshot&,
                                     const PatternParameters&, PatternState&, PatternOutput&);
extern void pattern_spectrum_render(uint32_t, const AudioDataSnapshot&,
                                     const PatternParameters&, PatternState&, PatternOutput&);
extern void pattern_bloom_render(uint32_t, const AudioDataSnapshot&,
                                 const PatternParameters&, PatternState&, PatternOutput&);

// Test data (constant, replay during test)
static AudioDataSnapshot test_audio_snapshot = {
    .vu_level = 0.5f,
    .vu_level_raw = 0.6f,
    .envelope = 0.7f,
    .spectrum = { /* 256 values from real capture */ },
    .beat_detected = true
};

void test_pattern_gradient_fps() {
    PatternState state;
    PatternOutput out;
    PatternParameters params = get_params();

    const int NUM_FRAMES = 1000;  // ~33 sec @ 30 FPS
    ProfileScope::reset_all();

    uint32_t frame_times[NUM_FRAMES];

    for (int i = 0; i < NUM_FRAMES; i++) {
        uint32_t t0 = micros();
        pattern_gradient_render(i, test_audio_snapshot, params, state, out);
        uint32_t t1 = micros();
        frame_times[i] = t1 - t0;
    }

    // Analyze results
    uint32_t sum = 0, max = 0, min = 0xFFFFFFFFu;
    for (int i = 0; i < NUM_FRAMES; i++) {
        sum += frame_times[i];
        max = (frame_times[i] > max) ? frame_times[i] : max;
        min = (frame_times[i] < min) ? frame_times[i] : min;
    }
    uint32_t avg = sum / NUM_FRAMES;

    // FPS = 1,000,000 µs/s / avg_frame_us
    float fps = 1000000.0f / avg;

    // Acceptance
    TEST_ASSERT_GREATER_THAN(28.0f, fps);  // ≥28 FPS
    TEST_ASSERT_LESS_THAN(10000, max);  // <10ms max

    printf("Pattern Gradient: avg=%u µs, max=%u µs, min=%u µs, FPS=%.1f\n",
           avg, max, min, fps);
}

void test_pattern_spectrum_fps() {
    // Similar structure, substitute pattern_spectrum_render
    // Expected: 32–35 FPS
}

void test_pattern_bloom_fps() {
    // Similar structure, substitute pattern_bloom_render
    // Expected: 28–32 FPS (must not drop below 28)
}

void setUp() {
    ProfileScope::reset_all();
    // Initialize audio snapshot from pre-recorded data
}

void tearDown() {
    ProfileScope::print_all_stats();
}
```

**Build & Run:**
```bash
pio test -e esp32-s3-devkitc-1 test_graph_profiling.cpp
```

### 5.3 Regression Detection Framework

**Strategy:** Establish baseline, track deltas per build

**File: `tools/performance_baseline.json`** (version control)

```json
{
  "baseline_date": "2025-11-15T12:00:00Z",
  "patterns": {
    "gradient": {
      "fps": 45.0,
      "render_us": 120,
      "quantize_us": 80,
      "max_frame_us": 8000,
      "heap_state_bytes": 512
    },
    "spectrum": {
      "fps": 33.5,
      "render_us": 2800,
      "quantize_us": 90,
      "max_frame_us": 18000,
      "heap_state_bytes": 3072
    },
    "bloom": {
      "fps": 30.2,
      "render_us": 8500,
      "quantize_us": 95,
      "max_frame_us": 22000,
      "heap_state_bytes": 12288
    }
  },
  "rmt_probe": {
    "max_gap_us": 45,
    "refill_count_30s": 900
  },
  "heap": {
    "min_free_bytes": 204800,
    "fragmentation_percent": 8
  }
}
```

**CI Integration (GitHub Actions):**

```yaml
# .github/workflows/performance-regression.yml
name: Performance Regression Check

on: [push, pull_request]

jobs:
  profile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build firmware (debug telemetry)
        run: |
          cd firmware
          pio run -e esp32-s3-devkitc-1-debug

      - name: Run profiling tests
        run: |
          cd firmware
          pio test -e esp32-s3-devkitc-1 test_graph_profiling.cpp

      - name: Compare against baseline
        run: |
          python3 tools/compare_performance.py \
            --baseline tools/performance_baseline.json \
            --current firmware/.pio/build/esp32-s3-devkitc-1/metrics.json \
            --tolerance 5%  # Allow 5% variance

      - name: Fail if regression >5%
        if: failure()
        run: exit 1
```

---

## PART 6: DATA COLLECTION & ANALYSIS

### 6.1 Collection Methodology

**On-Device (Real-Time):**
- Heartbeat logger: 1 entry/sec for 30 sec → 30 entries
- Ring buffer metrics: 256 frame entries (≈8.5 sec @ 30 FPS)
- Accumulated timers: Per-frame via profiling.h

**Extraction (After Test Run):**

```bash
# Download heartbeat log from device
curl -X GET http://k1.local/api/heartbeat_recent > heartbeat.txt

# Download metrics endpoint
curl -X GET http://k1.local/api/metrics > metrics.json

# Extract FPS from profiling output (serial monitor)
picocom /dev/ttyUSB0 --baud=2000000 | grep "PROFILING STATISTICS" -A 20 | tee profile.log
```

### 6.2 Analysis Workflow

**Step 1: Parse Data**

```python
import json
import csv

# Load heartbeat
with open('heartbeat.txt') as f:
    heartbeat = [line.strip() for line in f if line.startswith('t=')]

# Load metrics
with open('metrics.json') as f:
    metrics = json.load(f)

# Parse heartbeat entries
frames = []
for entry in heartbeat:
    parts = entry.split()
    data = {k.split('=')[0]: float(k.split('=')[1])
            for k in parts if '=' in k}
    frames.append(data)
```

**Step 2: Compute Aggregates**

```python
# FPS calculation
frame_deltas = [f['frame_delta'] for f in frames]
fps_samples = [fd * 1 for fd in frame_deltas]  # 1 Hz, each frame_delta ≈ 30 frames
avg_fps = sum(fps_samples) / len(fps_samples)
min_fps = min(fps_samples)
max_fps = max(fps_samples)

# RMT analysis
rmt_gaps_ch1 = [f['rmt_maxgap_us_ch1'] for f in frames]
rmt_gaps_ch2 = [f['rmt_maxgap_us_ch2'] for f in frames]
max_gap = max(max(rmt_gaps_ch1), max(rmt_gaps_ch2))

# Heap trend
heap_samples = [int(h) for h in metrics.get('heap_samples', []) if h > 0]
min_heap = min(heap_samples)
avg_heap = sum(heap_samples) / len(heap_samples)

# RMT refill stability
refill_ch1 = [f['rmt_empty_ch1'] for f in frames]
refill_ch2 = [f['rmt_empty_ch2'] for f in frames]
refill_rate = (refill_ch1[-1] - refill_ch1[0]) / len(frames)  # refills/sec
```

**Step 3: Validation Report**

```python
report = {
    "timestamp": datetime.now().isoformat(),
    "test_name": "pattern_spectrum",
    "duration_sec": len(frames),
    "performance": {
        "fps_avg": round(avg_fps, 1),
        "fps_min": round(min_fps, 1),
        "fps_max": round(max_fps, 1),
        "fps_target": 30,
        "fps_meets_target": avg_fps >= 28,  # 2 FPS margin
    },
    "memory": {
        "heap_min_bytes": min_heap,
        "heap_avg_bytes": int(avg_heap),
        "heap_target": 200000,
        "heap_meets_target": min_heap >= 200000,
    },
    "rmt_stability": {
        "max_gap_us": max_gap,
        "target_max_us": 100,
        "meets_target": max_gap <= 100,
        "refill_rate_hz": refill_rate,
    },
    "verdict": "PASS" if all([...]) else "FAIL",
}

print(json.dumps(report, indent=2))
```

### 6.3 Acceptance Criteria Decision Matrix

| Metric | Target | Good | Marginal | Fail |
|--------|--------|------|----------|------|
| **FPS avg** | 30 | ≥30 | 28–29.9 | <28 |
| **FPS min** | 28 | ≥28 | 26–27.9 | <26 |
| **Heap min** | 200 KB | ≥200 KB | 190–199 KB | <190 KB |
| **Max RMT gap** | <100 µs | <50 µs | 50–100 µs | >100 µs |
| **Render stability** | ±5% | ±3% | ±3–5% | >±5% |

**Decision Logic:**
```
GO: All metrics in "Good" column
MARGINAL: ≤2 metrics in "Marginal", rest "Good"
NO-GO: Any metric in "Fail" OR >2 in "Marginal"
```

---

## PART 7: GENERATED vs HAND-WRITTEN COMPARISON

### 7.1 Comparison Framework

**Methodology:** Back-to-back execution with identical audio input

**Patterns to Compare:**

| Generated | Hand-Written | Purpose |
|-----------|--------------|---------|
| Bloom (codegen) | bloom_spectrum_bloom() | Complex, memory-intensive |
| Spectrum (codegen) | spectrum_analyzer() | Moderate, typical |
| Gradient (codegen) | pattern_gradient() | Simple, baseline |

### 7.2 Test Harness

**File: `firmware/test/test_generated_vs_handwritten.cpp`**

```cpp
void test_bloom_codegen_vs_handwritten() {
    const int NUM_FRAMES = 1000;

    PatternState state_codegen, state_handwritten;
    PatternOutput out_codegen, out_handwritten;
    PatternParameters params = get_params();

    // Pre-record audio (constant for both)
    AudioDataSnapshot test_audio[NUM_FRAMES];
    for (int i = 0; i < NUM_FRAMES; i++) {
        test_audio[i] = generate_test_audio(i);  // Deterministic
    }

    uint32_t times_codegen[NUM_FRAMES];
    uint32_t times_handwritten[NUM_FRAMES];

    // Run codegen version
    for (int i = 0; i < NUM_FRAMES; i++) {
        uint32_t t0 = micros();
        pattern_bloom_render(i, test_audio[i], params, state_codegen, out_codegen);
        times_codegen[i] = micros() - t0;
    }

    // Run hand-written version
    for (int i = 0; i < NUM_FRAMES; i++) {
        uint32_t t0 = micros();
        bloom_spectrum_bloom(i, test_audio[i], params, state_handwritten, out_handwritten);
        times_handwritten[i] = micros() - t0;
    }

    // Compute statistics
    uint32_t avg_codegen = mean(times_codegen, NUM_FRAMES);
    uint32_t avg_handwritten = mean(times_handwritten, NUM_FRAMES);

    float delta_percent = abs(avg_codegen - avg_handwritten) * 100.0f / avg_handwritten;
    float fps_codegen = 1000000.0f / avg_codegen;
    float fps_handwritten = 1000000.0f / avg_handwritten;

    printf("Bloom Pattern Comparison:\n");
    printf("  Codegen:       %.1f FPS (avg %u µs)\n", fps_codegen, avg_codegen);
    printf("  Hand-written:  %.1f FPS (avg %u µs)\n", fps_handwritten, avg_handwritten);
    printf("  Delta:         %.1f%% (%s)\n",
           delta_percent,
           delta_percent <= 2.0f ? "PASS" : "FAIL");

    // Acceptance: Codegen ≤ 2% slower
    TEST_ASSERT_LESS_THAN(2.0f, delta_percent);

    // Validate output equivalence (optional, for correctness)
    for (int i = 0; i < NUM_LEDS; i++) {
        float error = abs(out_codegen.leds[i].r - out_handwritten.leds[i].r);
        TEST_ASSERT_LESS_THAN(0.01f, error);  // <1% color error
    }
}
```

### 7.3 Performance Delta Reporting

**Expected Results:**

| Pattern | Hand-Written FPS | Codegen FPS | Delta | Verdict |
|---------|------------------|-------------|-------|---------|
| **Gradient** | 45 | 44 | -2.2% | PASS |
| **Spectrum** | 33 | 32.5 | -1.5% | PASS |
| **Bloom** | 30.5 | 29.8 | -2.3% | PASS |

**Acceptable Range:** Codegen ≤ 2% slower than hand-written (compiler room for improvement)

---

## PART 8: CONTINUOUS MONITORING & REGRESSION PREVENTION

### 8.1 Build-Time Profiling in CI

**GitHub Actions Workflow:**

```yaml
name: Build & Profile

on: [push, pull_request, schedule: {cron: '0 12 * * *'}]

jobs:
  profile:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        pattern: [gradient, spectrum, bloom]

    steps:
      - uses: actions/checkout@v3
      - uses: esp-rs/esp-idf-template@main

      - name: Build firmware with DEBUG_TELEMETRY
        run: |
          cd firmware
          pio run -e esp32-s3-devkitc-1-debug \
            -DDEBUG_TELEMETRY=1

      - name: Extract metrics from build
        run: |
          python3 tools/extract_firmware_metrics.py \
            firmware/.pio/build/esp32-s3-devkitc-1/firmware.elf \
            > build_metrics.json

      - name: Validate metrics
        run: |
          python3 tools/validate_metrics.py \
            --metrics build_metrics.json \
            --pattern ${{ matrix.pattern }} \
            --baseline tools/performance_baseline.json

      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: profiling-${{ matrix.pattern }}
          path: |
            build_metrics.json
            validation_report.txt
```

### 8.2 Regression Detection Criteria

**Trigger NO-GO if:**
1. Any pattern FPS <28 (below 30 FPS target with 2 FPS margin)
2. Heap usage <190 KB (below 200 KB target with 10 KB margin)
3. RMT max gap >150 µs (above 100 µs target with 50 µs margin)
4. Render variance >±10% (indicating non-determinism)

### 8.3 Monthly Performance Review

**Template: `docs/09-reports/K1NReport_PERFORMANCE_MONTHLY_v1.0_YYYY-MM.md`**

```markdown
# K1.node1 Monthly Performance Report (YYYY-MM)

## Summary
- Total tests run: 150
- Regressions detected: 0
- Patterns profiled: 5
- Baseline stability: ±1% (excellent)

## Performance Trend (FPS)
| Month | Gradient | Spectrum | Bloom | Avg |
|-------|----------|----------|-------|-----|
| Oct   | 45.2     | 33.5     | 30.1  | 36.3|
| Nov   | 45.1     | 33.6     | 30.2  | 36.3|
| Δ%    | -0.2%    | +0.3%    | +0.3% | ±0% |

## Action Items
- None (all metrics stable)
```

---

## PART 9: RISK ASSESSMENT & MITIGATION

### 9.1 Profiling Infrastructure Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| **Probe overhead regresses FPS** | 15% | -1–2 FPS | Measure baseline without probes, validate <50 µs overhead |
| **Heartbeat logger blocks render** | 10% | jitter | Use non-blocking I/O, defer SPIFFS writes to background task |
| **RMT probe callback crashes** | 5% | NO-GO | Extensive ISR testing, atomic ops only |
| **Heap monitoring inaccurate** | 20% | false negatives | Validate with known allocations, compare to ESP IDF tools |

### 9.2 Benchmark Design Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| **Test audio data unrepresentative** | 25% | invalid baseline | Use real capture from 3+ songs, verify spectrum coverage |
| **Codegen patterns don't compile** | 10% | NO-GO | Dry-run codegen on all 5 patterns before profiling |
| **Generated output differs from reference** | 15% | validation failure | Implement CRC check, fuzzy color matching |

### 9.3 Decision Gate Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| **Acceptance criteria too strict** | 30% | false NO-GO | Review criteria with team (Nov 12), document rationale |
| **Environmental variance masks true issues** | 20% | uncertain verdict | Run 3+ times, report ranges, not point estimates |
| **Stakeholder disagreement on verdict** | 15% | blocked hand-off | Establish decision criteria document (this spec), sign-off pre-Task10 |

---

## PART 10: TOOLING & INFRASTRUCTURE

### 10.1 Required Tools

**On Device:**
- Firmware with profiling.h instrumentation (already present)
- Heartbeat logger (already present)
- RMT probe (already present)
- REST endpoints for metrics export (NEW)

**Host-Side:**
- Python 3.9+ (json, csv, statistics)
- `requests` library (data download)
- `matplotlib` (optional, visualization)
- Git (baseline tracking)

**Installation:**
```bash
pip install requests matplotlib numpy
```

### 10.2 Script Suite

**File: `tools/collect_performance_data.py`**

```python
#!/usr/bin/env python3
import requests
import json
import sys
import time
from datetime import datetime

def collect_metrics(device_url, test_duration_sec=30):
    """Download metrics from device via REST API."""

    print(f"Connecting to {device_url}...")

    # Download recent heartbeat data
    resp = requests.get(f"{device_url}/api/heartbeat_recent", timeout=5)
    if resp.status_code != 200:
        print(f"ERROR: Failed to get heartbeat data ({resp.status_code})")
        return None

    heartbeat_lines = resp.text.strip().split('\n')

    # Download metrics snapshot
    resp = requests.get(f"{device_url}/api/metrics", timeout=5)
    if resp.status_code != 200:
        print(f"ERROR: Failed to get metrics ({resp.status_code})")
        return None

    metrics = resp.json()

    # Package result
    data = {
        "timestamp": datetime.now().isoformat(),
        "device_url": device_url,
        "heartbeat": heartbeat_lines,
        "metrics": metrics,
    }

    return data

def save_results(data, filename):
    """Save collected data to file."""
    with open(filename, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"Saved to {filename}")

if __name__ == "__main__":
    device_url = sys.argv[1] if len(sys.argv) > 1 else "http://k1.local"
    output_file = sys.argv[2] if len(sys.argv) > 2 else f"metrics_{datetime.now().isoformat()}.json"

    data = collect_metrics(device_url)
    if data:
        save_results(data, output_file)
        print(f"✓ Data collection complete")
    else:
        print("✗ Data collection failed")
        sys.exit(1)
```

**File: `tools/analyze_performance.py`**

```python
#!/usr/bin/env python3
import json
import statistics
import sys

def analyze(metrics_file, baseline_file=None):
    """Analyze metrics and compare to baseline."""

    with open(metrics_file) as f:
        data = json.load(f)

    metrics = data['metrics']

    # Extract KPIs
    fps = metrics['fps']
    heap_min_kb = metrics['heap_min_kb']
    render_avg_us = metrics['render_us_avg']

    print("=" * 60)
    print("PERFORMANCE ANALYSIS")
    print("=" * 60)
    print(f"FPS:              {fps:.1f} (target: 30)")
    print(f"Heap min:         {heap_min_kb} KB (target: 200)")
    print(f"Render avg:       {render_avg_us} µs (budget: 10000)")
    print()

    # Pass/fail
    fps_pass = fps >= 28
    heap_pass = heap_min_kb >= 190
    render_pass = render_avg_us <= 10000

    verdict = "PASS" if all([fps_pass, heap_pass, render_pass]) else "FAIL"

    print(f"Verdict:          {verdict}")
    print("=" * 60)

    return verdict == "PASS"

if __name__ == "__main__":
    metrics_file = sys.argv[1] if len(sys.argv) > 1 else "metrics.json"
    baseline_file = sys.argv[2] if len(sys.argv) > 2 else None

    if analyze(metrics_file, baseline_file):
        sys.exit(0)
    else:
        sys.exit(1)
```

### 10.3 Directory Structure

```
firmware/
├── src/
│   ├── main.cpp                          (profiling instrumentation added)
│   ├── profiling.h                       (unchanged)
│   ├── profiler.h                        (unchanged)
│   ├── diagnostics/
│   │   ├── heartbeat_logger.cpp          (unchanged)
│   │   ├── rmt_probe.cpp                 (unchanged)
│   │   └── rmt_probe.h                   (unchanged)
│   └── webserver.cpp                     (new /api/metrics endpoint)
├── test/
│   └── test_graph_profiling.cpp          (new benchmark suite)
└── .pio/
    └── build/esp32-s3-devkitc-1/
        └── metrics.json                  (generated by CI)

tools/
├── collect_performance_data.py           (new)
├── analyze_performance.py                (new)
├── extract_firmware_metrics.py           (new)
├── validate_metrics.py                   (new)
├── compare_performance.py                (new)
└── performance_baseline.json             (version-controlled)

docs/
└── 09-implementation/
    ├── K1NImpl_GRAPH_PROFILING_STRATEGY_TASK10_v1.0_20251110.md  (this document)
    └── K1NImpl_PROFILING_DATA_ANALYSIS_GUIDE.md                   (new)
```

---

## PART 11: ACCEPTANCE CRITERIA (Task 10 Completion)

### 11.1 Deliverables Checklist

- [x] **Profiling Specification** — This document (Part 1–10)
- [ ] **Instrumentation Code** — Probes added to main.cpp, webserver.cpp (Part 4)
- [ ] **Benchmark Suite** — 5 test patterns, test harness (Part 5)
- [ ] **Data Collection Scripts** — Python tools for extraction & analysis (Part 10)
- [ ] **Baseline Metrics** — Measured on hardware, stored in git (Part 6)
- [ ] **Regression Detection Framework** — CI workflow + decision matrix (Part 8)
- [ ] **Generated vs Hand-Written Comparison** — Back-to-back test results (Part 7)
- [ ] **Documentation** — Profiling guide, runbook, troubleshooting (implicitly linked)

### 11.2 Acceptance Gates

**Before Hand-Off to Task 18 (Integration Testing):**

1. ✅ **All 5 benchmark patterns run without crash**
   - Gradient, Spectrum, Bloom, Perlin Noise, Idle
   - Proof: Test log showing PASS for all 5

2. ✅ **FPS meets target across all patterns**
   - Gradient: ≥40 FPS
   - Spectrum: ≥32 FPS
   - Bloom: ≥28 FPS (at margin)
   - Perlin: ≥35 FPS
   - Idle: ≥50 FPS

3. ✅ **Heap remains above 190 KB minimum**
   - Proof: heartbeat logs showing heap_free > 190 KB continuously

4. ✅ **RMT stability: max gap <150 µs**
   - Proof: RMT probe data showing max_gap_us < 150 per both channels

5. ✅ **Generated patterns ≤2% slower than hand-written**
   - Bloom: FPS delta ≤2%
   - Spectrum: FPS delta ≤2%

6. ✅ **CI regression detection active**
   - GitHub Actions workflow enabled
   - Baseline locked in `tools/performance_baseline.json`
   - Daily runs pass without regression

7. ✅ **Documentation complete**
   - Profiling runbook written
   - Data analysis guide written
   - Troubleshooting FAQ written

---

## APPENDIX A: GLOSSARY

| Term | Definition |
|------|-----------|
| **Heartbeat Entry** | Single data point (timestamp, FPS, heap, stalls) logged every ~1 sec |
| **Frame Metrics Ring** | Circular buffer (256 entries) of per-frame timing data |
| **RMT Probe** | ISR-attached callbacks measuring LED transmission gaps |
| **Render Budget** | Time allocated per frame for pattern execution (~10 ms @ 30 FPS) |
| **Scratch Buffer** | Temporary LED buffer allocated per frame, deallocated after quantize |
| **Persistent State** | Pattern state surviving across frame boundaries (e.g., filter history) |
| **Codegen** | Code generated by k1c compiler (pattern_*.cpp) |
| **Hand-Written** | Manually-coded reference patterns (bloom_spectrum_bloom, etc.) |

---

## APPENDIX B: REFERENCE DOCUMENTS

- **Architecture:** `docs/01-architecture/K1NArch_SPEC_LUT_SYSTEM_ARCHITECTURE_v1.0_20251108.md`
- **Risk Assessment:** `docs/05-analysis/K1NAnalysis_RISK_SUMMARY_EXECUTIVE_v1.0_20251110.md`
- **Roadmap:** `docs/04-planning/K1NPlan_TASK_ROADMAP_CORRECTED_v1.0_20251110.md`
- **Node Analysis:** `docs/09-implementation/K1NImpl_ANALYSIS_EXECUTIVE_SUMMARY_39_NODES_20251110.md`

---

## APPENDIX C: ACKNOWLEDGMENTS & SIGN-OFF

**Document Owner:** Performance Engineering
**Last Updated:** November 10, 2025
**Stakeholder Review:** Pending (Nov 12 pre-Task-5 review)
**Approved By:** [TBD]

**Next Steps:**
1. Review & sign-off (Nov 11–12)
2. Implement instrumentation (Task 10, Day 1–2)
3. Collect baseline metrics (Task 10, Day 2–3)
4. Validate against targets (Task 10, Day 3)
5. Hand off to Task 18 (Nov 19)

---

**END OF DOCUMENT**
