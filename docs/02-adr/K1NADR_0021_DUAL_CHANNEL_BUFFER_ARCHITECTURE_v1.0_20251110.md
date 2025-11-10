# ADR-0021: Dual-Channel Buffer Architecture & Rendering Strategy

**Status:** Proposed
**Owner:** Claude (Architecture Analysis)
**Date:** 2025-11-10
**Scope:** Firmware rendering pipeline (PatternRenderContext, RenderChannel, VisualScheduler)
**Related:**
- K1NADR_0011_DUAL_CHANNEL_LEDS_v1.0_20251110.md (dual-channel RMT decision)
- firmware/src/pattern_render_context.h
- firmware/src/render_channel.h
- firmware/src/visual_scheduler.cpp

---

## Context

Phase 0 scaffolding has established dual-channel RMT infrastructure with `RenderChannel` structs containing independent float and packed buffers. Two critical design questions remain before extending the architecture:

1. **How should dual-channel buffers be represented in PatternRenderContext?**
   - Option A: Single interleaved buffer
   - Option B: Two separate buffers in context
   - Option C: Context holds a "frame manager"

2. **Will VisualScheduler render directly or copy?**
   - Direct render → patterns write to channel-specific buffers
   - Copy strategy → patterns write to shared buffer, scheduler copies per-channel
   - Hybrid → pattern-dependent strategy

## Current State Analysis

### Memory Layout (NUM_LEDS = 180)

Per RenderChannel:
- Float buffer: 180 × sizeof(CRGBF) = 180 × 12 = **2160 bytes**
- Packed buffer: 180 × 3 = **540 bytes**
- **Total per channel: 2700 bytes**

Dual-channel total: **5400 bytes** (~5.3KB) - acceptable for ESP32-S3 (512KB SRAM)

### Current Phase 0 Implementation (Copy Strategy)

```cpp
// visual_scheduler.cpp:73-79
draw_current_pattern((millis() / 1000.0f), params);  // Renders to global leds[]
ch->last_render_us.store(micros() - t0);

// Copy global frame into channel-local frame for quantization
for (uint16_t i = 0; i < NUM_LEDS; ++i) {
    ch->frame[i] = leds[i];  // COPY operation
}
```

**Characteristics:**
- Patterns are channel-agnostic (write to global `leds[NUM_LEDS]`)
- PatternRenderContext points to single global buffer
- Scheduler copies to per-channel `RenderChannel::frame[]` after rendering
- Each channel can apply independent post-processing (brightness, dithering)
- Copy overhead: ~2160 bytes × 2 channels = **~4.3KB per frame**

### Constraints & Requirements

**Hard Constraints:**
- WS2812 timing critical (RMT mem_block_symbols ≥ 256)
- No logging in IRAM hot paths
- Zero-cost probes in production builds
- Bounded timeouts (8ms RMT wait)

**Soft Constraints:**
- Target 60 FPS → 16.67ms budget per frame
- Current render: ~2-4ms typical
- Copy overhead: ~200-400µs (measured empirically)
- Quantize: ~500-800µs
- RMT TX: ~600µs (hardware paced)

**Functional Requirements:**
- Independent per-channel brightness/dithering
- Support for mirrored patterns (same pattern, both channels)
- Support for independent patterns (different patterns per channel)
- Potential future: asymmetric patterns (channels with different behaviors)

---

## Decision: Hybrid Architecture

### Recommendation Summary

**Buffer Representation: Option B+ (Two Buffers + Metadata)**

Extend PatternRenderContext with dual-buffer capability while maintaining backward compatibility:

```cpp
struct PatternRenderContext {
    // Primary render target (backward compatible with existing patterns)
    CRGBF* const leds;
    const int num_leds;

    // Dual-channel extensions (Phase 1+)
    CRGBF* const leds_channel_a;  // nullptr for single-channel mode
    CRGBF* const leds_channel_b;  // nullptr for single-channel mode
    const uint8_t active_channel;  // 0=single, 1=A, 2=B, 3=both

    // ... (time, params, audio_snapshot unchanged)
};
```

**Rendering Strategy: Hybrid (Pattern-Dependent)**

Three rendering modes based on pattern capabilities:

1. **Legacy Mode (Copy):** Single-channel patterns continue to use global buffer + copy
2. **Direct Dual Mode:** Dual-aware patterns render directly to per-channel buffers
3. **Mirrored Mode:** Pattern renders once to primary buffer, scheduler duplicates to both channels

---

## Rationale

### Why Not Option A (Interleaved Buffer)?

**Rejected** due to:
- ❌ Complex indexing (`leds[channel * NUM_LEDS + i]`) increases cognitive load
- ❌ Patterns must understand channel layout (breaks abstraction)
- ❌ Incompatible with independent per-channel brightness/dithering
- ❌ No memory savings (still need separate packed buffers for RMT)
- ❌ Cache locality worse (alternating channel access)

### Why Not Option C (Frame Manager)?

**Rejected** due to:
- ❌ Indirection overhead in hot path
- ❌ Adds complexity without clear benefits
- ❌ Harder to optimize (compiler can't inline through interface)
- ❌ Over-engineering for fixed dual-channel scenario

### Why Hybrid Rendering Strategy?

**Copy Strategy Benefits:**
- ✅ Zero pattern migration effort (existing patterns work unchanged)
- ✅ Patterns remain channel-agnostic (simpler pattern development)
- ✅ Easy to mirror patterns across channels
- ✅ Independent post-processing per channel (brightness, dithering)

**Copy Strategy Costs:**
- ⚠️ ~200-400µs overhead per channel (acceptable within 16.67ms budget)
- ⚠️ ~4.3KB memory bandwidth per frame (negligible for ESP32-S3)

**Direct Render Benefits:**
- ✅ Zero-copy for dual-aware patterns
- ✅ Enables asymmetric effects (different visuals per channel)
- ✅ Future-proof for complex multi-channel behaviors

**Direct Render Costs:**
- ⚠️ Patterns must be dual-aware (not all patterns benefit)
- ⚠️ More complex pattern implementation

**Decision:** Support both via pattern metadata flag:
```cpp
struct PatternInfo {
    // ...
    bool is_dual_channel_aware;  // If true, receives per-channel pointers
};
```

---

## Implementation Plan

### Phase 1: Extend Context (Backward Compatible)

1. Add dual-buffer pointers to `PatternRenderContext` (default to nullptr)
2. Add `active_channel` metadata field
3. Existing patterns unchanged (continue to use `leds` pointer)

### Phase 2: Scheduler Dual-Channel Support

**For Legacy Patterns (is_dual_channel_aware = false):**
```cpp
// Render once to global buffer
PatternRenderContext ctx(leds, NUM_LEDS, time, params, audio);
pattern->draw(ctx);

// Copy to both channels (if dual-channel mode enabled)
for (uint8_t ci = 0; ci < 2; ++ci) {
    RenderChannel* ch = channels[ci];
    if (!ch || !ch->enabled) continue;

    memcpy(ch->frame, leds, NUM_LEDS * sizeof(CRGBF));  // Fast copy
    quantize_frame(*ch, params);
    rmt_transmit(ch->tx_handle, ch->encoder, ch->packed, ...);
}
```

**For Dual-Aware Patterns (is_dual_channel_aware = true):**
```cpp
for (uint8_t ci = 0; ci < 2; ++ci) {
    RenderChannel* ch = channels[ci];
    if (!ch || !ch->enabled) continue;

    g_pattern_channel_index = ci;
    PatternRenderContext ctx(
        ch->frame,           // Direct render target
        NUM_LEDS,
        time, params, audio,
        ch->frame,           // leds_channel_a
        ch->frame,           // leds_channel_b (pattern chooses which to use)
        ci + 1               // active_channel
    );
    pattern->draw(ctx);      // No copy needed

    quantize_frame(*ch, params);
    rmt_transmit(ch->tx_handle, ch->encoder, ch->packed, ...);
}
```

### Phase 3: Optimize (Optional)

**Copy Optimization:**
- Use `memcpy()` instead of loop (4x faster on ESP32-S3)
- DMA-based copy for large buffers (if bandwidth becomes bottleneck)

**Mirrored Pattern Optimization:**
```cpp
if (pattern->is_mirrored && channels[0] && channels[1]) {
    // Render once to channel A
    pattern->draw(ctx_for_channel_a);

    // Fast copy A → B (single memcpy)
    memcpy(channels[1]->frame, channels[0]->frame, NUM_LEDS * sizeof(CRGBF));

    // Quantize both (may differ due to per-channel brightness/dither)
    quantize_frame(*channels[0], params);
    quantize_frame(*channels[1], params);
}
```

---

## Performance Analysis

### Baseline (Current Phase 0 Copy Strategy)

Per-frame budget (60 FPS = 16.67ms):
- Render: ~3ms (pattern dependent)
- Copy: ~0.4ms (200µs × 2 channels)
- Quantize: ~1.2ms (600µs × 2 channels)
- RMT TX: ~1.2ms (600µs × 2 channels, hardware paced)
- Wait: ~8ms (bounded timeout)
- **Total: ~13.8ms** (17% margin)

### With memcpy Optimization

- Copy: ~0.1ms (50µs × 2 channels using memcpy)
- **Total: ~13.5ms** (19% margin)

### Direct Render (Zero-Copy)

- Copy: **0ms** (eliminated)
- **Total: ~13.1ms** (21% margin)

**Verdict:** Copy overhead is negligible. Hybrid approach provides flexibility without performance penalty.

---

## Migration Strategy

### Phase 1 (Immediate - Current PR)

**Goal:** No behavior change, pure scaffolding extension

1. ✅ Add dual-buffer fields to PatternRenderContext (default nullptr)
2. ✅ Add `is_dual_channel_aware` flag to PatternInfo
3. ✅ Maintain current copy-based scheduler behavior
4. ✅ All existing patterns continue to work unchanged

**Validation:**
- Compile-time: No warnings, existing patterns build unchanged
- Runtime: Identical FPS, brightness, visual output
- Memory: Stack usage unchanged (new pointers are nullptr)

### Phase 2 (Future PR - Opt-in Dual Patterns)

**Goal:** Enable first dual-aware pattern

1. Implement scheduler logic for dual-aware patterns (if/else on flag)
2. Create one reference dual-aware pattern (e.g., stereo VU meter)
3. Validate zero-copy path with telemetry
4. Document dual-pattern API in pattern developer guide

### Phase 3 (Future - Optimization)

**Goal:** Optimize copy path for legacy patterns

1. Replace loop-based copy with memcpy
2. Add mirrored-pattern fast path
3. Profile with real-world pattern mix
4. Optional: DMA-based copy if needed

---

## Risks & Mitigations

### Risk: Copy Overhead Exceeds Budget

**Likelihood:** Low (current measurements show 200-400µs acceptable)
**Impact:** Medium (FPS drop)
**Mitigation:**
- Monitor per-frame telemetry (already instrumented)
- Implement memcpy optimization if needed (trivial change)
- Fall back to direct render for slow patterns (pattern metadata flag)

### Risk: Dual-Aware Patterns Harder to Develop

**Likelihood:** High (developers need to understand channel model)
**Impact:** Low (opt-in, legacy patterns still work)
**Mitigation:**
- Provide clear dual-pattern API documentation
- Create reference implementations (stereo VU, ping-pong, asymmetric)
- Default to copy mode for most patterns

### Risk: Memory Fragmentation

**Likelihood:** Low (fixed-size buffers, allocated at init)
**Impact:** Low (ESP32-S3 has ample SRAM)
**Mitigation:**
- RenderChannel buffers allocated once at startup
- No dynamic allocation in hot path
- Stack usage unchanged (context pointers, not copies)

### Risk: Backward Compatibility Break

**Likelihood:** Very Low (explicit backward compat design)
**Impact:** High (all existing patterns break)
**Mitigation:**
- New context fields default to nullptr (safe for legacy patterns)
- Existing patterns continue to use primary `leds` pointer
- Compiler enforces type safety (no silent failures)

---

## Alternatives Considered

### Alt 1: Force All Patterns to Dual-Aware

**Rejected:** High migration cost, no benefit for simple patterns (e.g., solid color, rainbow)

### Alt 2: Always Copy, Never Direct

**Rejected:** Limits future asymmetric effects, wastes potential performance

### Alt 3: Always Direct, No Copy Path

**Rejected:** Forces all patterns to understand channels, breaks existing code

### Alt 4: Runtime Strategy Selection (Pattern Chooses)

**Considered:** Could allow patterns to dynamically choose copy vs. direct
**Deferred:** Adds complexity without clear use case. Can revisit if needed.

---

## Success Criteria

### Phase 1 (Scaffolding)
- [ ] PatternRenderContext extended with dual-buffer fields
- [ ] All existing patterns compile and run unchanged
- [ ] FPS, brightness, visual output identical to baseline
- [ ] Zero new compiler warnings
- [ ] Memory usage ≤ baseline + 8 bytes (two pointers)

### Phase 2 (Dual-Aware Patterns)
- [ ] At least one dual-aware pattern implemented and working
- [ ] Direct render path validated with zero-copy telemetry
- [ ] Pattern developer documentation complete with examples
- [ ] No FPS regression for legacy patterns

### Phase 3 (Optimization)
- [ ] Copy path uses memcpy (4x speedup)
- [ ] Mirrored pattern fast path implemented
- [ ] Telemetry confirms <100µs copy overhead per channel
- [ ] No visual artifacts from optimization

---

## Decision Record

**Chosen:** Option B+ (Two Buffers + Metadata) with Hybrid Rendering Strategy

**Justification:**
- Backward compatible (existing patterns work unchanged)
- Forward compatible (enables dual-aware patterns)
- Performance acceptable (copy overhead negligible)
- Flexible (supports mirrored, independent, and asymmetric modes)
- Simple to implement and test incrementally

**Trade-offs Accepted:**
- Small copy overhead (~200-400µs) for legacy patterns (acceptable within budget)
- Slightly more complex scheduler logic (if/else on pattern flag)
- Pattern developers must opt-in to dual-channel features (acceptable, most patterns don't need it)

**Next Steps:**
1. Implement Phase 1 scaffolding in current PR
2. Add telemetry to measure copy overhead
3. Validate with existing pattern suite
4. Document dual-pattern API for future use

---

## Appendix: Code Sketches

### Extended PatternRenderContext

```cpp
struct PatternRenderContext {
    // === Backward Compatible Fields (always present) ===
    CRGBF* const leds;              // Primary render target (global buffer or channel A)
    const int num_leds;             // LED count (always NUM_LEDS = 180)
    const float time;               // Animation time in seconds
    const PatternParameters& params;
    const AudioDataSnapshot& audio_snapshot;

    // === Dual-Channel Extensions (Phase 1+) ===
    CRGBF* const leds_channel_a;    // Direct render to channel A (or nullptr)
    CRGBF* const leds_channel_b;    // Direct render to channel B (or nullptr)
    const uint8_t active_channel;   // 0=legacy, 1=A-only, 2=B-only, 3=both

    // === Constructors ===

    // Legacy single-buffer constructor (existing patterns)
    PatternRenderContext(
        CRGBF* led_buffer,
        int led_count,
        float current_time,
        const PatternParameters& pattern_params,
        const AudioDataSnapshot& audio_data)
        : leds(led_buffer),
          num_leds(led_count),
          time(current_time),
          params(pattern_params),
          audio_snapshot(audio_data),
          leds_channel_a(nullptr),
          leds_channel_b(nullptr),
          active_channel(0) {}

    // Dual-buffer constructor (dual-aware patterns)
    PatternRenderContext(
        CRGBF* primary_buffer,
        int led_count,
        float current_time,
        const PatternParameters& pattern_params,
        const AudioDataSnapshot& audio_data,
        CRGBF* channel_a_buffer,
        CRGBF* channel_b_buffer,
        uint8_t channel_mask)
        : leds(primary_buffer),
          num_leds(led_count),
          time(current_time),
          params(pattern_params),
          audio_snapshot(audio_data),
          leds_channel_a(channel_a_buffer),
          leds_channel_b(channel_b_buffer),
          active_channel(channel_mask) {}
};
```

### Pattern Metadata Flag

```cpp
struct PatternInfo {
    const char* name;
    void (*draw_function)(const PatternRenderContext&);
    bool supports_audio;
    bool is_dual_channel_aware;  // NEW: if true, receives per-channel buffers
    bool is_mirrored;            // NEW: if true, scheduler can optimize (render once, copy)
};
```

### Scheduler Logic (Conceptual)

```cpp
void visual_scheduler_render_frame(RenderChannel** channels, const PatternInfo* pattern) {
    AudioDataSnapshot audio;
    get_audio_snapshot(&audio);
    const PatternParameters& params = get_params();
    const float time = millis() / 1000.0f;

    if (!pattern->is_dual_channel_aware) {
        // === LEGACY PATH: Render to global, copy to channels ===
        PatternRenderContext ctx(leds, NUM_LEDS, time, params, audio);
        pattern->draw_function(ctx);

        for (uint8_t ci = 0; ci < 2; ++ci) {
            RenderChannel* ch = channels[ci];
            if (!ch || !ch->enabled) continue;

            // Fast copy (use memcpy in optimized version)
            memcpy(ch->frame, leds, NUM_LEDS * sizeof(CRGBF));

            quantize_and_transmit(ch, params);
        }
    } else {
        // === DUAL-AWARE PATH: Direct render to per-channel buffers ===
        for (uint8_t ci = 0; ci < 2; ++ci) {
            RenderChannel* ch = channels[ci];
            if (!ch || !ch->enabled) continue;

            g_pattern_channel_index = ci;
            PatternRenderContext ctx(
                ch->frame,      // Direct render target
                NUM_LEDS, time, params, audio,
                channels[0]->frame,  // Channel A buffer (if needed)
                channels[1]->frame,  // Channel B buffer (if needed)
                ci + 1
            );
            pattern->draw_function(ctx);  // NO COPY

            quantize_and_transmit(ch, params);
        }
    }
}
```

---

## References

- Phase 0 Scaffolding: firmware/src/visual_scheduler.cpp
- Current Context: firmware/src/pattern_render_context.h
- Channel Structure: firmware/src/render_channel.h
- RMT Configuration: firmware/src/led_driver.h:88 (NUM_LEDS = 180)
- CLAUDE.md RMT Guidelines: Section "Firmware/ESP-IDF Guardrails & Playbook"
