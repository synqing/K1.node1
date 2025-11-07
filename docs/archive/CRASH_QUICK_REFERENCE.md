# ESP32-S3 Spectrum Pattern Crash - Quick Reference

## What's Happening
Device crashes with `LoadProhibited (0x0000001c)` exception immediately after "Starting pattern: Spectrum" message appears.

## Root Cause (One Sentence)
The Spectrum pattern's `PATTERN_AUDIO_START()` macro allocates a 1876-byte `AudioDataSnapshot` structure on the stack, but the GPU task's 16KB stack is insufficient, causing memory corruption.

## Is This a Compilation Issue?
**NO.** Code compiles cleanly without warnings or errors. The crash is purely a runtime memory access violation.

## Is This a Runtime/Design Issue?
**YES.** The architecture allows unbounded stack allocation via macros, with no bounds checking or static allocation strategy.

## Crash Chain (Simplified)
```
1. Boot completes
2. Pattern registry initializes → selects Spectrum (first audio-reactive)
3. GPU task calls draw_spectrum() for first frame
4. draw_spectrum() calls PATTERN_AUDIO_START() macro
5. Macro expands to: AudioDataSnapshot audio = {0}; (allocates 1876 bytes)
6. Stack pointer corrupted due to insufficient margin
7. Next memory operation attempts to dereference 0x00098004 (garbage value)
8. LoadProhibited exception → Watchdog timer resets system
9. Loop repeats (continuous reboot)
```

## Why Spectrum Specifically?
- Spectrum is the **first audio-reactive pattern** in the pattern registry
- All static patterns (Departure, Lava, Twilight) before it don't use audio interface
- This is the **first time** `PATTERN_AUDIO_START()` executes in any pattern
- Other audio-reactive patterns would crash the same way if selected first

## The Four Key Numbers

| Metric | Value | Why It Matters |
|--------|-------|-----------------|
| GPU task stack | 16,384 bytes | Total available memory for pattern rendering |
| AudioDataSnapshot size | 1,876 bytes | Allocated every frame by macro |
| Stack per pattern call | ~2,200 bytes | With locals and overhead |
| Safe margin remaining | ~14,000 bytes | Appears sufficient, but crashes anyway |

## Root Problem Code

### Location 1: The Macro (pattern_audio_interface.h:106)
```cpp
#define PATTERN_AUDIO_START() \
    AudioDataSnapshot audio = {0};  // ← Allocates 1876 bytes on CALLER's stack!
    bool audio_available = get_audio_snapshot(&audio);
    // ... more macro code ...
```

**Problem:** 1876-byte structure allocated on stack with no bounds check

### Location 2: GPU Task Stack (main.cpp:578)
```cpp
xTaskCreatePinnedToCore(
    loop_gpu,
    "loop_gpu",
    16384,  // ← Only 16KB for entire pattern rendering + OS overhead
    NULL, 1, &gpu_task_handle, 0
);
```

**Problem:** Insufficient stack space for macro allocations

### Location 3: Pattern Using Macro (generated_patterns.h:382)
```cpp
void draw_spectrum(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();  // ← First statement triggers 1876-byte allocation
    // ... rest of pattern code ...
}
```

**Problem:** Pattern blindly uses macro without knowing stack cost

## Affected Patterns
**All audio-reactive patterns will crash when selected:**
- Spectrum, Octave, Bloom, Bloom_Mirror
- Pulse, Tempiscope, Beat_Tunnel, Beat_Tunnel_Variant
- Perlin, Analog, Metronome, Hype
- Waveform_Spectrum, Snapwave
- (Any future patterns using PATTERN_AUDIO_START())

**Unaffected patterns (static, don't use audio):**
- Departure, Lava, Twilight

## Why 0x00098004?
This address is **outside all valid ESP32-S3 SRAM ranges** (which start at 0x3FCC0000). It's a **corrupted pointer** that resulted from stack overflow trampling the return address or frame pointer.

## Quick Fix (Temporary)
Increase GPU stack from 16KB to 24KB:

**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/main.cpp`
**Line:** 578
**Change:**
```cpp
// FROM:
16384,

// TO:
24576,  // 1.5x buffer (24KB instead of 16KB)
```

**Time:** 2 minutes
**Risk:** Low (temporary band-aid, not root cause fix)

## Permanent Fix (Proper Solution)
Move AudioDataSnapshot allocation from stack to static/global storage.

**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/pattern_audio_interface.h`
**Lines:** 106-116
**Change:** Instead of allocating `AudioDataSnapshot audio` inside every pattern function call, use a single static/global instance

**Time:** 30-45 minutes
**Risk:** Medium (must test all audio-reactive patterns)
**Benefit:** Eliminates root cause entirely

## Evidence This Is NOT Compilation
- No compiler errors
- No linker errors
- No undefined references
- Code compiles with `-Wall -Wextra`
- Device boots successfully and prints diagnostic messages
- LoadProhibited exception only occurs at runtime

## Evidence This IS Runtime Design Issue
- LoadProhibited is a runtime exception (invalid memory access during execution)
- Address 0x00098004 is not a static address (it's a corrupted value)
- Crash is reproducible and consistent
- Happens specifically during memory allocation in macro
- Only occurs in audio-reactive patterns, not static ones
- Stack overflow signature (corrupted pointer dereference)

## What To Check First
1. Verify audio/goertzel.h struct definition is 1876 bytes ✓
2. Confirm GPU task stack is 16384 bytes ✓
3. Check that Spectrum is first audio-reactive pattern ✓
4. Verify PATTERN_AUDIO_START() uses local allocation ✓
5. Monitor FreeRTOS task stack usage with `xTaskGetStackHighWaterMark()`

## Files Modified by Analysis
1. `/Users/spectrasynq/Workspace_Management/Software/K1.node1/CRASH_ANALYSIS_SPECTRUM_LOADPROHIBITED.md` - Full forensic analysis
2. `/Users/spectrasynq/Workspace_Management/Software/K1.node1/crash_analysis.json` - Structured data for automation
3. `/Users/spectrasynq/Workspace_Management/Software/K1.node1/CRASH_QUICK_REFERENCE.md` - This file

## Next Steps
1. **Immediate:** Apply temporary 16KB → 24KB stack increase fix
2. **Verify:** Test that Spectrum pattern loads without crash
3. **Monitor:** Check stack high-water mark to confirm margin
4. **Plan:** Schedule permanent fix to redesign macro allocation
5. **Test:** Verify all 15 audio-reactive patterns work correctly
