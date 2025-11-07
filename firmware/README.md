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

## Environments (PlatformIO)
- `env:esp32-s3-devkitc-1` — default release build (pinned platform + Arduino framework).
- `env:esp32-s3-devkitc-1-debug` — release flags + `DEBUG_TELEMETRY=1` and REST rate‑limits for diagnostics.
- `env:esp32-s3-devkitc-1-ota` — OTA upload configuration (ArduinoOTA).
- `env:esp32-s3-devkitc-1-idf5` — Arduino+ESP‑IDF combo for split RMT v2 headers.

## Telemetry & REST Endpoints
- `/api/health` — build signature (Arduino, `IDF_VER`, git SHA, build time), degraded flags, reset cause.
- `/api/rmt` — per‑channel `{empty, maxgap_us}` and refill cadence indicators.
- `/api/device/performance` — FPS, frame histograms, CPU %, memory, optional beat_phase.
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

## Testing (Unity)
- Run fast Phase‑A test set (no hardware‑in‑loop):
  - `pio test -e esp32-s3-devkitc-1 --without-building --filter test_phase_a*`
- Test folders of interest in `firmware/test/`:
  - `test_phase_a_bounds` — ring index wrapping + fuzz cases.
  - `test_phase_a_seqlock` — seqlock writer/reader snapshot consistency.
  - `test_phase_a_snapshot_bounds` — default initialization + spectral bounds.
- Hardware stress/long‑running tests are excluded by default.

## Validation Tools (repo root `tools/`)
- Beat‑phase logger (CSV):
  - `python tools/poll_beat_phase.py --device http://DEVICE --endpoint /api/device/performance --field beat_phase --interval 0.25 --count 240 --out beat_phase_log.csv`
  - Tip: `export K1_DEVICE_URL=http://DEVICE` to skip `--device`.
- Metronome generator: `python tools/metronome.py --bpm 120 --seconds 60 --outfile metronome_120bpm.wav`
- Analyzer: `python tools/beat_phase_analyzer.py --bpm 120 --log beat_phase_log.csv --out beat_phase_report.csv`
- Concurrency stress (desktop): `g++ -O3 -std=c++17 -pthread tools/seqlock_stress.cpp -o seqlock_stress && ./seqlock_stress --attempts 10000000 --readers 2 --bins 64 --writer-hz 200 --out stress.csv`
- One‑shot validation runner: `bash tools/run_phase_a_validation.sh`

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

## Troubleshooting
- Build signature missing: ensure `platformio.ini` pins and compile flags are intact; verify `/api/health`.
- Timing or RMT gaps spike: reduce debug logging; confirm bounded waits and no busy‑waits in hot paths.
- Mutex warnings: replace with seqlock + atomic sequence counters for shared buffers.
- Large repository clones/pushes: ensure `firmware/.platformio/**` and `*.DS_Store` are ignored (already configured).

## Notes
- PlatformIO caches and SDK/toolchain packages are intentionally ignored (`firmware/.platformio/**`); they are re‑hydrated by the build.
- See the playbook for Phase‑A readiness, gates, and telemetry specifics:
  - `docs/Playbooks/phase_a_security_and_phase0_readiness_playbook.md`
  - `docs/06-reference/phase_a_security_fixes_reference.md`
  - `docs/09-reports/security_fix_validation.md`
