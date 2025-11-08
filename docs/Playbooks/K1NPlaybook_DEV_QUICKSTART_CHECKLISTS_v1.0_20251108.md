# Dev Quickstart & Checklists

## Mindset

- Reproducible by default; measurable by default; rollback by default.
- Keep hot paths simple; push complexity to init/config/debug layers.
- Small, reversible steps; feature gates; delete dead code quickly.

---

## Quickstart

1) Pin environment (platformio.ini):
```ini
[env:esp32-s3-devkitc-1]
platform = espressif32@6.12.0
framework = arduino
platform_packages = platformio/framework-arduinoespressif32@3.20017.241212
```

2) Build & flash:
```bash
pio run -t upload
pio device monitor -b 2000000
```

3) Verify build signature at boot and via API:
```bash
curl http://<ip>/api/device/info | jq
```

4) Verify RMT telemetry:
```bash
curl http://<ip>/api/rmt | jq   # empty counts rising; maxgap_us well under ~300
```

5) Verify performance:
```bash
curl http://<ip>/api/device/performance | jq
```

---

## Design Checklist

- Target headers/APIs identified? (`__has_include` guards)
- Strict/relaxed mode planned? (compile-time error vs fallback)
- Invariants defined? (`static_assert` + runtime assertions)
- Worst‑case math done? (symbols, timings, buffers)
- Telemetry points set? (counters, histograms, REST exposure)
- Fallback/rollback path defined?

---

## Implementation Checklist

- Hot path log-free (wrap logs in `#if DEBUG_*`).
- QPT split: Quantize → Pack → Transmit; separate encoder state per channel.
- Critical sections minimal; bounded waits + skip-on-timeout (rate-limited warnings).
- New tunables/probes round-trip in REST and are rate-limited.

---

## Verification Checklist

- Boot signature matches pinned config.
- /api/rmt healthy (steady refill cadence; max gaps ≪ in-flight window).
- No timeouts in logs; fps steady; heartbeats clean.
- Logic analyzer (if timing changed): symbol widths and skew within spec.

---

## Release Checklist

- Tag build with semver + channel; attach build signature and hash.
- Canary with DEBUG_TELEMETRY → pass health gate → promote to stable.
- Rollback image preserved; ADR added with decision and metrics.

---

## Useful Snippets

- Header gate for IDF split vs legacy:
```cpp
#if __has_include(<driver/rmt_tx.h>)
  // new API
#elif __has_include(<driver/rmt.h>)
  // legacy API
#else
#  error "No RMT headers available"
#endif
```

- Static invariants:
```cpp
static_assert(STRIP_LENGTH == NUM_LEDS, "");
static_assert(STRIP_CENTER_POINT == (NUM_LEDS/2 - 1), "");
```

- Per‑channel pack:
```cpp
out[i*3+0] = rgb[src*3 + map[0]];
out[i*3+1] = rgb[src*3 + map[1]];
out[i*3+2] = rgb[src*3 + map[2]];
```

- Dual-post critical section:
```cpp
taskENTER_CRITICAL(&mux);
rmt_transmit(ch1, enc1, buf1, len1, &cfg);
rmt_transmit(ch2, enc2, buf2, len2, &cfg);
taskEXIT_CRITICAL(&mux);
```

