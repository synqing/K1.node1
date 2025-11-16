# K1NPlan – Pattern Module Refactor (Header-Only Light Modes)

## 1. Objectives

- **Modularize patterns/light modes** currently embedded in `firmware/src/generated_patterns.h`.
- **Adopt Emotiscope-style light_modes architecture**: small, focused pattern modules plus a thin registry.
- **Preserve behavior and performance** (center-origin rules, audio reactivity, 120–160+ FPS).
- **Prevent future helper regressions** (e.g., misuse of `memset` in shared audio/visual helpers).

Scope is firmware only (patterns, helpers, registry). No changes to web UI or higher-level APIs in this phase.

---

## 2. Current State and Pain Points

**File:** `firmware/src/generated_patterns.h`

- Single monolithic header (>2K lines) mixing:
  - Inline helper functions/macros (`apply_mirror_mode`, `LED_PROGRESS`, etc.).
  - All audio-reactive and static pattern implementations.
  - Registry data (`g_pattern_registry`).
- Multiple patterns share concepts (Bloom, tunnels, dot-based modes) but are hard to reason about due to interleaving and size.
- Several regressions originated from **shared helper misuse**:
  - `draw_sprite_float` and `draw_sprite` using `memset` on target buffers destroyed pattern persistence (Bloom, tunnels, Snapwave).
  - `draw_dot` initially ignored dot index/state, corrupting Analog/Metronome/Hype visuals.

This layout makes auditing and evolving individual light modes risky and time-consuming.

---

## 3. Target Architecture (High-Level)

### 3.1 Pattern API

Introduce a small, explicit pattern API:

- Pattern signature:
  - `using PatternFunction = void (*)(const PatternRenderContext&);`
- Pattern modules include:
  - `pattern_render_context.h`
  - `pattern_audio_interface.h`
  - `palettes.h`
  - `emotiscope_helpers.h` (sprite/dot helpers, center-origin utilities)

Patterns are implemented as **header-only inline functions** in dedicated modules to keep integration simple while still centralizing heavy helpers.

### 3.2 File Layout

Proposed structure under `firmware/src/patterns`:

- `patterns/bloom_family.hpp` – Bloom, Bloom Mirror, Snapwave.
- `patterns/tunnel_family.hpp` – Beat Tunnel, Beat Tunnel Variant, Tunnel Glow.
- `patterns/dot_family.hpp` – Analog, Metronome, Hype, other dot-based visualizers.
- `patterns/spectrum_family.hpp` – Waveform Spectrum, classic spectrum modes.
- `patterns/tempiscope.hpp` – Tempiscope and related tempo visualizations.
- `patterns/static_family.hpp` – non-audio static/palette-based patterns.
- `patterns/prism_family.hpp` – Prism and other advanced hybrids.
- `patterns/helpers.hpp` – pattern-specific utilities (if any) that don’t belong in `emotiscope_helpers`.

Existing helpers remain in:

- `firmware/src/emotiscope_helpers.h/.cpp`
- `firmware/src/pattern_audio_interface.h/.cpp`

### 3.3 Registry

Refactor `pattern_registry` into:

- `firmware/src/pattern_registry.h`
- `firmware/src/pattern_registry.cpp`

`pattern_registry.cpp` will:

- `#include` the pattern modules (`bloom_family.hpp`, etc.).
- Define `g_pattern_registry[]` with `PatternInfo {name, id, description, draw_fn, is_audio_reactive}`.
- Export `g_num_patterns` and default selection logic.

No pattern implementations will live in the registry.

### 3.4 Codegen / Templates (Optional Phase)

Longer-term, integrate with existing pattern generation tasks:

- Generator emits per-pattern or per-family headers into `patterns/generated/`.
- Registry includes those headers conditionally (e.g., via `#include "patterns/generated/..."`).
- Hand-written patterns (Bloom, Waveform Spectrum) coexist alongside generated ones.

---

## 4. Constraints and Design Decisions

1. **Header-only patterns:**  
   - Keep pattern functions `inline` in headers to match the “header-only light_modes” preference.
   - Avoid heavy inline helpers (e.g., sprite internals) in every header; keep those in `emotiscope_helpers.*` to avoid code bloat.

2. **Center-origin invariants:**  
   - All audio-reactive patterns must preserve center-origin symmetry rules (already encoded in helpers like `apply_mirror_mode`).
   - Refactor must not break these invariants; tests and visual checks should confirm.

3. **Performance:**  
   - Maintain or improve current frame timing: GPU loop ~160 FPS, audio task latency unaffected.
   - Shared helpers (sprite/dot) remain compiled once; patterns are thin call sites.

4. **Safety against helper misuse:**  
   - Clear comments in helper implementations and pattern call sites explaining why `memset` and similar “cleanup” is forbidden inside these functions.
   - Optionally, add `static_assert`s or internal tests in development builds to catch obvious regressions.

---

## 5. Migration Plan (Phased)

### Phase 0 – Ground Truth & Scaffolding

**Goal:** Stabilize helpers and capture expectations before moving patterns.

- [x] Fix `draw_sprite` / `draw_sprite_float` to be purely additive (no internal `memset`) and document the earlier regression.
- [x] Implement dot layer system in `draw_dot` with decay; document misuse impact.
- [x] Add short comments in patterns that rely heavily on these helpers (Bloom, tunnels, Snapwave, Analog/Metronome/Hype) pointing back to the helpers and calling out the `memset` failure mode.
- [x] Capture current behavior snapshots:
  - Bloom, Bloom Mirror, Snapwave
  - Beat Tunnel + variant, Tunnel Glow
  - Analog, Metronome, Hype
  - Tempiscope, Waveform Spectrum

*(Most items in this phase are now implemented; the snapshot bullet is satisfied by concise behavior notes plus tempo/debug logs for each family, not by any new runtime code.)*

### Phase 1 – Introduce Pattern Modules (No Behavior Change)

**Goal:** Create new header-only modules and wire them in, while still compiling via `generated_patterns.h` as the primary entry point.

Steps:

1. Create directory `firmware/src/patterns/`.
2. For each family (starting with Bloom family):
   - Copy the corresponding `draw_*` implementations from `generated_patterns.h` into `patterns/bloom_family.hpp`.
   - Mark them `inline` and ensure they include only the necessary headers.
   - Keep their names and signatures identical.
3. Expose a transitional header:
   - `patterns/all_patterns.hpp` that simply `#include`s all family headers.
4. In `generated_patterns.h`, replace the full pattern bodies for the migrated family with thin `#include "patterns/bloom_family.hpp"` (or forward declarations) to avoid duplication while keeping current builds intact.

Deliverable: patterns for one or two families live in dedicated headers, but the registry and other patterns still come from `generated_patterns.h`.

### Phase 2 – Registry Refactor

**Goal:** Move `g_pattern_registry[]` out of `generated_patterns.h` into `pattern_registry.cpp`.

Steps:

1. Create `pattern_registry.cpp`:
   - `#include "pattern_registry.h"`
   - `#include "patterns/all_patterns.hpp"`
   - Define `const PatternInfo g_pattern_registry[] = { ... };`
2. Remove or disable any registry-like data from `generated_patterns.h`:
   - Keep only pattern implementations and any inline helpers.
3. Ensure:
   - `draw_current_pattern()` and related functions call into the new registry.

Deliverable: registry is small and central; patterns are compiled from modular headers.

### Phase 3 – Full Pattern Extraction

**Goal:** Move all pattern implementations out of `generated_patterns.h` into modules.

Steps (repeat per family):

1. Identify contiguous pattern section in `generated_patterns.h` (e.g., Tempiscope, tunnels, dot patterns).
2. Move `draw_*` implementations and any family-specific helpers into the appropriate `patterns/*.hpp`.
3. Replace their previous bodies in `generated_patterns.h` with either:
   - nothing (preferred, eventually deleting the file), or
   - small comments pointing to the new module.
4. Rebuild, run quick hardware tests for each migrated family.

End of phase: `generated_patterns.h` has either vanished or reduced to a small compatibility layer or include aggregator.

### Phase 4 – Optional Codegen Integration

**Goal:** Wire existing or new codegen to emit per-pattern headers instead of a monolithic header.

Steps:

1. Define generator output contract:
   - For each pattern: one `patterns/generated/<id>.hpp` with `inline void draw_<id>(...)`.
   - A generated `patterns/generated_registry.hpp` that lists `PatternInfo` entries for generated patterns.
2. Update `pattern_registry.cpp` to:
   - Include `patterns/generated_registry.hpp`.
   - Merge generated entries with hand-crafted ones.
3. Ensure codegen does not emit helpers already provided by `emotiscope_helpers` or `pattern_audio_interface`.

This phase is optional and can be scheduled after core modularization is stable.

---

## 6. Risk Analysis and Mitigations

### 6.1 Behavioral Drift

**Risk:** Moving patterns to new modules changes behavior (due to include order, macro differences, or missed state).

**Mitigations:**
- Move families incrementally; after each, manually verify:
  - Visual output on hardware (especially audio-reactive response).
  - FPS and CPU usage under known test patterns.
- Preserve existing macro usage and includes; avoid stealth changes while migrating.

### 6.2 Performance Regression

**Risk:** Header-only pattern modules plus extra includes bloat code or slow builds, and pattern inlining impacts instruction cache.

**Mitigations:**
- Keep heavy helpers in `.cpp` (sprite/dot internals, complex math).
- Limit cross-module includes by grouping patterns logically.
- Use existing FPS diagnostics (and `K1NPlan_TASK11_HARDWARE_VALIDATION_STRATEGY`) to compare pre vs post-refactor performance.

### 6.3 Helper Misuse Re-occurring

**Risk:** Future agents reintroduce `memset` or similar “optimizations” inside helpers, rebreaking patterns.

**Mitigations:**
- Strong comments in `emotiscope_helpers.cpp` around `draw_sprite`, `draw_sprite_float`, `draw_dot` explaining the exact regression.
- Optionally add unit tests (or debug-mode asserts) that:
  - Verify sprite/dot helpers do not zero buffers internally.
  - Smoke-test a minimal Bloom/BloomMirror snapshot pipeline.

---

## 7. Acceptance Criteria

For this refactor to be considered complete and safe:

- **Functional parity:**
  - Bloom/Bloom Mirror, Beat Tunnel/Variant, Snapwave, Analog/Metronome/Hype, Tempiscope, Waveform Spectrum behave at least as well as pre-refactor versions (based on current fixed state).
- **Performance:**
  - GPU loop maintains ≥150 FPS on reference patterns, with no statistically significant slowdown.
  - Audio task timing (Goertzel/tempo) unchanged within measurement noise.
- **Maintainability:**
  - No single pattern module exceeds a reasonable size (e.g., <300–400 lines).
  - New patterns can be added by creating one header and a single registry entry.
- **Safety:**
  - All shared helpers critical to patterns have explicit comments about `memset` and buffer-clearing pitfalls.
  - CI and/or manual checklist includes a quick visual sanity check for at least one pattern from each family.

---

## 8. Next Actions

1. Review this plan for scope alignment and adjust family grouping if desired.
2. Lock in per-family migration order (e.g., Bloom family → tunnels → dot family → Tempiscope → Waveform Spectrum → misc).
3. Begin Phase 1 with Bloom family as the pilot module, using this plan as the implementation guide.

---

## 9. Detailed Module Layout & Mapping

This section enumerates concrete pattern → module mappings and the symbols each module depends on. Paths are relative to `firmware/src`.

### 9.1 Bloom Family

- **Current definitions (generated_patterns.h):**
  - `draw_bloom(const PatternRenderContext&)` – lines ~422–518.
  - `draw_bloom_mirror(const PatternRenderContext&)` – lines ~520–620.
  - `draw_snapwave(const PatternRenderContext&)` – lines ~1941–2079.
- **Target module:** `patterns/bloom_family.hpp`
- **Exports:**
  - `inline void draw_bloom(const PatternRenderContext&);`
  - `inline void draw_bloom_mirror(const PatternRenderContext&);`
  - `inline void draw_snapwave(const PatternRenderContext&);`
- **Required includes:**
  - `pattern_render_context.h` – for `PatternRenderContext`.
  - `pattern_audio_interface.h` – if PATTERN_AUDIO_START() is used in future refactors.
  - `palettes.h` – `color_from_palette`.
  - `emotiscope_helpers.h` – `draw_sprite_float`, `apply_mirror_mode`.
  - `shared_pattern_buffers.h` – dual-channel buffers for Bloom Mirror / Snapwave.
  - `dsps_helpers.h` – `dsps_mulc_f32_inplace`, `dsps_memcpy_accel`.
- **Audio fields used (from `context.audio_snapshot.payload`):**
  - `vu_level`
  - `novelty_curve` (scalar)
  - `chromagram[12]`
  - `spectrogram[NUM_FREQS]`, `spectrogram_smooth[NUM_FREQS]`
- **Critical invariants:**
  - Bloom and Bloom Mirror use persistent per-channel arrays:
    - `static float bloom_trail[2][NUM_LEDS];`
    - `static float bloom_trail_prev[2][NUM_LEDS];`
  - These buffers must **not** be cleared by helpers; patterns decay them explicitly, then call `draw_sprite_float()` to shift/blur energy.

### 9.2 Tunnel Family

- **Current definitions:**
  - `draw_beat_tunnel` – `generated_patterns.h` ~900–1056.
  - `draw_beat_tunnel_variant` – ~1061–1184.
  - `draw_tunnel_glow` – ~1345–1450.
- **Target module:** `patterns/tunnel_family.hpp`
- **Exports:**
  - `inline void draw_beat_tunnel(const PatternRenderContext&);`
  - `inline void draw_beat_tunnel_variant(const PatternRenderContext&);`
  - `inline void draw_tunnel_glow(const PatternRenderContext&);`
- **Required includes:**
  - `pattern_render_context.h`
  - `pattern_audio_interface.h`
  - `palettes.h`
  - `emotiscope_helpers.h` – `draw_sprite`, `apply_mirror_mode`.
  - `shared_pattern_buffers.h`
- **Audio fields used:**
  - `tempo_phase[NUM_TEMPI]`
  - `tempo_magnitude[NUM_TEMPI]`
  - `tempo_confidence`
  - `spectrogram_smooth[NUM_FREQS]`
  - `vu_level` (for gating in some variants)
- **Critical invariants:**
  - `draw_sprite()` is called *after* per-frame decay; it must be additive-only.
  - Tunnel images live in `shared_pattern_buffers.shared_image_buffer[_prev]` and must keep data between frames.

### 9.3 Dot Family (Analog / Metronome / Hype)

- **Current definitions:**
  - `draw_analog` – `generated_patterns.h` ~1589–1638.
  - `draw_metronome` – ~1642–1708.
  - `draw_hype` – ~1712–1785.
- **Target module:** `patterns/dot_family.hpp`
- **Exports:**
  - `inline void draw_analog(const PatternRenderContext&);`
  - `inline void draw_metronome(const PatternRenderContext&);`
  - `inline void draw_hype(const PatternRenderContext&);`
- **Required includes:**
  - `pattern_render_context.h`
  - `pattern_audio_interface.h` – for band energy helpers (`get_audio_band_energy*`).
  - `palettes.h`
  - `emotiscope_helpers.h` – `draw_dot`, `NUM_RESERVED_DOTS`.
- **Audio fields used:**
  - `vu_level`
  - `spectrogram[NUM_FREQS]`
  - Band helpers:
    - `get_audio_band_energy(audio, start, end)`
    - `get_audio_band_energy_absolute(audio, start, end)` for some modes
- **Critical invariants:**
  - `draw_dot()` now manages per-layer buffers with decay. Patterns must **not** call `memset` on these layers; only opacity/decay should be tuned.

### 9.4 Tempiscope

- **Current definition:** `draw_tempiscope` – `generated_patterns.h` ~804–902.
- **Target module:** `patterns/tempiscope.hpp`
- **Required includes:**
  - `pattern_render_context.h`
  - `palettes.h`
- **Audio fields used:**
  - `tempo_phase[NUM_TEMPI]`
  - `tempo_magnitude[NUM_TEMPI]`
  - `tempo_confidence`
  - `timestamp_us` (for staleness detection)
- **Critical invariants:**
  - Must clamp bin index to `[0, NUM_TEMPI-1]`.
  - Must normalize magnitudes by the current max (with a small epsilon floor) and modulate final brightness by `tempo_confidence` so weak tempos don’t black out the strip.

### 9.5 Waveform Spectrum

- **Current definition:** `draw_waveform_spectrum` – `generated_patterns.h` ~1794–1990.
- **Target module:** `patterns/spectrum_family.hpp`
- **Required includes:**
  - `pattern_render_context.h`
  - `palettes.h`
  - `audio/goertzel.h` – for `sample_history[]`, `SAMPLE_HISTORY_LENGTH`.
- **Audio fields used:**
  - `vu_level`
  - `chromagram[12]`
  - `spectrogram[NUM_FREQS]`
  - `sample_history[SAMPLE_HISTORY_LENGTH]` (time-domain waveform)
- **Critical invariants:**
  - Waveform amplitude per LED is derived from **real samples** in `sample_history`, smoothed into `waveform_history[]`. Reverting to synthetic VU-only envelopes breaks parity with Sensory Bridge.

### 9.6 Snapwave

- **Current definition:** `draw_snapwave` – `generated_patterns.h` ~1990–2079.
- **Target module:** `patterns/bloom_family.hpp` (same family) or its own file if preferred.
- **Audio fields used:**
  - `tempo_phase[NUM_TEMPI]`, `tempo_magnitude[NUM_TEMPI]`, `tempo_confidence`
  - `vu_level`
  - `spectrogram[NUM_FREQS]`
- **Critical invariants:**
  - Beat injection at `snapwave_buffer[0]` is gated by tempo confidence and magnitude; thresholds must remain low enough for normal music to trigger it, but high enough to keep noise from flickering.

---

## 10. Mechanical Migration Recipes

This section gives “copy-paste safe” recipes for moving code, avoiding the accidental drifts that caused prior regressions.

### 10.1 Common Pattern Module Template

All modules under `patterns/` should follow this skeleton:

```cpp
#pragma once

#include "pattern_render_context.h"
#include "pattern_audio_interface.h"
#include "palettes.h"
#include "emotiscope_helpers.h"
#include "shared_pattern_buffers.h"  // only if needed

inline void draw_some_pattern(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;
    const int num_leds = context.num_leds;
    const AudioDataSnapshot& audio = context.audio_snapshot;

    // Access audio fields via 'audio.payload.<field>'
    // No calls to get_audio_snapshot() here – snapshot is provided.
}
```

Notes:

- Use `inline` on pattern functions to avoid ODR issues across multiple TUs.
- Prefer direct field reads (`audio.payload.vu_level`) over redefining many macros; when macros are used, `#undef` them at the end of the function to avoid leakage.
- **Header-only + static state:** only one translation unit (e.g., `pattern_registry.cpp`) should `#include "patterns/*.hpp"`. Headers must not be pulled into multiple TUs if they contain `static` pattern state, or each core will see its own copy.

### 10.2 Bloom Family – Concrete Steps

1. Create `patterns/bloom_family.hpp` with the template above.
2. Cut the exact bodies of `draw_bloom`, `draw_bloom_mirror`, and `draw_snapwave` from `generated_patterns.h` and paste them into the new header, marking them `inline`.
3. Make sure the following remain intact:
   - `static float bloom_trail[2][NUM_LEDS];`
   - `static float bloom_trail_prev[2][NUM_LEDS];`
   - Any use of `get_pattern_channel_index()` and `shared_pattern_buffers` in Bloom Mirror / Snapwave.
4. Ensure no calls to `memset` are added inside these functions; only decay via scalar multiplication is allowed.
5. In `generated_patterns.h`, replace the original function bodies with:
   ```cpp
   #include "patterns/bloom_family.hpp"
   ```
   under the Bloom family region (Phase 1), or remove them entirely once the registry is wired to include the module directly (Phase 3).

### 10.3 Tunnels, Dot Family, Tempiscope, Waveform Spectrum

For each family:

- Repeat the Bloom recipe:
  - New `patterns/<family>_family.hpp`.
  - Move `draw_*` bodies verbatim.
  - Add precise includes for the dependencies listed in section 9.
- After each family is migrated:
  - Build firmware.
  - On hardware, cycle to at least one pattern from that family and confirm:
    - Visual behavior matches pre-migration output.
    - FPS in logs stays within expected range (no unexpected slowdowns).

---

## 11. Registry Wiring – Low-Level Details

In `pattern_registry.cpp`:

1. Include only the headers that define pattern functions:
   ```cpp
   #include "pattern_registry.h"
   #include "patterns/bloom_family.hpp"
   #include "patterns/tunnel_family.hpp"
   #include "patterns/dot_family.hpp"
   #include "patterns/spectrum_family.hpp"
   #include "patterns/tempiscope.hpp"
   // ...
   ```
2. Define `g_pattern_registry` using the **exact function names**:
   ```cpp
   const PatternInfo g_pattern_registry[] = {
       { "Bloom", "bloom", "Audio-reactive bloom", draw_bloom, true },
       { "Bloom Mirror", "bloom_mirror", "Dual-channel bloom", draw_bloom_mirror, true },
       // ...
   };
   ```
3. Keep `pattern_registry.h` unchanged in interface:
   - Still exposes `get_current_pattern()`, `draw_current_pattern(const PatternRenderContext&)`, etc.
4. In `main.cpp`, **no changes are needed** to pattern selection logic; it already uses the registry interface.

This ensures the rest of the system is oblivious to how patterns are physically organized.

---

## 12. Helper Invariants & Anti-Patterns (For Future Agents)

These rules exist because breaking them has already caused real regressions in this codebase.

1. **No `memset` inside sprite/dot helpers**
   - `draw_sprite`, `draw_sprite_float`, `draw_dot` must never clear their target/layer buffers.
   - The only acceptable clearing/decay is via scalar multiplication in the *caller* (pattern code).

2. **Single audio snapshot per pattern frame**
   - Patterns receive `context.audio_snapshot` by value; they must not call `get_audio_snapshot()` again.
   - All audio reads must come from this snapshot to avoid racing Core 0/1 and to preserve the seqlock guarantees.

3. **Center-origin is non-negotiable for audio-reactive patterns**
   - New audio-reactive patterns must either:
     - Use `apply_mirror_mode`, or
     - Perform explicit left/right mirroring as existing patterns do.
   - Any deviation must be explicitly justified in comments.

4. **Tempo indices must always be clamped**
   - Whenever a pattern converts `[0,1]` progress to a tempo bin:
     ```cpp
     int bin = (int)lroundf(progress * (float)(NUM_TEMPI - 1));
     if (bin < 0) bin = 0;
     if (bin >= NUM_TEMPI) bin = NUM_TEMPI - 1;
     ```
   - This must not be “simplified away”, especially if `NUM_TEMPI` changes again.

5. **Documented expectations**
   - For each pattern module, maintain a short comment at the top summarizing:
     - Audio fields it depends on.
     - Helpers it uses.
     - Any surprising behavior (e.g., reliance on tempo_confidence, dot layers, shared buffers).

This section is intended to be the low-level guardrail you can point future agents at when they start “cleaning up” helpers or patterns.

---

## 13. Additional Operational Guidelines & Lessons Learned

These are cross-cutting rules that don’t belong to a single module, but are critical for keeping the system stable over time.

### 13.1 Header-Only Patterns and Static State

- Pattern modules (`patterns/*.hpp`) are header-only and often contain `static` locals (trail buffers, angles, dot layers).
- To avoid multiple copies of state:
  - Only **one** `.cpp` (recommended: `pattern_registry.cpp`) should include the pattern headers.
  - `pattern_registry.h` should forward-declare pattern functions, not include their headers.
- Any new TU that needs to call a pattern should do so through the registry, not by including the module directly.

### 13.2 Macro Hygiene

- Macros like `AUDIO_VU`, `AUDIO_SPECTRUM`, `AUDIO_IS_AVAILABLE` are convenient but dangerous when they leak:
  - Define them in as small a scope as possible (inside a function), and `#undef` them immediately after.
  - Never define these macros in a shared header without a matching `#undef` in the same file.
- Code review guideline: patterns that introduce new `#define`’s must show the corresponding `#undef` in the same patch.

### 13.3 Emotiscope as Ground Truth

- For migrated patterns, the canonical behavior is Emotiscope, not the current K1 version (which has already suffered regressions).
- When validating a pattern refactor:
  - Compare against the original sources under:
    - `zref/Emotiscope.sourcecode/Emotiscope-1.0` … `Emotiscope-2.0`
    - `zref/Sensorybridge.sourcecode/SensoryBridge-3.1.0` / `4.0.0` for Sensory Bridge patterns.
  - Use Emotiscope comments and constant values (decay, thresholds, palette behavior) as reference.

### 13.4 Memset Discipline Beyond Helpers

- The root cause of several breakages was aggressive use of `memset` in hot paths:
  - Inside sprite helpers → killed Bloom/Tunnels/Snapwave.
  - Inside dot logic → flattened Analog/Metronome/Hype.
- Beyond `draw_sprite*` and `draw_dot`, any use of `memset` in audio/visual code should be treated as suspect unless it is:
  - A one-time initialization in `init_*` code, or
  - A deliberate, documented “reset” operation.
- Recommended audit command when reviewing changes:
  ```bash
  rg "memset" firmware/src/audio firmware/src/patterns firmware/src/emotiscope_helpers.cpp
  ```

### 13.5 Registry and ID Stability

- `PatternInfo.id` strings are part of the external contract (web UI routes, presets, automation). When adjusting the registry:
  - Do **not** change IDs without updating dependent components.
  - Prefer appending new patterns rather than reordering existing ones to avoid brittle index-based assumptions.
- If reordering or renaming is necessary, capture it as a separate, intentional change with migration notes.

### 13.6 Diagnostics and Debug Hooks

- Existing toggles:
  - `d` – audio diagnostics (`audio_debug_enabled`).
  - `t` – tempo diagnostics (`tempo_debug_enabled`).
  - `x` – low-level audio trace (`audio_trace_enabled`).
- As families are refactored, keep or add **low-cost diagnostics** behind these flags:
  - Bloom family: log max trail energy and center injection magnitude under `audio_debug_enabled`.
  - Tunnel family: log dominant tempo bin and strength under `tempo_debug_enabled`.
  - Dot family: log VU and band energies for Analog/Metronome/Hype under `audio_debug_enabled`.
- These hooks should remain cheap when disabled (no heavy computations guarded only by `if`).

### 13.7 Module-Level Documentation

- Every new `patterns/*.hpp` should start with a concise header comment that lists:
  - Which audio snapshot fields it reads (e.g., `vu_level`, `spectrogram_smooth`, `tempo_phase[]`, `tempo_magnitude[]`).
  - The helpers it depends on (`draw_sprite_float`, `draw_dot`, `apply_mirror_mode`, `shared_pattern_buffers`, etc.).
  - Any non-obvious behavior or assumptions (center-origin mirroring, tempo_confidence reliance, dual-channel usage).
- This metadata is as important as the code for future agents to avoid repeating mistakes.
