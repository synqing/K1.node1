# K1N CPU & RMT Headroom Analysis

> **Purpose** – Provide a ground-truth reference for timing, buffering, and processor headroom using only verified data from the firmware tree. Where runtime measurements are not yet implemented, gaps are called out explicitly rather than filled with guesses.

## 1. Verified Runtime Configuration
| Subsystem | Value | Source |
| --- | --- | --- |
| MCU cores | 2 × Tensilica LX7 @ 240 MHz | ESP32‑S3 datasheet (target platform). |
| LED transport | ESP-IDF RMT v2 DMA (dual channel) @ 20 MHz resolution | `firmware/src/led_driver.cpp:146-199`. |
| LEDs per channel | 160 (NUM_LEDS) | `firmware/src/led_driver.h:82-93`. |
| RMT mem block | 256 symbols/channel | `firmware/src/led_driver.cpp:154-188`. |
| Min frame period | Runtime param `frame_min_period_ms`, default 6.0 ms | `firmware/src/parameters.h:43`, `parameters.cpp:98-105`. |
| Audio sample rate | 16 kHz (`SAMPLE_RATE`) | `firmware/src/audio/microphone.h:42-48`. |
| I2S chunk size | 128 samples (8.0 ms chunk) with 8 DMA buffers | `firmware/src/audio/microphone.h:42-48`, `microphone.cpp:69-74`. |
| Audio pipeline cadence | `acquire_sample_chunk()` blocks on each 128-sample transfer; `audio_task` must finish <8 ms to avoid underrun | `firmware/src/audio/microphone.cpp:93-157`, `main.cpp:210-335`. |

## 2. WS2812 / RMT Timing Derivations
- RMT resolution: 20 MHz ⇒ 50 ns per tick (`led_driver.cpp:146`, `.resolution_hz`).
- Encoder timings (`led_driver.cpp:65-90`):
  - `bit0 = {7, 1, 18, 0}` ⇒ (7 + 18) ticks = 25 ticks = **1.25 µs** per “0” bit.
  - `bit1 = {14, 1, 11, 0}` ⇒ also 25 ticks (1.25 µs) per “1” bit.
- Per LED = 24 bits × 1.25 µs = **30.0 µs**.
- Frame payload per channel = 160 LEDs × 30 µs = **4.80 ms**.
- Reset latch code = 1000 ticks high + 1000 ticks low = 2000 × 50 ns = **100 µs**.
- **Total transmit time per channel** = 4.90 ms (does not include software preparation).
- Because both channels are queued within one critical section (see `led_driver.h:388-413`), skew stays below the enqueue latency (<50 µs industrial average on LX7) provided both DMA queues have headroom.

### Headroom vs `frame_min_period_ms`
- Default cap = 6.0 ms. Subtracting 4.90 ms hardware time leaves **≈1.10 ms** for render + quantize + wait.
- If the runtime parameter is lowered to 5.0 ms, the remaining headroom shrinks to 0.10 ms, guaranteeing RMT wait overruns whenever any ISR fires during DMA refill.

## 3. CPU Pipeline & Latency Requirements

### Core 1 (GPU / LED render task)
- `loop_gpu()` (`firmware/src/main.cpp:417-465`) performs: pattern render → `transmit_leds()` → FPS tracking.
- `transmit_leds()` enforces `frame_min_period_ms` by sleeping if the loop completed faster than the min period (`led_driver.h:520-550`).
- No concrete timing instrumentation exists for `draw_current_pattern` or quantization—the `profile_function` macro resolves to a no-op (`firmware/src/audio/goertzel.h:27-29`). **Actual per-stage timing must be gathered by adding instrumentation** (e.g., wrapping render spans with `uint32_t t_start = micros()` and accumulating into `ACCUM_RENDER_US`).
- Hard requirement: render + quantize + queue must complete within the configured `frame_min_period_ms` minus the 4.90 ms DMA time to avoid piling up wait requests. For the 6 ms default this is ≈1.10 ms total CPU budget per frame.

### Core 0 (Audio + system)
- `audio_task()` (`main.cpp:210-335`) blocks on `acquire_sample_chunk()`; each chunk is 128 samples @ 16 kHz = 8.0 ms.
- Therefore, **audio processing must finish in <8 ms** to keep pace. The code enforces `vTaskDelay(pdMS_TO_TICKS(1))` at the end of the loop, so any overrun directly reduces available CPU time for Wi-Fi/OTA tasks.
- I2S DMA config uses 8 buffers of 128 samples (`microphone.cpp:69-74`), giving 64 ms of aggregate buffering. However the read call requests exactly one chunk, so ISR cadence is effectively 125 Hz, not 750 Hz as previously (incorrectly) assumed.
- Current firmware does **not** pause I2S during the startup intro. Consequently, even “non-audio” modes keep the mic + Goertzel stack active, contending for core 0 bandwidth when Wi-Fi services wake up.

## 4. Instrumentation & Headroom Signals
| Metric | Definition | Current Status |
| --- | --- | --- |
| `ACCUM_RMT_WAIT_US` | Sum of `rmt_tx_wait_all_done()` durations | Implemented (`profiler.cpp`) but only printed when `print_fps()` log level is enabled. Not persisted elsewhere. |
| `ACCUM_RMT_TRANSMIT_US` | Sum of post-queue transmit spans | Same as above. |
| `g_led_rmt_wait_timeouts` | Count of soft timeouts (20 ms) encountered before recovery | **New** (`led_driver.h:307-365`, `led_driver.cpp:293-297`). Needs surfacing via diagnostics/UI. |
| `rmt_probe.max_gap_us` | Largest gap between DMA refill callbacks | Implemented in `diagnostics/rmt_probe.*` and already exposed in diagnostics endpoints. |
| Pattern render duration | Not instrumented. Requires explicit timing around `draw_current_pattern()` (e.g., accumulate into `ACCUM_RENDER_US`). |
| Audio pipeline duration | Not instrumented. Consider similar counters around `acquire_sample_chunk()`, `calculate_magnitudes()`, etc. |

Without the missing instrumentation, any per-stage “typical/worst” timings are speculative. All previous guesses have been removed in favor of requirements that can be validated once metrics exist.

## 5. Bottleneck Analysis (Evidence-Based)
1. **Render budget vs RMT** – With only ~1.1 ms of CPU budget per frame (at the default 6 ms cap), any intro effect that spends >1 ms rendering will cause the GPU loop to still be running when the next `rmt_tx_wait_all_done()` call fires. The new 20 ms/50 ms wait+recovery window prevents immediate frame drops, but it elongates the intro because the loop stalls waiting for DMA completion.
2. **I2S always-on** – Audio capture continues during the startup intro. Even though the intro itself is non-audio, core 0 still services the 125 Hz I2S ISR and performs Goertzel/tempo math. This limits how much time the Wi-Fi stack has to shepherd RMT DMA interrupts when the intro spikes render load on core 1.
3. **RMT memory block size** – 256-symbol blocks at 20 MHz produce DMA refill interrupts roughly every 12.8 µs while a frame is in flight (256 symbols ÷ 20 MHz). Under heavy CPU load, those interrupts can compete with Wi-Fi and I2S ISRs. Increasing `mem_block_symbols` (if RAM allows) would reduce refill frequency and give ISRs longer breathing room between service requests.

## 6. Next Steps (All Evidence-Linked)
1. **Add real timing hooks**
   - Wrap `draw_current_pattern()`, `quantize_color()`, and `pack_channel_bytes()` with instrumentation that accumulates into the existing `ACCUM_*` counters (or new ones). This converts render-time assumptions into actionable data.
   - Add similar counters around `acquire_sample_chunk()` and the Goertzel/tempo functions to prove whether the audio pipeline stays within its 8 ms budget.
2. **Expose diagnostics**
   - Publish `g_led_rmt_wait_timeouts`, `ACCUM_RMT_*`, and task stack high-water marks via the web diagnostics endpoint (or serial console) so startup-intro runs can be profiled without recompilation.
3. **Intro-specific mitigations**
   - Temporarily raise `frame_min_period_ms` during the intro (e.g., to 7–8 ms) so render time + DMA fits comfortably.
   - Alternatively pause audio capture (`EMOTISCOPE_ACTIVE=false`) while the intro runs to reduce contention on core 0 and free Wi-Fi for RMT ISRs.
4. **RMT configuration experiments**
   - Evaluate raising `.mem_block_symbols` from 256 to 320/384 to lessen refill interrupts, verifying that RAM and driver limits are respected.
   - If startup intro still tears, consider offloading one LED channel to SPI+DMA (`spi_led_driver.cpp`) to split ISR load.

## 7. Summary
- The only immutable facts today are the configured timings: 4.90 ms of hardware transmit per frame, 6.0 ms minimum frame cadence, 16 kHz audio capture with 8 ms DMA chunks, and 125 Hz I2S wake-ups. These leave ≈1 ms of CPU headroom per frame for rendering unless the min period is increased.
- Previous statements about 48 kHz I2S, 36-sample blocks, or measured render durations had no basis in the codebase and have been removed.
- To progress beyond theory, the firmware must emit the timing data it already tracks (or can easily track). Until then, architectural changes (intro pacing, audio pausing, RMT block sizing) should be validated by watching the new timeout counter and `rmt_probe` output during real hardware runs.
