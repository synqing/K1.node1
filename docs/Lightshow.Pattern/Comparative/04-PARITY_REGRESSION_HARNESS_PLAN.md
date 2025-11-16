# Parity Regression Harness Plan (Bloom/Tunnel)

Goal: Prevent visual drift by validating key metrics under synthetic audio against “golden frames”.

## Scope
- Families: Bloom, Bloom Mirror, Tunnel Glow, Beat Tunnel (+variant).
- Inputs: Scripted audio profiles (steady tone, kick/snare pulses, chroma sweeps) and parameter presets.

## Metrics
- Sprite alpha invariance: aggregate trail energy decay rate matches reference (alpha≈0.99 for Bloom family).
- Center injection: brightness at center LEDs vs. summed chroma V curve.
- Tail fade: end‑segment quadratic attenuation trend.
- Mirror symmetry: L/R per‑LED color equality within epsilon.
- Tunnel response: tempo_magnitude energy sum; peak bin index stability across sweeps.

## Test Method
1. Run firmware in a “headless” mode or on device with audio stubs that feed scripted profiles.
2. Capture N frames of LED buffer per test case (pre‑color‑pipeline or post, but consistent).
3. Compute metrics; compare to stored golden metrics (JSON) with tolerances.
4. Fail CI if deviation exceeds bounds; attach diff heatmap for review.

## Artifacts
- `golden/` directory with JSON summaries per test (family, case, tolerance, metrics).
- Helper script to replay tests and update goldens intentionally (after explicit approval).

## CI Integration
- Add a custom PlatformIO target that runs headless tests with `-DTEST_PARITY=1`.
- Upload artifacts as build outputs; present summary table in CI logs.

## Notes
- Keep goldens device‑agnostic by capturing normalized metrics (0..1) rather than raw 8‑bit RGB.
- Track both average and worst‑case deltas; small device‑specific timing jitter is acceptable within epsilon.

