# Sensory Bridge vs. Emotiscope: Audio + Visual Pipeline Comparative Analysis (Legacy Code)

This compares the original Sensory Bridge (SB) firmware vs. the original Emotiscope firmware (as provided under `zref/`). It focuses strictly on how each implemented audio and visual pipelines — no mixing and no modern additions like Cochlear AGC.

## Executive Summary
- Both SB and Emotiscope share a broadly similar structure: Goertzel bins → smoothing/autoranging → chromagram/VU/tempo → pattern rendering with strong reliance on additive sprite persistence and center‑origin symmetry.
- Differences are in numeric representation and a few shaping details: SB uses fixed‑point CRGB16 utilities and explicit LED quantization/dithering paths; Emotiscope uses float CRGBF utilities, a slightly different VU autorange and chromagram scale, and simpler quantization.
- Neither legacy codebase uses Cochlear AGC. Loudness adaptation is via auto‑range/auto‑scale (IIR max tracking) and a VU floor calibration.

## Pipeline Breakdown (as implemented in zref)

### Audio Chain
- Sensory Bridge (SB)
  - Goertzel (musical bins) with per‑frame calculation; moving averages for smoothing.
  - Auto‑ranger: IIR max tracker (`max_val_smooth`) to compute `autoranger_scale`; clamps below a floor.
  - Chromagram: 12‑bin pitch‑class sum from smoothed spectrum; brightness shaping typically uses squared magnitudes.
  - VU: RMS/peak‑style level; simple gating/flooring; no AGC.
  - Tempo: Goertzel‑style beat bins with their own autoranger and phase.

- Emotiscope (legacy)
  - Goertzel (musical bins) with `NUM_SPECTROGRAM_AVERAGE_SAMPLES` (default 8) circular averaging to form `spectrogram_smooth`.
  - Auto‑ranger: IIR `max_val_smooth` normalization (same principle as SB) with a minimum floor; `autoranger_scale = 1/max_val_smooth`.
  - Chromagram: simple sum of `spectrogram_smooth[i]/5.0` into 12 bins; often squared later for brightness.
  - VU: measurement over recent audio chunk, subtract configurable `vu_floor`, then auto‑scale by capped max amplitude (`max_amplitude_cap`) — no AGC.
  - Tempo: similar to SB — normalized magnitudes with IIR peak tracking and a separate autoranger.

Key Shared Ordering
1) Goertzel → smoothing (moving average)
2) Auto‑ranging (IIR max)
3) Derive VU/chromagram/tempo
4) Render patterns

### Visual Chain
- Shared ideas
  - Persistence via additive sprite scrolling with high alpha (~0.99) for Bloom‑style trails.
  - Center injection then tail fade and mirroring to enforce center‑origin symmetry.
  - Hue/brightness mapping in HSV; several modes square brightness for “pop”.

- SB specifics
  - CRGB16 fixed‑point utilities in `led_utilities.h`: `hsv`, `lerp_led_16`, `quantize_color`, temporal dither tables, `apply_brightness` (master brightness ramp), and `draw_sprite(CRGB16)` with alpha.
  - Bloom center color via chromagram^2 × share summed in HSV; then optional force hue; memcpy previous frame; tail fade; mirror.

- Emotiscope specifics
  - CRGBF float utilities in `leds.h`: `hsv(float)`, `draw_sprite(float[])` with alpha, float trail images for novelty Bloom, etc.
  - Bloom (“novelty”) uses `draw_sprite(novelty_image, novelty_image_prev, ..., 0.99)` and squares brightness for the palette color — nearly the same persistence behavior as SB.

## Evaluation Dimensions (Legacy vs. Legacy)

- Computational Resources
  - SB: More fixed‑point in the visual layer → predictable CPU, minimal float in pattern draws; Goertzel math still float. Low working‑set RAM thanks to CRGB16 buffers.
  - Emotiscope: Float CRGBF buffers for many visuals (novelty, spectrum, etc.), 8‑frame spectral averaging buffers, VU/spectrum histories → higher RAM but still within ESP32‑class limits.

- Throughput
  - Both: Designed to render smoothly at LED frame rates with audio updates in the tens of Hz. Emotiscope’s circular averages add small overhead.

- Error Handling
  - Neither legacy code has modern watchdog/heartbeat; they assume steady I2S/audio. Emotiscope exposes configuration (e.g., `vu_floor`) to compensate environments; SB uses similar floors and calibration.

- Development Complexity
  - SB: Slightly lower cognitive load in visuals via CRGB16 helpers; pattern logic tightly coupled to those utilities.
  - Emotiscope: Slightly more moving parts (float buffers, averaging, histogram‑like state) but straightforward once the moving average and autoranger are understood.

- Maintainability
  - SB: Easy to keep static; evolving visuals safely requires discipline around fixed‑point conversions and quantization.
  - Emotiscope: Easy to tweak visuals numerically in float; risk of drift if you change squared/scale factors casually.

- Scalability
  - Both: Primarily single‑device firmware; neither legacy codebase provides production‑grade APIs/telemetry out of the box. Emotiscope includes some WebSocket notes/examples for local tooling.

- Integration
  - SB: Minimal integration; typical Arduino/FastLED style.
  - Emotiscope: Slightly better developer ergonomics (preferences, UI notes, websocket tooling), but still not a full ops stack.

- Unique Advantages
  - SB: Tight quantization/dithering, master brightness handling, proven bloom/trail “feel”.
  - Emotiscope: Simpler float‑based visuals; clean novelty Bloom implementation; often easier to prototype visual math changes.

- Robustness Under Load
  - Both: Robust by simplicity; lack of advanced error recovery/telemetry means failures are opaque.

- Downstream Challenges
  - SB: Extending with new features must respect fixed‑point pipelines and quantization; porting visuals to float risks parity loss.
  - Emotiscope: Changes to averaging or scale factors will alter look quickly; must document those factors carefully.

- Upgrade Path
  - Both: Limited. Adding modern ops (telemetry, OTA, heartbeat) requires architectural additions beyond the legacy code.

## Selection Scenarios (Legacy‑only)

### 1) Building This Application (strict visual parity, minimal complexity)
Choose SB end‑to‑end if the priority is: identical Bloom feel, established quantization/dithering, and minimal changes. SB’s CRGB16 utilities lock in the intended behavior and make it harder to accidentally change persistence/brightness.

Justification
- SB’s Bloom/Trail is canonical and matches the expected look: draw_sprite alpha≈0.99, chromagram^2 sum, memcpy prev, tail fade, mirror.
- CRGB16 + quantization reproduces the on‑wire “glow”.

Tradeoffs
- Less flexible for rapid visual math experimentation compared to Emotiscope’s float math.
- Still lacks modern ops unless you add them.

### 2) Case for Sensory Bridge (why it can be better)
- Determinism: fixed‑point quantization + defined dithering → consistent look across environments.
- Bloom parity: the center‑inject + trail pipeline is encoded verbatim.
- Simplicity: fewer float buffers/state — easier to reason about persistence and mirror rules.

Costs
- Harder to add novel visual computations; integer paths make some experiments clunkier.
- Minimal infra for error visibility.

### 3) Case for Emotiscope (why it can be better)
- Visual prototyping: float CRGBF math and novelty images make it easy to tune curves (e.g., squaring, palette brightness) without fighting fixed‑point.
- Spectrum averaging: the 8‑frame spectral average is explicit and easy to tweak for responsiveness vs. stability.
- VU autorange knobs: `vu_floor` and `max_amplitude_cap` provide practical adaptation in various rooms.

Costs
- Easy to introduce drift: small scale/curve changes alter look; requires strict documentation and review.
- No built‑in ops; any telemetry/OTA must be added.

## Expert Notes
- The two codebases converge on the same visual truths: additive sprite persistence (alpha≈0.99), center‑origin symmetry, chromagram‑driven color/brightness shaping, squared brightness for pop, and moving‑average autoranging. That’s why you can port between them if you preserve these invariants.
- The biggest practical difference is numeric representation and helper ecosystems (CRGB16+quantization vs. CRGBF floats). Pick the one that matches your maintenance style and parity targets.

References (zref paths)
- SB Bloom/trails/quantization: `zref/Sensorybridge.sourcecode/SensoryBridge-4.0.0/SENSORY_BRIDGE_FIRMWARE/lightshow_modes.h`, `.../led_utilities.h`
- Emotiscope Bloom/novelty + sprite: `zref/Emotiscope.sourcecode/Emotiscope-1.0/src/lightshow_modes/bloom.h`, `.../leds.h`
- Emotiscope VU autorange/floor: `zref/Emotiscope.sourcecode/Emotiscope-1.0/src/vu.h`
- Emotiscope spectrogram averaging + autoranger: `zref/Emotiscope.sourcecode/Emotiscope-1.0/src/goertzel.h`
