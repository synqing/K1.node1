# Workstream A – SB Audio Core Implementation

This document defines the **full task** for implementing the SensoryBridge-based audio pipeline for `K1.PRISM.node`. It assumes minimal initiative from the agent and spells out exactly what to do and what not to do.

Read this ENTIRE document before writing any code.

----------------------------------------------------------------------
1. Objective
----------------------------------------------------------------------

Implement a standalone SB-style audio feature pipeline for `K1.PRISM.node` that:

- Processes raw microphone samples into:
  - Spectrogram (raw and smoothed).
  - Chromagram (12-bin pitch-class).
  - VU (level).
  - Tempo magnitude and phase (if SB defines them; otherwise see below).
- Produces a single, self-contained `SbAudioSnapshot` structure per frame.
- Does **not** modify any webserver or runtime API code.
- Can later be wired into the pattern runtime via `PatternRenderContext`.

You are implementing a **core library**: no HTTP, no patterns, no UI.

----------------------------------------------------------------------
2. Files to Create / Modify (K1.PRISM.node)
----------------------------------------------------------------------

Create the following new files under `K1.PRISM.node/firmware/src/audio`:

1. `sb_audio_core.h`
2. `sb_audio_core.cpp`

You MUST NOT touch any other files unless explicitly instructed later.

----------------------------------------------------------------------
3. Canonical References (SB and Docs)
----------------------------------------------------------------------

You MUST base your implementation on:

- SensoryBridge source (within this project family):
  - Primary: `zREF/SensoryBridge-4.1.1/SENSORY_BRIDGE_FIRMWARE/`
  - Secondary: `zREF/SensoryBridge-3.2.0/SENSORY_BRIDGE_FIRMWARE/`, `zREF/SensoryBridge-3.1.0/SENSORY_BRIDGE_FIRMWARE/`, `zREF/SensoryBridge-4.0.0/SENSORY_BRIDGE_FIRMWARE/`
    (or latest available SB firmware in that folder)
  - Look for:
    - Goertzel / FFT processing.
    - VU computation.
    - Chromagram / tempo logic.

- Comparative and forensic docs:
  - `docs/Lightshow.Pattern/Comparative/01-SB_VS_EMOTISCOPE_COMPARATIVE_ANALYSIS.md`
  - `docs/05-analysis/emotiscope_sensorybridge_forensic_analysis.md`
  - `docs/05-analysis/K1NAnalysis_FORENSIC_EMOTISCOPE_SENSORYBRIDGE_ANALYSIS_v1.0_20251110.md`
  - `docs/05-analysis/K1NAnalysis_ANALYSIS_AUDIO_PIPELINE_FORENSIC_v1.0_20251108.md`

Do NOT guess algorithms from scratch. Follow SB behavior.

----------------------------------------------------------------------
4. API to Implement (sb_audio_core.h)
----------------------------------------------------------------------

In `sb_audio_core.h`, define:

```cpp
#pragma once

#include <stdint.h>

// Adjust to match K1’s chosen constants.
// Do NOT hardcode magic numbers in multiple places.
constexpr uint16_t SB_NUM_FREQS = /* TODO: set from SB spec (e.g., 128) */;
constexpr uint16_t SB_NUM_CHROMA = 12;
constexpr uint16_t SB_NUM_TEMPI = /* TODO: set from SB spec or K1 tempo bins */;

struct SbAudioSnapshot {
    float spectrogram[SB_NUM_FREQS];
    float spectrogram_smooth[SB_NUM_FREQS];
    float chromagram[SB_NUM_CHROMA];

    float vu_level;      // normalized 0..1
    float vu_level_raw;  // pre-normalization or raw amplitude

    float tempo_magnitude[SB_NUM_TEMPI];
    float tempo_phase[SB_NUM_TEMPI];

    // Optional metadata (safe to leave zeroed for now)
    uint32_t update_counter;
    uint64_t timestamp_us;
};

// Initialize any internal state (buffers, IIR variables, etc.).
void sb_audio_init();

// Process one audio frame and produce a snapshot.
// This function MUST:
// - Read from internal ring buffers or HAL input (DESIGN-ONLY; do not implement HAL here).
// - Update SbAudioSnapshot with consistent, normalized values.
void sb_update_audio_snapshot(SbAudioSnapshot& out);
```

Notes:
- You MUST define `SB_NUM_FREQS` and `SB_NUM_TEMPI` based on SB’s actual implementation. Do not invent random sizes.
- You MUST keep all fields initialized (zero them before use).

----------------------------------------------------------------------
5. Implementation Requirements (sb_audio_core.cpp)
----------------------------------------------------------------------

In `sb_audio_core.cpp`, you MUST:

5.1. Manage Internal State
- Define static internal buffers and state:
  - Raw spectrum arrays.
  - Moving-average buffers (if SB uses them).
  - IIR max trackers for autoranging.
  - Any tempo-related state (history, novelty curve, etc.) if you port tempo.

5.2. Implement the SB Processing Order

The pipeline MUST follow this order (adjusted to SB’s exact behavior):

1. **Input accumulation** (not implemented here):
   - Assume a separate layer fills a raw audio buffer (e.g., `float samples[]`).
   - `sb_update_audio_snapshot` MUST NOT talk to hardware directly.
   - For now, you may assume a placeholder function `get_audio_frame()` exists or will be provided later.

2. **Goertzel / FFT transform**:
   - Compute frequency bins as SB does.
   - Apply any windowing or bin weighting defined in SB.

3. **Smoothing / Averaging**:
   - Implement SB’s multi-frame smoothing:
     - e.g., circular buffer of N frames, averaged into `spectrogram_smooth`.

4. **Autoranging (NO AGC)**:
   - Implement SB’s IIR max tracking:
     - Fast attack, slow release.
     - Floor to avoid division by zero.
   - Scale `spectrogram_smooth` (and any other arrays) using this autoranger.

5. **VU computation**:
   - Derive VU from smoothed spectrum as SB does:
     - Average energy, optional bass/treble weighting.
     - Apply SB’s floors and caps.
   - Populate `vu_level` and `vu_level_raw` in snapshot.

6. **Chromagram computation**:
   - Implement SB’s chroma algorithm:
     - Map frequency bins to 12 pitch classes.
     - Sum and normalize.
     - Apply any squaring / curve from SB.

7. **Tempo (if available in SB)**:
   - If SB has tempo detection:
     - Port its tempo-bin logic (Goertzel-based or otherwise).
     - Fill `tempo_magnitude` and `tempo_phase` accordingly.
   - If SB does NOT define tempo:
     - Leave `tempo_magnitude` and `tempo_phase` zeroed and document this clearly in comments and task notes.

8. **Snapshot assembly**:
   - Fill all fields of `SbAudioSnapshot`.
   - Update `update_counter` and `timestamp_us` appropriately (e.g., monotonic increment and `esp_timer_get_time()` once integrated).

5.3. No Hardware/OS Coupling in This Layer
- Do NOT:
  - Call ESP-IDF APIs directly here (no `i2s_read`, no `esp_timer_get_time` for now).
  - Use global variables from other modules.
- This file must be a **pure processing module** that can be unit-tested with provided input buffers.

----------------------------------------------------------------------
6. Forbidden Behaviors and Shortcuts
----------------------------------------------------------------------

6.1. No AGC
- Do NOT copy any Cochlear AGC or similar logic, even if present in other repos.
- Only implement SB-style autoranger (IIR max + floor + scaling).

6.2. No Random Constants
- Every numeric constant (e.g., window size, decay factor, floor value) MUST:
  - Come from SB source, OR
  - Be explicitly justified in a comment referencing documentation.

6.3. No Silent Tempo “Fixes”
- Do not:
  - Partially implement tempo.
  - Fill tempo arrays with fake values “just so patterns have something”.
- If tempo is not implemented yet:
  - Leave tempo arrays zeroed.
  - State this clearly in your task notes.

----------------------------------------------------------------------
7. Definition of Done (for this Workstream)
----------------------------------------------------------------------

Your work is considered **complete** only if ALL of the following are true:

1. Files `sb_audio_core.h` and `sb_audio_core.cpp` exist and compile as part of the `firmware` project.
2. `SbAudioSnapshot` is fully defined and used only through the functions in `sb_audio_core.h`.
3. `sb_audio_init()` and `sb_update_audio_snapshot()` are implemented with:
   - SB-style processing order.
   - No direct hardware calls.
   - No AGC, no background, no API changes.
4. All arrays in `SbAudioSnapshot` are initialized on every call to `sb_update_audio_snapshot`.
5. You provide:
   - A list of SB source files and functions used.
   - A short explanation of each major step (Goertzel, smoothing, autorange, VU, chroma, tempo).
   - A clear statement on tempo status (implemented vs. intentionally left zeroed).

If any of these are missing or incorrect, the task is **NOT** done.
