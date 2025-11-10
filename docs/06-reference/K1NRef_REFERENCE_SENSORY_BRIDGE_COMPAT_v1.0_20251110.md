Sensory Bridge → Graph System Compatibility Map

Purpose
- Orient pattern porting from Sensory Bridge/Emotiscope code to the K1 Graph System.
- Identify functional equivalents and small semantic differences.

At-a-Glance Mapping
- Spectrum sampling
  - SB: direct bin indexing, sometimes with smoothing
  - Graph: BandShape + interpolate(AUDIO_SPECTRUM_SMOOTH, NUM_FREQS)
  - Note: interpolate removes stepping artifacts; use ParamF gain for response tuning

- HSV/Color mapping
  - SB: hsv2rgb_spectrum(h,s,v)
  - Graph: hsv_to_rgb(h,s,v) or palette via ColorizeBuffer/GradientMap
  - Note: Prefer palette mapping for stylistic parity; hsv_to_rgb for algorithmic control

- Palettes
  - SB: custom palettes inline
  - Graph: color_from_palette(get_params().palette_id, progress, brightness)
  - Note: Use ParamF/ParamColor to drive progress and brightness from UI

- Mirroring and transforms
  - SB: manual buffer symmetry operations
  - Graph: Mirror, Shift, Downsample, Blur nodes map to graph_runtime helpers
  - Note: ComposeLayers blends buffers (add/multiply/screen); keep out-of-place for simplicity

- Dots/overlays
  - SB: draw_dot positions per-LED
  - Graph: DotRender with indices[] param and palette-colored dots
  - Note: Extend with explicit colors/width if parity is needed

- Persistence/trails
  - SB: rolling buffers with decay
  - Graph: BufferPersist with decay param (<1KB state per ADR-0007 policy variant)
  - Note: Emits into state.persist_buf, then written to allocated output buffer

- Audio snapshot
  - SB: direct audio state access
  - Graph: PATTERN_AUDIO_START(); single snapshot per frame; AUDIO_SPECTRUM/_SMOOTH macros

Semantic Notes
- Auto-ranging: AUDIO_SPECTRUM is normalized; use AUDIO_SPECTRUM_ABSOLUTE via pattern_audio_interface if absolute loudness matters.
- Color clamping: Emitter clamps before PatternOutput; keep node math unclamped to preserve headroom.
- NUM_LEDS: Graph emitter uses firmware NUM_LEDS; Sensory Bridge examples may assume fixed sizes.

Porting Tips
- Start with BandShape + ColorizeBuffer + Mirror to replicate most SB baseline looks.
- Replace hsv2rgb_spectrum with GradientMap/ColorizeBuffer using firmware palettes.
- Use ParamF nodes for responsiveness/sensitivity; wire to UI via firmware parameters.



Examples (side‑by‑side)

- Example 1: Spectrum → Palette mapping

SB (conceptual):
```
for each LED i:
  idx = spectrum[i]
  rgb[i] = hsv2rgb_spectrum(idx, 1.0, 1.0)
```

Graph JSON:
```
{
  "nodes": [
    { "id": "audio", "type": "AudioSpectrum" },
    { "id": "band",  "type": "BandShape", "inputs": { "src": "audio" } },
    { "id": "color", "type": "ColorizeBuffer", "inputs": { "index_buf": "band" } },
    { "id": "out",   "type": "LedOutput", "inputs": { "color": "color" } }
  ]
}
```

- Example 2: Trails (persistence)

SB (conceptual):
```
state[i] = decay * state[i] + (1-decay) * input[i]
```

Graph JSON:
```
{
  "nodes": [
    { "id": "audio", "type": "AudioSpectrum" },
    { "id": "band",  "type": "BandShape", "inputs": { "src": "audio" }, "params": { "gain": 1.1 } },
    { "id": "trail", "type": "BufferPersist", "inputs": { "src": "band" }, "params": { "decay": 0.92 } },
    { "id": "rgb",   "type": "ColorizeBuffer", "inputs": { "index_buf": "trail" } },
    { "id": "out",   "type": "LedOutput", "inputs": { "color": "rgb" } }
  ]
}
```

- Example 3: Dot overlays

SB (conceptual):
```
for peak in peaks:
  draw_dot(leds, peak.index, color(peak), opacity)
```

Graph JSON:
```
{
  "nodes": [
    { "id": "rgb", "type": "ColorizeBuffer", "inputs": { "index_buf": "band" } },
    { "id": "dots", "type": "DotRender", "inputs": { "base_buf": "rgb" }, "params": { "indices": [10,30,50] } },
    { "id": "out",  "type": "LedOutput", "inputs": { "color": "dots" } }
  ]
}
```
