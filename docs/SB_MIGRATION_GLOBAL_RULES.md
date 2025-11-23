# SB Migration – Global Rules for All Agents

This document defines **mandatory rules** for any agent working on `K1.PRISM.node`. Violation of these rules will cause work to be rejected, even if the code compiles.

Read this ENTIRE file before touching any code. Do not skim. Do not improvise.

----------------------------------------------------------------------
1. Scope and Intent
----------------------------------------------------------------------

1.1. Project Goal
- `K1.PRISM.node` is a **clean, from-the-ground-up rebuild** of the K1-Lightwave firmware stack, targeting:
  - Single-MCU ESP32-S3 device.
  - **SensoryBridge (SB)** behavior as the canonical reference for audio and visuals.
  - K1.node1’s **pattern/runtime plumbing and HTTP/REST/WebSocket API** as the preserved external contract.

1.2. What This Means
- You are **not fixing or tweaking** K1.node1 code.
- You are **re-implementing behavior** in `K1.PRISM.node` to:
  - Match SB’s observable behavior.
  - Plug into the existing runtime and API surfaces that have been ported over.

1.3. Zero Tolerance for “Half-Done” Work
- Submissions that:
  - Do not compile,
  - Break existing APIs,
  - Ignore required test/check steps,
  - Or clearly contradict SB specs,
  will be **rejected outright** regardless of how much code was written.

----------------------------------------------------------------------
2. Canonical References (What You MUST Read)
----------------------------------------------------------------------

2.1. SB Source Code (Behavioral Ground Truth)
- Location (within this project family): `zREF/`
  - Primary version (canonical): `zREF/SensoryBridge-4.1.1/`
  - Secondary references: `zREF/SensoryBridge-3.2.0/`, `zREF/SensoryBridge-3.1.0/`, `zREF/SensoryBridge-4.0.0/`
  - Typical firmware path: `zREF/SensoryBridge-4.1.1/SENSORY_BRIDGE_FIRMWARE/`
- When implementing or migrating logic:
  - **Start from SensoryBridge-4.1.1.**
  - Use 3.2.0 / 3.1.0 / 4.0.0 only to cross-check behavior or recover details that 4.1.1 obscures.
  - If versions disagree, 4.1.1 wins unless the lead architect explicitly designates an older version as canonical for a specific pattern family.

2.2. Comparative and Forensic Docs (Design Ground Truth)
- `docs/Lightshow.Pattern/Comparative/01-SB_VS_EMOTISCOPE_COMPARATIVE_ANALYSIS.md`
- `docs/Lightshow.Pattern/Comparative/02-FAMILY_INVARIANTS.md`
- `docs/Lightshow.Pattern/Comparative/05-SB_FRAMEWORK_PARITY_CHECKLIST.md`
- `docs/05-analysis/emotiscope_sensorybridge_forensic_analysis.md`
- Relevant analysis docs under `docs/05-analysis/` referenced by your specific task (audio, visual, tempo).

2.3. Runtime/API Contract (Interface Ground Truth)
- From K1.node1 (read-only reference):
  - `firmware/src/pattern_render_context.h`
  - `firmware/src/pattern_execution.*`
  - `firmware/src/pattern_registry.*`
  - `firmware/src/webserver.*`
  - `firmware/src/webserver_*.*`
- In K1.PRISM.node (actual working copies you will compile against):
  - `K1.PRISM.node/firmware/src/pattern_render_context.h`
  - `K1.PRISM.node/firmware/src/webserver.*`
  - `K1.PRISM.node/firmware/src/webserver_*.*`

----------------------------------------------------------------------
3. Absolutely Forbidden Changes
----------------------------------------------------------------------

3.1. Do NOT Modify These Without Explicit Instruction
- `K1.PRISM.node/firmware/src/webserver.h`
- `K1.PRISM.node/firmware/src/webserver.cpp`
- `K1.PRISM.node/firmware/src/webserver_*.*`
- `K1.PRISM.node/firmware/src/pattern_render_context.h`
- `K1.PRISM.node/firmware/src/types.h`
- Any future `firmware/src/pattern_execution.*`, `pattern_registry.*`, or graph runtime files once created.

If you believe one of these MUST change, stop and escalate to the lead architect. Do not “fix” them yourself.

3.2. Do NOT Introduce or Rely on Global Background/Ambient APIs
- `apply_background_overlay` is **dead** by design.
- You MUST NOT:
  - Implement `apply_background_overlay` in K1.PRISM.node.
  - Call any function named `apply_background_overlay` or conceptual equivalent.
  - Depend on a hidden “background layer” to fix your pattern output.
- Every pattern is responsible for **fully drawing its own frame** every time.

3.3. Do NOT Add AGC Layers
- Do not introduce Cochlear AGC or any new automatic gain control layer.
- Only use **SB-style autoranger** behavior (IIR max tracking, floors, caps) as specified in SB code and comparative docs.

3.4. Do NOT Change External API Contracts
- You MUST NOT:
  - Rename existing endpoints (paths).
  - Add/remove required fields from JSON responses.
  - Change HTTP methods (GET/POST/etc.) of existing routes.
- You MAY add internal helpers or new private fields inside the firmware as long as they do not change the public API contract.

----------------------------------------------------------------------
4. Behavioral Priorities
----------------------------------------------------------------------

4.1. SensoryBridge is Canonical
- When you face a decision:
  - If SB and Emotiscope differ → **implement SB behavior**.
  - If SB is silent and Emotiscope has a working, documented behavior → you MAY follow Emotiscope, but must:
    - Explicitly state this in your task notes.
    - Keep the implementation isolated so it can be swapped out later.

4.2. Runtime and APIs Are Sacred
- Pattern runtime plumbing (graphs, node execution, PatternRenderContext) and HTTP/REST/WebSocket APIs are **core product assets**.
- Your job is to build the **SB-based core inside that shell**, not to redesign the shell.

----------------------------------------------------------------------
5. Quality and Verification Requirements
----------------------------------------------------------------------

5.1. Compilation is Mandatory
- Before declaring your task “done”, you MUST:
  - Ensure `firmware` builds successfully for at least the default PlatformIO environment:
    - `[env:esp32-s3-devkitc-1]` in `firmware/platformio.ini`
  - If you cannot run PlatformIO locally, you MUST:
    - Double-check all include paths, function signatures, and types against existing headers.
    - Avoid speculative changes to core headers.

5.2. Runtime Safety
- Your code MUST NOT:
  - Dereference null pointers.
  - Access arrays out of bounds (LED buffers, snapshot arrays, chromagram bins, tempo bins).
  - Assume uninitialized data.
- When in doubt, clamp indices and validate array bounds explicitly.

5.3. Visual Sanity
- For pattern work:
  - Code MUST compile and link.
  - Logic MUST match SB semantics as closely as documented.
  - You MUST not ship clearly broken behavior (e.g., all LEDs stuck black, NaNs, uncontrolled flashing) and call it “complete”.

----------------------------------------------------------------------
6. Task Documentation Requirements
----------------------------------------------------------------------

For every task you complete, you MUST provide:

- 6.1. Source References
  - Explicit SB file and function names you used as reference, e.g.:
    - `SensoryBridge-4.0.0/SENSORY_BRIDGE_FIRMWARE/lightshow_modes.h:BloomMode()`
    - `SensoryBridge-4.0.0/SENSORY_BRIDGE_FIRMWARE/led_utilities.h:draw_sprite()`

- 6.2. Behavior Summary
  - 5–10 sentences describing:
    - What the SB code does.
    - How your implementation mirrors that behavior in K1.PRISM.node.

- 6.3. Deviations and Justifications
  - List any differences from SB behavior, including:
    - Numeric constants changed.
    - Additional guards or clamping.
  - For each difference, state **why** you changed it.

- 6.4. Integration Notes
  - Which new functions or files you added.
  - How they will be called by the runtime (if known).

Submissions without this meta-information will be considered incomplete.

----------------------------------------------------------------------
7. Personal Conduct and Assumptions
----------------------------------------------------------------------

- Assume that:
  - Your first attempt will be reviewed line-by-line.
  - Any “shortcuts” or “it probably works” assumptions will likely be caught and rejected.
- You are expected to:
  - Follow instructions exactly.
  - Ask for clarification if something in SB or the docs is ambiguous.
  - Err on the side of explicitness, not cleverness.
