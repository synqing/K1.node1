# Engineering Checklist: Safe Pattern Changes

Use this checklist before and after any change to pattern or audio pipeline code that affects visuals.

## Before Change
- [ ] Identify family (Bloom, Tunnel, Spectrum/Octave, Dots) and applicable invariants (see FAMILY_INVARIANTS.md).
- [ ] Confirm no hybridization: if family is SB‑parity, changes must not alter alpha, persistence, shaping, or mirror rules.
- [ ] Validate audio snapshot fields you will consume (VU, chromagram, tempo arrays). Ensure derived in correct order (AGC→autorange).
- [ ] Decide freshness behavior (skip only when `update_counter` unchanged); add static last counter if missing.
- [ ] Confirm shared buffers usage (acquire buffer ID, no memset; only multiplicative decay + sprite additive).

## During Change
- [ ] Preserve center‑origin symmetry and interpolation rules.
- [ ] Do not multiply by `params.brightness` (global color pipeline handles brightness/gamma).
- [ ] Avoid introducing additional calls to `get_audio_snapshot()` from patterns.
- [ ] Add temporary throttled debug logs if necessary (gated by debug toggles), then remove.

## After Change
- [ ] Build with warnings as errors for your units (format strings, reorder warnings, etc.).
- [ ] Run parity harness locally (when available) against golden metrics.
- [ ] Observe heartbeat console deltas (audio_delta > 0, snapshot_delta > 0) while testing.
- [ ] Validate under multiple parameter presets (speed, softness, saturation, palette) and silence vs. active audio.
- [ ] Update Pattern Status Matrix and History with summary + commit hash.

## Common Pitfalls
- Clearing persistence buffers (memset) — destroys trails.
- Freshness mis‑guards — skipping every frame or updating on stale frames.
- AGC/autorange reordering — flattens dynamics.
- Non‑center mirror — violates family symmetry axiom.
- Palette brightness mismatch — deviates from SB chroma‑sum shaping.

