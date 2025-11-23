# SensoryBridge Framework Parity Checklist (K1.node1)

**Canonical Reference:** SensoryBridge firmware (Bloom/trails/quantization, tempo/VU behavior) as described in `01-SB_VS_EMOTISCOPE_COMPARATIVE_ANALYSIS.md` and zref `Sensorybridge.sourcecode`.

**Scope:** Track K1.node1 firmware alignment with SensoryBridge across the audio pipeline, visual/color pipeline, and core pattern families. Status values:
- `Aligned (SB)`: Behavior matches SensoryBridge invariants.
- `ES-leaning (acceptable)`: Matches Emotiscope but is visually acceptable under SB constraints.
- `Needs Change`: Not yet consistent with SB; requires work.
- `TBD`: Requires targeted forensic verification.

---

## 1. Audio Pipeline Parity

| Item | SB Expectation | K1.node1 Reference | Status | Notes |
|------|---------------|--------------------|--------|-------|
| Goertzel → smoothing order | Goertzel bins → moving average → autorange; no AGC layer | `firmware/src/audio/goertzel.cpp`, `K1NAnalysis_EMOTISCOPE_AUDIO_PARITY_AUDIT_v1.0_20251114.md` | ES-leaning (acceptable) | Current chain matches Emotiscope-style autorange; SB shares same high-level order. No Cochlear AGC in SB, and AGC has been removed from K1. |
| Autoranger behavior | IIR max tracker with floor; fast attack, slow release; global scale applied post-smoothing | `goertzel.cpp`, `K1NAnalysis_EMOTISCOPE_AUDIO_PARITY_AUDIT_v1.0_20251114.md` | ES-leaning (acceptable) | Numeric constants taken from Emotiscope. Confirm SB constants and adjust only if visual behavior diverges. |
| VU computation | VU derived from smoothed spectrum with bass/treble weighting; floor clamped; no AGC | `goertzel.cpp` VU block; `K1NAnalysis_ANALYSIS_AUDIO_PIPELINE_FORENSIC_v1.0_20251108.md` | Aligned (SB) | Behavior matches SB narrative (no AGC, spectrum-based level). Further tuning should reference SB test scenes. |
| Tempo calculation | Goertzel over novelty; independent tempo bins; confidence and phase tracked; autoranged | `firmware/src/audio/tempo.cpp`; tempo analysis docs | ES-leaning (acceptable) | Implementation matches Emotiscope spec; SB uses similar structure. Treat as shared baseline unless SB evidence demands tweaks. |
| Tempo snapshot sync | `tempo_magnitude[]`/`tempo_phase[]` copied to snapshot every frame; never zeroed | `goertzel.cpp:600-654` (post-fix `1af9c2f`); TEMPO_* docs | Aligned (SB) | Critical bug fixed; matches SB invariant that patterns always see real tempo data. |
| Chromagram derivation | 12-bin pitch-class sum from smoothed spectrum; optional squared magnitudes | `goertzel.cpp` chroma paths; chroma helpers | TBD | Needs direct comparison against SB `chromagram` implementation and test playback scenes. |
| Silence handling | Low-level floor on max amplitude; defined silence threshold; stable behavior in quiet rooms | `goertzel.cpp` thresholds; `emotiscope_tempo_analysis.md` | TBD | Verify SB thresholds and apply if K1 feels too sensitive/insensitive in silence. |

---

## 2. Visual / Color Pipeline Parity

| Item | SB Expectation | K1.node1 Reference | Status | Notes |
|------|---------------|--------------------|--------|-------|
| Center-origin symmetry | Equal distance from center → identical color; strict mirroring | `firmware/src/patterns/*.hpp`; `FAMILY_INVARIANTS.md` | Aligned (SB) | Enforced via helpers and invariants; maintain as non-negotiable. |
| Trail persistence (Bloom/trails) | High-alpha sprite (≈0.99) with additive scroll; no memset on persistent buffers | `emotiscope_helpers.h` sprite/trail helpers; Bloom patterns | TBD | Confirm alpha constants and no stray `memset` use on trail buffers; adjust to match SB feel under harness. |
| Background / ambient behavior | SB: persistent ambient glow controlled by master brightness and quantization; never fully black unless intended | Color pipeline docs; pattern idle sections | Needs Change | Phase 2 intentionally disabled `apply_background_overlay()`. SB baseline requires ambient behavior for key modes (Bloom, Tunnel). |
| Brightness & gamma | Global brightness/gamma applied in color pipeline; patterns avoid manual brightness scaling | `color_pipeline.cpp`; pattern templates | ES-leaning (acceptable) | Templates still multiply by `params.brightness` in patterns. Long term, consolidate brightness in pipeline and keep pattern math SB-consistent. |
| Quantization & dithering | CRGB16 quantization with defined dither tables; trail look depends on this | SB zref `led_utilities.h`; `01-SB_VS_EMOTISCOPE_COMPARATIVE_ANALYSIS.md` | Needs Change | K1 currently uses float CRGBF without explicit SB-style quantization. Short term, simulate SB curves; long term, consider introducing SB-style quantization layer. |
| Idle animations | Non-blank idle behavior for audio-unavailable states; visually pleasing but restrained | Pattern templates; `FORENSIC_PATTERN_COMPARISON.md` | Aligned (SB) | Most Tier-1 patterns have idle paths. Keep this a hard requirement for new work. |

---

## 3. Pattern Family Parity (Tier-1 Focus)

Use `FORENSIC_PATTERN_COMPARISON.md`, `PATTERN_CODE_EVIDENCE.md`, and SB zref code to drive detailed verification.

| Family / Pattern | SB Expectation (High Level) | K1.node1 Status vs SB | Notes / Next Actions |
|------------------|-----------------------------|-----------------------|----------------------|
| Spectrum / Octave | Center-origin spectrum/chroma; palette-based color; perceptual response curves; smooth interpolation | ES-leaning (acceptable) | Verified correct vs Emotiscope; SB uses same conceptual behavior. Validate against SB playback scenes; adjust response curves only if SB and ES differ perceptibly. |
| Bloom / Bloom Mirror | Canonical SB Bloom/trails feel: chroma-driven center injection, additive sprite trails, strong persistence, quantized output | Needs Change | K1 Bloom is architecturally correct but uses float CRGBF and may differ in persistence/quantization. Use SB playback + regression harness to tune alpha, decay, and color quantization to SB. |
| Snapwave | Spectrum/tempo hybrid with center-origin waves and safe audio guards | Aligned (SB) | Recently fixed with audio validity guard; treat as SB-aligned unless SB behavior says otherwise. |
| Prism | SB-style frequency+beat “hero” pattern with trail glow and chroma awareness | ES-leaning (acceptable) | Currently designed using Emotiscope-inspired Spectrum principles. Evaluate against SB expectations; keep if it fits SB visual language. |
| Tunnel Family (Beat Tunnel / Tunnel Glow / Variants) | Beat/tempo-driven tunnel with sprite-based trails, tempo phase use, quantized feel | Needs Change | Tempiscope/Beat Tunnel historically mismatched due to tempo data issues and architecture drift. Revisit against SB’s tunnel implementation and the fixed tempo pipeline. |
| Perlin / Ambient Noise Field | Procedural pattern that remains pleasant under silence and subtle under music | ES-leaning (acceptable) | Architecture is fine; ensure audio guards and fallback modes match SB’s expectations for “safe” ambient visuals. |
| Dots (Analog / Metronome / Hype) | Dot overlays with proper decay and sub-pixel positioning; harmonize with SB’s chromatic modes | TBD | Requires direct comparison to SB `lightshow_modes.h` for dot behavior, then tuning K1 node graphs and pattern parameters accordingly. |

---

## 4. Process & Guardrails (SB-Centric)

- **Spec Hierarchy:** When SB and Emotiscope differ, **SB wins**. Emotiscope may still be used to fill gaps where SB has no implementation.
- **Change Review:** Any change touching `firmware/src/audio/*`, `firmware/src/color_pipeline.*`, or `firmware/src/patterns/*` must state its SB impact explicitly (which checklist items change and why).
- **Regression Harness:** Implement and maintain the plan in `04-PARITY_REGRESSION_HARNESS_PLAN.md` using SB playback scenes as the source of golden metrics.
- **Baseline Tag:** Once the majority of rows above are marked `Aligned (SB)` or `ES-leaning (acceptable)` with justification, tag the repo as `k1-sb-baseline-v1` and treat it as the golden reference for future work.

