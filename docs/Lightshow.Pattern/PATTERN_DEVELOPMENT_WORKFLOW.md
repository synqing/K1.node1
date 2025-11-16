# Pattern Development Workflow

**Purpose:** Systematic process for pattern modification and creation  
**Related Docs:** [Pattern History](../Lightshow.Pattern/LIGHTSHOW_PATTERN_HISTORY.md), [Status Matrix](../06-reference/PATTERN_STATUS_MATRIX.md), [Implementation Guide](../06-reference/pattern_implementation_guide.md)  
**Last Updated:** 2025-01-XX  
**Status:** Active

---

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

**Branch Naming Convention:**
- `pattern/spectrum/fix-center-alignment`
- `pattern/pulse/restore-tempo-gating`
- `pattern/bloom/add-idle-animation`

### Step 3: Implement Change

Follow these guidelines:

**✅ DO:**
- Maintain center-origin rendering (use mirror idioms)
- Add `AUDIO_IS_AVAILABLE()` guards if accessing audio data
- Implement explicit silence fallback (don't just return black)
- Use palette-based coloring (not raw HSV)
- Apply perceptual curves (`response_sqrt()`, `clip_float()`)
- Let color pipeline handle global brightness (don't multiply by `params.brightness`)
- Apply age-based decay to audio data
- Use `context.audio_snapshot` from PatternRenderContext (never call `get_audio_snapshot()`)

**❌ DON'T:**
- Call `apply_background_overlay()` expecting it to work (it's disabled)
- Clear dot layers with `memset()` (use scalar decay)
- Use `get_audio_snapshot()` inside pattern (use provided snapshot from context)
- Multiply by `params.brightness` inside pattern (color pipeline does this)
- Return early without rendering idle animation
- Ignore audio snapshot age/staleness
- Render over full LED array without center-origin awareness

**Code Example (Correct Pattern):**
```cpp
inline void draw_pattern(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    const AudioDataSnapshot& audio = context.audio_snapshot;  // ✅ Use context snapshot
    CRGBF* leds = context.leds;
    int num_leds = context.num_leds;

    // ✅ Check audio availability
    if (!AUDIO_IS_AVAILABLE()) {
        // ✅ Render idle animation (not black)
        int half = num_leds / 2;
        for (int i = 0; i < half; i++) {
            float progress = (float)i / (float)half;
            float breath = 0.5f + 0.3f * sinf(time * params.speed);
            CRGBF color = color_from_palette(params.palette_id, progress, breath);
            leds[half - 1 - i] = color;
            leds[half + i] = color;
        }
        return;
    }

    // ✅ Check audio age and apply decay
    uint32_t age_ms = AUDIO_AGE_MS();
    float age_factor = 1.0f - fminf(age_ms, 250.0f) / 250.0f;
    age_factor = fmaxf(0.0f, age_factor);

    // ✅ Center-origin rendering with mirroring
    int half = num_leds / 2;
    for (int i = 0; i < half; i++) {
        float progress = (float)i / (float)half;
        
        // ✅ Apply perceptual curves
        float magnitude = clip_float(audio.spectrogram_smooth[bin_index]);
        magnitude = response_sqrt(magnitude) * age_factor;
        
        // ✅ Palette-based coloring
        CRGBF color = color_from_palette(params.palette_id, progress, magnitude);
        // ✅ No brightness multiply (pipeline handles it)
        
        // ✅ Mirror to both halves
        leds[half - 1 - i] = color;
        leds[half + i] = color;
    }
}
```

### Step 4: Code Review (Self-Check)

Before committing, verify:

- [ ] Pattern compiles without warnings
- [ ] Audio validity is checked before accessing audio data
- [ ] Silence path renders something (not just black)
- [ ] Center-origin symmetry maintained
- [ ] No double brightness multiplication
- [ ] Palette system used (not raw HSV)
- [ ] Perceptual curves applied (`response_sqrt()`, `clip_float()`)
- [ ] Age-based decay applied to audio data
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

**Example:**
```markdown
**2025-01-XX · `abc123def`** – Added idle animation to Pulse pattern. 
Implemented gentle breathing gradient when audio unavailable, replacing black screen. 
Restores ambient behavior from Phase 1 (though background overlay remains disabled). 
Related to [History §6](../Lightshow.Pattern/LIGHTSHOW_PATTERN_HISTORY.md#6-pulse).
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

**Registration Example:**
```cpp
// In pattern_registry.cpp
{
    .id = "new_pattern",
    .name = "New Pattern",
    .description = "Description of new pattern",
    .category = PATTERN_CATEGORY_AUDIO_REACTIVE,
    .draw_func = draw_new_pattern,
},
```

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

**Reference Code Location:**
```
/Users/spectrasynq/Workspace_Management/Software/K1.reinvented/firmware/src/generated_patterns.h
```

### Performance Optimization

1. Profile pattern (identify bottlenecks)
2. Plan optimization strategy
3. Implement changes (avoid breaking behavior)
4. Verify performance improvement (FPS target met)
5. Verify visual output unchanged (regression test)
6. Document optimization in history

### Adding Silence Fallback

1. Identify pattern missing silence fallback
2. Review [Troubleshooting §1](../06-reference/PATTERN_TROUBLESHOOTING_QUICK.md#1-pattern-goes-black-on-silence)
3. Design appropriate idle animation
4. Implement fallback in pattern function
5. Test with audio disconnected
6. Update history and status matrix

---

## Emergency Procedures

### When Pattern Breaks After Commit

1. **Immediate:** Revert commit or create hotfix branch
   ```bash
   git revert <commit_hash>
   # OR
   git checkout -b hotfix/pattern-<name>-revert
   git revert <commit_hash>
   ```

2. **Investigate:** Review what changed in last commit
   ```bash
   git show <commit_hash>
   ```

3. **Diagnose:** Use `PATTERN_TROUBLESHOOTING_QUICK.md` to identify failure mode

4. **Fix:** Follow [Modification Process](#modification-process)

5. **Verify:** Complete [Post-Modification Verification](#post-modification-verification)

6. **Document:** Update history with regression entry

### When Parity is Lost

1. **Identify:** Compare with Emotiscope reference
   ```bash
   diff -u \
     /Users/spectrasynq/Workspace_Management/Software/K1.reinvented/firmware/src/generated_patterns.h \
     firmware/src/patterns/<family>.hpp
   ```

2. **Document:** Add to known issues in status matrix

3. **Prioritize:** Determine if restoration is urgent

4. **Plan:** Review historical context for how parity was maintained

5. **Restore:** Follow [Restoring Emotiscope Parity](#restoring-emotiscope-parity) workflow

### When Performance Degrades

1. **Measure:** Profile pattern before and after change
2. **Identify:** Locate bottleneck (audio processing, rendering, color pipeline)
3. **Optimize:** Apply performance improvements (avoid breaking behavior)
4. **Verify:** Ensure FPS target met (120+ FPS)
5. **Test:** Verify visual output unchanged
6. **Document:** Update history with optimization details

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
- [ ] Documentation update (history + status matrix)

---

## Commit Message Guidelines

**Format:**
```
<type>: <pattern> - <brief description>

[Optional detailed explanation]
```

**Types:**
- `fix:` - Bug fix or regression resolution
- `feat:` - New pattern or feature
- `refactor:` - Code restructuring without behavior change
- `perf:` - Performance optimization
- `docs:` - Documentation updates

**Examples:**
```
fix: pulse - Restore tempo-confidence gating

Restored tempo-based beat detection to match Phase 1 behavior.
Replaced VU gating with tempo_confidence checks and tempo_phase
arrays. Fixes beat alignment issues identified in parity audit.

See: History §6, Status Matrix (Pulse)
```

```
feat: spectrum - Add idle animation

Implemented gentle breathing gradient when audio unavailable.
Replaces black screen with low-intensity palette-based animation.
Addresses silence path issue documented in History §14.2.
```

---

## Next Steps

After completing this workflow, agents should consult:
- `LIGHTSHOW_PATTERN_HISTORY.md` for historical context
- `PATTERN_TROUBLESHOOTING_QUICK.md` if issues arise
- `PATTERN_STATUS_MATRIX.md` to update status

---

**Related Documentation:**
- [Pattern History](../Lightshow.Pattern/LIGHTSHOW_PATTERN_HISTORY.md) - Detailed change tracking
- [Status Matrix](../06-reference/PATTERN_STATUS_MATRIX.md) - Current implementation status
- [Troubleshooting Quick](../06-reference/PATTERN_TROUBLESHOOTING_QUICK.md) - Diagnostic tools
- [Implementation Guide](../06-reference/pattern_implementation_guide.md) - Code templates
- [Architecture Overview](../01-architecture/PATTERN_ARCHITECTURE_OVERVIEW.md) - System architecture

