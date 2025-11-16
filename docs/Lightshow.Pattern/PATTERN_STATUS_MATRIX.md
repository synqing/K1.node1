# Pattern Status Matrix

**Last Updated:** 2025-01-XX  
**Purpose:** At-a-glance status of all light show patterns  
**Related Docs:** [Pattern History](../Lightshow.Pattern/LIGHTSHOW_PATTERN_HISTORY.md), [Development Workflow](../03-guides/PATTERN_DEVELOPMENT_WORKFLOW.md)  
**Maintenance:** Update this matrix whenever pattern status changes. Reference commit hashes from `LIGHTSHOW_PATTERN_HISTORY.md`.

---

## Status Legend

| Symbol | Meaning | Action Required |
|--------|---------|-----------------|
| ✅ | Complete Parity | None - matches Emotiscope reference |
| ⚠️ | Partial Parity | Review - has known deviations or limitations |
| ❌ | Known Issues | Fix - documented problems present |
| 🔧 | Under Development | Monitor - active modifications |
| 📝 | Needs Documentation | Document - implementation not yet documented |

---

## Pattern Status Table

| Pattern | Family | Status | File Location | Last Modified | Known Issues | Parity Notes |
|---------|--------|--------|---------------|---------------|--------------|--------------|
| Spectrum | Spectrum | ✅ | `patterns/spectrum_family.hpp` | 2025-11-16 (`7c733c18`) | Background overlay disabled | Matches Emotiscope except background overlay |
| Octave | Spectrum | ✅ | `patterns/spectrum_family.hpp` | 2025-11-16 (`7c733c18`) | Background overlay disabled | Matches Emotiscope except background overlay |
| Waveform Spectrum | Spectrum | ✅ | `patterns/spectrum_family.hpp` | 2025-11-14 (`b003be01`) | Audio guard added | Parity verified 2025-11-16, audio guard prevents stale data |
| Bloom | Bloom | ✅ | `patterns/bloom_family.hpp` | 2025-11-05 (`481edf12`) | Background overlay disabled | Matches Emotiscope except background overlay |
| Bloom Mirror | Bloom | ✅ | `patterns/bloom_family.hpp` | 2025-11-05 (`481edf12`) | Background overlay disabled | Matches Emotiscope except background overlay |
| Snapwave | Bloom | ⚠️ | `patterns/bloom_family.hpp` | 2025-11-14 (`b003be01`) | Audio guard added; idle mode initially lacked deterministic behavior | Idle mode fixed outside commit log; parity verified 2025-11-16 |
| Pulse | Misc | ❌ | `patterns/misc_patterns.hpp` | 2025-11-05 (`481edf12`) | VU gating instead of tempo; no background fallback; black screen on silence | Needs tempo confidence restoration (see [History §6](../Lightshow.Pattern/LIGHTSHOW_PATTERN_HISTORY.md#6-pulse)) |
| Tempiscope | Tempiscope | ⚠️ | `patterns/tempiscope.hpp` | 2025-11-14 (`b003be01`) | Background overlay disabled; silence fallback minimal (zeros LEDs) | Parity verified 2025-11-16; tempo behavior matches but ambient differs |
| Prism | Prism | ✅ | `patterns/prism.hpp` | 2025-11-16 (`7c733c18`) | Background overlay disabled (intentional) | Parity verified; Phase 2 only pattern; background disabled by design |
| Beat Tunnel | Tunnel | ✅ | `patterns/tunnel_family.hpp` | 2025-11-16 (`7c733c18`) | Background overlay disabled | Matches Emotiscope except background overlay; dt bug fixed outside commit log |
| Tunnel Glow | Tunnel | ✅ | `patterns/tunnel_family.hpp` | 2025-11-07 (`315a5ef7`) | dt bug fixed outside commit log | Phase 2 only pattern; parity verified 2025-11-16 |
| Startup Intro | Tunnel | ✅ | `patterns/tunnel_family.hpp` | 2025-11-07 (`c7aba918`) | N/A | Phase 2 only pattern; deterministic animation |
| Perlin | Misc | ✅ | `patterns/misc_patterns.hpp` | 2025-11-14 (`997980cb`) | Audio guard + fallback added | Matches Emotiscope except background overlay |
| Departure | Static | ✅ | `patterns/static_family.hpp` | 2025-11-05 (`481edf12`) | Background overlay disabled | Non-audio pattern; parity confirmed 2025-11-16 |
| Lava | Static | ✅ | `patterns/static_family.hpp` | 2025-11-05 (`481edf12`) | Background overlay disabled | Non-audio pattern; parity confirmed 2025-11-16 |
| Twilight | Static | ✅ | `patterns/static_family.hpp` | 2025-11-05 (`481edf12`) | Background overlay disabled | Non-audio pattern; parity confirmed 2025-11-16 |
| Analog | Dot | ⚠️ | `patterns/dot_family.hpp` | 2025-11-14 (`74ac4bdb`) | Silence fallback minimal (black screen) | Background overlay disabled; parity verified 2025-11-16 |
| Metronome | Dot | ⚠️ | `patterns/dot_family.hpp` | 2025-11-14 (`74ac4bdb`) | Silence fallback minimal (black screen) | Background overlay disabled; parity verified 2025-11-16 |
| Hype | Dot | ⚠️ | `patterns/dot_family.hpp` | 2025-11-14 (`74ac4bdb`) | Silence fallback minimal; originally tempo-driven, currently band-energy driven | Background overlay disabled; parity verified 2025-11-16 |

---

## Status Summary

**Complete Parity (✅):** 13 patterns  
**Partial Parity (⚠️):** 4 patterns  
**Known Issues (❌):** 1 pattern (Pulse)  
**Under Development (🔧):** 0 patterns  
**Needs Documentation (📝):** 0 patterns

**Total Patterns:** 18

---

## Priority Actions

### High Priority

1. **Restore Pulse tempo-confidence gating**
   - **Pattern:** Pulse (`patterns/misc_patterns.hpp`)
   - **Issue:** Currently uses VU gating instead of tempo confidence; lacks background fallback; black screen on silence
   - **Reference:** [History §6](../Lightshow.Pattern/LIGHTSHOW_PATTERN_HISTORY.md#6-pulse)
   - **Action:** Restore original `PATTERN_AUDIO_START` macros and tempo-confidence logic from Phase 1
   - **Source:** `K1.reinvented/firmware/src/generated_patterns.h:522-615`

### Medium Priority

2. **Improve silence fallbacks for Dot family patterns**
   - **Patterns:** Analog, Metronome, Hype (`patterns/dot_family.hpp`)
   - **Issue:** Patterns black out on silence due to disabled background overlay
   - **Action:** Implement explicit idle animations or gentle gradients
   - **Reference:** [History §14.2](../Lightshow.Pattern/LIGHTSHOW_PATTERN_HISTORY.md#142-silence-paths-that-clear-leds-and-return-early)

3. **Improve Tempiscope silence fallback**
   - **Pattern:** Tempiscope (`patterns/tempiscope.hpp`)
   - **Issue:** Minimal fallback (zeros LEDs) when audio unavailable
   - **Action:** Implement gentle breathing animation or gradient
   - **Reference:** [History §7](../Lightshow.Pattern/LIGHTSHOW_PATTERN_HISTORY.md#7-tempiscope)

### Low Priority

4. **Document Snapwave idle mode deterministic behavior**
   - **Pattern:** Snapwave (`patterns/bloom_family.hpp`)
   - **Status:** Fixed outside commit log; should document the fix
   - **Action:** Document idle mode implementation in pattern history

---

## Change Log

| Date | Pattern | Change | Status Update | Committed By / Reference |
|------|---------|--------|---------------|--------------------------|
| 2025-11-16 | Spectrum, Octave, Waveform | Final parity verification (`7c733c18`) | ✅ Complete | Parity audit |
| 2025-11-16 | Prism | Parity verification (`7c733c18`) | ✅ Complete | Parity audit |
| 2025-11-16 | Snapwave | Idle mode fixed (outside commit log) | ⚠️ → ✅ | Ad-hoc fix |
| 2025-11-16 | Tempiscope | Parity verification (`7c733c18`) | ⚠️ Partial (tempo matches, fallback differs) | Parity audit |
| 2025-11-16 | Pulse | Parity audit notes VU gating deviation (`7c733c18`) | ❌ Known Issues | Parity audit |
| 2025-11-16 | Dot Family | Parity verification (`7c733c18`) | ⚠️ Partial (fallback minimal) | Parity audit |
| 2025-11-14 | Waveform Spectrum | Audio guard added (`b003be01`) | ✅ Complete | Audio validity fix |
| 2025-11-14 | Snapwave | Audio guard added (`b003be01`) | ⚠️ (idle mode incomplete) | Audio validity fix |
| 2025-11-14 | Perlin | Audio guard + fallback added (`997980cb`) | ✅ Complete | Audio validity fix |
| 2025-11-14 | Spectrum Family | Brightness fixes (`6a68bb23`, `7e1543a1`) | ✅ Complete | Double brightness fix |
| 2025-11-14 | Prism | Brightness fixes (`6a68bb23`, `7e1543a1`) | ✅ Complete | Double brightness fix |
| 2025-11-11 | Prism | Rebuilt with Emotiscope design (`a4b4731b`) | ✅ Complete | Pattern redesign |
| 2025-11-11 | Spectrum | Center-alignment fix (`e3219577`) | ✅ Complete | Regression fix |
| 2025-11-07 | Tunnel Glow | Created (`315a5ef7`) | ✅ Complete | New pattern |
| 2025-11-07 | Startup Intro | Created (`4a6d95dd`, `c7aba918`) | ✅ Complete | New pattern |
| 2025-11-05 | All patterns | Modularization (`481edf12`) | Various | Phase 2 refactor |

---

## Known Limitations (Global)

### Background Overlay Disabled

**Status:** By design in Phase 2  
**Impact:** All patterns  
**Effect:** `params.background` slider has no effect globally; patterns must implement ambient behavior explicitly  
**Reference:** [History §12.1](../Lightshow.Pattern/LIGHTSHOW_PATTERN_HISTORY.md#12-helper--pipeline-changes-impacting-all-patterns)

### Color Pipeline Integration

**Status:** Active since 2025-11-11  
**Impact:** All patterns  
**Effect:** Patterns must not multiply by `params.brightness` internally (pipeline handles this globally)  
**Reference:** [History §12.2](../Lightshow.Pattern/LIGHTSHOW_PATTERN_HISTORY.md#12-helper--pipeline-changes-impacting-all-patterns)

### Snapshot / Freshness Boundaries

- The render loop fetches a single `AudioDataSnapshot` per frame and injects it via `PatternRenderContext`. Patterns must never call `get_audio_snapshot()` internally; doing so risks torn reads and breaks the seqlock guarantees.
- Patterns are responsible for their own freshness tracking (static `last_update_counter` per pattern) now that `PATTERN_AUDIO_START()` is gone.
- Do not mutate `context.audio_snapshot.payload` or keep pointers into it beyond the draw call.

### Magnitude / AGC Chain

- The expected processing order is Goertzel → noise suppression → spectrogram smoothing → Cochlear AGC → tempo/VU/chroma → pattern rendering → color pipeline.
- Ensure `g_cochlear_agc->process()` runs inside `calculate_magnitudes()` before copying into `audio_back`.
- Fix brightness/response by repairing the pipeline, not by inserting per-pattern multipliers downstream.

### Shared Buffers / Dual Channels

- Bloom Mirror, Tunnel family, and Snapwave rely on `shared_pattern_buffers`. Always call `acquire_dual_channel_buffer()` and never `memset` the buffers; persistence requires multiplicative decay only.
- Honor `g_pattern_channel_index` so dual-strip deployments stay in sync.

### Palette / Parameter Semantics

- Keep `params.color`, `color_range`, `softness`, and `custom_param_*` meanings consistent within a family. The UI maps to these slots globally; conflicting behaviors confuse users and break parity checks.

---

## Pattern Family Overview

### Spectrum Family (3 patterns)
- **Status:** All ✅ Complete Parity
- **Location:** `patterns/spectrum_family.hpp`
- **Last Parity Check:** 2025-11-16 (`7c733c18`)
- **Known Issues:** Background overlay disabled (global limitation)

### Bloom Family (3 patterns)
- **Status:** 2 ✅ Complete, 1 ⚠️ Partial (Snapwave)
- **Location:** `patterns/bloom_family.hpp`
- **Last Parity Check:** 2025-11-16 (`7c733c18`)
- **Known Issues:** Background overlay disabled; Snapwave idle mode fixed outside commit log

### Dot Family (3 patterns)
- **Status:** All ⚠️ Partial Parity
- **Location:** `patterns/dot_family.hpp`
- **Last Parity Check:** 2025-11-16 (`7c733c18`)
- **Known Issues:** Minimal silence fallbacks (black screen); background overlay disabled

### Static Family (3 patterns)
- **Status:** All ✅ Complete Parity
- **Location:** `patterns/static_family.hpp`
- **Last Parity Check:** 2025-11-16 (`7c733c18`)
- **Known Issues:** Background overlay disabled (non-audio patterns, less critical)

### Tunnel Family (3 patterns)
- **Status:** All ✅ Complete Parity
- **Location:** `patterns/tunnel_family.hpp`
- **Last Parity Check:** 2025-11-16 (`7c733c18`)
- **Known Issues:** Background overlay disabled; dt bug in Tunnel Glow fixed outside commit log

### Misc Patterns (3 patterns)
- **Status:** 1 ✅ Complete (Perlin), 1 ❌ Known Issues (Pulse), 1 ✅ Complete (Prism)
- **Location:** `patterns/misc_patterns.hpp`, `patterns/prism.hpp`, `patterns/tempiscope.hpp`
- **Last Parity Check:** 2025-11-16 (`7c733c18`)
- **Known Issues:** Pulse needs tempo restoration; Tempiscope minimal fallback

---

## Maintenance Instructions

### When to Update This Matrix

1. **After pattern modification:** Update status, last modified date, known issues
2. **After parity audit:** Update status symbols, parity notes
3. **When new issues discovered:** Add to known issues column
4. **When issues resolved:** Update status (❌ → ⚠️ or ✅), remove from known issues

### Update Procedure

1. Identify the pattern(s) affected
2. Update relevant row(s) in Pattern Status Table
3. Update Status Summary counts
4. Add entry to Change Log with date, pattern, change, and reference
5. Update Priority Actions if status changed
6. Update Pattern Family Overview if family status changed

### Validation

Before finalizing updates:
- [ ] All commit hashes verified (exist in git history)
- [ ] All file paths verified (files exist)
- [ ] Status summary counts match table
- [ ] Change log entries are chronological
- [ ] Priority actions reflect current issues

---

**Related Documentation:**
- [Pattern History](../Lightshow.Pattern/LIGHTSHOW_PATTERN_HISTORY.md) - Detailed change tracking
- [Development Workflow](../03-guides/PATTERN_DEVELOPMENT_WORKFLOW.md) - Modification process
- [Troubleshooting Quick Reference](PATTERN_TROUBLESHOOTING_QUICK.md) - Diagnostic tools
- [Pattern Glossary](PATTERN_GLOSSARY.md) - Technical term definitions
