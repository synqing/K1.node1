# Audio System Architecture - Executive Summary

**Date**: 2025-11-07
**Status**: Review Complete
**Overall Score**: 7.4/10 - GOOD with room for improvement

---

## TL;DR

✅ **System is well-architected** - Lock-free synchronization is correct, Goertzel is the right choice
⚠️ **Tempo disabled** due to poor signal quality (13-17% confidence vs 60-90% expected)
✅ **Phase 0 recommended** - Fix signal quality, add telemetry, gradual rollout
⚠️ **CPU over budget** - 15-25ms per frame vs 10ms target (needs staggering)

---

## Quick Assessment

| Aspect | Score | Status |
|--------|-------|--------|
| Algorithm Choice (Goertzel) | 9/10 | ✅ Optimal for musical patterns |
| Thread Safety (Seqlock) | 9/10 | ✅ Lock-free, correct |
| Separation of Concerns | 8/10 | ✅ Clean layers |
| Extensibility | 7/10 | ⚠️ Easy to add features, CPU tight |
| Observability | 5/10 | ❌ Limited telemetry |
| Documentation | 6/10 | ⚠️ Code comments good, arch docs missing |
| Performance | 6/10 | ⚠️ Over budget, high jitter |

---

## Key Findings

### ✅ Strengths

1. **Lock-Free Synchronization**: Seqlock pattern correctly prevents data races
2. **Goertzel vs FFT**: Correct choice - musical spacing beats linear bins
3. **Double Buffering**: 1,328 byte snapshot copied atomically in ~5µs
4. **Clean Boundaries**: I2S → Goertzel → Tempo → Patterns (no circular deps)
5. **Extensible**: Adding features takes 30-60 minutes (simple cases)

### ⚠️ Issues

1. **Tempo Disabled**: Confidence oscillates 13-17% (random walk)
   - **Cause**: Novelty curve has poor SNR (~3dB vs >10dB needed)
   - **Fix**: High-pass filter + faster adaptation + hysteresis

2. **CPU Overload**: 15-25ms per frame (53% over 10ms budget)
   - **Cause**: Goertzel computes all 64 bins every frame
   - **Fix**: Bin interleaving (16 bins/frame = 75% reduction)

3. **I2S Freezing** (Historical, RESOLVED)
   - **Cause**: RMT ISR preempted I2S ISR on Core 1
   - **Fix**: Migrated to I2S v4 API (commit 0cc83c8)

4. **Limited Observability**: No health monitoring
   - **Fix**: Add `/api/audio/telemetry` REST endpoint

---

## Phase 0 Recommendations

### GO Decision: ✅ YES (with conditions)

**Timeline**: 5-7 days
**Risk**: 🟡 MEDIUM (tempo flickering possible, mitigated by gating)

### Week 1: Signal Quality (2-3 days)
- [ ] Add high-pass filter to novelty curve (30 Hz cutoff)
- [ ] Increase normalization adaptation (5% → 15%)
- [ ] Add silence detection gating
- [ ] Validate SNR improvement (target >10dB)

### Week 1: Observability (1-2 days)
- [ ] Add `/api/audio/novelty` endpoint
- [ ] Add `/api/audio/tempo` endpoint
- [ ] Add retry histogram telemetry
- [ ] Create tempo debug overlay (webapp)

### Week 2: Gradual Enablement (1-2 days)
- [ ] Populate tempo_magnitude/tempo_phase in AudioDataSnapshot
- [ ] Re-enable AUDIO_TEMPO_* macros
- [ ] Add confidence gating (threshold = 0.6)
- [ ] Add hysteresis (require 3 consecutive frames)

### Week 2: Validation (1-2 days)
- [ ] Test with known BPM tracks (120, 140, 180 BPM)
- [ ] Measure confidence distribution
- [ ] Stress test: Dual RMT + I2S + WiFi
- [ ] Document rollback procedure

---

## Phase 1-3 Readiness

### Phase 1: HPSS (Harmonic-Percussive Separation)
- **Status**: ✅ READY (no architectural changes needed)
- **Memory**: +5.6KB (acceptable)
- **CPU**: +2-3ms (requires staggering)
- **Risk**: 🟢 LOW

### Phase 2: Staggered Processing
- **Status**: ✅ REQUIRED for Phase 1+
- **Approach**: Bin interleaving (64 → 16 bins/frame)
- **Benefit**: 75% Goertzel CPU reduction
- **Risk**: 🟡 MEDIUM (visual artifacts possible)

### Phase 3: FFT + Emotion + Spectral
- **Status**: ⚠️ NEEDS PLANNING
- **Memory**: +1.1KB (acceptable)
- **CPU**: +15-30ms (tight, may need coprocessor)
- **Risk**: 🟠 HIGH

---

## Architecture Diagrams

### Current Data Flow
```
I2S (16kHz) → sample_history[4096] → Goertzel → spectrogram[64]
                                              ↓
                                          chromagram[12]
                                              ↓
                                          novelty_curve[1024]
                                              ↓
                                          tempo[64] (disabled)
                                              ↓
                                          audio_back (Core 1)
                                              ↓ commit_audio_data()
                                          audio_front (Core 0)
                                              ↓ get_audio_snapshot()
                                          Patterns → leds[]
```

### Synchronization (Lock-Free Seqlock)
```
Writer (Core 1):                  Reader (Core 0):
1. seq++  (mark dirty)            1. seq1 = read sequence
2. memcpy to audio_front          2. memcpy from audio_front
3. seq++  (mark clean)            3. seq2 = read sequence
                                  4. if seq1 != seq2: retry
                                     if seq1 odd: retry
                                  5. use snapshot
```

---

## Risk Matrix

| Risk | Likelihood | Impact | Severity |
|------|------------|--------|----------|
| Tempo flickering | HIGH | Medium | 🟡 MEDIUM |
| CPU overload | MEDIUM | High | 🟡 MEDIUM |
| Audio freeze recurrence | LOW | Critical | 🟢 LOW |
| Sync corruption | VERY LOW | High | 🟢 LOW |

**Mitigations**:
- Tempo: Hysteresis + confidence gating
- CPU: Staggered processing (Phase 2)
- Freeze: I2S v4 migration complete
- Sync: Seqlock proven robust

---

## Rollback Strategy

### Emergency Disable
```bash
# Serial console
> disable tempo

# REST API
POST /api/audio/features
{"tempo_enabled": false}
```

### Failure Detection
- Tempo flickering: Confidence oscillates >10 Hz
- CPU overload: Frame time >50ms
- Audio freeze: AUDIO_IS_STALE() true >1 sec

---

## Key Metrics

### Current Performance
- Audio processing: 15-25ms per frame (target: 10ms)
- Jitter: ±3.1ms (high)
- Memory: ~50KB (10% of 512KB SRAM)
- Tempo confidence: 13-17% (broken, target: 60-90%)

### Phase 0 Targets
- Tempo confidence: >60% on-beat
- Novelty SNR: >10dB
- Sync retry rate: <1%
- CPU time: <10ms average

### Phase 1-2 Targets
- CPU time: <8ms average (staggering)
- HPSS separation quality: >15dB
- Feature latency: <40ms (acceptable for visuals)

---

## Conclusion

**Recommendation**: ✅ **Proceed with Phase 0**

The audio architecture is solid and ready for tempo re-enablement with proper signal quality improvements and observability. The system is well-positioned for Phases 1-3 enhancements with minimal refactoring.

**Primary Concerns**:
1. Fix novelty signal quality (high-pass + adaptation)
2. Add telemetry (REST API + debug UI)
3. Implement staggered processing (Phase 2 prerequisite)

**Expected Outcome**: Reliable beat detection with 60-90% confidence on musical content, graceful degradation on silence, zero breaking changes to existing patterns.

---

**For detailed analysis, see**: `/docs/05-analysis/K1NAnalysis_REVIEW_AUDIO_SYSTEM_ARCHITECTURAL_v1.0_20251108.md`
