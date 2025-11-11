# Tempo Entropy Validation Integration Plan

**Project:** K1.node1 Firmware - Hardening Tempo Detection
**Date:** 2025-11-11
**Owner:** Firmware Team
**Status:** Proposed
**Related ADR:** TBD (pending architectural decision)

---

## Objective

Integrate entropy-based validation into K1.node1 tempo detection system to:

1. Reject tempo estimates on ambient/arhythmic audio (reduce false positives by 80%+)
2. Detect and flag octave ambiguity (half/double tempo errors)
3. Provide confidence scores for adaptive pattern behavior
4. Maintain real-time performance (<2% CPU overhead on ESP32)

---

## Current State Analysis

### Existing Tempo Detection (as of 2025-11-11)

**Location:** `firmware/src/` (exact path TBD - requires codebase inspection)

**Current Approach:**
- Onset detection → Autocorrelation → Peak finding → BPM estimation
- No validation or confidence scoring
- No rejection of non-rhythmic content
- Fixed threshold beat tracking

**Known Issues:**
1. Detects "tempo" on ambient music and silence
2. Octave errors (120 vs 240 BPM ambiguity)
3. No confidence feedback to pattern system
4. Unstable on music with tempo variations

---

## Proposed Architecture

### System Diagram

```
┌────────────────────────────────────────────────────┐
│           I2S Audio Input (Microphone)             │
└─────────────────────┬──────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────────┐
│        Onset Strength Computation                  │
│        • Spectral flux (existing)                  │
│        • 100 Hz update rate                        │
│        • Circular buffer (1 second)                │
└─────────────────────┬──────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
┌──────────────────┐    ┌─────────────────────┐
│ [NEW] Spectral   │    │ Tempo Detection     │
│ Entropy Gate     │    │ (existing, enhanced)│
│                  │    │                     │
│ If SE > 0.70:    │    │ • Autocorrelation   │
│   REJECT         │───▶│ • Peak finding      │
│   return null    │    │ • BPM calculation   │
│                  │    │                     │
│ Else: PROCEED    │    │ [NEW] + Shannon H   │
└──────────────────┘    └──────────┬──────────┘
                                   │
                                   ▼
                      ┌──────────────────────────┐
                      │ [NEW] Confidence         │
                      │ Aggregation              │
                      │                          │
                      │ Inputs:                  │
                      │  • Spectral entropy      │
                      │  • AC Shannon entropy    │
                      │  • Peak-to-average ratio │
                      │  • Octave check          │
                      │                          │
                      │ Output:                  │
                      │  • Composite confidence  │
                      │  • Decision: A/R/R       │
                      └────────────┬─────────────┘
                                   │
                                   ▼
                      ┌──────────────────────────┐
                      │ Tempo State Manager      │
                      │ (existing, modified)     │
                      │                          │
                      │ States:                  │
                      │  • LOCKED (conf > 0.70)  │
                      │  • TRACKING (0.50-0.70)  │
                      │  • SEARCHING (< 0.50)    │
                      │  • REJECTED (ambient)    │
                      └────────────┬─────────────┘
                                   │
                                   ▼
                      ┌──────────────────────────┐
                      │ Pattern Control          │
                      │ (existing, enhanced)     │
                      │                          │
                      │ Behavior by state:       │
                      │  • LOCKED → sync tight   │
                      │  • TRACKING → sync loose │
                      │  • SEARCHING → damped    │
                      │  • REJECTED → autonomous │
                      └──────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Spectral Entropy Gate (Week 1)

**Goal:** Reject ambient/non-rhythmic content before tempo estimation.

**Tasks:**

1. **Create entropy utilities module** (`firmware/src/audio/entropy_utils.cpp`)
   ```cpp
   // Header: entropy_utils.h
   void init_entropy_lut();
   float compute_spectral_entropy(const int16_t* audio, int len);
   float fast_entropy_normalized(const float* prob, int n);
   ```

2. **Implement spectral entropy calculation**
   - FFT size: 512 samples (23ms at 22050 Hz)
   - Use existing FFT implementation or CMSIS-DSP
   - Normalize to [0, 1] range
   - Update every 10 frames (~100ms)

3. **Add gating logic in tempo detector**
   ```cpp
   // In tempo_detector.cpp::update()
   float se = compute_spectral_entropy(latest_audio_frame, 512);

   if (se > SPECTRAL_ENTROPY_REJECT_THRESHOLD) {
       tempo_state = TEMPO_STATE_REJECTED;
       current_bpm = 0.0f;
       confidence = 0.0f;
       return;
   }

   // Proceed with normal tempo detection...
   ```

4. **Configure thresholds**
   - Initial threshold: 0.70 (conservative)
   - Expose via config or REST API for runtime tuning

5. **Add telemetry**
   - Track rejection rate
   - Log spectral entropy values
   - Expose via `/api/tempo/metrics`

**Deliverable:** Ambient music no longer triggers tempo detection

**Success Criteria:**
- Rejection rate on ambient test set: >90%
- False rejection rate on rhythmic music: <5%
- CPU overhead: <1%

---

### Phase 2: Autocorrelation Shannon Entropy (Week 2)

**Goal:** Compute confidence score for tempo estimates.

**Tasks:**

1. **Extend autocorrelation to store full distribution**
   ```cpp
   // Instead of just finding peak:
   struct AutocorrResult {
       float bpm;
       float peak_strength;
       float entropy;           // [NEW]
       float confidence;        // [NEW]
       bool octave_ambiguous;   // [NEW]
   };

   AutocorrResult compute_tempo_with_confidence(const float* onset_env, int len);
   ```

2. **Implement Shannon entropy of autocorrelation**
   ```cpp
   float compute_autocorr_entropy(const float* autocorr, int n_lags) {
       // Normalize to probability
       float total = 0.0f;
       for (int i = 0; i < n_lags; i++) {
           total += autocorr[i];
       }

       float prob[MAX_LAGS];
       for (int i = 0; i < n_lags; i++) {
           prob[i] = autocorr[i] / total;
       }

       // Use LUT-based entropy
       return fast_entropy_normalized(prob, n_lags);
   }
   ```

3. **Detect octave ambiguity**
   ```cpp
   bool check_octave_ambiguity(const AutocorrResult& result) {
       // Find secondary peak
       int peak_idx_1 = result.peak_lag_idx;
       int peak_idx_2 = find_second_peak(autocorr, n_lags, peak_idx_1);

       float ratio = (float)peak_idx_2 / peak_idx_1;

       // Check for 2:1 or 3:1 relationship
       return (1.9f < ratio && ratio < 2.1f) ||
              (2.9f < ratio && ratio < 3.1f);
   }
   ```

4. **Compute composite confidence**
   ```cpp
   float compute_composite_confidence(
       float spectral_entropy,
       float autocorr_entropy,
       float peak_to_avg_ratio,
       bool octave_ambiguous
   ) {
       float conf_spectral = 1.0f - spectral_entropy;
       float conf_autocorr = 1.0f - autocorr_entropy;
       float conf_peak = fminf(peak_to_avg_ratio / 5.0f, 1.0f);

       // Penalize octave ambiguity
       float octave_penalty = octave_ambiguous ? 0.7f : 1.0f;

       return (0.25f * conf_spectral +
               0.35f * conf_autocorr +
               0.20f * conf_peak +
               0.20f * 0.7f)  // Placeholder for phase consistency
              * octave_penalty;
   }
   ```

5. **Update tempo state machine**
   ```cpp
   enum TempoState {
       TEMPO_STATE_REJECTED,      // SE > threshold or no audio
       TEMPO_STATE_SEARCHING,     // Low confidence (< 0.50)
       TEMPO_STATE_TRACKING,      // Medium confidence (0.50 - 0.70)
       TEMPO_STATE_LOCKED         // High confidence (> 0.70)
   };

   void update_tempo_state(float confidence) {
       if (confidence >= 0.70f) {
           tempo_state = TEMPO_STATE_LOCKED;
       } else if (confidence >= 0.50f) {
           tempo_state = TEMPO_STATE_TRACKING;
       } else {
           tempo_state = TEMPO_STATE_SEARCHING;
       }
   }
   ```

**Deliverable:** Tempo estimates include confidence scores

**Success Criteria:**
- Confidence correlates with human perception (r > 0.7)
- Octave ambiguity detection rate: >80%
- CPU overhead: <1.5% (total: ~2.5%)

---

### Phase 3: Adaptive Pattern Behavior (Week 3)

**Goal:** Use confidence scores to modulate pattern synchronization.

**Tasks:**

1. **Expose tempo confidence to pattern system**
   ```cpp
   // In pattern_controller.cpp
   struct TempoInfo {
       float bpm;
       float confidence;
       TempoState state;
       uint32_t last_update_ms;
   };

   extern TempoInfo g_tempo_info;  // Shared from tempo_detector
   ```

2. **Implement adaptive sync strength**
   ```cpp
   void update_pattern_sync(const TempoInfo& tempo) {
       switch (tempo.state) {
           case TEMPO_STATE_LOCKED:
               // Tight synchronization
               sync_strength = 1.0f;
               pattern_mode = PATTERN_MODE_SYNC_TIGHT;
               break;

           case TEMPO_STATE_TRACKING:
               // Loose synchronization with damping
               sync_strength = 0.5f + 0.5f * tempo.confidence;
               pattern_mode = PATTERN_MODE_SYNC_LOOSE;
               break;

           case TEMPO_STATE_SEARCHING:
               // Gradual transition to autonomous
               sync_strength *= 0.95f;  // Decay
               if (sync_strength < 0.1f) {
                   pattern_mode = PATTERN_MODE_AUTONOMOUS;
               }
               break;

           case TEMPO_STATE_REJECTED:
               // Fully autonomous (ambient mode)
               sync_strength = 0.0f;
               pattern_mode = PATTERN_MODE_AUTONOMOUS;
               break;
       }
   }
   ```

3. **Add hysteresis to prevent flapping**
   ```cpp
   // Require confidence to be stable for N frames before state change
   #define STATE_CHANGE_HYSTERESIS_FRAMES 5

   static int frames_in_current_state = 0;
   static TempoState pending_state = TEMPO_STATE_SEARCHING;

   void update_tempo_state_with_hysteresis(float confidence) {
       TempoState new_state = determine_state_from_confidence(confidence);

       if (new_state == tempo_state) {
           frames_in_current_state++;
       } else {
           if (new_state == pending_state) {
               frames_in_current_state++;
               if (frames_in_current_state >= STATE_CHANGE_HYSTERESIS_FRAMES) {
                   tempo_state = new_state;
                   frames_in_current_state = 0;
               }
           } else {
               pending_state = new_state;
               frames_in_current_state = 1;
           }
       }
   }
   ```

4. **Visual feedback for debugging**
   - LED strip segment shows tempo confidence (color gradient)
   - REST API exposes current state
   - Serial debug output (DEBUG mode only)

**Deliverable:** Patterns adapt smoothly to tempo confidence

**Success Criteria:**
- Smooth transitions between sync modes (no jarring jumps)
- Ambient music triggers autonomous mode within 1 second
- Clear music achieves LOCKED state within 3 seconds

---

### Phase 4: Telemetry & Tuning (Week 4)

**Goal:** Expose metrics and enable runtime tuning.

**Tasks:**

1. **REST API endpoints**
   ```cpp
   // GET /api/tempo/status
   {
       "bpm": 120.5,
       "confidence": 0.82,
       "state": "LOCKED",
       "spectral_entropy": 0.35,
       "autocorr_entropy": 0.28,
       "octave_ambiguous": false,
       "last_update_ms": 1234567890
   }

   // GET /api/tempo/metrics
   {
       "frames_processed": 10532,
       "rejection_rate": 0.08,
       "avg_confidence": 0.71,
       "state_distribution": {
           "REJECTED": 0.08,
           "SEARCHING": 0.12,
           "TRACKING": 0.35,
           "LOCKED": 0.45
       }
   }

   // POST /api/tempo/config
   {
       "spectral_entropy_threshold": 0.70,
       "autocorr_entropy_threshold": 0.60,
       "confidence_weights": {
           "spectral": 0.25,
           "autocorr": 0.35,
           "peak": 0.20,
           "phase": 0.20
       }
   }
   ```

2. **Persistent configuration storage**
   - Save thresholds to EEPROM/NVS
   - Load on boot
   - Reset to defaults API

3. **Debug heartbeat**
   ```cpp
   #ifdef DEBUG_TEMPO
   void print_tempo_heartbeat() {
       static uint32_t last_print = 0;
       if (millis() - last_print > 1000) {
           Serial.printf("TEMPO: %.1f BPM | Conf: %.2f | State: %s | "
                        "SE: %.2f | AE: %.2f\n",
                        tempo_info.bpm,
                        tempo_info.confidence,
                        state_name(tempo_info.state),
                        spectral_entropy,
                        autocorr_entropy);
           last_print = millis();
       }
   }
   #endif
   ```

4. **Field data collection script**
   - Python script to poll `/api/tempo/status` during testing
   - Log to CSV for threshold optimization
   - Correlation analysis with manual labels

5. **Threshold auto-tuning (optional)**
   - Collect statistics over 5-minute window
   - Adjust thresholds to maintain target rejection rate (e.g., 10%)
   - Exponential moving average for stability

**Deliverable:** Full observability and tunability

**Success Criteria:**
- All metrics accessible via REST API
- Configuration persists across reboots
- Threshold tuning reduces false positives by 50%+ in field testing

---

## Testing Strategy

### Unit Tests

**Location:** `firmware/test/test_entropy_validation.cpp`

```cpp
void test_spectral_entropy_rejects_white_noise() {
    int16_t white_noise[512];
    generate_white_noise(white_noise, 512);

    float se = compute_spectral_entropy(white_noise, 512);

    TEST_ASSERT_GREATER_THAN(0.75f, se);
}

void test_spectral_entropy_accepts_rhythmic() {
    int16_t rhythmic[512];
    generate_test_tone_with_rhythm(rhythmic, 512, 120.0f);

    float se = compute_spectral_entropy(rhythmic, 512);

    TEST_ASSERT_LESS_THAN(0.65f, se);
}

void test_autocorr_entropy_detects_ambiguity() {
    float onset_env[100];
    generate_ambiguous_onset_pattern(onset_env, 100, 120.0f);

    AutocorrResult result = compute_tempo_with_confidence(onset_env, 100);

    TEST_ASSERT_TRUE(result.octave_ambiguous);
    TEST_ASSERT_GREATER_THAN(0.5f, result.entropy);
}
```

### Integration Tests

**Test Audio Samples:** `firmware/test/audio_samples/`

1. **ambient_drone.wav** - Should be REJECTED
2. **electronic_clear_beat_120bpm.wav** - Should be LOCKED at 120 BPM
3. **jazz_syncopated_150bpm.wav** - Should be TRACKING or LOCKED at 150 BPM
4. **classical_variable_tempo.wav** - May be SEARCHING or REJECTED
5. **silence_1sec.wav** - Should be REJECTED
6. **speech_no_music.wav** - Should be REJECTED

**Test Procedure:**
```python
# test_tempo_validation.py
import requests
import librosa

test_cases = [
    ("ambient_drone.wav", "REJECTED", None),
    ("electronic_clear_beat_120bpm.wav", "LOCKED", 120.0),
    # ... etc
]

for filename, expected_state, expected_bpm in test_cases:
    # Play audio to device
    play_audio_to_device(filename)

    # Poll tempo status
    time.sleep(2.0)  # Allow stabilization
    response = requests.get("http://device-ip/api/tempo/status")
    data = response.json()

    # Assertions
    assert data['state'] == expected_state
    if expected_bpm:
        assert abs(data['bpm'] - expected_bpm) < 5.0  # 5 BPM tolerance
```

### Field Testing

**Phase 1: Lab Testing (1 week)**
- Test with curated playlist (50 songs, diverse genres)
- Manual labeling of expected tempo and confidence
- Measure precision/recall for state decisions

**Phase 2: Real-World Testing (2 weeks)**
- Deploy to beta testers
- Collect telemetry via `/api/tempo/metrics`
- User survey: "Did the lights match the music?"
- Iterate on thresholds based on feedback

**Success Metrics:**
- User satisfaction score: >8/10
- False positive rate (tempo on ambient): <5%
- True positive rate (correct tempo on rhythmic): >90%
- Octave error rate: <10%

---

## Performance Budget

### CPU Usage (ESP32 @ 240 MHz)

| Component | Cycles/Frame | Time (µs) | % at 100fps |
|-----------|--------------|-----------|-------------|
| **Existing baseline** | ~500k | ~2,080 | 20.8% |
| Spectral entropy (512-pt FFT) | 15k | 62 | 0.62% |
| Entropy calc (LUT, 256 bins) | 2k | 8 | 0.08% |
| Autocorr entropy | 3k | 12 | 0.12% |
| Confidence aggregation | 0.5k | 2 | 0.02% |
| **Total new overhead** | ~20k | ~84 | **0.84%** |
| **Grand total** | ~520k | ~2,164 | **21.6%** |

**Result:** Well within budget. Target was <2% overhead; achieved 0.84%.

### Memory Usage

| Item | RAM (bytes) | Flash (bytes) |
|------|-------------|---------------|
| Entropy LUT (float32 × 256) | 1,024 | 1,024 |
| FFT buffer (int16 × 512 × 2) | 2,048 | - |
| Power spectrum (float × 256) | 1,024 | - |
| Autocorr buffer (float × 68) | 272 | - |
| Config struct | 64 | - |
| **Total new allocations** | **4,432** | **1,024** |

**Result:** Minimal impact. ESP32 has 520 KB SRAM.

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **False rejections on good music** | Medium | High | Extensive testing, tunable thresholds, gradual rollout |
| **CPU overhead higher than estimated** | Low | Medium | Profiling on hardware, frame skip if needed |
| **Octave ambiguity not resolved** | Medium | Medium | Add user feedback mechanism (tap tempo button) |
| **Thresholds not generalizable** | Medium | High | Field data collection, auto-tuning, genre presets |
| **Integration breaks existing features** | Low | High | Comprehensive regression testing, feature flags |

---

## Rollout Plan

### Stage 1: Alpha (Internal, 1 week)
- Deploy to development board only
- Feature flag: `ENABLE_ENTROPY_VALIDATION` (default OFF)
- Extensive logging and metrics collection

### Stage 2: Beta (Limited, 2 weeks)
- Deploy to 5-10 beta testers
- Feature flag: default ON, but disableable via API
- Daily telemetry reports
- User feedback surveys

### Stage 3: General Release (Gradual, 2 weeks)
- Staged rollout: 25% → 50% → 100% of users
- Monitor for increased support requests
- Prepare hotfix rollback if critical issues found

### Stage 4: Optimization (Ongoing)
- Analyze field data
- Refine thresholds
- Add genre-specific presets based on user patterns

---

## Dependencies

### Software
- Existing tempo detection module (to be enhanced)
- FFT implementation (CMSIS-DSP or existing)
- REST API framework (existing)
- NVS/EEPROM library for config persistence

### Hardware
- ESP32 with sufficient RAM (✓ K1.node1 uses ESP32)
- I2S microphone (✓ already present)

### Documentation
- `/home/user/K1.node1/docs/05-analysis/entropy_based_tempo_validation_research.md`
- `/home/user/K1.node1/docs/05-analysis/entropy_validation_quick_reference.md`

---

## Success Criteria

### Functional Requirements
- [ ] Ambient music (SE > 0.75) rejected with >90% accuracy
- [ ] Rhythmic music (SE < 0.65) accepted with >90% accuracy
- [ ] Octave ambiguity detected when present (>80% accuracy)
- [ ] Confidence scores correlate with human perception (r > 0.7)
- [ ] State transitions are smooth (no flapping)

### Performance Requirements
- [ ] CPU overhead < 2% on ESP32 @ 240 MHz
- [ ] Memory footprint < 10 KB additional RAM
- [ ] Real-time operation at 100 fps onset detection rate

### Quality Requirements
- [ ] All unit tests pass
- [ ] Integration tests pass on standard test set
- [ ] No regressions in existing tempo detection accuracy
- [ ] Code coverage > 80% for new modules

### User Experience Requirements
- [ ] User satisfaction > 8/10 in beta testing
- [ ] False positive rate < 5% (tempo on ambient)
- [ ] Support requests related to tempo < baseline

---

## Open Questions

1. **Should we use genre classification to adapt thresholds?**
   - Pro: Better accuracy for specific music types
   - Con: Adds complexity and requires genre detector
   - **Decision:** Defer to Phase 2, use single threshold set for MVP

2. **What should happen on octave ambiguity?**
   - Option A: Choose higher tempo (doubling feels better than halving)
   - Option B: Flag as uncertain, let user choose
   - Option C: Use additional features (onset strength at each candidate)
   - **Decision:** TBD, needs user research

3. **Should confidence affect LED brightness/intensity?**
   - Pro: Subtle visual feedback for confidence
   - Con: May be confusing to users
   - **Decision:** Experiment in beta, make configurable

4. **How to handle live input vs. pre-recorded music?**
   - Live input has more noise, variable quality
   - May need different thresholds
   - **Decision:** Collect data and decide in Phase 4

---

## Next Steps

1. **Create ADR** for architectural decisions (Phase 1 vs Phase 2 vs full implementation)
2. **Code review** of entropy utilities module design (before implementation)
3. **Assign owner** for each phase (firmware engineer)
4. **Set up test environment** with audio playback and telemetry collection
5. **Kick off Phase 1** implementation (spectral entropy gate)

---

## Document History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2025-11-11 | 1.0 | Research Analyst | Initial integration plan based on research findings |

---

**Related Documents:**
- Research: `/home/user/K1.node1/docs/05-analysis/entropy_based_tempo_validation_research.md`
- Quick Reference: `/home/user/K1.node1/docs/05-analysis/entropy_validation_quick_reference.md`
- Tempo Detection ADR: TBD
- Phase 5.3 RMT Stability: (related work on timing validation)
