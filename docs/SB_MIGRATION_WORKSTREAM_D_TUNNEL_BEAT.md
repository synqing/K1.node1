# Workstream D – SB Tunnel and Beat Patterns

This document defines the complete task for implementing SensoryBridge-style tunnel and beat-driven patterns in `K1.PRISM.node`.

Read this ENTIRE document before writing any code.

----------------------------------------------------------------------
1. Objective
----------------------------------------------------------------------

Implement tunnel/beat patterns that:

- Use **tempo magnitude and phase** (when available) to drive tunnel visuals.
- Follow SensoryBridge’s behavior for beat responsiveness and trails.
- Use `PatternRenderContext` and `ctx.audio_snapshot` as the only data sources.
- Do not rely on any global background or hidden state.

----------------------------------------------------------------------
2. Files to Create / Modify (K1.PRISM.node)
----------------------------------------------------------------------

Create or edit the following file under `K1.PRISM.node/firmware/src/patterns`:

1. `sb_tunnel_family.hpp`

Do NOT modify:
- `pattern_render_context.h`
- Webserver or API files.

----------------------------------------------------------------------
3. Canonical References (SB and Docs)
----------------------------------------------------------------------

You MUST reference:

- SensoryBridge firmware (within this project family):
  - Primary: `zREF/SensoryBridge-4.1.1/SENSORY_BRIDGE_FIRMWARE/lightshow_modes.h`
  - Secondary: `zREF/SensoryBridge-3.2.0/SENSORY_BRIDGE_FIRMWARE/lightshow_modes.h`, `zREF/SensoryBridge-3.1.0/SENSORY_BRIDGE_FIRMWARE/lightshow_modes.h`, `zREF/SensoryBridge-4.0.0/SENSORY_BRIDGE_FIRMWARE/lightshow_modes.h`
    - Look for tunnel/beat modes (e.g., patterns that produce moving “tunnel” or “beat path” effects).
  - Any tempo-related utilities in the same SB codebase versions.

- Docs:
  - `docs/Lightshow.Pattern/Comparative/01-SB_VS_EMOTISCOPE_COMPARATIVE_ANALYSIS.md`
  - `docs/Lightshow.Pattern/Comparative/02-FAMILY_INVARIANTS.md` (Tunnel family section).
  - `docs/05-analysis/TEMPO_*` files for tempo/beat invariants (even if Emotiscope-based, they indicate expectations).

----------------------------------------------------------------------
4. API to Implement (sb_tunnel_family.hpp)
----------------------------------------------------------------------

Implement at least one canonical tunnel pattern:

```cpp
#pragma once

#include "pattern_render_context.h"

// SB-style beat/tempo-driven tunnel pattern
void draw_sb_tunnel(const PatternRenderContext& ctx);
```

You may implement additional variants (e.g., different decay or color schemes) only if they map cleanly to SB behavior.

----------------------------------------------------------------------
5. Implementation Requirements
----------------------------------------------------------------------

5.1. Tempo and Beat Usage

- Primary driver:
  - Tempo magnitude and phase from `ctx.audio_snapshot`, if available via `SbAudioSnapshot`.
  - If tempo is not yet implemented in `SbAudioSnapshot`, temporarily rely on VU/novelty but:
    - Mark this clearly in your notes as an approximation.
- Use SB’s approach:
  - Where beats manifest spatially (center, edges, moving pulses).
  - How beat phase translates to LED position or pattern phase.

5.2. Trails and Persistence

- Use a trail buffer or equivalent:
  - Similar persistence rules to Bloom:
    - Multiplicative decay with alpha close to 1.0 (high persistence).
  - Tail behavior:
    - Fade intensity with distance from the “head” of the tunnel.
    - Respect SB’s attenuation curve if documented.

5.3. Geometry and Symmetry

- Tunnel patterns typically:
  - Emanate from center or from ends toward the center.
  - Maintain symmetry unless SB specifies an asymmetric effect.
- Use `ctx.num_leds` to derive geometry.
  - No hardcoded LED counts.

5.4. Color and Brightness

- Use SB’s mapping:
  - E.g., frequency range → hue, tempo confidence → brightness.
  - Avoid arbitrary color schemes without SB justification.
- Keep brightness in 0..1 and clamp.

5.5. Idle / Low-Tempo Behavior

- When tempo or energy is low:
  - Pattern should degrade gracefully:
    - Slower motion.
    - Lower brightness.
  - Avoid complete shutdown (unless SB explicitly does that).

----------------------------------------------------------------------
6. Forbidden Behaviors
----------------------------------------------------------------------

- Do NOT:
  - Fake tempo data (e.g., randomize `tempo_phase`).
  - Use background overlays to hide broken visuals.
  - Break symmetry without a clear SB reference.
  - Use arbitrary thresholds not present or justified in SB code.

----------------------------------------------------------------------
7. Definition of Done
----------------------------------------------------------------------

Your work is considered **complete** only if ALL of the following are true:

1. `sb_tunnel_family.hpp` compiles as part of the `firmware` project.
2. `draw_sb_tunnel`:
   - Uses `ctx.audio_snapshot` (tempo and/or VU/novelty) as the primary driver.
   - Implements trail persistence consistent with SB-style behavior.
   - Maintains appropriate symmetry and geometry.
3. No global background APIs are used.
4. You provide:
   - Exact SB functions and code regions you mirrored.
   - Explanation of how tempo/beat drives spatial and temporal behavior.
   - Clear statement on whether tempo is fully SB-style or temporarily approximated.

If any requirement is not met, the task is **NOT** done.
