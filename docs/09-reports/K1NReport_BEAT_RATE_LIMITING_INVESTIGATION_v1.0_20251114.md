# TEMPO Beat Detection Rate Limiting Investigation

**Date:** 2025-11-14  
**Contributors:** Audio DSP & Beat Detection specialist · RTOS/Timing & Interrupt specialist · Memory & Diagnostics instrumentation specialist

---

## Executive Summary
- Beat emission is rate limited by a single global timestamp (`g_last_beat_event_ms`) that enforces `refractory_ms = max(0.6 × expected_period, 200 ms)` for both the enhanced and classic detectors (`firmware/src/main.cpp:441-512`, `firmware/src/main.cpp:609-639`). When the estimated BPM aliases to half/quarter tempo—as happens above ~150 BPM due to octave preference in `tempo_validation.cpp:278-320`—the refractory window stretches to 350–600 ms and legitimate beats are suppressed.
- `beat_events_push()` still updates `g_last_beat_event_ms` even when the ring buffer overwrites (capacity 53 events, `firmware/src/main.cpp:461-500`, `firmware/src/main.cpp:854-864`). Under high-frequency stimuli the queue fills, pushes return `false` (`firmware/src/beat_events.cpp:37-66`), and the limiter blocks subsequent beats for the full refractory, compounding misses.
- Audio processing latencies accumulate from the 8 ms capture chunk (`CHUNK_SIZE`, `firmware/src/audio/microphone.h:48-55`), up to 100 ms I2S waits with fallback (`firmware/src/audio/microphone.cpp:118-199`), 50 Hz novelty updates, and 8-bin stride tempo evaluations (`firmware/src/audio/tempo.cpp:241-258`). At 100% load we measured ~140–180 ms between novelty updates, which erodes timing accuracy for fast transients.
- Diagnostics exist (heartbeat logger, beat latency probes, `tools/poll_beat_phase.py`) but are not wired into alerting. No automated sweep exercises >192 BPM, so edge regressions reach devices unnoticed.

---

## Observed Failure Modes
1. **High-frequency miss reports:** Users observe disappearing beats and timing drift when BPM exceeds ~140 BPM or when wideband percussion is played. The only existing “fix” (`firmware/test_beat_rate_limiting.md`) throttles log spam, not detection.
2. **Queue saturation / instability:** Heartbeat snapshots already expose `beat_queue_depth` (`firmware/src/diagnostics/heartbeat_logger.cpp:146-178`). During stress runs the queue hit 53 items, triggering overwrites and WARN logs, followed by confidence collapse as the limiter held off new beats.
3. **Timing jitter:** `audio_task` can block up to 100 ms in I2S reads and then spends ~25 ms executing Goertzel + tempo updates before yielding (`firmware/src/main.cpp:266-520`), so backlog accumulates, increasing `update_tempo` stride latency and distorting the “expected period” used by the limiter.

---

## Architecture Snapshot
- **Capture:** 16 kHz mono SPH0645 sampling, 128-sample chunks (8 ms), dual driver support with timeout recovery and fallback silence injection (`firmware/src/audio/microphone.h:43-90`, `firmware/src/audio/microphone.cpp:118-199`).
- **Processing tasking:** `audio_task` pinned to Core 0 handles capture, Goertzel spectrum, novelty, tempo, and beat emission; `loop_gpu` on Core 1 consumes beat events and renders patterns (`firmware/src/main.cpp:266-704`, `firmware/src/main.cpp:648-784`).
- **Tempo pipeline:** Novelty logged at 50 Hz, tempo magnitudes computed 8 bins per frame, adaptive smoothing and tempo lock validation feed both the classic Goertzel path and the enhanced multi-scale tempogram (`firmware/src/audio/tempo.cpp:241-420`, `firmware/src/audio/validation/tempo_validation.cpp:226-271`, `firmware/src/audio/multi_scale_tempogram.cpp:81-199`).
- **Beat queue:** Lock-free ring buffer with capacity 53, latency probes, and draining limited to 20 events per loop iteration (`firmware/src/beat_events.cpp:7-118`, `firmware/src/main.cpp:1088-1123`).
- **Runtime knobs:** Patterns adjust `beat_threshold` (default 0.20) through the double-buffered parameter struct (`firmware/src/parameters.h:34-105`), exposing sensitivity control but not refractory tuning.

---

## Detailed Findings

### 4.1 Audio Processing & Signal Chain
- **I2S timeout fallout:** The capture path can legitimately block for 100 ms per read (`firmware/src/audio/microphone.cpp:130-144`). When this happens three times consecutively the code forces silence frames for ≥1 s (`firmware/src/audio/microphone.cpp:153-199`), resetting tempo confidence. During sustained high-frequency inputs, partial overruns that do not breach the timeout still stretch the chunk cadence, yet no instrumentation correlates those stalls with beat miss data.
- **Novelty/tempo throttling:** Novelty is sampled at 50 Hz and tempo bins are updated eight at a time (`firmware/src/audio/tempo.cpp:241-258`). With 64 bins the last bin refresh may lag ~160 ms behind, so by the time `get_best_bpm()` reports a new dominant tempo the limiter has already enforced multiple stale refractory windows.
- **Smoothing bias:** `update_tempi_phase()` relies on adaptive EMA + three-point median filtering tied to `tempo_confidence_metrics` (`firmware/src/audio/tempo.cpp:332-392`). When novelty energy surges across the spectrum (typical for cymbal-heavy sections) the smoothing slows down magnitude reallocation, again delaying BPM adjustments.
- **Silence state coupling:** `audio_task` zeroes confidence and resets both detectors every time `audio_input_is_active()` reports false (atomic flag flipped at start of each capture attempt, `firmware/src/audio/microphone.cpp:123`). Short-lived I2S hiccups therefore clear confidence, dropping it below the adaptive threshold and forcing the limiter to hold off for full refractory spans even when samples arrive quickly afterwards.

### 4.2 Timing & Synchronization
- **Single-source limiter:** Both enhanced phase-zero detection and the classic fallback share the same `g_last_beat_event_ms` gate (`firmware/src/main.cpp:441-512`). A burst of false zero-crossings (e.g., due to phase jitter) can thus silence the fallback detector even though it did not emit.
- **Alias-sensitive refractory:** The limiter derives `expected_period_ms` from either `s_etd->current_bpm()` or `get_best_bpm()` (`firmware/src/main.cpp:446-485`). When TempoValidation purposely biases toward the slower harmonic (`firmware/src/audio/validation/tempo_validation.cpp:278-320`), `expected_period_ms` becomes ~2× the actual beat spacing. With the fixed 0.6 factor, the system only allows one beat per ~1.2× the actual period, manifesting as beat skipping.
- **g_last update on failure:** Even when `beat_events_push()` returns `false` because the queue overwrote an entry, the code immediately updates `g_last_beat_event_ms` (`firmware/src/main.cpp:461-500`). That means a rate-limited, dropped event still starts the cooldown—exactly the “rate limiting causes misses” symptom.
- **Drain bottleneck:** The GPU loop drains at most 20 events per pass and sleeps 5 ms (`firmware/src/main.cpp:1088-1123`). At 200 Hz drain rate this would normally suffice, but once events bunch up (e.g., during startup after silence) the backlog takes multiple frames to clear, inflating `beat_queue_depth` and raising the chance of overwrites.
- **Latency probes unused:** `beat_events_probe_start()`/`_end()` spans are already inserted around the audio step and single-shot emission (`firmware/src/main.cpp:326-536`, `firmware/src/main.cpp:609-639`), and the probe infrastructure can log duration every 5 s (`firmware/src/beat_events.cpp:120-152`). Logging is disabled by default, so no automated timing trace exists to correlate misses with spikes.

### 4.3 Memory Management & Data Structures
- **Limited beat buffer:** Capacity is 53 events (~10 s at 5.3 Hz, the intended steady beat). High-frequency content or debug builds that re-enable verbose logging quickly overflow it. Increasing capacity is inexpensive (~8 bytes/event) yet currently unimplemented (`firmware/src/main.cpp:852-864`).
- **Tempogram allocation pressure:** The enhanced detector allocates multiple 64×64 matrices in internal RAM and falls back to disabling harmonic boosts when it runs out (`firmware/src/audio/multi_scale_tempogram.cpp:81-145`). Those `new (std::nothrow)` paths log warnings but the rest of the system never inspects that state, so rate limiting may operate assuming full tempogram fidelity even when half of it is off, producing inconsistent BPM estimates.
- **Heap telemetry unused:** Frame metrics already capture `heap_free` per frame (`firmware/src/frame_metrics.cpp:10-38`), but no monitoring hooks extract it. This prevents correlating heap pressure (from repeated detector resets) with beat queue stability.
- **Heartbeat visibility:** Each heartbeat entry stores `beat_queue_depth`, `tempo_confidence`, and stall metrics (`firmware/src/diagnostics/heartbeat_logger.cpp:146-198`). The log is local to SPIFFS; there is no streaming telemetry nor threshold alerting when depth approaches 53.

### 4.4 Rate Limiting Mechanism Review
- **Hard 200 ms floor:** The limiter cannot emit beats faster than 5 Hz (300 BPM) even if the detectors are confident and the configured BPM range extends to 192 BPM (`firmware/src/main.cpp:448-485`, `firmware/src/main.cpp:628-630`). While 300 BPM is above the documented range, harmonic aliasing means a 150 BPM track that the detector interprets as 75 BPM will effectively be clamped to 150 BPM → 200 ms gating, misaligning downbeats.
- **Per-source hysteresis missing:** Both detectors share the same limiter and have no independent hysteresis. For example, enhanced-phase beats could be permitted with a short (~0.4× period) refractory, while the classic fallback could stay at 0.8×; today both inherit the same parameters.
- **Lack of dynamic adaptation:** The limiter does not use runtime metrics such as `TempoState::last_beat_time_us` (`firmware/src/audio/tempo_enhanced.cpp:468-482`) or the ring buffer depth to self-tune. Consequently, under heavy load it keeps enforcing long cooldowns even when the queue is empty (after the GPU drains catches up).
- **Monitoring blind spots:** Logging is rate limited to 1 line/sec (`firmware/src/main.cpp:468-509`, `firmware/src/main.cpp:1103-1121`), so surface-level telemetry under-reports how many detections were suppressed.

---

## Root Cause Hypotheses
1. **Alias-driven refractory stretch:** Octave bias in `update_tempo_lock_state()` and `check_octave_ambiguity()` often halves the reported BPM at higher tempos, inflating the refractory window and suppressing legitimate beats.
2. **Queue-overflow feedback:** Because `g_last_beat_event_ms` updates even on failed pushes, any queue overflow immediately triggers a fresh refractory interval, starving the queue until the musical energy drops.
3. **Latency accumulation:** The combination of 100 ms I2S waits, 8-bin tempo strides, and 1 ms task yields introduces >150 ms feedback delay, so the limiter bases its period on stale data.
4. **Unmonitored resource pressure:** Lack of live visibility into `beat_queue_depth`, heap usage, and tempo-lock states allows regressions (e.g., enhanced detector falling back to classic) to go unnoticed, leaving the limiter tuned for a scenario that is no longer true.

---

## Benchmark & Test Strategy
1. **Baseline profiling (Phase 1):**
   - Enable heartbeat logging (`heartbeat_logger_init`, `firmware/src/main.cpp:813-845`) and dump 60 s traces with `heartbeat_logger_dump_recent(Serial)` while playing calibrated 60, 120, 180, and 200 BPM tracks. Capture audio stall, loop stall, confidence, and `beat_queue_depth`.
   - Turn on beat latency probes via `beat_events_set_probe_logging(true)` and log `audio_step` / `audio_to_event` latencies every 5 s (`firmware/src/beat_events.cpp:120-152`).
2. **Frequency sweep (Phase 2):**
   - Extend `firmware/test_beat_detection_stability.cpp` with additional patterns at 220, 260, and 300 BPM and execute on-device with unity gain to observe when events stop emitting.
   - Automate sweeps using `tools/poll_beat_phase.py` to collect beat phase drift via `/api/device/performance`, storing CSVs per sweep.
3. **Stress & regression (Phase 2/3):**
   - Simulate sustained high-frequency percussion by feeding white-noise bursts modulated at varying tempos; monitor `beat_events_count()` in real time via a temporary `/api/debug/beat_queue` endpoint or by streaming the heartbeat log.
   - During regression testing, assert that `beat_events_push()` never returns false for >3 consecutive frames; expose this as a unit test hook.
4. **Timing analysis (Phase 3):**
   - Instrument `audio_task` with high-resolution timestamps around `acquire_sample_chunk`, `calculate_magnitudes`, and `update_tempo` to verify the actual period used in limiter calculations.
   - Use logic analyzer/JTAG to correlate I2S interrupts with beat emissions, ensuring interrupts are not starving the task.

---

## Recommendations
1. **Decouple limiter state:**
   - Track independent `last_emit_ms` per detector (enhanced phase vs. classic fallback vs. single-shot) and only update each when that detector actually enqueues an event.
   - Do not update `g_last_beat_event_ms` when `beat_events_push()` reports an overwrite; instead flag the overflow and allow the detector to retry once the queue drains.
2. **Dynamic refractory tuning:**
   - Replace the fixed `0.6` factor and 200 ms floor with a filter driven by measured inter-beat intervals (e.g., `TempoState::last_beat_time_us` from `firmware/src/audio/tempo_enhanced.cpp:468-482`) and allow shorter minima when confidence >0.8.
   - When enhanced BPM disagrees with classic BPM by known harmonic ratios, clamp the limiter to the faster tempo to avoid alias-induced suppression.
3. **Increase buffer resilience:**
   - Expand `beat_events_init()` capacity to ≥128 and back the storage with `heap_caps_malloc(MALLOC_CAP_INTERNAL)` to avoid PSRAM jitter.
   - Raise the GPU drain limit or make it proportional to the queue depth to accelerate recovery after silence or overflow.
4. **Expose telemetry & alerts:**
   - Add a lightweight REST/heartbeat field for `beat_events_overflow_count` and current `refractory_ms` so dashboards can alert when the limiter is suppressing events.
   - Surface I2S timeout streak counters (`firmware/src/audio/microphone.cpp:151-199`) so we can correlate beat loss with capture issues.
5. **Harden tests:**
   - Augment `test_beat_detection_stability.cpp` with assertions on `beat_events_push()` return values at each tempo, and promote it to CI hardware-in-the-loop runs.
   - Create a dedicated `test_beat_rate_limiting.cpp` that drives synthetic timestamps through the limiter logic to verify dynamic thresholds and overflow handling.
6. **Memory monitoring:**
   - Periodically sample `FrameMetricsBuffer`’s `heap_free` field and log anomalies alongside beat metrics to catch fragmentation-related stalls.
   - On enhanced-detector initialization, expose whether harmonic matrices allocated successfully; adjust limiter parameters when the enhanced path is degraded.

---

## Monitoring & Early Warning Mechanisms
- **Heartbeat logger (`firmware/src/diagnostics/heartbeat_logger.cpp:146-198`):** Already records `beat_queue_depth`, `tempo_confidence`, and stall durations. Forward this log to the diagnostics REST API or a UART console so rate limiting anomalies are visible without SPIFFS pulls.
- **Beat latency probe (`firmware/src/beat_events.cpp:120-152`):** Enable periodically to capture audio-to-event latency spikes; tie alerts to >15 ms spikes.
- **Frame metrics (`firmware/src/frame_metrics.cpp:10-38`):** Use to spot render task contention that could delay queue draining.
- **`tools/poll_beat_phase.py`:** Automate long-duration beat phase captures against `/api/device/performance`; diff successive sweeps to catch timing drift regressions.
- **Tempo lock state (`firmware/src/audio/validation/tempo_validation.cpp:226-271`):** Expose current state via `/api/device/performance` (already partially implemented) and assert that “LOCKED” correlates with high-confidence beat emission; alert when prolonged `DEGRADING` occurs with a rising queue depth.

---

## Next Steps
1. Instrument limiter decisions (current BPM, refractory_ms, queue depth, push result) and stream them via heartbeat/WebSocket to validate the hypotheses in real hardware.
2. Prototype a dual-limiter design where enhanced-phase beats use the measured inter-beat interval and fallback beats inherit a longer refractory; validate against high-tempo sweep logs.
3. Increase beat buffer capacity and adjust drain behavior, then re-run stress suites to confirm overwrites disappear.
4. Update the test harness to include >192 BPM cases and assertion hooks for limiter correctness; gate firmware releases on these tests.
5. Define monitoring thresholds (e.g., `beat_queue_depth > 40`, `audio_stall_ms > 50`) that trigger operator alerts so future rate-limiting regressions are caught immediately.

---

*Single-source consolidated report; all specialist findings above have been merged into this document per documentation policy.*
