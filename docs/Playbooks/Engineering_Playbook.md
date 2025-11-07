# Engineering Playbook

## Mindset

- Think like an expert
  - Measure-before-cut: add telemetry first, then optimize. Reject “it feels fine” unless counters prove it.
  - Separate concerns: isolate quantize → pack → transmit; input → analysis → snapshot; config → validate → apply.
  - Size for worst‑case, not average. Do the math, then verify with real counters.
  - Fail fast & loud: compile‑time guards (static_assert, header gates), runtime asserts with rate‑limited logs.
  - Design for drift: pin toolchains; print build signatures at boot; guard features with header checks.
  - Look ahead: document invariants and budgets (SLOs). Add rollback paths and safe‑modes before you need them.

- Problem-solve like an expert
  - Define the failure: “first frame, then stall” → RMT starvation/skew. Instrument to prove/refute.
  - Use differential diagnosis: change one variable at a time; keep pins on the environment; compare telemetry traces.
  - Create probes at choke points: refill cadence, max refill gaps, I2S block times, frame timing histograms.
  - Bias to reversible decisions: compile flags, feature gates, optional strict modes.

- Design like an expert
  - APIs and invariants first: strict vs relaxed modes; compile‑time feature gates; static_asserts for geometry.
  - Stateful objects have unique instances: one encoder per RMT channel; no shared mutable state.
  - Good defaults, visible wiring: default LED map = GRB; mapping per channel; mapping packers before transmit.
  - Observability is part of design: REST endpoints and heartbeat lines for critical telemetry.

- Avoid pitfalls like an expert
  - Don’t log in IRAM hot paths; don’t do redundant memory clears.
  - Never silently downgrade features; refuse to build on unmet strict requirements.
  - Keep timeouts bounded; skip work on failure rather than stall main loops.
  - Have a build signature; pin platforms; treat toolchain upgrades as RFCs.

---

## Architecture Principles

- Interfaces
  - Strict mode (hard fail):
    ```cpp
    #ifdef REQUIRE_IDF5_DUAL_RMT
    #  if !__has_include(<driver/rmt_tx.h>)
    #    error "Dual-RMT requires IDF5 (driver/rmt_tx.h)"
    #  endif
    #endif
    ```
  - Relaxed mode (adaptive):
    ```cpp
    #if __has_include(<driver/rmt_tx.h>)
      // RMT v2 path
    #elif __has_include(<driver/rmt.h>)
      // RMT v1 path
    #else
      #error "No RMT headers found"
    #endif
    ```

- Invariants
  - Geometry asserts:
    ```cpp
    static_assert(STRIP_LENGTH == NUM_LEDS, "STRIP_LENGTH must equal NUM_LEDS");
    static_assert(STRIP_CENTER_POINT == (NUM_LEDS/2 - 1), "Center must be NUM_LEDS/2 - 1");
    ```

- Concurrency & timing
  - Separate state per encoder:
    ```cpp
    rmt_encoder_handle_t enc_ch1, enc_ch2; // no shared state
    ```
  - Synchronized starts:
    ```cpp
    static portMUX_TYPE mux=portMUX_INITIALIZER_UNLOCKED;
    taskENTER_CRITICAL(&mux);
    rmt_transmit(ch1, enc_ch1, buf1, len1, &cfg);
    rmt_transmit(ch2, enc_ch2, buf2, len2, &cfg);
    taskEXIT_CRITICAL(&mux);
    ```
  - Bounded waits + skip-on-timeout:
    ```cpp
    if (rmt_tx_wait_all_done(ch1, pdMS_TO_TICKS(8))!=ESP_OK) return;
    if (rmt_tx_wait_all_done(ch2, pdMS_TO_TICKS(8))!=ESP_OK) return;
    ```

- Observability
  - Probes and counters:
    ```cpp
    struct RmtProbe { uint32_t empty, done, max_gap_us; uint64_t last_us; };
    // on_mem_empty: ++empty; max_gap_us=max(max_gap_us, now-last_us); last_us=now;
    ```
  - REST exposure:
    ```json
    { "ch1": {"empty": 1523, "maxgap_us": 97}, "ch2": {"empty": 1519, "maxgap_us": 94} }
    ```

---

## Transport Design (LEDs)

- Quantize → Pack → Transmit (QPT)
  1) Quantize CRGBF to `rgb8_data` (canonical RGB order)
  2) Pack per channel by mapping (e.g., GRB) into `raw_led_data[_ch2]`
  3) Transmit both channels with minimal skew

- Per-channel mapping
  ```cpp
  struct LedChannelConfig { uint8_t map[3]; uint16_t length; uint16_t offset; };
  LedChannelConfig ch1{{1,0,2}, NUM_LEDS, 0}; // GRB
  LedChannelConfig ch2{{1,0,2}, NUM_LEDS, 0}; // GRB
  ```

- Worst‑case sizing (RMT)
  - 160 LEDs × 24 bits = 3840 symbols + reset
  - mem_block_symbols = 256 @ 20 MHz → ~320 µs in-flight window
  - Refills per frame ≈ 3840/256 ≈ 15 per channel → ~30 across both → ~160 µs cadence → safe margin

---

## API & Telemetry

- Endpoints
  - /api/health: build signature, degraded flags, last reset cause, uptime
  - /api/rmt: per-channel {empty, maxgap_us}
  - /api/device/performance: fps, frame histograms, cpu/mem
  - /api/params & /api/audio-config: tunables and profiles

- Rate limiting per route/method:
  ```cpp
  {ROUTE_PARAMS, ROUTE_POST, 300, 0}, {ROUTE_RMT, ROUTE_GET, 200, 0}
  ```

---

## Example: Adding a New Hardware Feature Safely

1) RFC: outline options, constraints, decision, fallback
2) Compile-time gates with strict mode option
3) Implement behind `#if` guards
4) Add probes + REST exposure
5) Canary build with DEBUG telemetry on
6) Release: stable flag flip, keep rollback image

---

## Checklists

- Before coding: invariants, worst‑case math, header guards, probes planned?
- During coding: hot path log-free, critical sections minimal, fallback path explicit
- After build: boot signature correct, /api/rmt healthy, no timeouts, histograms acceptable

