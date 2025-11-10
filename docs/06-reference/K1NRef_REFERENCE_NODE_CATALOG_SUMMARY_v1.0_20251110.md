
# Node Catalog Reference (v1)

Status: Stable for Phase 1
Audience: Graph authors and codegen developers

Legend
- Ports: required ports are marked •
- Types: scalar (`float`), color (`color`), buffers (`led_buffer_float`, `led_buffer_vec3`)
- Notes: helpers called in firmware, performance hints

## Summary Table

| Node | Inputs (• required) | Outputs | Params | Helper | In-place |
|------|----------------------|---------|--------|--------|----------|
| Time | — | time | — | — | — |
| AudioSpectrum | — | audio_spectrum | — | — | — |
| ParamF | — | param_float | name | get_params | — |
| ParamColor | — | color | — | color_from_palette | — |
| Add | a,b (float|color|vec3) | same | — | per-LED | vec3: yes (first) |
| Mul | a,b (float|color|vec3) | same | — | per-LED | vec3: yes (first) |
| Lerp | a,b (float|color|vec3), t | same | — | per-LED | vec3: yes (first) |
| Clamp | value, min?, max? | float | — | std::clamp | — |
| Pow | base, exponent? | float | — | powf | — |
| Sqrt | x | float | — | sqrtf | — |
| Hsv | h, s?, v? | color | — | hsv_to_rgb | — |
| Desaturate | color | color | mode | desaturate | — |
| ForceSaturation | color | color | strength | force_saturation | — |
| PaletteSelector | index | color | — | color_from_palette | — |
| BandShape | src• | led_buffer_float | gain, smoothing | interpolate | — |
| BufferPersist | src• | led_buffer_float | decay | state.persist_buf | — |
| ColorizeBuffer | index_buf• | led_buffer_vec3 | — | palette | — |
| GradientMap | index• | led_buffer_vec3 | — | palette | — |
| Fill | color• | led_buffer_vec3 | — | fill_buffer | — |
| Mirror | src• | led_buffer_vec3 | — | mirror_buffer | — |
| Blur | src• | led_buffer_vec3 | radius | blur_buffer | no |
| Shift | src• | led_buffer_vec3 | offset | shift_buffer | no |
| Downsample | src• | led_buffer_vec3 | factor | downsample_buffer | no |
| DotRender | base_buf | led_buffer_vec3 | indices[], blend | dot_render | n/a |
| ComposeLayers | base•, overlay• | led_buffer_vec3 | blend_mode, opacity | compose_layers | base: yes (add/mul; opacity=1; single-use) |
| LedOutput | color• | — | — | clamped_rgb | — |
| LedOutputMirror | color• | — | — | clamped_rgb | — |

Performance Notes
- In-place is limited and gated; use `--no-inplace` while developing.
- Large Blurs are costly; prefer small radii or pre-blurred assets.
- Keep BandShape gain moderate; inspect `dump-typed.json` for types.

---

## Port Names Quick Reference

- BandShape: `src`
- BufferPersist: `src`
- ColorizeBuffer: `index_buf`
- GradientMap: `index`
- Fill: `color`
- Mirror: `src`
- Blur: `src`
- Shift: `src`
- Downsample: `src`
- DotRender: `base_buf`
- ComposeLayers: `base`, `overlay`
- LedOutput: `color`
- LedOutputMirror: `color`
