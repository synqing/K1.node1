# Workstream E – SB Dots and Ambient Patterns

This document defines the complete task for implementing SensoryBridge-style dot and ambient patterns in `K1.PRISM.node`.

Read this ENTIRE document before writing any code.

----------------------------------------------------------------------
1. Objective
----------------------------------------------------------------------

Implement dot and ambient patterns that:

- Match SensoryBridge’s dot overlays and ambient fields.
- Use `PatternRenderContext` for all inputs and outputs.
- Behave well with and without audio.
- Do not depend on any background/ambient overlay functions.

----------------------------------------------------------------------
2. Files to Create / Modify (K1.PRISM.node)
----------------------------------------------------------------------

Create or edit the following file under `K1.PRISM.node/firmware/src/patterns`:

1. `sb_dot_family.hpp`

Do NOT modify runtime or webserver code.

----------------------------------------------------------------------
3. Canonical References (SB and Docs)
----------------------------------------------------------------------

- SensoryBridge firmware (within this project family):
  - Primary: `zREF/SensoryBridge-4.1.1/SENSORY_BRIDGE_FIRMWARE/lightshow_modes.h`
  - Secondary: `zREF/SensoryBridge-3.2.0/SENSORY_BRIDGE_FIRMWARE/lightshow_modes.h`, `zREF/SensoryBridge-3.1.0/SENSORY_BRIDGE_FIRMWARE/lightshow_modes.h`, `zREF/SensoryBridge-4.0.0/SENSORY_BRIDGE_FIRMWARE/lightshow_modes.h`
    - Dot overlays (e.g., Analog, Metronome, Hype-like modes).
  - Any utility functions for drawing dots or markers in the same SB versions.

- Docs:
  - `docs/Lightshow.Pattern/Comparative/01-SB_VS_EMOTISCOPE_COMPARATIVE_ANALYSIS.md`
  - `docs/Lightshow.Pattern/Comparative/02-FAMILY_INVARIANTS.md` (Dots section).
  - `docs/05-analysis/K1NAnalysis_REFERENCE_PATTERN_DESIGN_VISUAL_PRINCIPLES_v1.0_20251110.md`

----------------------------------------------------------------------
4. API to Implement (sb_dot_family.hpp)
----------------------------------------------------------------------

Implement at least:

```cpp
#pragma once

#include "pattern_render_context.h"

// SB-style analog dot overlay (e.g., tracking loudest bins)
void draw_sb_analog_dots(const PatternRenderContext& ctx);

// SB-style metronome/hype dots (beat markers)
void draw_sb_metronome_dots(const PatternRenderContext& ctx);
```

You may add further dot variants only if clearly mapped to SB behavior.

----------------------------------------------------------------------
5. Implementation Requirements
----------------------------------------------------------------------

5.1. Dot Positioning

- Use sub-pixel positioning:
  - If SB uses continuous positions, map them to discrete LEDs via interpolation or rounding with care.
- Dot locations should:
  - Reflect energy in specific bins or tempo beats.
  - Not be arbitrary.

5.2. Dot Decay and Persistence

- Implement decay as described in the invariants or SB code:
  - Dots should fade over time, not disappear instantly.
  - Use multiplicative decay or step-down logic per SB behavior.

5.3. Interaction with Base Visuals

- Dots may:
  - Overlay on top of other patterns.
  - Be rendered as standalone ambient patterns.
- Respect SB semantics:
  - Do not destroy base visuals by clearing the LED buffer unnecessarily.

5.4. Audio and Idle Behavior

- With audio:
  - Dots should respond to energy, frequency peaks, or beats in a way consistent with SB.
- Without audio:
  - Implement a mild idle behavior (e.g., slow drifting markers) or keep dots minimal but non-glitchy.

----------------------------------------------------------------------
6. Forbidden Behaviors
----------------------------------------------------------------------

- Do NOT:
  - Use random dot placement that doesn’t correspond to audio features.
  - Turn all LEDs on/off as a substitute for discrete dot behavior.
  - Rely on background overlays to fix visual artifacts.

----------------------------------------------------------------------
7. Definition of Done
----------------------------------------------------------------------

Your work is considered **complete** only if ALL of the following are true:

1. `sb_dot_family.hpp` compiles as part of the `firmware` project.
2. `draw_sb_analog_dots` and `draw_sb_metronome_dots`:
   - Use `ctx.audio_snapshot` appropriately.
   - Position dots based on actual audio/tempo data.
   - Implement decay consistent with SB’s style.
3. No background APIs are used.
4. You provide:
   - SB source references for each dot mode you implemented.
   - Explanation of dot positioning, intensity, and decay logic.

If any requirement is not met, the task is **NOT** done.
