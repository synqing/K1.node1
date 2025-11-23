# Workstream C – SB Spectrum and Octave Patterns

This document defines the complete task for implementing SensoryBridge-style spectrum and octave patterns in `K1.PRISM.node`.

Read this ENTIRE document before writing any code.

----------------------------------------------------------------------
1. Objective
----------------------------------------------------------------------

Implement spectrum and octave patterns that:

- Visualize frequency and chroma content according to **SensoryBridge** behavior.
- Use `PatternRenderContext` as the runtime interface.
- Maintain strict center-origin symmetry and smooth interpolation.
- Do not rely on background overlays or ad-hoc color hacks.

----------------------------------------------------------------------
2. Files to Create / Modify (K1.PRISM.node)
----------------------------------------------------------------------

Create or edit the following file under `K1.PRISM.node/firmware/src/patterns`:

1. `sb_spectrum_family.hpp`

You MUST NOT:
- Modify `pattern_render_context.h`.
- Modify `webserver.*` or add new API endpoints.

----------------------------------------------------------------------
3. Canonical References (SB and Docs)
----------------------------------------------------------------------

Use these as your primary references:

- SensoryBridge firmware (within this project family):
  - Primary: `zREF/SensoryBridge-4.1.1/SENSORY_BRIDGE_FIRMWARE/lightshow_modes.h`
  - Secondary: `zREF/SensoryBridge-3.2.0/SENSORY_BRIDGE_FIRMWARE/lightshow_modes.h`, `zREF/SensoryBridge-3.1.0/SENSORY_BRIDGE_FIRMWARE/lightshow_modes.h`, `zREF/SensoryBridge-4.0.0/SENSORY_BRIDGE_FIRMWARE/lightshow_modes.h`
    - Look for spectrum and octave modes (frequency bars, musical note bars).
  - `led_utilities.h` in the same versions for rendering helpers and quantization.

- Docs:
  - `docs/Lightshow.Pattern/Comparative/01-SB_VS_EMOTISCOPE_COMPARATIVE_ANALYSIS.md`
  - `docs/Lightshow.Pattern/Comparative/02-FAMILY_INVARIANTS.md` (Spectrum/Octave).
  - `docs/Lightshow.Pattern/Comparative/05-SB_FRAMEWORK_PARITY_CHECKLIST.md`

Do NOT derive behavior from K1.node1’s spectrum patterns unless SB is silent on a detail.

----------------------------------------------------------------------
4. API to Implement (sb_spectrum_family.hpp)
----------------------------------------------------------------------

Implement at least:

```cpp
#pragma once

#include "pattern_render_context.h"

// SB-style spectrum visualization
void draw_sb_spectrum(const PatternRenderContext& ctx);

// SB-style octave / chromagram visualization
void draw_sb_octave(const PatternRenderContext& ctx);
```

More variants may be added only if justified and clearly linked to SB code.

----------------------------------------------------------------------
5. Implementation Requirements
----------------------------------------------------------------------

5.1. LED Mapping and Interpolation

- Use **sub-pixel interpolation** when mapping frequencies/chroma to LEDs:
  - Do NOT simply pick the nearest bin.
  - Use `interpolate()` or equivalent to produce smooth gradients.
- Map:
  - For spectrum: frequency index → LED position along strip.
  - For octave: 12 chroma bins → LED segments or positions.

5.2. Center-Origin Symmetry

- As with Bloom, enforce:
  - Mirrored behavior around the strip center.
  - Equal distance from center → identical color.
- Use `ctx.num_leds` to compute center indices; do NOT hardcode LED counts.

5.3. Audio Feature Usage

- Use `ctx.audio_snapshot`:
  - `spectrogram_smooth` as the primary magnitude source.
  - Optionally raw `spectrogram` if SB does so.
  - `chromagram` for octave patterns.
- Use SB’s magnitude curves:
  - If SB applies sqrt/exponential/log curves, replicate them.
  - Respect SB’s minimum/maximum thresholds to avoid flicker.

5.4. Color and Brightness

- Prefer palette-based coloring or SB’s color utilities over raw HSV.
- Keep brightness in 0..1 range.
- If SB uses any non-linear brightness mapping (e.g., squaring), implement the same.

5.5. Silence and Low-Energy Handling

- When audio energy is low or absent:
  - Fade the visualization gracefully (no hard cutoff).
  - You may:
    - Lower brightness proportionally to VU.
    - Blend toward a stable low-level visualization (not just blank).

----------------------------------------------------------------------
6. Forbidden Behaviors
----------------------------------------------------------------------

- Do NOT:
  - Use random colors unrelated to frequency content.
  - Break symmetry (unless SB explicitly uses asymmetric layouts).
  - Rely on `apply_background_overlay` or similar concepts.
  - Hardcode magic numbers without referencing SB behavior.

----------------------------------------------------------------------
7. Definition of Done
----------------------------------------------------------------------

Your work is considered **complete** only if ALL of the following are true:

1. `sb_spectrum_family.hpp` compiles as part of the `firmware` project.
2. `draw_sb_spectrum` and `draw_sb_octave`:
   - Use `ctx.audio_snapshot` correctly.
   - Implement sub-pixel interpolation.
   - Maintain center-origin symmetry.
3. Behavior aligns with the SB spectrum/octave description:
   - Clear bar-like representation of spectral and/or chroma energy.
   - Reasonable response to changes in audio input.
4. No global background/ambient overlays are used.
5. You provide:
   - SB source references (functions, line ranges).
   - Explanation of your LED mapping, interpolation, and color curves.

If any requirement is not met, the task is **NOT** done.
