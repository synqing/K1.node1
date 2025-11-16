# Pattern Documentation Supplement Proposal

**Purpose:** Define additional documentation files needed to complement `LIGHTSHOW_PATTERN_HISTORY.md` and create a complete knowledge base for pattern development and troubleshooting.

**Status:** Proposal  
**Date:** 2025-01-XX  
**Author:** Captain (Strategic Analysis)

---

## Executive Summary

The `LIGHTSHOW_PATTERN_HISTORY.md` document provides exceptional historical tracking and failure mode documentation, but lacks operational status tracking, workflow guidance, and quick-reference diagnostic tools. This proposal identifies **five new documents** that will transform the pattern documentation suite from "reference consulted when broken" to "guide followed during development."

**Proposed Documents:**
1. **Pattern Status Matrix** (`06-reference/PATTERN_STATUS_MATRIX.md`) - Operational status dashboard
2. **Pattern Development Workflow** (`03-guides/PATTERN_DEVELOPMENT_WORKFLOW.md`) - Step-by-step development process
3. **Pattern Troubleshooting Quick Reference** (`06-reference/PATTERN_TROUBLESHOOTING_QUICK.md`) - Diagnostic decision tree
4. **Pattern Architecture Overview** (`01-architecture/PATTERN_ARCHITECTURE_OVERVIEW.md`) - Onboarding and system understanding
5. **Pattern Glossary** (`06-reference/PATTERN_GLOSSARY.md`) - Technical term definitions

---

## Document Relationships

```
┌─────────────────────────────────────────────────────────┐
│  PATTERN_ARCHITECTURE_OVERVIEW.md                       │
│  (Onboarding - Read First)                              │
└─────────────────────────────────────────────────────────┘
                       │
                       ├──────────────────────┐
                       │                      │
                       ▼                      ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│  PATTERN_DEVELOPMENT_        │  │  PATTERN_STATUS_MATRIX.md    │
│  WORKFLOW.md                 │  │  (Operational Dashboard)     │
│  (How to Modify Patterns)    │  └──────────────────────────────┘
└──────────────────────────────┘            │
                       │                    │
                       └──────────┬─────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────┐
│  LIGHTSHOW_PATTERN_HISTORY.md                           │
│  (Historical Reference - Consult During Development)    │
└─────────────────────────────────────────────────────────┘
                       │
                       ├──────────────────────┐
                       │                      │
                       ▼                      ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│  PATTERN_TROUBLESHOOTING_    │  │  pattern_implementation_     │
│  QUICK.md                    │  │  guide.md (Existing)         │
│  (Diagnostic Tool)           │  │  (Code Templates)            │
└──────────────────────────────┘  └──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  PATTERN_GLOSSARY.md                                     │
│  (Term Definitions - Reference as Needed)               │
└─────────────────────────────────────────────────────────┘
```

---

## Document 1: Pattern Status Matrix

**Location:** `docs/06-reference/PATTERN_STATUS_MATRIX.md`  
**Purpose:** Operational dashboard showing current implementation status of all patterns  
**Audience:** All agents (quick status check)  
**Update Frequency:** After each pattern modification  
**Format:** Tabular data with status indicators

### Content Structure

```markdown
# Pattern Status Matrix

**Last Updated:** 2025-01-XX  
**Purpose:** At-a-glance status of all light show patterns  
**Related Docs:** [Pattern History](../LIGHTSHOW_PATTERN_HISTORY.md), [Development Workflow](../03-guides/PATTERN_DEVELOPMENT_WORKFLOW.md)

## Status Legend

| Symbol | Meaning | Action Required |
|--------|---------|-----------------|
| ✅ | Complete Parity | None - matches Emotiscope reference |
| ⚠️ | Partial Parity | Review - has known deviations or limitations |
| ❌ | Known Issues | Fix - documented problems present |
| 🔧 | Under Development | Monitor - active modifications |
| 📝 | Needs Documentation | Document - implementation not yet documented |

## Pattern Status Table

| Pattern | Family | Status | File Location | Last Modified | Known Issues | Parity Notes |
|---------|--------|--------|---------------|---------------|--------------|--------------|
| Spectrum | Spectrum | ✅ | `patterns/spectrum_family.hpp` | 2025-11-16 | Background overlay disabled | Matches Emotiscope except background |
| Octave | Spectrum | ✅ | `patterns/spectrum_family.hpp` | 2025-11-16 | Background overlay disabled | Matches Emotiscope except background |
| Waveform Spectrum | Spectrum | ✅ | `patterns/spectrum_family.hpp` | 2025-11-14 | Audio guard added | Parity verified 2025-11-16 |
| Bloom | Bloom | ✅ | `patterns/bloom_family.hpp` | 2025-11-05 | Background overlay disabled | Matches Emotiscope except background |
| Bloom Mirror | Bloom | ✅ | `patterns/bloom_family.hpp` | 2025-11-05 | Background overlay disabled | Matches Emotiscope except background |
| Snapwave | Bloom | ⚠️ | `patterns/bloom_family.hpp` | 2025-11-14 | Audio guard added; idle mode incomplete | Idle mode lacks deterministic behavior |
| Pulse | Misc | ❌ | `patterns/misc_patterns.hpp` | 2025-11-05 | VU gating instead of tempo; no background fallback | Needs tempo confidence restoration (see History §6) |
| Tempiscope | Tempiscope | ⚠️ | `patterns/tempiscope.hpp` | 2025-11-14 | Background overlay disabled; silence fallback minimal | Parity verified but ambient behavior differs |
| Prism | Prism | ✅ | `patterns/prism.hpp` | 2025-11-16 | Background overlay disabled (intentional) | Parity verified; background disabled by design |
| Beat Tunnel | Tunnel | ✅ | `patterns/tunnel_family.hpp` | 2025-11-05 | Background overlay disabled | Matches Emotiscope except background |
| Tunnel Glow | Tunnel | ✅ | `patterns/tunnel_family.hpp` | 2025-11-07 | dt bug fixed outside commit log | Phase 2 only pattern |
| Startup Intro | Tunnel | ✅ | `patterns/tunnel_family.hpp` | 2025-11-07 | N/A | Phase 2 only pattern |
| Perlin | Misc | ✅ | `patterns/misc_patterns.hpp` | 2025-11-14 | Audio guard + fallback added | Matches Emotiscope except background |
| Departure | Static | ✅ | `patterns/static_family.hpp` | 2025-11-05 | Background overlay disabled | Non-audio pattern |
| Lava | Static | ✅ | `patterns/static_family.hpp` | 2025-11-05 | Background overlay disabled | Non-audio pattern |
| Twilight | Static | ✅ | `patterns/static_family.hpp` | 2025-11-05 | Background overlay disabled | Non-audio pattern |
| Analog | Dot | ⚠️ | `patterns/dot_family.hpp` | 2025-11-14 | Silence fallback minimal | Background overlay disabled |
| Metronome | Dot | ⚠️ | `patterns/dot_family.hpp` | 2025-11-14 | Silence fallback minimal | Background overlay disabled |
| Hype | Dot | ⚠️ | `patterns/dot_family.hpp` | 2025-11-14 | Silence fallback minimal; originally tempo-driven | Background overlay disabled |

## Status Summary

**Complete Parity:** 13 patterns  
**Partial Parity:** 4 patterns  
**Known Issues:** 1 pattern (Pulse)  
**Under Development:** 0 patterns  
**Needs Documentation:** 0 patterns

## Priority Actions

1. **High Priority:** Restore Pulse tempo-confidence gating (see [History §6](../LIGHTSHOW_PATTERN_HISTORY.md#6-pulse))
2. **Medium Priority:** Improve silence fallbacks for Dot family patterns
3. **Low Priority:** Document Snapwave idle mode deterministic behavior

## Change Log

| Date | Pattern | Change | Committed By |
|------|---------|--------|--------------|
| 2025-11-16 | Spectrum, Octave, Waveform | Parity verified | [Agent] |
| 2025-11-14 | Pulse | Audio guard added | [Agent] |

---
**Maintenance:** Update this matrix whenever pattern status changes. Reference commit hashes from `LIGHTSHOW_PATTERN_HISTORY.md`.
```

### Maintenance Requirements

- **Auto-Update Triggers:** After pattern modification commits
- **Validation:** Cross-reference with `LIGHTSHOW_PATTERN_HISTORY.md` commit log
- **Review Frequency:** Weekly during active development

---

## Document 2: Pattern Development Workflow

**Location:** `docs/03-guides/PATTERN_DEVELOPMENT_WORKFLOW.md`  
**Purpose:** Step-by-step process for modifying, creating, and testing patterns  
**Audience:** Agents modifying patterns  
**Update Frequency:** When workflow processes change  
**Format:** Procedural guide with checklists

### Content Structure

```markdown
# Pattern Development Workflow

**Purpose:** Systematic process for pattern modification and creation  
**Related Docs:** [Pattern History](../LIGHTSHOW_PATTERN_HISTORY.md), [Status Matrix](../06-reference/PATTERN_STATUS_MATRIX.md), [Implementation Guide](../06-reference/pattern_implementation_guide.md)

## Quick Start

**For modifying an existing pattern:**
1. Read [Pre-Modification Checklist](#pre-modification-checklist)
2. Follow [Modification Process](#modification-process)
3. Complete [Post-Modification Verification](#post-modification-verification)

**For creating a new pattern:**
1. Read [New Pattern Creation](#new-pattern-creation)
2. Follow [Implementation Steps](#implementation-steps)
3. Complete [Integration Checklist](#integration-checklist)

---

## Pre-Modification Checklist

Before modifying any existing pattern:

- [ ] **Read the Pattern History section** for your target pattern in `LIGHTSHOW_PATTERN_HISTORY.md`
  - Understand when it was last modified and why
  - Identify any known issues or limitations
  - Note any regressions that were fixed previously

- [ ] **Review the Pattern Status Matrix** entry
  - Check current parity status
  - Review known issues that might be affected by your change
  - Understand expected vs actual behavior

- [ ] **Examine the pattern file** (`firmware/src/patterns/*_family.hpp`)
  - Read the header comment block (usually contains important warnings)
  - Identify audio snapshot dependencies
  - Note helper function usage
  - Check for center-origin rendering compliance

- [ ] **Review last 3 commits** affecting the pattern
  ```bash
  git log --oneline -- firmware/src/patterns/<family>.hpp | head -3
  git show <commit_hash> -- firmware/src/patterns/<family>.hpp
  ```

- [ ] **Understand audio dependencies**
  - Which `AudioDataSnapshot` fields does the pattern use?
  - Does it use `AUDIO_IS_AVAILABLE()` guard?
  - How does it handle silence/snapshot age?

- [ ] **Identify helper function dependencies**
  - Check `pattern_helpers.h` usage
  - Review `emotiscope_helpers.h` dependencies
  - Understand palette system integration

---

## Modification Process

### Step 1: Plan Your Change

Document your intent:
- What behavior are you changing?
- Why is this change necessary?
- What are the expected outcomes?
- What could break?

**Template:**
```markdown
## Modification Plan: [Pattern Name]

**Date:** YYYY-MM-DD  
**Agent:** [Your identifier]  
**Goal:** [What you're trying to achieve]

**Current Behavior:**
[Describe how pattern currently works]

**Proposed Change:**
[Describe what will change]

**Rationale:**
[Why this change is needed]

**Risk Assessment:**
- Breaking changes: [List potential impacts]
- Parity concerns: [Will this affect Emotiscope compatibility?]
- Performance impact: [Will this affect FPS?]
```

### Step 2: Create Feature Branch

```bash
git checkout -b pattern/<pattern-name>/<brief-description>
```

### Step 3: Implement Change

Follow these guidelines:

**✅ DO:**
- Maintain center-origin rendering (use mirror idioms)
- Add `AUDIO_IS_AVAILABLE()` guards if accessing audio data
- Implement explicit silence fallback (don't just return black)
- Use palette-based coloring (not raw HSV)
- Apply perceptual curves (`response_sqrt()`, `clip_float()`)
- Let color pipeline handle global brightness (don't multiply by `params.brightness`)

**❌ DON'T:**
- Call `apply_background_overlay()` expecting it to work (it's disabled)
- Clear dot layers with `memset()` (use scalar decay)
- Use `get_audio_snapshot()` inside pattern (use provided snapshot from context)
- Multiply by `params.brightness` inside pattern (color pipeline does this)
- Return early without rendering idle animation
- Ignore audio snapshot age/staleness

### Step 4: Code Review (Self-Check)

Before committing, verify:

- [ ] Pattern compiles without warnings
- [ ] Audio validity is checked before accessing audio data
- [ ] Silence path renders something (not just black)
- [ ] Center-origin symmetry maintained
- [ ] No double brightness multiplication
- [ ] Palette system used (not raw HSV)
- [ ] Code follows existing pattern style
- [ ] Header comment block updated if behavior changed

---

## Post-Modification Verification

### Step 1: Visual Testing

Test these scenarios:

- [ ] **Audio Active:** Pattern renders correctly with live audio
- [ ] **Silence:** Pattern shows appropriate idle/fallback animation
- [ ] **Audio Disconnect:** Pattern handles microphone disconnection gracefully
- [ ] **Parameter Changes:** Pattern responds correctly to UI parameter adjustments
- [ ] **Palette Switching:** Pattern updates colors correctly when palette changes
- [ ] **Brightness Adjustment:** Pattern brightness scales correctly (not doubled)

### Step 2: Parity Comparison

If pattern should match Emotiscope:

- [ ] Visual output matches Emotiscope reference
- [ ] Audio reactivity timing matches
- [ ] Color mapping aligns with reference
- [ ] Beat alignment correct (for tempo-driven patterns)

**How to verify:**
1. Run Emotiscope reference pattern
2. Run K1.node1 pattern
3. Side-by-side visual comparison
4. Document any intentional deviations

### Step 3: Regression Testing

Ensure you didn't break:

- [ ] Other patterns in the same family file
- [ ] Global helpers (if you modified shared code)
- [ ] Performance (FPS remains stable)
- [ ] Memory usage (no leaks)

### Step 4: Documentation Update

- [ ] Update `LIGHTSHOW_PATTERN_HISTORY.md` with your change entry
- [ ] Update `PATTERN_STATUS_MATRIX.md` if status changed
- [ ] Add commit hash and date to history document
- [ ] Document any new known issues or limitations

**History Entry Template:**
```markdown
**YYYY-MM-DD · `<commit_hash>`** – [Brief description of change]. 
[Technical details]. 
[Impact on parity/behavior]. 
[Reference to related commits if applicable].
```

---

## New Pattern Creation

### Step 1: Design Planning

Before writing code:

1. **Define Pattern Purpose**
   - What audio data will it visualize?
   - What visual effect are you creating?
   - Which pattern family should it belong to?

2. **Choose Implementation Location**
   - Existing family file (`patterns/*_family.hpp`)?
   - New family file (`patterns/new_family.hpp`)?
   - Misc patterns (`patterns/misc_patterns.hpp`)?

3. **Identify Dependencies**
   - Audio snapshot fields needed
   - Helper functions required
   - Palette preferences
   - Persistence buffers needed?

### Step 2: Implementation

Use `pattern_implementation_guide.md` templates:

1. **Select Base Template**
   - Spectrum-based (frequency visualization)
   - Chromagram-based (musical notes)
   - Persistence/trail (ghosting effects)
   - Beat/pulse (synchronized animation)
   - Perlin/procedural (organic effects)

2. **Customize for Your Pattern**
   - Modify audio data access
   - Adjust visual calculation
   - Implement unique features
   - Add silence fallback

3. **Follow Code Guidelines** (see [Modification Process](#modification-process) Step 3)

### Step 3: Integration Checklist

- [ ] Add pattern function to appropriate family file
- [ ] Register pattern in `pattern_registry.cpp`
- [ ] Add pattern metadata (name, description, category)
- [ ] Update pattern registry documentation
- [ ] Add to webapp pattern selector (if needed)

### Step 4: Initial Documentation

- [ ] Add entry to `LIGHTSHOW_PATTERN_HISTORY.md`:
  ```markdown
  ## [Your Pattern Name]
  
  ### Phase 2 – K1.node1
  1. **YYYY-MM-DD · `<commit_hash>`** – Added [pattern name] pattern. 
     [Description of purpose and implementation approach]. 
     [Audio dependencies and visual characteristics].
  ```
- [ ] Add entry to `PATTERN_STATUS_MATRIX.md` (mark as 🔧 during development, ✅ after verification)
- [ ] Document in pattern file header comment

---

## Common Workflows

### Fixing a Known Issue

1. Identify issue in `PATTERN_STATUS_MATRIX.md`
2. Review historical context in `LIGHTSHOW_PATTERN_HISTORY.md`
3. Locate root cause using failure modes from `LIGHTSHOW_PATTERN_HISTORY.md` §14
4. Implement fix following [Modification Process](#modification-process)
5. Verify fix resolves issue
6. Update status matrix (❌ → ✅ or ⚠️)
7. Update history with fix entry

### Restoring Emotiscope Parity

1. Review historical divergence in `LIGHTSHOW_PATTERN_HISTORY.md`
2. Compare with Emotiscope reference code (Phase 1 repo)
3. Identify differences (audio gating, color mapping, etc.)
4. Plan restoration approach
5. Implement change following workflow
6. Verify parity visually
7. Update status matrix to ✅
8. Document restoration in history

### Performance Optimization

1. Profile pattern (identify bottlenecks)
2. Plan optimization strategy
3. Implement changes (avoid breaking behavior)
4. Verify performance improvement (FPS target met)
5. Verify visual output unchanged (regression test)
6. Document optimization in history

---

## Emergency Procedures

### When Pattern Breaks After Commit

1. **Immediate:** Revert commit or create hotfix branch
2. **Investigate:** Review what changed in last commit
3. **Diagnose:** Use `PATTERN_TROUBLESHOOTING_QUICK.md` to identify failure mode
4. **Fix:** Follow [Modification Process](#modification-process)
5. **Verify:** Complete [Post-Modification Verification](#post-modification-verification)
6. **Document:** Update history with regression entry

### When Parity is Lost

1. **Identify:** Compare with Emotiscope reference
2. **Document:** Add to known issues in status matrix
3. **Prioritize:** Determine if restoration is urgent
4. **Plan:** Review historical context for how parity was maintained
5. **Restore:** Follow [Restoring Emotiscope Parity](#restoring-emotiscope-parity) workflow

---

## Workflow Checklist Summary

**Before Starting:**
- [ ] Read pattern history section
- [ ] Check status matrix
- [ ] Review pattern file and dependencies
- [ ] Examine last 3 commits

**During Implementation:**
- [ ] Follow code guidelines (DO/DON'T lists)
- [ ] Self-review code before commit
- [ ] Write meaningful commit messages

**After Implementation:**
- [ ] Visual testing (all scenarios)
- [ ] Parity comparison (if applicable)
- [ ] Regression testing
- [ ] Update documentation (history + status matrix)

---

**Next Steps:** After completing this workflow, agents should consult `LIGHTSHOW_PATTERN_HISTORY.md` for historical context and `PATTERN_TROUBLESHOOTING_QUICK.md` if issues arise.
```

---

## Document 3: Pattern Troubleshooting Quick Reference

**Location:** `docs/06-reference/PATTERN_TROUBLESHOOTING_QUICK.md`  
**Purpose:** Diagnostic decision tree for rapid issue identification  
**Audience:** Agents debugging pattern issues  
**Update Frequency:** When new failure modes discovered  
**Format:** Decision tree with symptom→cause→solution mapping

### Content Structure

```markdown
# Pattern Troubleshooting Quick Reference

**Purpose:** Rapid diagnostic tool for pattern-related issues  
**Related Docs:** [Pattern History](../LIGHTSHOW_PATTERN_HISTORY.md#14-known-failure-conditions), [Development Workflow](../03-guides/PATTERN_DEVELOPMENT_WORKFLOW.md)

---

## Quick Diagnostic Table

| Symptom | Likely Cause | Section | Solution |
|---------|--------------|---------|----------|
| Pattern goes black on silence | Early return without fallback | §1 | Add idle animation |
| Colors appear washed out | Double brightness multiplication | §2 | Remove `params.brightness` multiply |
| Pattern off-center/asymmetric | Center-origin violation | §3 | Use mirror idioms |
| Beat alignment feels wrong | Tempo/VU confusion | §4 | Restore tempo-based gating |
| Pattern keeps moving when audio stops | Stale snapshot data | §5 | Add age-based decay |
| Background slider does nothing | Background overlay disabled | §6 | Implement explicit ambient rendering |
| Visual regression after pattern change | Code style violation | §7 | Review failure modes |

---

## Decision Tree

```
Pattern Issue Detected
│
├─ Pattern is completely black
│   ├─ Audio active? → YES → Check §2 (Brightness) or §4 (Audio Access)
│   └─ Audio silent? → YES → Check §1 (Silence Path)
│
├─ Pattern appears incorrect visually
│   ├─ Off-center or asymmetric? → YES → Check §3 (Center-Origin)
│   ├─ Colors washed out or too bright? → YES → Check §2 (Brightness)
│   ├─ Beat alignment wrong? → YES → Check §4 (Tempo/VU)
│   └─ Keeps moving when audio stops? → YES → Check §5 (Snapshot Age)
│
├─ Pattern parameter doesn't work
│   ├─ Background slider? → YES → Check §6 (Background Overlay)
│   └─ Brightness slider? → YES → Check §2 (Brightness)
│
└─ Regression after modification
    └─ Check §7 (Code Review) and review [Development Workflow](../03-guides/PATTERN_DEVELOPMENT_WORKFLOW.md)
```

---

## Failure Mode Quick Reference

### §1: Pattern Goes Black on Silence

**Symptom:** Pattern completely disappears when audio stops or microphone disconnects.

**Quick Check:**
```cpp
if (!AUDIO_IS_AVAILABLE()) {
    // BAD: Just returns without rendering
    return;
    
    // GOOD: Renders idle animation
    for (int i = 0; i < NUM_LEDS; i++) {
        // Render gentle gradient or breathing animation
    }
    return;
}
```

**Solution:**
1. Replace early `return` with explicit idle rendering
2. Implement gentle gradient or breathing animation
3. Use `params.background` or low-intensity palette colors

**Affected Patterns:** Pulse, Dot Family, Tempiscope  
**Detailed Info:** [History §14.2](../LIGHTSHOW_PATTERN_HISTORY.md#142-silence-paths-that-clear-leds-and-return-early)

---

### §2: Colors Appear Washed Out or Too Bright

**Symptom:** Colors clip to white quickly, patterns appear "overexposed," brightness controls feel too sensitive.

**Quick Check:**
```cpp
// BAD: Double brightness multiplication
color.r *= params.brightness;  // Pattern-level
// ... later in color_pipeline.cpp ...
leds[i] *= master_brightness;  // Pipeline-level (duplicate!)

// GOOD: Let color pipeline handle brightness
color.r = magnitude;  // Pattern sets magnitude
// ... color pipeline applies brightness globally ...
```

**Solution:**
1. Remove `params.brightness` multiplication from pattern code
2. Let `color_pipeline.cpp` handle global brightness
3. Only multiply by brightness for *relative* effects (trail weights)

**Affected Patterns:** All patterns (when modified incorrectly)  
**Detailed Info:** [History §14.4](../LIGHTSHOW_PATTERN_HISTORY.md#144-double-brightness-scaling-transport-vs-pattern)

---

### §3: Pattern Off-Center or Asymmetric

**Symptom:** Pattern appears shifted from center, mirroring is incorrect, halves don't align.

**Quick Check:**
```cpp
// BAD: Renders over full array without center awareness
for (int i = 0; i < NUM_LEDS; i++) {
    leds[i] = color;
}

// GOOD: Renders half, then mirrors
int half = NUM_LEDS / 2;
for (int i = 0; i < half; i++) {
    CRGBF color = /* compute for position i */;
    leds[half - 1 - i] = color;  // Left half (mirrored)
    leds[half + i] = color;       // Right half
}
```

**Solution:**
1. Compute `half = NUM_LEDS / 2`
2. Render only first half of LEDs
3. Mirror to second half explicitly
4. Or use `apply_mirror_mode(leds, true)` helper

**Affected Patterns:** Any new or modified pattern  
**Detailed Info:** [History §14.7](../LIGHTSHOW_PATTERN_HISTORY.md#147-rendering-outside-center-origin-constraints)

---

### §4: Beat Alignment Feels Wrong

**Symptom:** Pattern reacts like simple VU meter (jerky, wrong frequency emphasis) instead of tempo-driven beat sync.

**Quick Check:**
```cpp
// BAD: Uses VU instead of tempo
if (AUDIO_VU > threshold) {
    trigger_effect();
}

// GOOD: Uses tempo arrays
if (tempo_confidence > threshold && tempo_phase[i] > gate) {
    trigger_effect();
}
```

**Solution:**
1. Use `tempo_phase[]`, `tempo_magnitude[]`, `tempo_confidence` instead of VU
2. Reserve VU gating for explicitly VU-based patterns (Bloom)
3. Reference Emotiscope code in Phase 1 repo for correct signal usage

**Affected Patterns:** Pulse, Hype, Beat Tunnel, Tempiscope  
**Detailed Info:** [History §14.3](../LIGHTSHOW_PATTERN_HISTORY.md#143-tempo-vs-vu-confusion-in-tempo-driven-patterns)

---

### §5: Pattern Keeps Moving When Audio Stops

**Symptom:** Visual features continue animating based on old audio data after microphone stops or audio input ends.

**Quick Check:**
```cpp
// BAD: Only checks validity, not age
if (!audio.payload.is_valid) {
    return;
}
// ... uses stale data ...

// GOOD: Checks age and applies decay
uint32_t age_ms = AUDIO_AGE_MS();
if (age_ms > 250) {
    float age_factor = 1.0f - fminf(age_ms, 500.0f) / 500.0f;
    magnitude *= age_factor;  // Fade out gracefully
}
```

**Solution:**
1. Always check `AUDIO_AGE_MS()` when using audio data
2. Apply age-based decay factor to visuals
3. Switch to idle animation after threshold (250-500ms)

**Affected Patterns:** All audio-reactive patterns  
**Detailed Info:** [History §14.6](../LIGHTSHOW_PATTERN_HISTORY.md#146-audio-snapshot-staleness-ignored)

---

### §6: Background Slider Does Nothing

**Symptom:** Adjusting `params.background` slider in UI has no visible effect on pattern.

**Root Cause:** `apply_background_overlay()` is intentionally disabled in K1.node1.

**Solution:**
1. **DO NOT** re-enable `apply_background_overlay()` without owner approval
2. If pattern needs ambient background, implement it explicitly:
   ```cpp
   if (!AUDIO_IS_AVAILABLE()) {
       // Explicit ambient rendering
       for (int i = 0; i < NUM_LEDS; i++) {
           float progress = (float)i / NUM_LEDS;
           CRGBF ambient = color_from_palette(params.palette_id, progress, params.background);
           leds[i] = ambient;
       }
   }
   ```

**Affected Patterns:** All patterns (globally)  
**Detailed Info:** [History §14.1](../LIGHTSHOW_PATTERN_HISTORY.md#141-global-background-overlay-misunderstanding)

---

### §7: Visual Regression After Pattern Change

**Symptom:** Pattern behavior changes unexpectedly after modification, or other patterns break.

**Common Causes:**
- Modified shared helper function
- Changed audio data access pattern
- Introduced center-origin violation
- Added double brightness multiplication
- Removed required guard checks

**Solution:**
1. Review [Development Workflow](../03-guides/PATTERN_DEVELOPMENT_WORKFLOW.md) checklist
2. Check failure modes in [History §14](../LIGHTSHOW_PATTERN_HISTORY.md#14-known-failure-conditions)
3. Revert change and re-implement following guidelines
4. Complete full regression test suite

---

## Diagnostic Commands

### Check Pattern File Location

```bash
# Find which file contains a pattern
grep -r "draw_<pattern_name>" firmware/src/patterns/
```

### View Recent Changes

```bash
# Last 5 commits affecting patterns
git log --oneline -- firmware/src/patterns/ | head -5

# Show specific commit
git show <commit_hash> -- firmware/src/patterns/<family>.hpp
```

### Compare with Emotiscope Reference

```bash
# If Phase 1 repo available
diff -u \
  /path/to/K1.reinvented/firmware/src/generated_patterns.h \
  firmware/src/patterns/<family>.hpp
```

### Check Audio Guard Usage

```bash
# Verify pattern checks audio availability
grep -A 10 "draw_<pattern_name>" firmware/src/patterns/<family>.hpp | grep -i "AUDIO_IS_AVAILABLE"
```

---

## When to Escalate

**Escalate to maintainer when:**
- Issue affects multiple patterns simultaneously
- Root cause unclear after reviewing failure modes
- Proposed fix would require architectural changes
- Pattern behavior fundamentally differs from Emotiscope reference
- Performance degradation (>10% FPS drop)

**Before escalating:**
1. Document symptom with specific reproduction steps
2. Identify affected pattern(s) and commit hash
3. Review relevant failure mode sections in History §14
4. Attempt diagnostic commands above
5. Document findings in status matrix or history

---

**Quick Links:**
- [Full Failure Mode Details](../LIGHTSHOW_PATTERN_HISTORY.md#14-known-failure-conditions)
- [Development Workflow](../03-guides/PATTERN_DEVELOPMENT_WORKFLOW.md)
- [Pattern Status Matrix](../06-reference/PATTERN_STATUS_MATRIX.md)
```

---

## Document 4: Pattern Architecture Overview

**Location:** `docs/01-architecture/PATTERN_ARCHITECTURE_OVERVIEW.md`  
**Purpose:** Onboarding document explaining pattern system architecture  
**Audience:** New agents, first-time pattern developers  
**Update Frequency:** When architecture changes  
**Format:** Conceptual overview with diagrams

### Content Structure

```markdown
# Pattern Architecture Overview

**Purpose:** Introduction to K1 light show pattern system architecture  
**Audience:** New agents, first-time developers  
**Related Docs:** [Pattern History](../LIGHTSHOW_PATTERN_HISTORY.md), [Development Workflow](../03-guides/PATTERN_DEVELOPMENT_WORKFLOW.md)

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architectural Phases](#architectural-phases)
3. [Pattern Execution Flow](#pattern-execution-flow)
4. [File Organization](#file-organization)
5. [Audio Data Pipeline](#audio-data-pipeline)
6. [Color Pipeline](#color-pipeline)
7. [Pattern Families](#pattern-families)
8. [Helper Functions](#helper-functions)
9. [Key Design Constraints](#key-design-constraints)

---

## System Overview

The K1 light show system renders audio-reactive LED patterns that respond to real-time audio analysis. Patterns are organized into families, executed through a modular dispatch system, and post-processed through a color pipeline.

**Core Components:**
- **Pattern Registry:** Maps pattern IDs to implementation functions
- **Pattern Execution:** Dispatches to appropriate pattern based on selection
- **Audio Pipeline:** Analyzes microphone input, produces frequency/tempo data
- **Color Pipeline:** Applies perceptual curves, warmth, gamma correction
- **LED Driver:** Outputs final color values to physical LED strip

---

## Architectural Phases

### Phase 1: K1.reinvented (Monolithic)

**Structure:**
- Single file: `firmware/src/generated_patterns.h`
- Contains: Helper functions + all pattern implementations
- Pattern dispatch: Inline function calls

**Characteristics:**
- Background overlay enabled
- Direct FastLED integration
- Emotiscope parity as primary goal

### Phase 2: K1.node1 (Modular)

**Structure:**
- Family files: `firmware/src/patterns/*_family.hpp`
- Pattern execution: `firmware/src/pattern_execution.cpp`
- Helpers: `firmware/src/pattern_helpers.h`, `emotiscope_helpers.h`

**Characteristics:**
- Background overlay disabled by design
- Color pipeline separates rendering from output
- Modular pattern organization
- Hardware v2 optimizations

**Migration:** See `LIGHTSHOW_PATTERN_HISTORY.md` for detailed migration path.

---

## Pattern Execution Flow

```
┌─────────────────────┐
│  Audio Input        │
│  (Microphone)       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Audio Analysis     │
│  - Goertzel (Freq)  │
│  - Tempo Detection  │
│  - Chromagram       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Audio Snapshot     │
│  (Seqlock Protected)│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Pattern Registry   │
│  (Select Pattern)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Pattern Execution  │
│  (Dispatch to func) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Pattern Render     │
│  (Family .hpp file) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Color Pipeline     │
│  (Tone map, gamma)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  LED Driver         │
│  (Hardware output)  │
└─────────────────────┘
```

---

## File Organization

```
firmware/src/
├── patterns/                    # Pattern implementations
│   ├── spectrum_family.hpp     # Spectrum, Octave, Waveform Spectrum
│   ├── bloom_family.hpp        # Bloom, Bloom Mirror, Snapwave
│   ├── dot_family.hpp          # Analog, Metronome, Hype
│   ├── static_family.hpp       # Departure, Lava, Twilight
│   ├── tunnel_family.hpp       # Beat Tunnel, Tunnel Glow, Startup Intro
│   ├── tempiscope.hpp          # Tempiscope (single pattern)
│   ├── prism.hpp               # Prism (single pattern)
│   └── misc_patterns.hpp       # Pulse, Perlin
│
├── pattern_registry.cpp        # Pattern registration & selection
├── pattern_registry.h          # Pattern registry interface
├── pattern_execution.cpp       # Pattern dispatch system
├── pattern_execution.h         # Execution context definitions
├── pattern_render_context.h    # Context passed to patterns
├── pattern_helpers.h           # Shared pattern utilities
├── emotiscope_helpers.h        # Emotiscope-compatible helpers
├── pattern_audio_interface.h   # Audio snapshot access macros
├── color_pipeline.cpp          # Post-processing pipeline
└── led_driver.h                # LED output interface
```

**Pattern File Structure:**
Each family file contains:
1. Header comment block (audio dependencies, warnings, helpers)
2. Include statements (context, helpers, audio interface)
3. Pattern function implementations (inline functions)

---

## Audio Data Pipeline

**Audio Snapshot Structure:**
```cpp
struct AudioDataSnapshot {
    bool is_valid;
    uint64_t timestamp_us;
    float vu_level;
    float novelty_curve;
    float chromagram[12];
    float spectrogram[NUM_FREQS];
    float spectrogram_smooth[NUM_FREQS];
    float tempo_phase[NUM_TEMPI];
    float tempo_magnitude[NUM_TEMPI];
    float tempo_confidence;
};
```

**Access Pattern:**
- Single snapshot per frame (seqlock protection)
- Patterns receive snapshot via `PatternRenderContext`
- **Never** call `get_audio_snapshot()` inside pattern (breaks single-snapshot invariant)

**Audio Guards:**
```cpp
#define AUDIO_IS_AVAILABLE() (context.audio.payload.is_valid)
#define AUDIO_AGE_MS() ((uint32_t)((esp_timer_get_time() - context.audio.payload.timestamp_us) / 1000))
```

---

## Color Pipeline

**Processing Stages:**
1. **LPF (Low-Pass Filter):** Smooths rapid color changes
2. **Tone Mapping:** Compresses highlights, boosts shadows
3. **Warmth Adjustment:** Shifts white balance
4. **White Balance:** Color temperature correction
5. **Gamma Correction:** Perceptual brightness mapping
6. **Master Brightness:** Global intensity scaling

**Important:** Patterns should **not** multiply by `params.brightness` internally. The color pipeline handles this globally.

---

## Pattern Families

**Family-Based Organization:**

| Family | Patterns | Audio Dependencies | Characteristics |
|--------|----------|-------------------|-----------------|
| **Spectrum** | Spectrum, Octave, Waveform Spectrum | `spectrogram[]`, `spectrogram_smooth[]` | Frequency-domain visualization |
| **Bloom** | Bloom, Bloom Mirror, Snapwave | `vu_level`, `novelty_curve`, `chromagram[]` | Sprite persistence, beat-gated |
| **Dot** | Analog, Metronome, Hype | `vu_level`, `spectrogram[]`, `chromagram[]` | Point-based rendering, layer persistence |
| **Static** | Departure, Lava, Twilight | None | Non-audio, palette-based gradients |
| **Tunnel** | Beat Tunnel, Tunnel Glow, Startup Intro | `tempo_phase[]`, `vu_level` | Shared sprite buffers, rotation effects |
| **Misc** | Pulse, Perlin | `vu_level`, `tempo_phase[]`, `novelty_curve` | Various unique implementations |

---

## Helper Functions

**pattern_helpers.h:**
- `apply_mirror_mode()` - Center-origin mirroring
- `blend_sprite()` - Alpha blending for trails
- `perlin_noise_simple()` - Procedural noise
- `apply_background_overlay()` - **DISABLED** (no-op)

**emotiscope_helpers.h:**
- `color_from_palette()` - Palette-based color mapping
- `response_sqrt()` - Perceptual magnitude curves
- `clip_float()` - Value clamping
- `interpolate()` - Linear interpolation
- `draw_dot()` - Point rendering with persistence

---

## Key Design Constraints

### Center-Origin Rendering

**Requirement:** All patterns must render symmetrically from the center of the LED strip.

**Implementation:**
- Compute `half = NUM_LEDS / 2`
- Render first half only
- Mirror to second half explicitly

### Audio Validity Guards

**Requirement:** All patterns must check audio availability before accessing audio data.

**Implementation:**
```cpp
if (!AUDIO_IS_AVAILABLE()) {
    // Render idle animation
    return;
}
```

### Silence Fallbacks

**Requirement:** Patterns must render something visible when audio is unavailable (not just black).

**Implementation:** Gentle gradients, breathing animations, or low-intensity palette displays.

### Background Overlay Disabled

**Design Decision:** Global background overlay is intentionally disabled. Patterns must implement ambient behavior explicitly if needed.

---

## Next Steps for New Agents

1. **Read this document** (you are here)
2. **Review Pattern Status Matrix** - Understand current implementation state
3. **Read Pattern History** - Learn from past changes and issues
4. **Study Pattern Implementation Guide** - Review code templates
5. **Follow Development Workflow** - When ready to make changes

---

**Related Documentation:**
- [Pattern History](../LIGHTSHOW_PATTERN_HISTORY.md) - Detailed change tracking
- [Development Workflow](../03-guides/PATTERN_DEVELOPMENT_WORKFLOW.md) - Modification process
- [Status Matrix](../06-reference/PATTERN_STATUS_MATRIX.md) - Current state
- [Implementation Guide](../06-reference/pattern_implementation_guide.md) - Code templates
```

---

## Document 5: Pattern Glossary

**Location:** `docs/06-reference/PATTERN_GLOSSARY.md`  
**Purpose:** Definitions of technical terms used in pattern documentation  
**Audience:** All agents (reference as needed)  
**Update Frequency:** When new terms introduced  
**Format:** Alphabetical glossary with cross-references

### Content Structure

```markdown
# Pattern Glossary

**Purpose:** Definitions of technical terms used in pattern development  
**Related Docs:** [Pattern Architecture](../01-architecture/PATTERN_ARCHITECTURE_OVERVIEW.md), [Pattern History](../LIGHTSHOW_PATTERN_HISTORY.md)

---

## A

### Age-Based Decay
Gradual fade-out of visual features based on audio snapshot age. Used to gracefully handle stale audio data when microphone stops or audio input ends.

**Usage:** `AUDIO_AGE_MS()` returns milliseconds since last audio update; patterns multiply visuals by decay factor (1.0 at 0ms → 0.0 at 250-500ms).

**See also:** Audio Snapshot Staleness, Silence Fallback

---

### Audio Snapshot
Single-frame capture of all audio analysis data, protected by seqlock to ensure consistency.

**Structure:** Contains `vu_level`, `spectrogram[]`, `chromagram[]`, `tempo_phase[]`, `tempo_magnitude[]`, `tempo_confidence`, `is_valid` flag, and `timestamp_us`.

**Critical Rule:** Patterns must use snapshot from `PatternRenderContext`, never call `get_audio_snapshot()` directly (violates single-snapshot-per-frame invariant).

**See also:** Audio Snapshot Staleness, Pattern Render Context

---

### Audio Snapshot Staleness
Condition where audio snapshot timestamp indicates data is old (no recent audio input). Patterns should apply age-based decay or switch to idle animation.

**Detection:** Compare `AUDIO_AGE_MS()` against threshold (typically 250-500ms).

**See also:** Age-Based Decay, Silence Fallback

---

## B

### Background Overlay
**Historical:** Global ambient color layer that was blended into all patterns based on `params.background`.

**Current Status:** **DISABLED BY DESIGN** in K1.node1. Function `apply_background_overlay()` is intentionally a no-op.

**Rationale:** Disabled to put all visual responsibility on individual patterns and avoid muddying choreography.

**Agent Guidance:** Do not re-enable without owner approval. Patterns needing ambient behavior must implement it explicitly.

**See also:** Silence Fallback, Pattern Design Philosophy

---

### Beat Gating
Threshold-based triggering of visual effects when beat detection confidence exceeds a threshold. Used for synchronized animations that align with musical beats.

**Implementation:** Compare `tempo_confidence` against threshold; trigger effects when `tempo_phase[]` crosses gate values.

**See also:** Tempo Bins, Tempo Confidence

---

## C

### Center-Origin Rendering
Design constraint requiring all patterns to render symmetrically from the center of the LED strip.

**Hardware Context:** K1 LED strip is split into two halves that mirror each other. Center index is `NUM_LEDS / 2 - 1`.

**Implementation:**
- Compute `half = NUM_LEDS / 2`
- Render only first `half` LEDs
- Mirror to second half: `leds[half - 1 - i]` and `leds[half + i]`

**See also:** Pattern Design Constraints, Mirror Mode

---

### Chromagram
12-element array representing musical note energy across chromatic scale (C, C#, D, D#, E, F, F#, G, G#, A, A#, B).

**Usage:** Patterns use chromagram to color-code visuals based on dominant musical notes or chord progressions.

**Access:** `context.audio.payload.chromagram[12]`

**See also:** Audio Snapshot, Musical Note Mapping

---

### Color Pipeline
Post-processing stage that applies perceptual curves, tone mapping, warmth, white balance, gamma correction, and master brightness to pattern output.

**Important:** Patterns should **not** multiply by `params.brightness` internally (pipeline handles this globally).

**Stages:**
1. LPF (smoothing)
2. Tone mapping (highlight compression)
3. Warmth adjustment
4. White balance
5. Gamma correction
6. Master brightness scaling

**See also:** Brightness Multiplication, Perceptual Curves

---

## D

### Double Brightness Multiplication
Bug condition where brightness is applied twice: once in pattern code and once in color pipeline.

**Symptom:** Colors clip to white quickly, patterns appear overexposed, brightness controls feel too sensitive.

**Fix:** Remove `params.brightness` multiplication from pattern code; let color pipeline handle it.

**See also:** Color Pipeline, Brightness Multiplication

---

## E

### Emotiscope Parity
Design goal of matching visual behavior and audio reactivity of Emotiscope reference implementation.

**Verification:** Side-by-side visual comparison, timing alignment, beat synchronization.

**Status:** Tracked in `PATTERN_STATUS_MATRIX.md` (✅ Complete, ⚠️ Partial, ❌ Known Issues).

**See also:** Pattern Status Matrix, Parity Audit

---

### Emotiscope Helpers
Helper functions in `emotiscope_helpers.h` that provide Emotiscope-compatible behavior (palette mapping, perceptual curves, dot rendering).

**Key Functions:**
- `color_from_palette()` - Palette-based color mapping
- `response_sqrt()` - Perceptual magnitude curves
- `draw_dot()` - Point rendering with persistence

**See also:** Pattern Helpers, Helper Functions

---

## F

### Family File
Header file (`patterns/*_family.hpp`) containing multiple related pattern implementations.

**Organization:** Patterns grouped by audio dependencies, visual characteristics, and shared helper usage.

**Examples:**
- `spectrum_family.hpp` - Spectrum, Octave, Waveform Spectrum
- `bloom_family.hpp` - Bloom, Bloom Mirror, Snapwave

**See also:** Pattern Families, File Organization

---

## G

### Goertzel
Audio analysis algorithm used for frequency-domain analysis and tempo detection.

**Output:** Produces `spectrogram[]` (frequency magnitude) and tempo arrays (`tempo_phase[]`, `tempo_magnitude[]`).

**See also:** Audio Snapshot, Tempo Bins, Spectrogram

---

## H

### Helper Functions
Shared utility functions used by multiple patterns.

**Categories:**
- **Pattern Helpers** (`pattern_helpers.h`): Mirroring, sprite blending, noise generation
- **Emotiscope Helpers** (`emotiscope_helpers.h`): Palette mapping, perceptual curves, dot rendering

**See also:** Emotiscope Helpers, Pattern Helpers

---

## I

### Idle Animation
Visual fallback rendered when audio is unavailable. Should be gentle, non-distracting, and clearly indicate "waiting for audio" state.

**Examples:** Breathing gradients, slow color rotations, low-intensity palette displays.

**Requirement:** All audio-reactive patterns must implement idle animation (not just return black).

**See also:** Silence Fallback, Audio Validity Guards

---

## M

### Mirror Mode
Helper function (`apply_mirror_mode()`) that copies first half of LED array to second half in reverse order, creating center-origin symmetry.

**Usage:** After rendering first `NUM_LEDS / 2` LEDs, call `apply_mirror_mode(leds, true)` to mirror to second half.

**Alternative:** Manual mirroring using `leds[half - 1 - i]` and `leds[half + i]`.

**See also:** Center-Origin Rendering

---

## P

### Palette System
Color mapping system that maps normalized position/magnitude values to colors from predefined palettes.

**Function:** `color_from_palette(palette_id, position, magnitude)`

**Rationale:** Provides consistent color aesthetics and eliminates desaturation issues compared to raw HSV mapping.

**See also:** Color Pipeline, Emotiscope Helpers

---

### Parity Audit
Systematic verification that K1.node1 patterns match Emotiscope reference implementation.

**Last Audit:** 2025-11-16 (`7c733c1`) - Verified spectrum, bloom, dot, and misc pattern families.

**Status Tracking:** Documented in `PATTERN_STATUS_MATRIX.md`.

**See also:** Emotiscope Parity, Pattern Status Matrix

---

### Pattern Family
Logical grouping of related patterns sharing similar audio dependencies, visual characteristics, or helper usage.

**Families:**
- Spectrum (frequency visualization)
- Bloom (sprite persistence, beat-gated)
- Dot (point-based rendering)
- Static (non-audio, palette gradients)
- Tunnel (rotation effects, shared buffers)
- Misc (unique implementations)

**See also:** Family File, Pattern Organization

---

### Pattern Helpers
Shared utility functions in `pattern_helpers.h` for common pattern operations.

**Key Functions:**
- `apply_mirror_mode()` - Center-origin mirroring
- `blend_sprite()` - Alpha blending for trails
- `perlin_noise_simple()` - Procedural noise
- `apply_background_overlay()` - **DISABLED** (no-op)

**See also:** Helper Functions, Emotiscope Helpers

---

### Pattern Render Context
Structure passed to pattern functions containing all necessary data for rendering.

**Contents:**
- `time` - Current animation time
- `params` - User-adjustable parameters (brightness, speed, palette, etc.)
- `audio` - Audio snapshot (seqlock-protected)
- `leds` - LED array to modify
- `num_leds` - LED count

**Critical Rule:** Patterns must use `context.audio.payload` snapshot, never call `get_audio_snapshot()` directly.

**See also:** Audio Snapshot, Pattern Execution Flow

---

### Perceptual Curves
Mathematical functions that map raw audio magnitude to perceptually linear brightness.

**Function:** `response_sqrt(value)` applies square root curve, making low magnitudes more visible and high magnitudes compress smoothly.

**Rationale:** Human perception of brightness is non-linear; perceptual curves make visuals feel more responsive and natural.

**See also:** Color Pipeline, Emotiscope Helpers

---

### Phase 1 / Phase 2
Architectural evolution phases of K1 light show system.

**Phase 1 (K1.reinvented):**
- Monolithic structure: single `generated_patterns.h` file
- Background overlay enabled
- Direct FastLED integration
- Emotiscope parity as primary goal

**Phase 2 (K1.node1):**
- Modular structure: `patterns/*_family.hpp` files
- Background overlay disabled by design
- Color pipeline separates rendering from output
- Hardware v2 optimizations

**See also:** Architectural Phases, Pattern History

---

### Silence Fallback
Visual animation rendered when audio input is unavailable (microphone disconnected, no audio stream, or stale snapshot).

**Requirement:** All audio-reactive patterns must implement explicit silence fallback (not just return black).

**Examples:** Gentle gradients, breathing animations, low-intensity palette displays, slow color rotations.

**Implementation:** Check `AUDIO_IS_AVAILABLE()` before accessing audio data; render idle animation when false.

**See also:** Idle Animation, Audio Validity Guards, Background Overlay

---

### Spectrogram
Array of frequency magnitude values representing audio energy across frequency bins.

**Structure:** `spectrogram[NUM_FREQS]` and `spectrogram_smooth[NUM_FREQS]` (smoothed version).

**Usage:** Patterns visualize frequency content by mapping bins to LED positions and magnitudes to brightness/color.

**Access:** `context.audio.payload.spectrogram[]` or `context.audio.payload.spectrogram_smooth[]`

**See also:** Audio Snapshot, Frequency Visualization, Spectrum Family

---

### Sprite Persistence
Frame-to-frame accumulation of visual features using shared buffer arrays, creating ghosting or trail effects.

**Implementation:** Patterns use `blend_sprite()` to alpha-blend new frame into persistent buffer, then render buffer to LEDs.

**Critical Rule:** **Never** use `memset()` on sprite buffers (destroys persistence). Use scalar multiplication for decay.

**See also:** Bloom Family, Tunnel Family, Shared Pattern Buffers

---

## T

### Tempo Bins
Frequency-domain analysis bins used for beat detection and tempo-driven visual effects.

**Arrays:**
- `tempo_phase[NUM_TEMPI]` - Phase values (0.0-1.0) indicating beat position
- `tempo_magnitude[NUM_TEMPI]` - Energy magnitude for each tempo bin
- `tempo_confidence` - Overall confidence in beat detection

**Usage:** Tempo-driven patterns (Pulse, Tempiscope, Beat Tunnel) use these arrays for beat-synchronized animations.

**See also:** Beat Gating, Tempo Confidence, Goertzel

---

### Tempo Confidence
Scalar value (0.0-1.0) indicating reliability of beat detection. High confidence means clear, consistent beat alignment.

**Usage:** Patterns gate tempo-driven effects using `if (tempo_confidence > threshold)` to prevent erratic behavior on weak or ambiguous audio.

**See also:** Beat Gating, Tempo Bins

---

### Tempo vs VU Confusion
**Failure Mode:** Pattern uses VU (volume) gating instead of tempo-based signals, causing jerky, non-synchronized behavior.

**Symptom:** Beat alignment feels wrong; pattern reacts like simple VU meter instead of tempo-synchronized effect.

**Fix:** Use `tempo_phase[]`, `tempo_magnitude[]`, `tempo_confidence` instead of `AUDIO_VU` for tempo-driven patterns.

**See also:** Beat Gating, Tempo Bins, Failure Modes

---

### VU (Volume Unit)
Overall audio level metric (0.0-1.0) representing total energy in audio signal.

**Usage:** VU-based patterns (Bloom, simple meters) use `AUDIO_VU` for energy-driven visual effects.

**Not Suitable For:** Beat-synchronized or tempo-driven patterns (use tempo bins instead).

**See also:** Tempo vs VU Confusion, Audio Snapshot

---

**Glossary Maintenance:** Update when new terms are introduced. Cross-reference with Pattern History and Architecture Overview documents.

---

## Implementation Priority and Dependencies

### Recommended Implementation Order

1. **Pattern Glossary** (Priority 1)
   - **Rationale:** Foundation for all other documents (defines terminology)
   - **Effort:** Low (2-3 hours)
   - **Dependencies:** None

2. **Pattern Status Matrix** (Priority 2)
   - **Rationale:** Provides operational dashboard for all patterns
   - **Effort:** Medium (3-4 hours, requires pattern audit)
   - **Dependencies:** None (but benefits from Glossary)

3. **Pattern Architecture Overview** (Priority 3)
   - **Rationale:** Critical for agent onboarding
   - **Effort:** Medium (4-5 hours)
   - **Dependencies:** Glossary (for terminology)

4. **Pattern Troubleshooting Quick Reference** (Priority 4)
   - **Rationale:** Accelerates debugging workflow
   - **Effort:** Medium (3-4 hours)
   - **Dependencies:** History document (for failure modes)

5. **Pattern Development Workflow** (Priority 5)
   - **Rationale:** Comprehensive but can reference other documents
   - **Effort:** High (6-8 hours)
   - **Dependencies:** Glossary, Status Matrix, Troubleshooting Quick

### Total Estimated Effort

- **Glossary:** 2-3 hours
- **Status Matrix:** 3-4 hours
- **Architecture Overview:** 4-5 hours
- **Troubleshooting Quick:** 3-4 hours
- **Development Workflow:** 6-8 hours

**Total:** 18-24 hours of focused documentation work

---

## Document Maintenance Requirements

### Update Triggers

| Document | Update Trigger | Update Frequency |
|----------|---------------|------------------|
| **Pattern Status Matrix** | After pattern modification | Immediately |
| **Pattern History** | After pattern modification | Immediately |
| **Development Workflow** | When process changes | As needed |
| **Troubleshooting Quick** | When new failure mode discovered | As needed |
| **Architecture Overview** | When architecture changes | Quarterly |
| **Glossary** | When new term introduced | As needed |

### Validation Requirements

Before marking any document as "complete":
- [ ] All cross-references verified (links work)
- [ ] All code examples tested/validated
- [ ] All commit hashes verified (exist in git history)
- [ ] All file paths verified (files exist)
- [ ] Terminology consistent with Glossary
- [ ] Formatting consistent with existing documentation standards

---

## Conclusion

This proposal identifies five new documentation files that will transform the pattern documentation suite from "reference consulted when broken" to "guide followed during development." Each document serves a specific purpose:

- **Status Matrix** → Operational dashboard
- **Development Workflow** → Process guidance
- **Troubleshooting Quick** → Diagnostic tool
- **Architecture Overview** → Onboarding resource
- **Glossary** → Terminology foundation

Together with `LIGHTSHOW_PATTERN_HISTORY.md`, these documents create a complete knowledge base for pattern development, troubleshooting, and maintenance.

**Next Steps:**
1. Review and approve this proposal
2. Prioritize document creation based on current needs
3. Begin implementation starting with Priority 1 (Glossary)
4. Establish maintenance workflow for keeping documents current

---

**Proposal Status:** Ready for review  
**Proposed By:** Captain (Strategic Analysis)  
**Date:** 2025-01-XX  
**Related Documents:** `LIGHTSHOW_PATTERN_HISTORY.md`, `LIGHTSHOW_PATTERN_HISTORY_REVIEW.md`