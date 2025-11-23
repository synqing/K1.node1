# Workstream B – SB Bloom and Trails Patterns

This document defines the complete task for implementing SensoryBridge-style Bloom and trail patterns in `K1.PRISM.node`.

Read this ENTIRE document before writing any code.

----------------------------------------------------------------------
1. Objective
----------------------------------------------------------------------

Implement Bloom and related trail patterns that:

- Reproduce **SensoryBridge** Bloom/trail behavior as closely as possible.
- Use the `PatternRenderContext` runtime model.
- Do NOT rely on any global background/ambient overlay.
- Are wired as self-contained pattern functions that the runtime can call.

----------------------------------------------------------------------
2. Files to Create / Modify (K1.PRISM.node)
----------------------------------------------------------------------

Create or edit the following file under `K1.PRISM.node/firmware/src/patterns`:

1. `sb_bloom_family.hpp`

You MUST NOT:
- Modify any existing `bloom_family.hpp` in K1.node1.
- Modify `PatternRenderContext` or any webserver/API files.

----------------------------------------------------------------------
3. Canonical References (SB and Docs)
----------------------------------------------------------------------

You MUST base your implementation on:

- SensoryBridge firmware (within this project family):
  - Primary: `zREF/SensoryBridge-4.1.1/SENSORY_BRIDGE_FIRMWARE/lightshow_modes.h`
  - Secondary: `zREF/SensoryBridge-3.2.0/SENSORY_BRIDGE_FIRMWARE/lightshow_modes.h`, `zREF/SensoryBridge-3.1.0/SENSORY_BRIDGE_FIRMWARE/lightshow_modes.h`, `zREF/SensoryBridge-4.0.0/SENSORY_BRIDGE_FIRMWARE/lightshow_modes.h`
  - Utility functions: corresponding `led_utilities.h` in the same versions (start with 4.1.1).
    - Especially the Bloom-like modes and `draw_sprite`/trail utilities.

- Comparative docs:
  - `docs/Lightshow.Pattern/Comparative/01-SB_VS_EMOTISCOPE_COMPARATIVE_ANALYSIS.md`
  - `docs/Lightshow.Pattern/Comparative/02-FAMILY_INVARIANTS.md` (Bloom section).
  - `docs/Lightshow.Pattern/Comparative/05-SB_FRAMEWORK_PARITY_CHECKLIST.md`

Do NOT base your behavior on K1.node1’s Bloom unless SB is silent on a detail.

----------------------------------------------------------------------
4. API to Implement (sb_bloom_family.hpp)
----------------------------------------------------------------------

In `sb_bloom_family.hpp`, implement at least:

```cpp
#pragma once

#include "pattern_render_context.h"

// Canonical SB Bloom pattern
void draw_sb_bloom(const PatternRenderContext& ctx);

// Optional: SB Bloom mirror or chroma-variant, if defined in SB firmware
void draw_sb_bloom_mirror(const PatternRenderContext& ctx);
```

You MAY add internal helper functions inside this header (or a companion `.cpp` if needed), but:
- Do not expose additional pattern entrypoints unless agreed with the lead.

----------------------------------------------------------------------
5. Implementation Requirements
----------------------------------------------------------------------

5.1. Trail Buffer and Persistence

- SB Bloom uses **sprite-based persistence** with high alpha (≈0.99).
- You MUST:
  - Maintain one or more static trail buffers (e.g., `float trail[NUM_LEDS]` or equivalent).
  - Apply multiplicative decay each frame:
    - Example: `trail[i] *= alpha;` with `alpha` derived from SB (e.g., 0.99).
  - Never `memset` trail buffers to zero during normal rendering.

- Decay rules:
  - Use SB’s decay semantics from `led_utilities.h` and `lightshow_modes.h`.
  - If SB uses a Gaussian or other curve, replicate it.

5.2. Center-Origin and Mirror Behavior

- SB Bloom injects new energy at or near the center of the strip, with symmetric tails.
- Requirements:
  - Determine center index using `ctx.leds` layout:
    - Typical: `int center_left = ctx.num_leds / 2 - 1; int center_right = ctx.num_leds / 2;`
  - Ensure that:
    - Positions equidistant from center have identical colors (within floating error).
  - Use `PatternRenderContext`’s LED array; do not assume a hard-coded LED count.

5.3. Audio Inputs and Mapping

- From `ctx.audio_snapshot`, use:
  - Smoothed spectrum (and/or chromagram) as SB does.
  - VU level for overall energy modulation.
- Mapping:
  - Use SB’s rules for:
    - How chroma or spectrum energy drives center brightness.
    - How energy maps to hue/brightness.
  - Avoid raw `hsv` linear hue mapping; favor palette mapping or SB’s color utilities if available.

5.4. Color and Brightness Curves

- Follow SB’s curves:
  - If SB squares chroma or brightness (e.g., `value*value`), do the same.
  - Keep brightness in the 0..1 range, clamped.
- You MAY reuse K1’s palette utilities if they do not conflict with SB’s semantics, but:
  - Do not multiply by `ctx.params.brightness` multiple times.
  - Keep global brightness responsibility in the color pipeline once defined.

5.5. No Background Overlay

- Your patterns MUST fully define each frame:
  - No calls to `apply_background_overlay`.
  - No reliance on a background layer to fix banding or artifacts.

5.6. Idle Behavior (No Audio)

- When audio is unavailable or invalid:
  - Implement an **idle visual** that:
    - Is visually pleasant.
    - Does not look like a failure mode (e.g., not all black, not random noise).
  - Idle behavior should be simple (e.g., slow breathing or low-level trail), consistent with SB’s aesthetic.

----------------------------------------------------------------------
6. Forbidden Behaviors and Shortcuts
----------------------------------------------------------------------

- Do NOT:
  - Use random numbers as a substitute for SB-defined behavior.
  - Add hacks like “flash all LEDs white on each beat” if SB does not do that.
  - Ignore center-origin symmetry.
  - Zero the LED buffer or trail buffer each frame unless specifically needed for a reset scenario.

----------------------------------------------------------------------
7. Definition of Done
----------------------------------------------------------------------

Your work is considered **complete** only if ALL of the following are true:

1. `sb_bloom_family.hpp` compiles as part of the `firmware` project.
2. `draw_sb_bloom` (and any additional SB Bloom variants you implement) use:
   - Trail buffers with high-alpha decay.
   - Center-origin symmetry.
   - Audio inputs from `ctx.audio_snapshot` in a way consistent with SB’s design.
3. No calls to `apply_background_overlay` exist in your code.
4. The pattern(s) produce deterministic, non-broken visuals with and without audio.
5. You provide:
   - Exact SB functions and code regions you mirrored.
   - Explanation of how center injection, trail decay, and color mapping work in your implementation.
   - Any deviations from SB and why they are necessary.

If any of these conditions are not met, the task is **NOT** done.
