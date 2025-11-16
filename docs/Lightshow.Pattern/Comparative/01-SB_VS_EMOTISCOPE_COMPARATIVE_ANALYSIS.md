# Sensory Bridge vs. Emotiscope: Audio + Visual Pipeline Comparative Analysis

This document compares Sensory Bridge (SB) and Emotiscope across audio and visual pipelines, with explicit selection scenarios. It emphasizes long‑term maintainability, parity, and operational robustness.

## Executive Summary
- SB excels at deterministic visuals with minimal moving parts. Bloom/trails use additive sprite (alpha≈0.99) and chroma‑sum shaping; looks are battle‑tested but infra‑light.
- Emotiscope delivers modern infrastructure: seqlock snapshots, Cochlear AGC, robust logging/heartbeat, OTA/web APIs, dual‑core separation. More moving parts; higher maintainability and observability.
- Recommended architecture: Emotiscope core pipeline + SB‑exact per‑family algorithms (no hybrid inside a family). This yields parity + ops.

## Pipeline Breakdown

### Audio Chain
- SB: Goertzel bins → simple averaging → chromagram → VU/tempo → pattern logic. Lightweight, fewer guards, minimal diagnostics.
- Emotiscope: Goertzel (64 bins) → averaging buffer → Cochlear AGC → autorange → VU/novelty/tempo/chromagram → seqlock snapshot → pattern. Includes I2S timeout fallback, heartbeat, counters.

Key Ordering (must‑keep):
1) Goertzel + smoothing
2) AGC (if enabled)
3) Autorange
4) Derive VU/chromagram/tempo
5) Copy to snapshot exactly once; patterns never re‑read

### Visual Chain
- SB: persistence via additive sprite α≈0.99; memcpy prev; tail fade; mirror; chroma‑sum → HSV shaping → optional hue forcing; strict center‑origin symmetry.
- Emotiscope: same primitives available, but must be applied exactly (no memset of trail buffers; correct alpha; strict mirror from center; sub‑pixel interpolation for spectrum/chroma mapping).

## Evaluation Dimensions

- Computational Resources
  - SB: lower CPU/RAM; fixed‑point friendly; simpler frame loop.
  - Emotiscope: higher CPU/RAM (buffers, web, logs) but acceptable for ESP32‑S3 when profiled.

- Data Throughput
  - SB: steady visual rate, minimal instrumentation.
  - Emotiscope: audio ~40–50 Hz, LED 120–160 FPS; telemetry makes throughput tunable.

- Error Handling/Recovery
  - SB: minimal explicit recovery; simplicity as prevention.
  - Emotiscope: I2S timeouts → silence fallback; heartbeat; seqlock snapshot; freshness guards.

- Development Complexity
  - SB: low; visuals precise but fewer layers. Risk: small deviations cause obvious drift.
  - Emotiscope: higher; more infra to understand; safer boundaries once learned.

- Maintainability
  - SB: strong if static; harder to evolve safely; limited ops.
  - Emotiscope: excellent — clearer APIs, diagnostics, testing, remote ops.

- Scalability
  - SB: scales visually; not infra‑scalable.
  - Emotiscope: scales in features, ops, and multi‑device integration.

- Integration
  - SB: embedded integration only.
  - Emotiscope: REST/WS APIs, OTA, metrics — fits modern infra.

- Unique Features
  - SB: proven bloom persistence, chroma shaping, quantization; visually “right”.
  - Emotiscope: AGC normalization across loudness; heartbeat/logs; shared buffers; palette system.

- Robustness Under Load
  - SB: survives due to simplicity; lacks safety rails.
  - Emotiscope: detects stalls/failures; DSP optimizations for hotspots.

- Downstream Challenges
  - SB: extending or integrating telemetry/AGC is invasive.
  - Emotiscope: must enforce invariants to avoid regressions; larger toolchain.

- Upgrade Path
  - SB: modest; risk of altering look when expanding.
  - Emotiscope: strong; feature growth behind stable APIs.

- Ecosystem/Community
  - SB: smaller infra footprint; relies on Arduino/FastLED.
  - Emotiscope: broader ecosystem (PlatformIO, AsyncWebServer, ArduinoJson, RMTv2).

## Selection Scenarios

### 1) Building This Application (Parity + Ops)
Pick Emotiscope pipeline + SB‑exact per‑family visual algorithms.
- Audio/ops: Emotiscope (seqlock snapshot; heartbeat; I2S fallback; AGC before autorange; REST/WS).
- Visuals: SB‑parity for Bloom/Tunnel and any legacy‑defined families; Emotiscope/K1 styles where SB has no baseline.

Justification
- Guarantees 1:1 visual parity by locking family algorithms.
- Provides professional diagnostics/observability and remote control.
- Decouples ops evolution from look fidelity (patterns remain canonical).

Risks & Mitigations
- Drift from future changes → Keep “SB Parity” variants; add CI parity metrics.
- Developer errors (memset/ordering) → Enforce invariants (see FAMILY_INVARIANTS.md); code asserts; checklist.

### 2) Case for Sensory Bridge
Choose SB end‑to‑end when:
- You want lowest footprint; no web/telemetry; fixed visuals forever.
- You prefer deterministic simplicity and accept minimal diagnostics.

Why SB wins
- Fewer moving parts, fixed‑point friendliness, known visual correctness. Easier to meet tight timing on smaller MCUs.

Tradeoffs
- Harder integration, weaker ops, challenging to add AGC/tempo upgrades without changing the look.

### 3) Case for Emotiscope
Choose Emotiscope when:
- You need production‑grade telemetry, OTA, structured concurrency, and future expansions.
- Multiple patterns/families and fleet ops are in scope.

Why Emotiscope wins
- Observability, structured audio pipeline, safety (seqlock & guards), CI/testability, and better integration options.

Tradeoffs
- Requires discipline to avoid visual drift; enforce family invariants and pipeline ordering.

## Expert Notes & Long‑Term Considerations
- Never hybridize algorithms inside a family. SB bloom rules (alpha=0.99, additive sprite, chroma‑sum shaping) must remain intact.
- Treat pipeline ordering as a contract: AGC before autorange; derive VU/chromagram/tempo from AGC‑processed values; snapshot once; patterns only consume the snapshot.
- Bake invariants into code (asserts/lints) and docs. Add a parity harness for Bloom/Tunnel with “golden frame” metrics.

References (repo)
- SB bloom: `zref/Sensorybridge.sourcecode/.../lightshow_modes.h` (draw_sprite α≈0.99, chroma sum)
- Emotiscope audio: `firmware/src/audio/goertzel.*` (AGC → autorange → snapshot)
- Pattern rules: `firmware/src/patterns/*`, `firmware/src/emotiscope_helpers.*`

