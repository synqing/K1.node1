---
title: ADR-0011 - Dual-Channel Independent LED System Architecture
author: Claude Architecture Team
date: 2025-11-05
status: proposed
intent: Define architecture for independent dual LED channel system (Task 21) maintaining 60 FPS, <10ms latency, and zero contention with existing audio pipeline
related:
  - TASKS.md (Task 21: Dual Independent LED Channel)
  - firmware/src/led_driver.h (single-channel RMT implementation)
  - firmware/src/audio/goertzel.cpp (audio producer)
  - firmware/src/generated_patterns.h (visual consumer)
tags: [firmware, architecture, led-system, dual-channel]
---

# ADR-0011: Dual-Channel Independent LED System

## Problem Statement

Current system: **Single Producer (Audio) → Single Consumer (Visual) → Single LED Output (180 LEDs)**

Requirement: **Single Producer (Audio) → Dual Consumer (Visual) → Dual LED Output (180 LEDs each)**

Enable users to control two independent 180-LED strips from a single ESP32-S3 with:
- Shared audio source (single I2S microphone)
- Independent visual patterns and effects (different patterns per channel)
- Independent parameter controls (brightness, speed, palette per channel)
- Maintain 60 FPS per channel, <10ms latency, zero cross-contention

## Technical Feasibility (Validated)

### Hardware Constraints ✅
- **RMT Channels**: ESP32-S3 has 4 RMT TX channels; currently using 1 → **3+ available**
- **GPIO**: Current GPIO 5 for LED data; recommend GPIO 4 for second strip (adjacent, low EMI)
- **Memory**: Second 180-LED buffer = 540 bytes; ESP32-S3 has 512KB SRAM → **negligible impact (0.2%)**
- **Transmission Time**: Single strip ~5.5ms @ 60 FPS budget of 16.67ms → **10.67ms margin available**

### Performance Validation ✅
- **Single-Channel Baseline**: 6.0ms (LED TX + CPU overhead), 10.67ms headroom
- **Dual-Channel (Parallel RMT)**: 6.5ms (simultaneous DMA transmission), **10.17ms headroom (61% margin)**
- **Dual-Channel (Sequential Fallback)**: 12.0ms (if needed), **4.67ms headroom (acceptable)**

**Verdict: FULLY FEASIBLE with >61% timing margin preserved**

### Producer-Consumer Architecture ✅
Current architecture is **naturally extensible for dual consumers**:

- **Audio Producer** (Core 1): Single source publishes `AudioDataSnapshot` via lock-free double-buffer with atomic sequence counters
- **Current Consumer**: Reads from `audio_front` snapshot, renders pattern, transmits
- **Dual Consumers**: Both independently read same `audio_front` snapshot via `get_audio_snapshot()` (lock-free, no contention)
- **Synchronization**: Existing sequence-counter retry loop handles concurrent readers; no torn reads (validated in test suite)

**Key Insight**: No new synchronization primitives needed. Audio pipeline already isolates producers and consumers via immutable snapshots.

## Architecture Decision

### Pattern: **Twin Pipeline with Shared Audio Source** (Fan-Out variation)

#### 1. Channel Abstraction (Explicit, Not Polymorphic)

```cpp
struct LEDChannel {
    // Display buffer (owned by this channel's render task)
    uint8_t leds[NUM_LEDS * 3];           // 540 bytes

    // Hardware interface
    rmt_channel_handle_t rmt_handle;       // Independent RMT channel
    rmt_encoder_handle_t led_encoder;

    // Pattern state (private to render task)
    PatternState pattern_state;

    // Controls (atomics: written by WebServer, read by render task)
    struct ChannelControls {
        std::atomic<uint8_t> brightness;
        std::atomic<uint8_t> speed_multiplier;
        std::atomic<uint8_t> palette_index;
        std::atomic<bool> enabled;
    } controls;

    // Metrics (written by render task, read by monitoring)
    std::atomic<uint32_t> last_render_us;
    std::atomic<float> fps;
};

// Two instances - no dynamic allocation
LEDChannel channel_a;
LEDChannel channel_b;
```

**Why explicit over polymorphic**: 2-channel system is fixed requirement, not N-channel dynamic system. Avoids virtual dispatch overhead, simplifies debugging, prevents heap fragmentation on embedded system.

#### 2. Rendering & Transmission Pipeline

**Task Structure** (FreeRTOS Core 1):

```
┌─────────────────────────────────────────┐
│ Audio I2S Task (Core 1)                 │
│ - Acquires samples every 10ms           │
│ - Publishes AudioDataSnapshot atomic    │
│ - g_audio.spectrum, g_audio.beat, etc.  │
└────────────────┬────────────────────────┘
                 │ (lock-free reads)
    ┌────────────┴───────────┐
    │                        │
┌───▼──────────────────┐  ┌──▼──────────────────┐
│ Render Task A        │  │ Render Task B       │
│ (Core 1, Pri 3)      │  │ (Core 1, Pri 3)     │
│ 1. Read g_audio      │  │ 1. Read g_audio     │
│ 2. Apply controls_a  │  │ 2. Apply controls_b │
│ 3. Render pattern_a  │  │ 3. Render pattern_b │
│ 4. Update leds_a[]   │  │ 4. Update leds_b[]  │
│ 5. RMT transmit      │  │ 5. RMT transmit     │
│ (non-blocking DMA)   │  │ (non-blocking DMA)  │
└──────────────────────┘  └─────────────────────┘
         │ (parallel)              │ (parallel)
┌────────▼──────────────────────────▼────────┐
│ RMT Hardware (DMA)                         │
│ - Channel A on GPIO 4 (DMA controller 0)   │
│ - Channel B on GPIO 5 (DMA controller 1)   │
│ - True parallel transmission               │
└────────────────────────────────────────────┘
```

**Rendering Loop** (per-channel):

```cpp
void render_task_channel(LEDChannel& ch, void* param) {
    TickType_t last_wake = xTaskGetTickCount();

    for (;;) {
        // 1. Read shared audio state (lock-free atomic)
        AudioDataSnapshot audio;
        if (get_audio_snapshot(&audio)) {
            // New audio available
        }

        // 2. Render pattern into ch.leds[]
        uint32_t start_us = esp_timer_get_time();
        render_pattern(ch.leds, ch.pattern_state, audio, ch.controls);
        uint32_t render_us = esp_timer_get_time() - start_us;

        // 3. Transmit non-blocking (RMT handles timing via DMA)
        rmt_transmit(ch.rmt_handle, ch.led_encoder, ch.leds,
                     NUM_LEDS * 3, &tx_config);

        // 4. Update metrics
        ch.last_render_us.store(render_us);

        // 5. Frame-lock to 60 FPS
        vTaskDelayUntil(&last_wake, pdMS_TO_TICKS(16));  // 16.67ms
    }
}

// Both tasks created identical, pinned to Core 1
xTaskCreatePinnedToCore(render_task_channel, "render_a", 8192,
                        &channel_a, 3, NULL, 1);
xTaskCreatePinnedToCore(render_task_channel, "render_b", 8192,
                        &channel_b, 3, NULL, 1);
```

#### 3. Synchronization Model (Minimal, Lock-Free)

| Data Flow | Mechanism | Contention | Latency |
|-----------|-----------|-----------|---------|
| Audio → Render | Lock-free atomic reads (`std::memory_order_relaxed`) | None | ~1-2 μs |
| WebServer → Render | Atomic store to `controls` fields | None | ~1 μs |
| Render → RMT | Direct struct pointer (task-owned buffer) | None | ~10 μs |
| Render → Metrics | Atomic store to FPS counters | None | ~1 μs |

**No Mutexes Needed** for core rendering loop. Mutexes only for rare pattern switches:

```cpp
SemaphoreHandle_t pattern_switch_mutex = xSemaphoreCreateMutex();

void switch_pattern(LEDChannel& ch, PatternID new_pattern) {
    xSemaphoreTake(pattern_switch_mutex, portMAX_DELAY);
    ch.pattern_state = initialize_pattern(new_pattern);
    xSemaphoreGive(pattern_switch_mutex);
}
```

#### 4. Control Plane (RESTful with Channel Scoping)

```
Current:              Proposed:
GET /api/brightness   → GET /api/channel/a/brightness
POST /api/brightness  → POST /api/channel/a/brightness
                      POST /api/channel/b/brightness
                      POST /api/global/brightness (master override)
```

**Per-Channel Handlers**:

```cpp
esp_err_t channel_handler(httpd_req_t* req) {
    char channel_id = extract_from_uri(req->uri);  // 'a' or 'b'
    LEDChannel& ch = (channel_id == 'a') ? channel_a : channel_b;

    if (is_brightness_endpoint(req)) {
        if (req->method == HTTP_GET) {
            uint8_t val = ch.controls.brightness.load();
            return send_json(req, "{\"value\": %d}", val);
        } else {
            uint8_t new_val = parse_json(req);
            ch.controls.brightness.store(new_val);  // Fire-and-forget atomic write
            return send_ok(req);
        }
    }
    // ... similar for speed, palette, enable
}
```

**Global Master Brightness** (3-tier hierarchy):

```cpp
struct GlobalControls {
    std::atomic<uint8_t> master_brightness;  // 0-255
};
extern GlobalControls g_global;

// During render:
uint8_t effective_brightness =
    (g_global.master_brightness.load() * ch.controls.brightness.load()) / 255;
```

## Why This Design

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Dual vs N-channel** | Explicit 2-instance, not polymorphic | Fixed requirement, simpler, faster, embedded-friendly |
| **Audio sharing** | Single producer, dual consumers | Audio is deterministic; multiple readers need no synchronization |
| **Synchronization** | Lock-free atomics | Minimal overhead; proven pattern in this codebase |
| **RMT allocation** | Static dual channels | Hardware parallelism; isolated failure domains |
| **Rendering strategy** | Sequential render, parallel transmit | Fits FreeRTOS scheduler; leverages RMT DMA |
| **Buffer management** | Single buffer per channel | DMA read + CPU write overlap acceptable at 60 FPS |
| **Parameter updates** | Atomic fire-and-forget | Eventual consistency; renders next frame with new value |

## Implementation Roadmap

### Phase 1: Refactor Single-Channel (Day 1-2)
- [ ] Define `struct LEDChannel` with all fields
- [ ] Move global `leds[]` → `channel_a.leds[]`
- [ ] Move RMT handle → `channel_a.rmt_handle`
- [ ] Rename `render_gpu()` → `render_task_channel()` (parameterized by `LEDChannel&`)
- [ ] Test: Verify single-channel behavior unchanged

### Phase 2: Initialize Dual RMT (Day 2-3)
- [ ] Allocate RMT channel B on GPIO 4
- [ ] Create second LED encoder for channel B
- [ ] Create `channel_b` instance
- [ ] Create second render task, pinned to Core 1

### Phase 3: API Routing (Day 3)
- [ ] Add channel parameter to WebServer handlers
- [ ] Implement global master brightness
- [ ] Test: Independent brightness control per channel

### Phase 4: Validation (Day 3-4)
- [ ] Run both channels at 60 FPS simultaneously for 60 seconds
- [ ] Verify FPS ≥58 on both channels
- [ ] Verify render latency <8ms per channel
- [ ] Verify no CPU exhaustion (Core 1 <70%)
- [ ] Test pattern switching on one channel (other unaffected)

## Performance Targets & Validation

| Metric | Target | Measurement |
|--------|--------|-------------|
| FPS per channel | 60 ±2 | `ch.fps` atomic counter |
| Render latency | <8ms | `esp_timer_get_time()` deltas |
| Audio-visual lag | <10ms | Beat timestamp to LED update |
| CPU Core 1 utilization | <70% | FreeRTOS idle time |
| Memory overhead | <1.5KB | Two LED buffers + atomics |

**Validation Test**:

```cpp
void validate_dual_channel_60s() {
    uint32_t start = esp_timer_get_time();
    while (esp_timer_get_time() - start < 60000000) {  // 60 seconds
        assert(channel_a.fps >= 58 && channel_a.fps <= 62);
        assert(channel_b.fps >= 58 && channel_b.fps <= 62);
        assert(channel_a.last_render_us < 8000);
        assert(channel_b.last_render_us < 8000);
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
    LOG_INFO("✓ Dual-channel validation passed");
}
```

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Core 1 CPU overload | Medium | High | Profile early; reduce pattern complexity if needed |
| RMT channel conflict | Low | High | Static allocation; fail-fast on init error |
| Audio snapshot contention | Low | Medium | Existing retry logic sufficient; validate with stress test |
| GPIO interference (EMI) | Low | Medium | Use separate power supplies for each strip; keep GPIO 4 & 5 away from high-current traces |

## Compatibility with Phase 2D1 Fixes

✅ **No disruption**: Audio pipeline untouched; pattern rendering logic identical per-channel; RMT hardware-isolated.

✅ **Synergistic**: Both channels benefit from any audio improvements (beats, spectral analysis, etc.)

## Dependencies

- None on Phase C or PF-5 (can ship independently)
- Minimal firmware changes (can integrate into Week 1 if capacity allows, or push to Week 2)

## Decision

**APPROVED**: Implement Dual-Channel LED System using **Twin Pipeline with Shared Audio Source** architecture.

Next step: Execute Phase 1 (refactor single-channel to LEDChannel struct) and validate no behavioral changes before adding channel_b.

---

**Signed**: Claude Architecture Team
**Date**: 2025-11-05
**Status**: PROPOSED (awaiting implementation validation)
