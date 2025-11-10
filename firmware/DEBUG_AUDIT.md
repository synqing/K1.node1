# Phase 0 — Debugging Audit Report

This report inventories direct printing paths, catalogs debug flags and likely noisy hotspots, and proposes initial tag defaults and a global log level to start Phase 1 refactors.

## Inventory: Direct Serial/printf Usage (to refactor to Logger)

- `src/main.cpp`
  - `Serial.println/printf` in setup banner, UART sync status, beat/audio metrics, debug menu output, pattern change.
- `src/spi_led_driver.cpp`
  - Init and error messages via `Serial.println/printf`.
- `src/led_driver.cpp`
  - Numerous `printf` diagnostics during RMT init and handle verification.
- `src/udp_echo.cpp`
  - Bind/listen messages via `Serial.printf`.
- `src/beat_events.cpp`
  - Latency prints via `Serial.printf`.
- `src/diagnostics/gpio4_test.cpp`
  - Test harness prints via `Serial.println/printf`.
- `src/profiling.h`
  - Summary table via `Serial.println/printf`.
- `src/connection_state.cpp`
  - Raw `printf("[CONN] ...")` (bypasses Logger).
- `src/diagnostics/heartbeat_logger.cpp`
  - Uses `out.printf(...)` for periodic health snapshots (stream-agnostic but still bypasses Logger).

Notes
- `src/logging/logger.cpp` uses `Serial.print(message_buffer)` as the single emission point; this remains as-is.
- Commented debug prints exist in `audio/tempo.cpp.disabled`, `audio/goertzel.cpp` and are not active.

## Catalog: Debug Flags and Hotspots

- Flags
  - `main.cpp`: `audio_debug_enabled` (serial-toggleable) controlling verbose audio metrics.
  - `network_security_module.h`: `log_level` (independent of Logger), should be unified.
  - `webserver.cpp`: debug telemetry defaults (compile-time); unify into runtime controls.

- Hotspots (potentially high-frequency emission)
  - GPU/rendering: debug lines in `generated_patterns.h`, `pattern_registry.h` when level is `DEBUG`.
  - Audio/I2S: `audio/microphone.cpp` warnings/errors; could spike during failures; info on recovery.
  - LED driver/RMT: `led_driver.h/.cpp` warnings on TX issues; diagnostics currently via `printf`.
  - Heartbeat/health: `diagnostics/heartbeat_logger.cpp` periodic snapshot lines.
  - Profiling: `profiler.cpp` debug metrics; `profiling.h` summary tables on demand.
  - WiFi/connection: `wifi_monitor.cpp` uses `connection_logf("DEBUG", ...)` (bypasses Logger); may be chatty during events.

## Proposal: Initial Defaults

- Global log level
  - Default runtime level: `WARN`.
  - During setup: temporarily `INFO` for key startup info, then switch to `WARN` at the end of `setup()`.

- Per-tag defaults (enabled/disabled refers to tag filter; severity gating still applies)
  - `TAG_CORE0`, `TAG_CORE1`: enabled (general lifecycle and task startup).
  - `TAG_AUDIO`, `TAG_I2S`, `TAG_LED`, `TAG_GPU`, `TAG_TEMPO`, `TAG_BEAT`, `TAG_SYNC`: enabled; rely on `WARN` global for quiet operation.
  - `TAG_WIFI`, `TAG_WEB`: enabled; with `WARN` default these emit only warnings/errors; elevate to `INFO` during setup for connection/mDNS messages.
  - `TAG_MEMORY`: enabled.
  - `TAG_PROFILE`: enabled but no output at default `WARN`; consider exposing Profile toggles via menu when needed.
  - Future: `TAG_SCHED` (Visual Scheduler) included and enabled.

Rationale
- Keep tag filters permissive and use severity as the primary noise gate.
- Enable quick investigation by elevating global level or boosting a tag temporarily (Phase 2).

## Refactor Targets (Phase 1)

- Replace direct `Serial.print/printf` and bare `printf` with `LOG_*` macros and appropriate tags:
  - `src/main.cpp`: all runtime prints except the keyboard/menu banner (may keep as raw UI text).
  - `src/spi_led_driver.cpp`, `src/led_driver.cpp`: convert initialization and error paths to `LOG_INFO/LOG_WARN/LOG_ERROR` under `TAG_LED`.
  - `src/udp_echo.cpp`: convert to `LOG_INFO` under `TAG_SYNC` or `TAG_WEB` depending on intent.
  - `src/beat_events.cpp`: convert latency prints to `LOG_INFO` under `TAG_BEAT` and throttle.
  - `src/diagnostics/gpio4_test.cpp`: convert to `LOG_INFO/LOG_ERROR` under `TAG_LED`.
  - `src/profiling.h`: route summary emission via Logger (or keep behind a single controlled emitter).
  - `src/connection_state.cpp`, `src/wifi_monitor.cpp`: replace `printf/connection_logf` with Logger calls under `TAG_WIFI`.
  - `src/diagnostics/heartbeat_logger.cpp`: consider routing through Logger in structured mode, or make `out` a Logger-backed stream.

- Apply throttling macros (`LOG_EVERY_MS`, `LOG_EVERY_N`) on hotspots:
  - Beat latency, GPU pattern diagnostics, LED transmit attempts, WiFi event flood.

## Acceptance Criteria (Phase 0)

- Locations to refactor identified above.
- Initial tag defaults and runtime level agreed: `WARN` default; `INFO` during setup.
- Hotspots earmarked for throttling in Phase 1.

---

Prepared for Phase 1 execution: consolidate to Logger, add throttling at hotspots, and stage quiet defaults.

