# Firmware Ops Runbook

## Mindset

- Precision over convenience: pin everything, print signatures, reject mismatches.
- Health before features: SLOs, histograms, degraded flags, safe‑mode boot.
- Pragmatic observability: minimal counters by default, rich telemetry in debug/canary.
- Rollback ready: prior image, manual and auto triggers; keep recovery endpoints alive.

---

## Environment Control

- Pin platform and framework (PlatformIO):
```ini
[env:esp32-s3-devkitc-1]
platform = espressif32@6.12.0
framework = arduino
platform_packages = platformio/framework-arduinoespressif32@3.20017.241212
```

- Build signature at boot (and /api/health):
```cpp
#ifdef ARDUINO
build["arduino"] = ARDUINO;
#endif
#ifdef IDF_VER
build["idf_ver"] = IDF_VER;
#endif
```

- Preflight checks: header presence, strict mode flags (doctor script).

---

## Release Flow

- Channels: canary (DEBUG_TELEMETRY on) → stable. Keep one rollback image.
- Health gate: check RMT timeouts=0, rmt_maxgap_us well below window, frame SLO satisfied.
- Signing (optional): attach hash & timestamp to artifact and include in /api/health.

---

## Runtime Safety

- Safe-mode boot
  - After N consecutive boot loops, start with LEDs off, minimal WiFi, only `/api/health` and `/api/rollback`.
- Watchdogs & budgets
  - Task watchdogs for main loops; count timeouts; set degraded flags if SLOs breached.
- Brownout & reset cause
  - Enable brownout; expose last reset cause and boot counters in /api/health.

---

## Observability

- Heartbeat: fps, idle, rmt_empty, rmt_maxgap_us, cpu/mem (with histograms in debug).
- REST endpoints
  - /api/rmt → { ch1: {empty, maxgap_us}, ch2:{…} }
  - /api/device/performance → frame time P50/95/99, CPU %, memory, fps history
  - /api/health → build signature, degraded, reset causes
  - /api/params, /api/audio-config → tunables; profile switch route

---

## Testing & Verification

- CI Smoke (local or Actions)
  - Build debug & release, check signature strings, curl `/api/health`, `/api/rmt`, `/api/device/performance`.

- Hardware-in-loop
  - Logic analyzer on LED pins: verify bit widths (T0H/T0L, T1H/T1L), reset period, and start skew < 10 µs.
  - Stress WiFi/audio replay in debug; confirm refill cadence and no timeouts.

---

## Incident Response

- Triage flow
  1) /api/health → build signature, degraded flags, reset cause
  2) /api/rmt → refill counters & max gaps (are they spiking?)
  3) /api/device/performance → frame time histograms
  4) Serial logs (if DEBUG enabled)

- Mitigations
  - Increase mem_block_symbols (if headroom), trans_queue_depth
  - Toggle DMA on secondary, bump intr_priority, or separate RMT groups
  - Strict-mode build to catch header/API drift

---

## Operational Playbook Snippets

- Quiet-mode transmit skip:
```cpp
if (audio_level < 0.01f) if (++quiet >= 10) { vTaskDelay(1); return; } else quiet=0;
```

- Critical section dual-post:
```cpp
taskENTER_CRITICAL(&mux);
rmt_transmit(ch1, enc1, buf1, len1, &cfg);
rmt_transmit(ch2, enc2, buf2, len2, &cfg);
taskEXIT_CRITICAL(&mux);
```

- Timeout skip with rate-limited warning:
```cpp
if (rmt_tx_wait_all_done(ch, pdMS_TO_TICKS(8))!=ESP_OK) { warn_rl(); return; }
```

---

## Checklists

- Pre‑release: build signature OK; /api/* endpoints accessible; no timeouts; RMT gaps ≪ window.
- Post‑release: canary health 10–15 min; promote to stable; lock rollback image ref.
- Postmortem template: impact, timeline, root cause, guardrails added.

