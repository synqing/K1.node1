---
author: Codex (ChatGPT)
date: 2025-11-06
status: draft
intent: Deep technical execution plan for Dual Independent LED Channel architecture (Task 21)
related:
  - docs/02-adr/ADR-0011-dual-channel-leds.md
  - firmware/src/main.cpp
  - firmware/src/led_driver.h
  - firmware/src/parameters.cpp
  - webapp/src/lib/api.ts
---

# Dual Independent LED Channel Execution Blueprint (Task 21)

## Executive Decision (Final)

- Adopt Codex architecture with the following confirmed modifications:
  - VisualScheduler pinned to Core 0 for deterministic coordination.
  - Per-channel CRGBF frames and per-channel packed buffers.
  - Dualize pattern statics using a first dimension `[2][...]` (no big-bang runtime rewrite).
  - Remove frame-locking to 60 FPS; target unconstrained 100+ FPS per channel.
  - Add frame budget monitoring and graceful degradation when overruns detected.
  - Maintain per-channel `dither_step` to prevent synchronized flicker.
- Defer PatternInstance/PatternRuntime migration until post-ship; migrate incrementally per pattern.

## 1. Baseline System Anatomy

### 1.1 Producer (Audio Pipeline)
- **Core binding:** Audio tasks currently run on Core 1 (`audio_task`). They ingest SPH0645 I2S data, run Goertzel/tempo analysis, and publish immutable snapshots via `finish_audio_frame()`.
- **Snapshot type:** `AudioDataSnapshot` (declared in `firmware/src/audio/goertzel.h`) contains beat detections, spectral bins, VU stats, and metadata. A lock-free sequence counter prevents torn reads.
- **Access contract:** Consumers call `get_audio_snapshot(&snapshot)` which retries if the sequence count is odd. Latency is ~1–2 µs per call (interrupt-safe). This producer remains unchanged; dual-channel work only increases readers.

### 1.2 Consumer (Visual Pipeline) — Current State
- **Task:** `loop_gpu` pinned to Core 0 in `firmware/src/main.cpp:423` renders into the global `CRGBF leds[NUM_LEDS]` array and pushes bytes via `transmit_leds()`.
- **Driver coupling:** `firmware/src/led_driver.h` mixes render utilities (quantization, dithering) with hardware state (`tx_chan`, `raw_led_data`). This tight coupling is acceptable for one channel but blocks multi-output expansion.
- **Data flow (single channel):**
  1. Fetch `PatternParameters` via `get_params()` (double buffer of size 2).
  2. Render `draw_current_pattern()` using pattern registry state.
  3. Convert floats → bytes (`quantize_color`) and send on one RMT channel.
  4. Update instrumentation counters (`ACCUM_*`, `g_last_led_tx_us`).

**Constraint summary:** All global singletons (`leds`, `global_brightness`, encoder handles, LED TX events) must be scoped per channel to avoid data collisions once we introduce a second consumer.

## 2. Dual Channel Objectives & Guardrails
- **One audio producer → two independent visual consumers.** Each must render distinct patterns, palettes, and brightness envelopes.
- **Performance envelope:** ≤8 ms render latency per channel, ≥58 FPS sustained (ADR-0001 targets 60 FPS nominal). Combined CPU load on Core 0 must stay <70% to keep OTA/network responsive.
- **Synchronization:** No mutexes on critical render loop. Lock-free patterns from single channel must be preserved; all coordination should rely on atomics or per-channel ownership.
- **Backwards compatibility:** Existing REST/websocket routes should function during migration, defaulting to channel A. UI migration can happen after firmware ship.

## 3. Channel Encapsulation Strategy

### 3.1 `RenderChannel` Structure
Create a dedicated struct in a new `firmware/src/render_channel.h` to isolate everything previously global:

```cpp
struct RenderChannel {
    // Frame buffers
    CRGBF frame[NUM_LEDS];          // High precision buffer (pattern writes)
    uint8_t packed[NUM_LEDS * 3];   // Quantized buffer for RMT DMA

    // Hardware handles
    rmt_channel_handle_t tx_handle;
    rmt_encoder_handle_t encoder;

    // Pattern runtime
    PatternInstance pattern;        // See §4.2
    PatternParametersBuffer params; // Double-buffered channel-specific params

    // Control overlays
    std::atomic<uint8_t> brightness;   // 0–255 scaler (per-channel)
    std::atomic<bool> enabled;

    // Telemetry (Core 0 writes, diagnostics read)
    std::atomic<uint32_t> last_render_us;
    std::atomic<uint32_t> last_quantize_us;
    std::atomic<uint32_t> last_tx_us;
    std::atomic<uint32_t> last_frame_start_us;

    // LED TX event ring buffer
    LedTxBuffer tx_events;         // Wrap existing `led_tx_events` implementation
};
```

**Implementation notes:**
- `PatternParametersBuffer` mirrors existing global double buffer but is scoped to the channel and adds two buffers per channel (storage ≈ 2 × (13 floats + metadata) ≈ 112 bytes/channel).
- `LedTxBuffer` reuses current ring buffer logic by embedding capacity and head/tail indices. Each channel logs its own transmit timestamps for the API.
- Store two static instances (`RenderChannel g_channel_a;`, `RenderChannel g_channel_b;`) to avoid dynamic allocation.

### 3.2 Memory Footprint
- Frame: `NUM_LEDS * sizeof(CRGBF)` = `180 * 12` = 2160 bytes per channel.
- Packed buffer: `NUM_LEDS * 3` = 540 bytes per channel.
- Pattern state: depends on pattern; worst-case (Beat Tunnel variant) uses multiple 180-entry arrays (≈8 KB). To avoid double-allocation, patterns will allocate storage per channel (§4.2).
- Overall incremental SRAM usage < 12 KB, well within ESP32-S3 512 KB limit.

## 4. Rendering Runtime Refactor

### 4.1 Scheduler (`VisualScheduler`)
Replace `loop_gpu` with a modular scheduler defined in `firmware/src/visual_scheduler.cpp`:

```cpp
void visual_scheduler(void* param) {
    auto* channels = static_cast<ChannelSet*>(param); // Holds pointers to channel A/B
    uint32_t frame_counter = 0;

    while (true) {
        uint32_t frame_start = esp_timer_get_time();
        AudioDataSnapshot audio;
        bool audio_ok = get_audio_snapshot(&audio);

        for (RenderChannel* ch : channels->active()) {
            if (!ch->enabled.load(std::memory_order_relaxed)) continue;

            ParameterPack params = ch->params.acquire(); // Acquire active buffer
            uint8_t brightness = compute_effective_brightness(ch, params); // includes global overlay

            uint32_t render_t0 = esp_timer_get_time();
            PatternRuntime::render(ch->pattern, ch->frame, params, audio, frame_counter);
            ch->last_render_us.store(esp_timer_get_time() - render_t0, std::memory_order_relaxed);

            uint32_t quantize_t0 = esp_timer_get_time();
            quantize_frame(ch->frame, ch->packed, brightness, params.dithering >= 0.5f);
            ch->last_quantize_us.store(esp_timer_get_time() - quantize_t0, std::memory_order_relaxed);

            start_led_dma(*ch); // Non-blocking rmt_transmit
        }

        wait_for_all_dma(channels->active());
        update_tx_metrics(channels->active());
        enforce_frame_budget(frame_start, 16000); // 16ms target
        frame_counter++;
    }
}
```

**Key behaviors:**
- Audio snapshot reuse: Acquire once per frame, reuse for both channels. If `audio_ok == false`, fall back to prior snapshot or zeroed structure to avoid jitter.
- DMA overlap: `start_led_dma` issues `rmt_transmit` on both channels sequentially. The ESP32-S3 RMT hardware streams bytes via DMA; CPU is free while transmissions run. The scheduler waits for completion (`rmt_tx_wait_all_done`) after queuing both to ensure the next frame starts only after both strips latched.
- Frame pacing (modified): No artificial frame-lock. Run unconstrained (100+ FPS when possible). Add frame budget monitoring; if measured total frame time regularly exceeds thresholds, log diagnostics and apply soft backoff only when necessary (e.g., skip low-priority post-processing), but do not hard-cap FPS.

### 4.1.1 Frame Budget Monitoring (Unconstrained FPS)

- Metrics to compute each frame:
  - `frame_total_us = now - frame_start` (per-channel split available via `last_render_us`, `last_quantize_us`, `last_tx_us`).
  - `dma_overlap_us` (difference between first TX start and both-complete time) to infer overlap efficiency.
  - Rolling percentiles (P50/P90/P99) over a 1–2 s window.
- Soft backoff policy (only if sustained overload):
  - If P90 `frame_total_us` > 12 ms for 1 s, reduce optional effects (e.g., bloom iterations) on the next N frames.
  - If P99 > 16.7 ms for 1 s, temporarily skip one frame of lower-priority channel post-processing (never skip DMA send of the already-rendered buffer) and emit a single diagnostic event.
  - Restore effects automatically when `frame_total_us` drops below thresholds for 2 s.

### 4.2 Pattern Runtime Isolation
Current patterns in `firmware/src/generated_patterns.h` rely on `static` scratch buffers shared globally. Dual channels necessitate per-instance storage:

1. **Generate metadata:** For each pattern entry in `g_pattern_registry`, add `state_size` and `init_fn` to a new struct `PatternRuntime`.

    ```cpp
    struct PatternRuntime {
        PatternFunction render;
        PatternInitFunction init;   // Optional; prepares state block
        uint16_t state_size;        // Bytes required for persistent state
    };
    ```

2. **Pattern instance:**

    ```cpp
    struct PatternInstance {
        const PatternInfo* info;   // Registry reference
        void* state;               // Per-channel persistent state
    };
    ```

    Allocate `aligned_storage<MAX_STATE>` inside `RenderChannel` for `state` (compile-time maximum derived from pattern metadata). `init` populates arrays, noise buffers, etc., per channel.

3. **Render invocation:** The scheduler passes the channel’s `PatternInstance` to `PatternRuntime::render`, which now takes `(CRGBF* frame, void* state, const PatternParameters&, const AudioDataSnapshot&, uint32_t frame_index)`.

4. **State migration plan:**
   - Phase 1: add wrappers that route existing global statics through `PatternInstance::state` but keep single channel active. Validate bit-for-bit output.
   - Phase 2: enable dual channels and remove legacy globals once tests pass.
   - Adjustment (final decision): For initial ship, dualize statics using `[2][...]` buffers keyed by `ch_idx` to achieve channel isolation with minimal churn; delay full `PatternInstance` migration to post-ship.

### 4.3 Quantization Pipeline
- Move `quantize_color` logic into `quantize_frame(RenderChannel&, brightness, dithering)` to operate on channel-local buffers.
- The dithering table and `dither_step` become per-channel to prevent synchronous dithering patterns (store in `PatternInstance` or `RenderChannel`). This avoids correlated noise between strips.
- Accumulate timing metrics per channel (`last_quantize_us`, `ACCUM_QUANTIZE_US` becomes array indexed by channel ID for legacy telemetry compatibility).

## 5. Hardware Layer Adjustments

### 5.1 Multi-channel RMT Setup
In `firmware/src/led_driver.cpp`:

```cpp
static esp_err_t init_rmt_for_channel(RenderChannel& ch, gpio_num_t gpio) {
    rmt_tx_channel_config_t config = {
        .gpio_num = gpio,
        .clk_src = RMT_CLK_SRC_DEFAULT,
        .resolution_hz = 20'000'000,
        .mem_block_symbols = 64,
        .trans_queue_depth = 4,
        .intr_priority = 99,
        .flags = { .with_dma = 1 },
    };

    ESP_RETURN_ON_ERROR(rmt_new_tx_channel(&config, &ch.tx_handle), TAG, "rmt_new_tx_channel");

    led_strip_encoder_config_t encoder_cfg{ .resolution = 20'000'000 };
    ESP_RETURN_ON_ERROR(rmt_new_led_strip_encoder(&encoder_cfg, &ch.encoder), TAG, "rmt_new_led_strip_encoder");

    return rmt_enable(ch.tx_handle);
}
```

- Channel A uses GPIO 5 (current pin). Channel B uses GPIO 4; confirm board routing to ensure noise isolation.
- Each `RenderChannel` owns its encoder instance and reset symbol, preventing re-entrancy issues.
- `start_led_dma(RenderChannel&)` becomes a thin wrapper that calls `rmt_transmit(ch.tx_handle, ch.encoder, ch.packed, sizeof(ch.packed), &tx_config)`.

### 5.2 LED TX Events
- Embed `LedTxBuffer` (wrapper around existing `led_tx_events` ring). Initialize per channel with identical capacities (256 entries ≈ 4 s history at 60 FPS).
- Update `led_tx_events_push` consumers (webserver, diagnostics) to accept channel id.

## 6.1.1 Unconstrained FPS and Telemetry Contracts

- Expose instantaneous and rolling FPS per channel without clamping. FPS derives from completed DMA frames, not just render loops, ensuring hardware-truth measurements.
- Extend `/api/device/performance` to include per-channel: `fps`, `render_avg_us`, `quantize_avg_us`, `rmt_wait_avg_us`, and `dma_overlap_us`.
- Add a compact `overruns_last_10s` counter per channel for quick health checks.

## 6. Control Plane Evolution

### 6.1 REST Routing
Add channel-aware endpoints while keeping legacy compatibility:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/channels/{id}/params` | GET/POST | Fetch/update `PatternParameters` for channel `id∈{a,b}`. Uses existing validation logic (`update_params_safe`) scoped to channel buffer. |
| `/api/channels/{id}/patterns` | POST | Select pattern by index or id for the specified channel. |
| `/api/channels/{id}/led/frame` | GET | Sample current frame (supports `?n=` and `?fmt=`). Reads from `RenderChannel::packed` and `frame`. |
| `/api/channels/{id}/led/tx/info` | GET | Returns ring buffer counts and last timestamp using channel-local telemetry. |
| `/api/global/brightness` | GET/POST | Master brightness overlay. |
| `/api/global/state` | GET | Summaries (FPS, render time, pattern names) for both channels. |

**Backwards compatibility:**
- `/api/params` delegates to channel A handler.
- `/api/pattern/set` updates channel A until frontend migrates.
- WebSocket payload extends JSON with `channels: [{id:"a", fps:..., pattern:"..."}, …]` while primary fields remain.

### 6.2 Webapp Integration
- Introduce `ChannelId` enum in `webapp/src/lib/api.ts` and extend existing hooks (`getParams`, `updateParams`) with optional channel argument defaulting to `'a'`.
- Update gating logic (`api.ts:70`) to gate by channel so concurrent GET/POST to different channels do not block each other.
- UI can progressively adopt dual-channel controls; firmware plan ensures API parity.

## 7. Migration & Validation Plan

### 7.1 Phase 0 — Refactor Under Feature Flag (Parity)
- Add build flag `DYNAMIC_LED_CHANNELS` (PlatformIO environment option).
- Implement `RenderChannel` scaffolding but wire only channel A. Unit/integration tests must confirm identical LED output vs baseline (bitwise compare of `raw_led_data`).
- Run existing test suite and LED simulator to assert regressions absent.

### 7.2 Phase 1 — Enable Channel B Mirroring Channel A
- Instantiate channel B, route to GPIO 4, but mirror pattern selection and params from channel A. This validates hardware and scheduler concurrency without introducing control plane changes.
- Instrument: log both channels’ render/quantize/tx timings and ensure differences <200 µs. Capture data via `/api/global/state`.

### 7.3 Phase 2 — Independent Controls + Dualized Statics
- Activate per-channel parameter buffers and REST routes.
- Dualize pattern statics to `[2][...]` arrays and pass `ch_idx` through rendering helpers so each channel uses its own slice. Verify pattern switching on one strip leaves the other unaffected.
- Webapp: add channel selector to parameter editor; run API gating tests for both channels.

### 7.4 Stress Test — 60s Dual-Channel Burn-In at 100+ FPS

- Conditions: both channels active, unconstrained FPS (no deliberate delay), representative complex patterns selected on each channel.
- Success criteria:
  - `fps >= 95` sustained per channel (100+ typical) with zero hard overruns.
  - P90 `frame_total_us` < 12 ms; P99 < 16.7 ms (budget headroom maintained).
  - CPU Core 0 average < 70%; no watchdog resets; stable heap.
  - No synchronized flicker (verify distinct `dither_step` sequences).
  - No cross-channel state contamination (visual inspection of trails/tunnels).

### 7.4 Validation Checklist
- **Performance burn-in:** 60 s run at maximum load, assert `fps >= 58` for both channels (`RenderChannel::fps` computed as rolling average).
- **Timing metrics:** `last_render_us`, `last_quantize_us`, `last_tx_us` under thresholds (target <8 ms, <1 ms, <6 ms respectively).
- **Audio sync:** Use beat event timestamps and TX ring buffers to verify end-to-end latency <10 ms on both outputs.
- **Thermal/power:** Dual DMA bursts double instantaneous current draw; ensure power supply spec covers ~8–10 A if both strips at max brightness. Document in operator runbook.

## 8. Risks & Mitigations (Expanded)

| Risk | Detail | Mitigation |
|------|--------|------------|
| **Pattern memory blow-up** | Patterns with static buffers (e.g., `beat_tunnel_image`) could double memory footprint beyond SRAM limits. | During `state_size` audit, compress or reuse buffers. For symmetrical patterns, share read-only lookup tables via PROGMEM or compile-time constants. |
| **RMT channel contention** | ESP32-S3 RMT channels share DMA resources; simultaneous starts may starve if both use same DMA controller. | Stagger DMA start by ~2 µs or assign alternating memory blocks to avoid collisions; validate with logic analyzer. |
| **Frame budget overruns** | If render time + two DMA transfers >16 ms, FPS drops. | Add adaptive scheduler: if `wait_for_all_dma` reports >16 ms, skip next render for lower-priority channel or reduce `params.speed`. |
| **API regression** | Legacy clients expect `/api/params`. | Provide transitional alias, emit deprecation header, and document timeline in CHANGELOG. |
| **Dithering interference** | Shared `dither_step` causes identical flicker on both strips. | Store `dither_step` in `RenderChannel` so channels desynchronize automatically. |

## 9. Deliverables & Artifacts
- **Firmware code:** `firmware/src/render_channel.*`, `visual_scheduler.*`, refactored `led_driver.*`, pattern runtime updates, parameter routing.
- **Docs:**
  - Update `docs/02-adr/ADR-0011-dual-channel-leds.md` to `accepted` with new scheduler diagram.
  - Create `docs/09-implementation/dual_channel_runbook.md` focusing on wiring, configuration, validation scripts.
  - Append migration notes to `docs/04-planning/K1NPlan_STRATEGY_PHASE_2D1_GRAPH_PARALLEL_MASTER_v1.0_20251108.md` linking to this blueprint.
- **Tests:** Add integration harness capturing dual-channel timings (serial logging or WebSocket). Extend firmware unit tests verifying parameter isolation.
- **Metrics:** New `/api/global/state` endpoint feeding dashboards or CLI health scripts.

## 10. Profiling & Instrumentation (Aggressive)

- Per-channel counters (atomic, rolling window):
  - `fps_inst`, `fps_rolling[16]`, `last_render_us`, `last_quantize_us`, `last_tx_us`, `dma_overlap_us`.
  - Overrun counters: `frame_over_12ms`, `frame_over_16ms` (reset every 10 s).
- RMT telemetry:
  - Queue depth sampled at TX enqueue and completion; expose `rmt_queue_depth_max` if available.
- API exposure:
  - Extend `/api/device/performance` and `/api/global/state` to include the above per-channel metrics.
- Logging:
  - Rate-limited warnings when P90/P99 thresholds are exceeded; one-line summaries every 5 s.

---

**Next Engineering Actions**
1. Implement `RenderChannel` and `PatternRuntime` scaffolding under feature flag; ensure single-channel parity.
2. Split hardware initialization into per-channel paths and validate mirrored output on hardware bench.
3. Land dual-channel REST/WebSocket API changes and adapt webapp gating to accept channel identifiers.
4. Run 60 s dual-strip burn-in, capture metrics, and update ADR + runbook.
