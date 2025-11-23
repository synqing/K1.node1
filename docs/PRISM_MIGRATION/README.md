# K1.PRISM.node – SB Migration Start Here

This folder contains all instructions for agents working on the K1.PRISM.node SensoryBridge-based rebuild. Do not work outside these guidelines.

----------------------------------------------------------------------
1. Read This in Order (Before Coding)
----------------------------------------------------------------------

1. `docs/PRISM_MIGRATION/SB_MIGRATION_GLOBAL_RULES.md`
   - Project scope and intent.
   - Canonical references (SensoryBridge source, comparative docs).
   - Forbidden files and behaviors (no API changes, no background, no AGC).
   - Quality and documentation requirements for every task.

2. Pick your assigned workstream and read its brief:
   - Audio core:  
     `docs/PRISM_MIGRATION/SB_MIGRATION_WORKSTREAM_A_AUDIO_CORE.md`
   - Bloom / trails patterns:  
     `docs/PRISM_MIGRATION/SB_MIGRATION_WORKSTREAM_B_BLOOM_TRAILS.md`
   - Spectrum / octave patterns:  
     `docs/PRISM_MIGRATION/SB_MIGRATION_WORKSTREAM_C_SPECTRUM_OCTAVE.md`
   - Tunnel / beat patterns:  
     `docs/PRISM_MIGRATION/SB_MIGRATION_WORKSTREAM_D_TUNNEL_BEAT.md`
   - Dots / ambient patterns:  
     `docs/PRISM_MIGRATION/SB_MIGRATION_WORKSTREAM_E_DOTS_AMBIENT.md`

You must read both the global rules and your workstream brief in full before editing any code.

----------------------------------------------------------------------
2. Where to Implement Code
----------------------------------------------------------------------

- Firmware project root: `K1.PRISM.node/firmware`
- Source code root: `K1.PRISM.node/firmware/src`

Workstream-specific locations:

- Workstream A (Audio core):  
  Implement only in `firmware/src/audio/sb_audio_core.h` and `firmware/src/audio/sb_audio_core.cpp`.

- Workstream B (Bloom / trails):  
  Implement only in `firmware/src/patterns/sb_bloom_family.hpp` (and optional companion `.cpp` if needed).

- Workstream C (Spectrum / octave):  
  Implement only in `firmware/src/patterns/sb_spectrum_family.hpp`.

- Workstream D (Tunnel / beat):  
  Implement only in `firmware/src/patterns/sb_tunnel_family.hpp`.

- Workstream E (Dots / ambient):  
  Implement only in `firmware/src/patterns/sb_dot_family.hpp`.

Do not modify runtime core or webserver/API files unless explicitly instructed.

----------------------------------------------------------------------
3. Runtime / API Files Are Read-Only
----------------------------------------------------------------------

Treat these as fixed interfaces, not editable code:

- `firmware/src/webserver.h`
- `firmware/src/webserver.cpp`
- All `firmware/src/webserver_*.{h,cpp}`
- `firmware/src/pattern_render_context.h`
- `firmware/src/types.h`

If you believe these must change to complete your task, stop and escalate to the lead architect.

----------------------------------------------------------------------
4. Required External References (Read-Only)
----------------------------------------------------------------------

When implementing behavior you MUST consult:

- SensoryBridge firmware under `zREF/` in this project (SB is canonical).
- Pattern and comparative docs:
  - `docs/Lightshow.Pattern/*`
  - `docs/Lightshow.Pattern/Comparative/*`
  - `docs/05-analysis/*` as referenced in your workstream brief.

Do not use Conductor/Orkes docs or code. They are out of scope for K1.PRISM.node.
