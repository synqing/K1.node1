# Pattern Family Invariants (Non‑Negotiable Rules)

These guardrails prevent visual drift and runtime regressions. They apply to all contributors and all future changes.

## Global
- Single snapshot per frame: patterns consume `PatternRenderContext.audio_snapshot` only. No `get_audio_snapshot()` calls from patterns.
- Freshness: per‑pattern static `last_update_counter`; skip work only when the counter is unchanged. Do not skip on “counter == 0”.
- Pipeline order: AGC → autorange → derive VU/chroma/tempo → copy to snapshot. Never reorder.
- Trail persistence: do not `memset` persistent buffers. Apply multiplicative decay only; scrolling is additive via sprite.
- Center‑origin symmetry: equal distance from center must map to equal color. Always mirror correctly.
- Interpolation: use `interpolate()` for spectrum/chromagram → LED mapping to avoid stepping.
- Color pipeline: do not multiply by `params.brightness` in patterns; global pipeline handles brightness/gamma.

## Bloom Family (SB Parity)
- Sprite alpha: 0.99. High persistence is mandatory.
- Scroll: `draw_sprite` additive; copy to prev via `memcpy` at the correct time.
- Brightness shaping (non‑chromatic): chromagram^2 × 1/6 summed in HSV; square once; map summed V into palette brightness.
- Center injection: only at center (two mid LEDs); then tail fade (quadratic) and mirror.

## Tunnel Family (Beat‑Driven Trails)
- Persistence: sprite additive on shared buffers; never zero entire frame via memset.
- Tempo data: `tempo_magnitude[]` and `tempo_phase[]` must be copied to snapshot before `finish_audio_frame()`.
- Gating: small strength cutoff (<0.02) allowed; Gaussian spread around a computed center index.

## Spectrum/Octave Family
- Mapping: sub‑pixel interpolation for bins (spectrum) or chroma (octave) to LED positions.
- Freshness: required; skip renders only when `update_counter` unchanged.
- Age‑based decay: optional linear taper for frames older than ~250 ms to smooth silence.

## Dots (Analog/Metronome/Hype)
- Dot layers: preserve decay only; never overwrite with memset. Use the decay constant defined in helpers.
- Positioning: sub‑pixel correct; width/intensity conforms to helper behavior.

## Enforcement
- Add static asserts in helpers to prevent accidental memset in sprite/dot paths.
- Add CI lint for banned calls in `patterns/` (e.g., `memset` on persistent arrays).
- Maintain “SB Parity” variants for A/B and as a source of truth.

