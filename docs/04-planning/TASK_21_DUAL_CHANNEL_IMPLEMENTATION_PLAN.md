---
title: Task 21 - Dual Independent LED Channel Implementation Plan
author: Claude Engineering Team
date: 2025-11-05
status: ready
intent: Detailed breakdown of work items for dual-channel LED system (high-value firmware enhancement)
related:
  - ADR-0011-dual-channel-leds.md (architecture decision)
  - firmware/src/led_driver.h (current single-channel implementation)
  - firmware/src/main.cpp (main loop and task creation)
tags: [firmware, led-system, task-21, high-value]
---

# Task 21: Dual Independent LED Channel System

## Overview

**Value**: HIGH (enables dual-display use case, marketplace premium feature)
**Effort**: 20-24 hours (4-6 days, 1 engineer)
**Timeline**: Week 2-3 post-decision gate (can pull forward if Week 1 bandwidth allows)
**Risk Level**: LOW (validated architecture, no new synchronization primitives)

## Subtasks Breakdown

### Subtask 21.1: Refactor to LEDChannel Struct (6 hours)

**Objective**: Encapsulate single-channel code without changing behavior

**Work Items**:
1. Define `struct LEDChannel` in new header `firmware/src/led_channel.h`
   - `uint8_t leds[NUM_LEDS * 3]`
   - `rmt_channel_handle_t rmt_handle`
   - `rmt_encoder_handle_t led_encoder`
   - `PatternState pattern_state`
   - `ChannelControls controls` (atomic brightness, speed, palette, enabled)
   - `std::atomic<uint32_t> fps`
   - `std::atomic<uint32_t> last_render_us`

2. Create global instances in `main.cpp`
   ```cpp
   LEDChannel channel_a;
   LEDChannel channel_b;  // Initialize later
   ```

3. Replace global `leds[]` array references in:
   - `led_driver.cpp` → use `channel_a.leds` in `transmit_leds()`
   - `main.cpp` → render loop uses `channel_a.leds`
   - `generated_patterns.h` → update pattern render calls

4. Move RMT handle initialization to `channel_a`
   - Refactor `init_rmt_driver()` to accept `LEDChannel&`
   - Call from `setup()` for `channel_a`

5. Test single-channel behavior unchanged
   - Visual output matches current implementation
   - FPS ≥58, latency <8ms
   - All 15 patterns render correctly

**Deliverable**: Single-channel code reorganized in struct; tests pass

---

### Subtask 21.2: Initialize Dual RMT Channels (4 hours)

**Objective**: Set up second RMT hardware channel on GPIO 4

**Work Items**:
1. Update `platformio.ini` GPIO mapping (if needed)
   ```
   GPIO 5: LED_DATA_PIN_A (current)
   GPIO 4: LED_DATA_PIN_B (new)
   ```

2. Extend `init_rmt_driver()` to handle dual channels
   ```cpp
   void init_rmt_driver() {
       init_channel(channel_a, GPIO_LED_DATA_PIN_A, RMT_CHANNEL_0);
       init_channel(channel_b, GPIO_LED_DATA_PIN_B, RMT_CHANNEL_1);
   }

   void init_channel(LEDChannel& ch, gpio_num_t pin, rmt_channel_t ch_id) {
       // Create RMT channel handle
       // Create LED strip encoder
       // Store in ch.rmt_handle, ch.led_encoder
   }
   ```

3. Create `channel_b` LED encoder instance
   - Reuse existing `rmt_led_strip_encoder_t` type
   - Initialize with same timing as `channel_a`

4. Add GPIO 4 validation in startup diagnostics
   - Verify both RMT channels initialized successfully
   - Log GPIO assignments for debugging

5. Test dual RMT initialization
   - Both channels ready for transmission
   - No conflicts or mutual interference

**Deliverable**: Second RMT channel functional; diagnostic output confirms both channels active

---

### Subtask 21.3: Implement Dual Render Tasks (5 hours)

**Objective**: Create second rendering loop for independent pattern rendering

**Work Items**:
1. Refactor `loop_gpu()` → `render_task_channel(LEDChannel& ch, void* param)`
   ```cpp
   void render_task_channel(void* param) {
       LEDChannel& ch = *(LEDChannel*)param;
       TickType_t last_wake = xTaskGetTickCount();

       for (;;) {
           // 1. Read shared audio
           AudioDataSnapshot audio;
           get_audio_snapshot(&audio);

           // 2. Render pattern
           uint32_t start = esp_timer_get_time();
           render_pattern(ch.leds, ch.pattern_state, audio, ch.controls);
           uint32_t render_us = esp_timer_get_time() - start;

           // 3. RMT transmit (non-blocking)
           rmt_transmit(ch.rmt_handle, ch.led_encoder, ch.leds,
                        NUM_LEDS * 3, &tx_config);

           // 4. Update metrics
           ch.last_render_us.store(render_us);
           ch.fps.store(/* calculated FPS */);

           // 5. Frame-lock
           vTaskDelayUntil(&last_wake, pdMS_TO_TICKS(16));
       }
   }
   ```

2. Create both render tasks in `setup()`
   ```cpp
   xTaskCreatePinnedToCore(render_task_channel, "render_a", 8192,
                           &channel_a, 3, NULL, 1);
   xTaskCreatePinnedToCore(render_task_channel, "render_b", 8192,
                           &channel_b, 3, NULL, 1);
   ```

3. Add global synchronization for audio snapshots (if needed)
   - Current code: lock-free reads via `get_audio_snapshot()`
   - Validate: no torn reads with dual simultaneous reads
   - If contention observed: add retry loop instrumentation

4. Verify pattern rendering is idempotent
   - Both channels render same or different patterns → no state corruption
   - Pattern state isolated per channel

5. Test dual rendering
   - Both channels execute simultaneously on Core 1
   - FPS ≥58 on both channels
   - No visual artifacts or tearing

**Deliverable**: Both render tasks execute in parallel; visual output on both channels

---

### Subtask 21.4: Implement Per-Channel Controls (4 hours)

**Objective**: Enable independent parameter control via WebServer API

**Work Items**:
1. Extend `ChannelControls` with atomics
   - `std::atomic<uint8_t> brightness`
   - `std::atomic<uint8_t> speed_multiplier`
   - `std::atomic<uint8_t> palette_index`
   - `std::atomic<bool> enabled`

2. Update render loop to read per-channel controls
   ```cpp
   // Instead of: const PatternParameters& params = get_params();
   PatternParameters params = get_params();
   params.brightness *= ch.controls.brightness.load() / 255.0f;
   params.speed *= ch.controls.speed_multiplier.load() / 128.0f;
   ```

3. Update WebServer routes
   - Old: `GET /api/brightness` → both channels
   - New: `GET /api/channel/a/brightness` → channel A only
   - New: `GET /api/channel/b/brightness` → channel B only
   - Extend pattern selection, effects, colors endpoints similarly

4. Implement `handle_channel_request(httpd_req_t* req)`
   ```cpp
   esp_err_t handle_channel_request(httpd_req_t* req) {
       char channel_id = extract_channel_id(req->uri);
       LEDChannel& ch = (channel_id == 'a') ? channel_a : channel_b;

       if (endpoint == "brightness") {
           if (req->method == HTTP_GET) {
               uint8_t val = ch.controls.brightness.load();
               return send_json(req, "{\"brightness\": %d}", val);
           } else {
               uint8_t new_val = parse_brightness(req);
               ch.controls.brightness.store(new_val);
               return send_ok(req);
           }
       }
       // ... similar for speed, palette, enabled
   }
   ```

5. Implement global master brightness
   ```cpp
   struct GlobalControls {
       std::atomic<uint8_t> master_brightness;  // 0-255, applied to both
   };
   extern GlobalControls g_global;

   // In render:
   uint8_t effective = (g_global.master_brightness * ch.controls.brightness) / 255;
   ```

6. Test per-channel control
   - Brightness control on channel A doesn't affect channel B
   - Pattern switching on channel A doesn't affect channel B
   - Global master dims both channels correctly

**Deliverable**: Independent control working; WebServer routes functional

---

### Subtask 21.5: Validation & Performance Testing (5 hours)

**Objective**: Validate dual-channel system meets performance targets

**Work Items**:
1. Create 60-second dual-channel stress test
   ```cpp
   void test_dual_channel_60s() {
       uint32_t start_us = esp_timer_get_time();
       const uint32_t test_duration_us = 60 * 1000 * 1000;

       while (esp_timer_get_time() - start_us < test_duration_us) {
           // Verify FPS
           float fps_a = channel_a.fps.load();
           float fps_b = channel_b.fps.load();
           assert(fps_a >= 58 && fps_a <= 62);
           assert(fps_b >= 58 && fps_b <= 62);

           // Verify latency
           uint32_t render_a = channel_a.last_render_us.load();
           uint32_t render_b = channel_b.last_render_us.load();
           assert(render_a < 8000);  // <8ms
           assert(render_b < 8000);

           vTaskDelay(pdMS_TO_TICKS(5000));  // Sample every 5s
       }

       LOG_INFO("✓ Dual-channel 60-second stress test PASSED");
   }
   ```

2. Test all 15 patterns on both channels simultaneously
   - Cycle through patterns on channel A while channel B runs steady pattern
   - Verify no cross-channel interference

3. Profile CPU utilization
   - Measure Core 1 idle time during dual rendering
   - Target: >30% idle (i.e., <70% used)
   - Log FreeRTOS task statistics

4. Test hardware timing synchronization
   - Measure actual beat event timing from audio to LED update
   - Target: <10ms latency (should be 5-7ms typical)
   - Verify both channels sync'd to same beat within ±1ms

5. Documentation & notes
   - Update `firmware/README.md` with dual-channel pinout
   - Document per-channel API endpoints
   - Add GPIO 4 allocation note to `platformio.ini` comments

6. Regression testing
   - Verify Phase 2D1 critical fixes still work (WiFi, I2S, WebServer)
   - Test pattern switching, brightness control on existing single-channel path (if kept for compatibility)

**Deliverable**: Validation test passes; all targets met; documentation updated

---

### Subtask 21.6: Code Review & Integration (2 hours)

**Objective**: Peer review and merge to main

**Work Items**:
1. Self-review
   - Check for race conditions (atomic operations correct?)
   - Verify no memory leaks (RMT cleanup on errors?)
   - Ensure code follows K1.node1 style guide

2. Peer code review
   - Have senior firmware engineer review architecture
   - Validate synchronization assumptions
   - Check performance-critical paths

3. Create commit with detailed message
   ```
   feat(firmware): Dual independent LED channel system

   Implements Task 21: Enable two independent 180-LED strips with shared
   audio source. Each channel has independent controls (brightness, speed,
   palette) and can render different patterns simultaneously.

   Architecture:
   - Twin render tasks (Core 1, time-sliced by FreeRTOS)
   - Separate RMT channels (GPIO 4 & 5) for parallel DMA transmission
   - Lock-free atomics for parameter updates (no mutex contention)
   - Shared audio snapshot via existing lock-free mechanism

   Performance:
   - 60 FPS per channel ±2
   - <8ms render latency per channel
   - 61% timing margin at 60 FPS baseline
   - CPU utilization <70% Core 1

   Validated: 60-second stress test with both channels at full load
   ```

4. Merge to main
   - Ensure CI passes (if configured)
   - Update CHANGELOG.md with entry

**Deliverable**: Code reviewed and merged; changelog updated

---

## Time Allocation

| Subtask | Effort | Owner | Week |
|---------|--------|-------|------|
| 21.1 Refactor | 6h | Firmware Eng | W2 |
| 21.2 RMT Init | 4h | Firmware Eng | W2 |
| 21.3 Render Tasks | 5h | Firmware Eng | W2-W3 |
| 21.4 Per-Channel Control | 4h | Firmware Eng | W3 |
| 21.5 Validation | 5h | Firmware Eng + QA | W3 |
| 21.6 Review & Merge | 2h | Team | W3 |
| **TOTAL** | **26h** | **1 eng** | **2 weeks** |

---

## Success Criteria

✅ **Functional**:
- Both 180-LED strips transmit independently
- Each channel renders patterns from different effects
- Parameter changes on channel A don't affect channel B

✅ **Performance**:
- 60 ±2 FPS per channel
- <8ms render latency
- <10ms audio-to-LED latency
- Core 1 utilization <70%

✅ **Quality**:
- 60-second stress test passes
- All 15 patterns work on both channels
- Phase 2D1 fixes unaffected
- Code reviewed and approved

✅ **Documentation**:
- ADR-0011 approved
- API endpoints documented
- GPIO pinout in firmware README

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Core 1 CPU exhaustion | Early profiling; reduce pattern complexity if needed |
| RMT channel conflict | Static allocation; fail-fast validation |
| GPIO EMI interference | Separate power supplies; keep GPIO 4 & 5 isolated |
| Race conditions | Atomic operations validated in test suite; retry instrumentation |

## Dependencies & Blockers

**None**. Can execute independently from Phase C/PF-5 or Phase 2D1 fixes.

**Recommended Timeline**: Week 2 startup (immediately post-decision gate) to validate high-value feature early.

---

**Prepared By**: Claude Architecture Team
**Date**: 2025-11-05
**Status**: READY FOR EXECUTION
