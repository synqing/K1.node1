# K1.node1 Firmware

## Overview
- Purpose: Real‑time audio‑reactive LED firmware for ESP32‑S3, driving patterns with beat/energy/spectral features and exposing telemetry over REST.
- Design goals: deterministic frame timing, safe concurrency, and field‑ready observability with low overhead.
- Key traits:
  - Dual‑RMT LED transmit with minimal skew (v1/v2 paths selected via header guards).
  - Lock‑free data handoff (seqlock + atomic counters) between audio and render loops.
  - Telemetry heartbeat and REST endpoints for health, performance, and RMT diagnostics.

## Platform & Targets
- MCU: ESP32‑S3 DevKitC‑1 (primary).
- Build system: PlatformIO (Arduino framework; optional Arduino+ESP‑IDF combo env).
- Toolchains and SDKs are pinned in `firmware/platformio.ini`.

## Quick Start
1) Install PlatformIO (VS Code extension or CLI: `pip install platformio`).
2) Connect the ESP32‑S3 via USB.
3) Build and flash (release env):
   - `pio run -e esp32-s3-devkitc-1`
   - `pio run -e esp32-s3-devkitc-1 -t upload`
4) Optional debug telemetry build:
   - `pio run -e esp32-s3-devkitc-1-debug -t upload`
5) Monitor serial logs:
   - `pio device monitor -b 115200`

## Keyboard Controls
- `SPACEBAR` — cycle to next pattern.
- `m` — open/close Debug Menu (single entry point to avoid many unique keys).

Debug Menu (digits only):
- `1` — cycle log level (`DEBUG → INFO → WARN → ERROR`).
- `2` — toggle audio debug mode.
- `3` — dump recent heartbeat logs.
- `4` — toggle log tags (opens tag submenu).
- `0` — close the menu.

Tag submenu (page 1):
- `1` Audio, `2` GPU, `3` I2S, `4` LED, `5` Tempo,
- `6` Beat, `7` Sync, `8` WiFi, `9` Web, `0` next page.

Tag submenu (page 2):
- `1` Memory, `2` Profile, `9` previous page, `0` back to main menu.

Notes:
- Lowercase only; no Shift/uppercase shortcuts are used.
- Digits are reused across menu pages to minimize unique keystrokes.

## Environments (PlatformIO)
- `env:esp32-s3-devkitc-1` — default release build (pinned platform + Arduino framework).
- `env:esp32-s3-devkitc-1-debug` — release flags + `DEBUG_TELEMETRY=1` and REST rate‑limits for diagnostics.
- `env:esp32-s3-devkitc-1-metrics` — release build with `FRAME_METRICS_ENABLED=1`; required before running `tools/run_benchmark.sh`.
- `env:esp32-s3-devkitc-1-metrics-ota` — OTA upload variant of the metrics build (used by `tools/run_benchmark.sh`).
- `env:esp32-s3-devkitc-1-ota` — OTA upload configuration (ArduinoOTA).
- `env:esp32-s3-devkitc-1-idf5` — Arduino+ESP‑IDF combo for split RMT v2 headers.
- `env:esp32-s3-devkitc-1-codegen` — metrics build + generated Bloom/Spectrum enabled (`USE_GENERATED_*`), excludes baseline PoCs to avoid symbol clashes.
- `env:esp32-s3-devkitc-1-codegen-ota` — OTA upload variant of the codegen build.

### LED Alignment & Mirror Controls

- `mirror_mode` (boolean) and `led_offset` (float, ±NUM_LEDS) live inside `/api/params` now.
  - Mirror mode mirrors the strip around the centre when `true` (default).
  - LED offset applies once in the LED driver so every pattern shares the alignment fix.
- Example:

```bash
curl -X POST http://DEVICE/api/params \
  -H 'Content-Type: application/json' \
  -d '{"mirror_mode":false,"led_offset":-10}'
```

## Telemetry & REST Endpoints
- `/api/health` — build signature (Arduino, `IDF_VER`, git SHA, build time), degraded flags, reset cause.
- `/api/rmt/diag` — per‑channel `{empty, maxgap_us, trans_done, last_empty_us}` plus `wait_timeouts`.
- `/api/rmt/reset` — resets RMT probe counters and LED wait timeouts.
- `/api/device/performance` — FPS, frame histograms, CPU %, memory, optional beat_phase.
- `/api/realtime/config` — GET/POST realtime telemetry WebSocket enable + interval (persisted).
- `/api/diag` — GET/POST diagnostics enable + interval (persisted; heartbeat logger mirrors).
- Heartbeat: periodic metrics (interval higher in release; faster when `DEBUG_TELEMETRY=1`).

## Concurrency & Safety Guardrails
- Hot paths: no `std::mutex`/spinlocks in IRAM or inner loops; prefer seqlock + atomic sequence counters.
- Bounds correctness: wrap ring indices using modulo or bitmask (power‑of‑two lengths), explicit range checks for spectral bins.
- Initialization: default‑initialize snapshot structs; zero‑init factories for POD data.
- Compile‑time guards: use `__has_include` to select RMT v1/v2 code paths; gate strict/relaxed modes via flags.
- Timeouts bounded: skip work on timeout; rate‑limit any warnings.

## Performance Targets
- LED render FPS: minimum 120, target 150 (serialize uploads; keep hot paths lean).
- Audio FPS: ≥100 sustained.

## Building & Flashing
- Clean build: `pio run -e esp32-s3-devkitc-1 -t clean && pio run`
- Upload: `pio run -e esp32-s3-devkitc-1 -t upload`
- OTA (if configured): `pio run -e esp32-s3-devkitc-1-ota -t upload`
- Serial monitor: `pio device monitor -b 115200`

## Quick API Examples
- Use mDNS `http://k1-reinvented.local/` or IP.
- Diagnostics:
  - `curl -s http://k1-reinvented.local/api/diag`
  - `curl -s -X POST http://k1-reinvented.local/api/diag -H 'Content-Type: application/json' -d '{"enabled":true,"interval_ms":1000}'`
- Realtime config:
  - `curl -s http://k1-reinvented.local/api/realtime/config`
  - `curl -s -X POST http://k1-reinvented.local/api/realtime/config -H 'Content-Type: application/json' -d '{"enabled":true,"interval_ms":500}'`
- RMT telemetry / reset:
  - `curl -s http://k1-reinvented.local/api/rmt/diag`
  - `curl -s -X POST http://k1-reinvented.local/api/rmt/reset -H 'Content-Type: application/json' -d '{}'`

See `docs/06-reference/firmware-api.md` for full details and rate‑limit windows, the comprehensive index at `docs/09-implementation/api-index.md`, and quick curl suites at `docs/09-implementation/api-quick-tests.md`.

## Testing (Unity)
- Run fast Phase‑A test set (no hardware‑in‑loop):
  - `pio test -e esp32-s3-devkitc-1 --without-building --filter test_phase_a*`
- Test folders of interest in `firmware/test/`:
  - `test_phase_a_bounds` — ring index wrapping + fuzz cases.
  - `test_phase_a_seqlock` — seqlock writer/reader snapshot consistency.
- `test_phase_a_snapshot_bounds` — default initialization + spectral bounds.
- Hardware stress/long-running tests are excluded by default; run `pio test -e esp32-s3-devkitc-1 --filter test_stress_suite --project-option \"build_flags=-DSTRESS_TEST_DURATION_SCALE=0.2f\"` for a shortened burn-in.

## Troubleshooting

### AsyncTCP.cpp:1557 begin(): failed to start task
If you see this during boot, the AsyncTCP worker task could not be created because the ESP32-S3 ran out of internal RAM. We now cap `CONFIG_ASYNC_TCP_STACK_SIZE` at 6144 bytes in `platformio.ini`, which drops the stack requirement enough for xTaskCreate to succeed while keeping plenty of headroom for AsyncWebServer. If you use a custom environment, ensure the flag is carried across (or lower it further to 4096 if you run additional tasks). After modifying `platformio.ini`, clean + rebuild (`pio run -t clean && pio run`) to push the new stack size into the firmware.

- Build signature missing: ensure `platformio.ini` pins and compile flags are intact; verify `/api/health`.
- Timing or RMT gaps spike: reduce debug logging; confirm bounded waits and no busy-waits in hot paths.
- Mutex warnings: replace with seqlock + atomic sequence counters for shared buffers.
- Large repository clones/pushes: ensure `firmware/.platformio/**` and `*.DS_Store` are ignored (already configured).

## Benchmarking & Hardware Suites

- Automated profiling run: `tools/run_benchmark.sh 192.168.1.104`
  - Builds/flashes `env:esp32-s3-devkitc-1-metrics`, selects each benchmark pattern, and captures `/api/frame-metrics`.
  - Outputs CSV (`benchmark_results/benchmark_<timestamp>.csv`) + human-readable summary.
  - Override to exercise generated patterns:
    - `BUILD_ENV=esp32-s3-devkitc-1-codegen UPLOAD_ENV=esp32-s3-devkitc-1-codegen-ota tools/run_benchmark.sh <ip>`
- Hardware validation loop: `tools/run_hw_tests.sh --device /dev/tty.usbmodem212401`
  - Builds each suite (`test_hw_led_driver`, `test_hw_audio_input`, `test_hw_graph_integration`), flashes, and streams Unity logs via `tools/parse_test_output.py`.
- Stress suite: `pio test -e esp32-s3-devkitc-1 --filter test_stress_suite`.
  - Default runs ~10 minutes; adjust `STRESS_TEST_DURATION_SCALE` to shorten/lengthen durations.

## Validation Tools (repo root `tools/`)
- Beat‑phase logger (CSV):
  - `python tools/poll_beat_phase.py --device http://DEVICE --endpoint /api/device/performance --field beat_phase --interval 0.25 --count 240 --out beat_phase_log.csv`
  - Tip: `export K1_DEVICE_URL=http://DEVICE` to skip `--device`.
- Metronome generator: `python tools/metronome.py --bpm 120 --seconds 60 --outfile metronome_120bpm.wav`
- Analyzer: `python tools/beat_phase_analyzer.py --bpm 120 --log beat_phase_log.csv --out beat_phase_report.csv`
- Concurrency stress (desktop): `g++ -O3 -std=c++17 -pthread tools/seqlock_stress.cpp -o seqlock_stress && ./seqlock_stress --attempts 10000000 --readers 2 --bins 64 --writer-hz 200 --out stress.csv`
- One‑shot validation runner: `bash tools/run_phase_a_validation.sh`
- Pattern smoke test: `bash tools/test_patterns.sh <device-ip>` — cycles Spectrum/Spectronome/Bloom/Metronome/FFT/Pitch/Neutral/Debug via REST and fails if `/api/frame-metrics` is empty for any selection.

## CI (Fast Lane + Guards)
- Fast lane: cached PlatformIO build (release + debug) + Phase‑A unit tests.
- Optional validation lane (label `run-validation` or manual dispatch): stress+metronome artifacts.
- Non‑blocking guards:
  - Hawk‑Eye: warns on `std::mutex` usage in hot paths.
  - Git Size Guard: warns on tracked files > 10MB.

## Release Flow (Field)
- Canary: flash single device with `DEBUG_TELEMETRY=1`; monitor `/api/health`, `/api/rmt`, `/api/device/performance` for 10–15 minutes.
- Promote: disable debug telemetry if needed; record rollback image reference.
- Rollback: `/api/rollback` or re‑flash prior image; confirm `/api/health` hash.

## Notes
- PlatformIO caches and SDK/toolchain packages are intentionally ignored (`firmware/.platformio/**`); they are re‑hydrated by the build.
- See the playbook for Phase‑A readiness, gates, and telemetry specifics:
  - `docs/Playbooks/K1NPlaybook_PHASE_A_SECURITY_AND_PHASE0_READINESS_v1.0_20251108.md`
  - `docs/06-reference/K1NRef_REFERENCE_PHASE_A_SECURITY_FIXES_v1.0_20251108.md`
  - `docs/09-reports/K1NReport_VALIDATION_SECURITY_FIX_v1.0_20251108.md`
