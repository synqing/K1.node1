---
status: active
author: K1.node1 Audio Team
date: 2026-01-08
intent: Onboarding guide for new developers joining beat tracking system development and pattern creation
scope: 15–20 minute overview covering system architecture, key concepts, validation procedures, and where to find help
related:
  - "K1NAnalysis_BEAT_TRACKING_EXECUTIVE_SUMMARY_v1.0_20260108.md (project status and recovery timeline)"
  - "K1NAnalysis_BEAT_TRACKING_GIT_HISTORY_v1.0_20260108.md (detailed technical reference)"
  - "firmware/src/audio/ (implementation)"
  - "firmware/src/patterns/ (pattern examples)"
tags:
  - beat-tracking
  - onboarding
  - audio-reactive
  - quick-reference
  - pattern-development
---

# Quick-Start Guide: Beat Tracking System for New Developers

**Reading Time**: 15–20 minutes
**Prerequisites**: Familiarity with C++, LED pattern basics
**Goal**: Understand beat tracking architecture, validate it's working, and avoid common mistakes

---

## Part 1: System Architecture (5 min)

### What is Beat Tracking?

Beat tracking is **audio frequency analysis** that detects the tempo (BPM) of music and outputs:
- **Tempo Confidence**: How confident we are about the detected tempo (0.0–1.0 scale)
- **Tempo Magnitude**: Strength of the beat at each frequency bin
- **Tempo Phase**: Timing offset relative to the beat (for synchronization)

### How It Works: Signal Flow

```
Microphone (SPH0645)
    ↓
I2S Audio Buffer (12.8 kHz, 32-bit)
    ↓
Goertzel DFT Analysis (frequency domain)
    ↓
Tempo Detection (tempo_confidence, tempo_magnitude, tempo_phase)
    ↓
Seqlock Snapshot (lock-free handoff to patterns)
    ↓
LED Patterns (Pulse, Hype, Beat Tunnel use tempo data)
    ↓
RMT WS2812 Transmission (synchronized dual channels)
```

### Key Parameters (Emotiscope Baseline)

| Parameter | Value | Meaning |
|-----------|-------|---------|
| **BOTTOM_NOTE** | 12 Hz | Lowest frequency analyzed (floor of tempo range) |
| **NUM_TEMPI** | 192 | Number of frequency bins (4.2 Hz resolution) |
| **Tempo Range** | 50–150 BPM | Covers most music genres |
| **Normalization** | ÷(N/2) | Frequency domain magnitude scaling |
| **Sample Rate** | 12.8 kHz | I2S audio buffer rate |
| **AGC Enabled** | Yes | Automatic gain control for consistent levels |

### Three Core Subsystems

**1. Audio Capture (I2S)**
- SPH0645 MEMS microphone on I2S line
- 12.8 kHz sample rate, 32-bit signed
- Auto-gain control (AGC) compensates for volume changes
- File: `firmware/src/audio/microphone.cpp`

**2. Frequency Analysis (Goertzel)**
- Discrete Fourier Transform analysis (DFT)
- Analyzes 192 frequency bins from 50–150 BPM range
- Outputs tempo confidence, magnitude, phase
- Computationally efficient (single-pass analysis)
- File: `firmware/src/audio/goertzel.h/.cpp`

**3. Pattern Integration (Seqlock)**
- Lock-free synchronization between audio core and pattern core
- Guarantees patterns see consistent snapshots (no torn reads)
- <1 ms latency, <1% retry rate
- File: `firmware/src/system_state.h` (unified state structures)

---

## Part 2: Validation (5 min)

### Quick-Check Procedure (Before Making Changes)

**Goal**: Verify beat tracking is working in ~2 minutes

**Step 1: Run Test Suite**
```bash
cd firmware
pio test --environment esp32dev -f test_beat_detection_stability
```
Expected: All tests pass ✅

**Step 2: Check Heartbeat Endpoint**
```bash
curl http://<device-ip>/api/device/performance
```
Look for:
```json
{
  "fps": 60,
  "beat_confidence": 0.65,
  "beat_latency_ms": 0.8
}
```
- If `fps` < 58: Performance regression
- If `beat_confidence` < 0.3: Audio quality or algorithm issue
- If `beat_latency_ms` > 2.0: Synchronization delay

**Step 3: Visual Verification**
Play a song with clear beat (pop, electronic, or dance music).
Observe Pulse pattern:
- ✅ **Good**: Waves spawn synchronized with bass drops, responsive to tempo changes
- ❌ **Bad**: Waves spawn randomly, unrelated to beat, respond to total volume instead

**Step 4: Parameter Baseline (Optional)**
```bash
# List all audio parameters
curl http://<device-ip>/api/audio/params
```
Compare against reference (see "Parameter Reference Card" below).

### Diagnostic: "Beat Tracking Not Working"

| Symptom | Likely Cause | Check |
|---------|--------------|-------|
| Confidence always ~0.5 | Audio input too quiet | Check microphone gain; AGC disabled? |
| Confidence random (0.1–0.9 swings) | Environmental noise | Try quiet room; check for electrical interference |
| Patterns unresponsive to beat | Using VU level instead of tempo data | Verify pattern code references `tempo_confidence` not `vu_level` |
| Specific genre fails (e.g., hip-hop) | Tempo outside 50–150 BPM range | Check reference audio; may need NUM_TEMPI adjustment |
| Latency spikes (>5 ms) | Seqlock contention or slow audio buffer | Check CPU usage; may indicate other system load |

---

## Part 3: Parameter Reference Card

### Adjusting Beat Tracking Parameters

**When to adjust**:
- New music genre with unusual BPM distribution
- Audio quality degradation (confidence drops)
- Pattern synchronization issues

**Parameters**:

```cpp
// firmware/src/audio/audio_config.h

// Lowest frequency to analyze (Hz)
// Higher = skips slow tempos; lower = includes more bass
#define BOTTOM_NOTE 12

// Number of frequency bins
// More bins = finer resolution but more CPU
// 192 = 4.2 Hz/bin (RECOMMENDED)
// 128 = 6.7 Hz/bin (legacy, faster)
#define NUM_TEMPI 192

// Normalization: divide magnitude by (N/2)
// Required for consistent levels across different buffer sizes
#define NORMALIZE_BY_N_DIV_2 1

// Magnitude scaling: multiply by 1.0 (linear)
// Historical note: was cubic (x³), changed to linear for better SNR
#define MAGNITUDE_SCALE 1.0f

// Silence gate threshold
// If average energy < this, assume silence
#define SILENCE_THRESHOLD 0.05f
```

### Changing Parameters Safely

**Checklist** (before committing):

- [ ] Updated comment explaining why change was needed
- [ ] Ran full test suite: `pio test --environment esp32dev`
- [ ] Tested on 3+ reference songs (different genres)
- [ ] Validated F1 score on test corpus (see "Testing Protocol" below)
- [ ] Checked CPU/latency impact (should be <1% change)
- [ ] Confirmed no regressions in pattern visual output
- [ ] Created git commit with justification

---

## Part 4: Common Mistakes to Avoid

### ❌ Mistake 1: "Recompute Beat Detection in Pattern Code"

**Wrong**:
```cpp
// In pattern rendering loop
float beat_energy = fft(audio_buffer);  // DON'T DO THIS
if (beat_energy > threshold) { spawn_wave(); }
```

**Why**: Duplicates computation; introduces inconsistency between patterns; misses Emotiscope optimizations.

**Right**:
```cpp
// Use pre-computed tempo data from audio pipeline
if (audio_state.tempo_confidence > 0.3f) {
    spawn_wave();
}
```

### ❌ Mistake 2: "Confusing VU Level with Tempo Confidence"

**Wrong**:
```cpp
if (audio_state.vu_level > 0.6f) {  // VU = total volume
    spawn_wave();  // Spawns on EVERY loud sound, not beat
}
```

**Right**:
```cpp
if (audio_state.tempo_confidence > 0.3f) {  // Tempo = sync'd beat
    spawn_wave();  // Spawns only on detected beats
}
```

### ❌ Mistake 3: "Changing NUM_TEMPI Without Testing"

**Wrong**:
```cpp
#define NUM_TEMPI 256  // "More precision is always better"
// Commit without testing across genres
```

**Why**: May break 140–150 BPM detection; wastes CPU; untested edge cases.

**Right**:
```cpp
#define NUM_TEMPI 256
// Test on: pop, electronic, hip-hop, metal, classical
// Verify: No genre drops below 0.3 confidence
// Check: CPU usage still <5%, latency <40ms
// Then commit with testing results
```

### ❌ Mistake 4: "Ignoring Silence Gating"

**Wrong**:
```cpp
// Pattern always tries to use tempo_confidence
// Even when audio is silent
spawn_wave();  // Creates false positives
```

**Right**:
```cpp
// Check for silence first
if (audio_state.silence_detected) {
    return;  // Don't spawn on silence
}
if (audio_state.tempo_confidence > 0.3f) {
    spawn_wave();
}
```

---

## Part 5: Pattern Development Guide

### Creating a Tempo-Driven Pattern (30 seconds)

**Step 1**: Copy reference pattern (e.g., `Pulse`)
**Step 2**: Replace wave spawn logic with your animation:
```cpp
// Instead of spawn_wave(), do whatever you want:
// - Change color based on tempo_confidence
// - Scale size based on tempo_magnitude
// - Adjust animation speed based on tempo
```

**Step 3**: Access tempo data:
```cpp
#include "audio_system_state.h"

// In pattern render function:
auto tempo_confidence = audio_state->tempo_confidence;
auto tempo_magnitude = audio_state->tempo_magnitude;
auto tempo_phase = audio_state->tempo_phase;

// tempo_phase is 0.0–2π (beat phase in current cycle)
float beat_phase_pct = tempo_phase / (2 * M_PI);  // 0.0–1.0
```

### Validating New Pattern

**Checklist**:
- [ ] Pattern compiles without warnings
- [ ] Responds to beat (not volume) on test audio
- [ ] No regressions in other patterns (`pio test`)
- [ ] Latency acceptable (<5 ms added overhead)
- [ ] Behavior consistent on silence (no artifacts)

---

## Part 6: Troubleshooting

### Issue: "CI Build Fails: Beat Tracking Test"

**Common Cause**: Changes to audio subsystem broke test expectations.

**Fix**:
```bash
# Run test locally first
pio test --environment esp32dev -f test_beat_detection_stability --verbose

# If test fails, check:
# 1. Did you change BOTTOM_NOTE, NUM_TEMPI, or normalization?
# 2. Did you run test corpus validation?
# 3. Does test expect old confidence values?

# Update test thresholds if necessary
# Reference test: firmware/test_beat_detection_stability.cpp
```

### Issue: "Pattern Suddenly Unresponsive"

**Checklist**:
1. Check heartbeat: Is `beat_confidence` > 0.3? If not, check audio.
2. Check silence gate: Is device picking up audio, or is it silent?
3. Check pattern code: Are you using `tempo_confidence` or `vu_level`?
4. Revert to last commit: `git checkout -- firmware/src/audio/`
5. Rebuild: `pio run --environment esp32dev`

### Issue: "Performance Degraded (FPS < 60)"

**Check (in order)**:
1. `curl /api/device/performance` → Is CPU usage >10%?
2. Did you increase NUM_TEMPI? (more bins = more CPU)
3. Did you add logging in hot path? (common mistake)
4. Did you recompile without optimizations? (check `-O2` flag)

---

## Part 7: Where to Find Help

### Documentation

| Question | Resource |
|----------|----------|
| "What's the root cause of the Nov crisis?" | [K1NAnalysis_BEAT_TRACKING_EXECUTIVE_SUMMARY](./K1NAnalysis_BEAT_TRACKING_EXECUTIVE_SUMMARY_v1.0_20260108.md) |
| "How do I change parameters safely?" | This guide + [Parameter Governance](../01-architecture/firmware_state_architecture.md) |
| "What does Goertzel do?" | [Goertzel Header](../../firmware/src/audio/goertzel.h) (well-commented) |
| "How do patterns work?" | [Beat Family Patterns](../../firmware/src/patterns/beat_family.hpp) (reference implementation) |
| "What's in the test suite?" | [Test Files](../../firmware/test_beat_detection_stability.cpp) |

### Code Locations

```
firmware/src/
├── audio/
│   ├── microphone.cpp      # I2S audio capture
│   ├── goertzel.h/.cpp     # Frequency analysis
│   ├── tempo.h/.cpp        # Tempo detection state machine
│   └── audio_config.h      # BOTTOM_NOTE, NUM_TEMPI parameters
├── patterns/
│   ├── beat_family.hpp     # Pulse, Hype, Beat Tunnel (reference)
│   └── dot_family.hpp      # Other tempo-driven patterns
└── system_state.h          # Unified state structures (Seqlock)

firmware/test/
├── test_beat_detection_stability.cpp  # Core validation
└── test_pattern_snapshots.cpp         # Visual regression tests
```

### Contact & Escalation

**If you find a beat tracking bug**:
1. Create test case demonstrating the issue
2. Check git history: `git log --oneline -- firmware/src/audio/`
3. Reference relevant issue in test: `// Related to issue #123`
4. Escalate to audio team (see CODEOWNERS)

**If you're unsure about a change**:
- Check [Parameter Change Approval Checklist](../05-analysis/K1NAnalysis_BEAT_TRACKING_GIT_HISTORY_v1.0_20260108.md#part-10-parameter-change-approval-checklist)
- Ask in team Slack or design doc review

---

## Part 8: Key Takeaways (Remember These!)

### ✅ DO
- ✅ Use `tempo_confidence` for beat detection (not `vu_level`)
- ✅ Test parameter changes on 5+ genres before committing
- ✅ Run test suite: `pio test --environment esp32dev`
- ✅ Check heartbeat endpoint: `/api/device/performance`
- ✅ Reference Pulse/Hype patterns as examples (Emotiscope-verified)

### ❌ DON'T
- ❌ Recompute beat detection in pattern code
- ❌ Change parameters without testing
- ❌ Add logging in hot paths (`firmware/src/audio/goertzel.cpp`)
- ❌ Modify audio pipeline without running full test suite
- ❌ Assume VU level and tempo confidence are the same thing

---

## Part 9: Next Steps

**Ready to contribute?**

1. **Onboarding Task 1** (15 min): Run quick-check procedure (Part 2) on your device
2. **Onboarding Task 2** (30 min): Review Pulse pattern code and understand how it uses `tempo_confidence`
3. **Onboarding Task 3** (1 hour): Create a new pattern based on Beat Tunnel template
4. **Onboarding Task 4** (1 hour): Run full test suite and study test expectations

**Next Level: Core Development**

- Review [Emotiscope baseline parameters](../05-analysis/K1NAnalysis_BEAT_TRACKING_GIT_HISTORY_v1.0_20260108.md) and understand historical optimization
- Study Goertzel algorithm (mathematical foundation)
- Explore seqlock synchronization (lock-free patterns)
- Contribute to test suite improvements

---

## References

- **Executive Summary**: Status, timeline, validation results
- **Detailed Analysis**: 1,963-line forensic document with git history, parameter validation, telemetry, diagrams
- **Emotiscope Baseline**: Original audio system (50+ years of audio engineering knowledge encoded in parameters)
- **Test Suite**: `firmware/test/` directory with regression tests

---

**Document Version**: 1.0
**Last Updated**: 2026-01-08
**Status**: ACTIVE
**Audience**: New developers, pattern creators, system integrators
**Questions?**: See Part 7 (Where to Find Help)
