# K1.node1 Audio Pipeline Architecture Documentation

Complete analysis of the audio pipeline from microphone to LED output, with emphasis on timing, synchronization, and thread safety.

## Quick Navigation

### For Fast Orientation (5 minutes)
Start here: **[K1N_AUDIO_PIPELINE_QUICK_REFERENCE_20251114.txt](../07-resources/K1N_AUDIO_PIPELINE_QUICK_REFERENCE_20251114.txt)**
- File locations with line numbers
- Key constants and architecture overview
- Synchronization strategy summary
- Known limitations and next steps

### For Visual Understanding (10 minutes)
Then read: **[K1N_AUDIO_PIPELINE_FLOW_DIAGRAM_20251114.txt](K1N_AUDIO_PIPELINE_FLOW_DIAGRAM_20251114.txt)**
- Complete data flow diagram (ASCII)
- Timing timeline (T=0ms to T=45ms per frame)
- Synchronization guarantees
- Key invariants maintained

### For Complete Technical Reference
Deep dive: **[K1N_AUDIO_PIPELINE_COMPLETE_MAP_20251114.md](K1N_AUDIO_PIPELINE_COMPLETE_MAP_20251114.md)**
- All 10 requested architectural areas
- Code snippets with line-by-line annotations
- Data structures and enums
- Latency analysis and profiling recommendations

---

## What You'll Learn

### Architecture Overview
- Dual-core processing: Core 0 (audio @ ~100 Hz) + Core 1 (rendering @ ~100+ FPS)
- Lock-free synchronization using atomic sequence counters
- Zero-blocking render path (Core 1 never waits on Core 0)

### Audio Pipeline Stages
1. **Microphone Capture** (SPH0645, I2S, 16 kHz)
2. **I2S Buffering** (8ms chunks, CHUNK_SIZE=128)
3. **Ring Buffer** (sample_history[4096], 256ms history)
4. **Goertzel FFT** (64 musical frequency bins)
5. **Tempo Detection** (64 BPM hypotheses, novelty-based)
6. **Double-Buffering** (audio_back ↔ audio_front)
7. **Pattern Interface** (Thread-safe macros)
8. **LED Rendering** (RMT DMA transmission)

### Key Numbers
- **Latency**: 40-50ms one-way (mic → LED)
- **Frequency Bins**: 64 (55 Hz to 622 Hz)
- **Tempo Bins**: 64 (32-192 BPM)
- **Novelty History**: 1024 samples @ 50 Hz (20.48s)
- **Memory Barriers**: __sync_synchronize() (1-2µs overhead)

### Thread Safety
- **Synchronization Method**: Atomic sequence counters (even=valid, odd=writing)
- **Memory Barriers**: ESP32-S3 cache coherency via __sync_synchronize()
- **Retry Mechanism**: get_audio_snapshot() with max 1000 retries
- **Spinlock**: Only for tempo array copy (microseconds)

---

## File References

### Primary Source Files
| File | Lines | Purpose |
|------|-------|---------|
| `firmware/src/main.cpp` | 240-449 | audio_task() entry point |
| `firmware/src/audio/microphone.cpp` | 113-252 | I2S acquisition |
| `firmware/src/audio/goertzel.cpp` | 403-591 | Goertzel FFT computation |
| `firmware/src/audio/tempo.cpp` | 276-297 | Tempo detection interlacing |
| `firmware/src/audio/goertzel.cpp` | 184-222 | Lock-free buffer sync |
| `firmware/src/pattern_audio_interface.h` | 79-89 | PATTERN_AUDIO_START macro |

### Documentation Files
| Document | Size | Purpose |
|----------|------|---------|
| K1N_AUDIO_PIPELINE_COMPLETE_MAP_20251114.md | 34 KB | Complete technical reference |
| K1N_AUDIO_PIPELINE_FLOW_DIAGRAM_20251114.txt | 18 KB | Visual data flow diagram |
| K1N_AUDIO_PIPELINE_QUICK_REFERENCE_20251114.txt | 6.2 KB | Fast lookup reference |

---

## Key Sections in Complete Map

### 1. Entry Point (main.cpp:240-449)
```
audio_task() on Core 0 @ ~100 Hz
├─ acquire_sample_chunk() [I2S blocking]
├─ calculate_magnitudes() [Goertzel FFT, 15-25ms]
├─ get_chromagram() [Pitch aggregation, ~1ms]
├─ update_novelty() [Spectral flux, ~1ms]
├─ update_tempo() [Tempo Goertzel, 5-10ms interlaced]
├─ update_tempi_phase() [Beat phase, ~1ms]
├─ Beat detection [Phase-locked or confidence-gated]
└─ finish_audio_frame() [Buffer swap, ~1ms]
```

### 2. I2S Microphone (microphone.cpp)
- **Hardware**: SPH0645 microphone, I2S standard (NOT PDM)
- **Pins**: BCLK=GPIO14, LRCLK=GPIO12, DIN=GPIO13
- **Config**: 16 kHz sample rate, 128 samples per chunk (8ms)
- **Timeout**: 100ms max, fallback to silence on error
- **Buffer**: sample_history[4096] ring buffer (256ms @ 16kHz)

### 3. FFT Computation (goertzel.cpp:403-591)
- **Algorithm**: Goertzel constant-Q transform
- **Bins**: 64 musical scale frequencies
- **Block Sizes**: Variable per frequency (bandwidth-dependent)
- **Smoothing**: 6-sample moving average
- **Auto-ranging**: Normalized to loudest bin (0.0-1.0)
- **VU Level**: Frequency-weighted average with bass_treble_balance

### 4. Tempo Detection (tempo.cpp:276-297)
- **Input**: Novelty curve (spectral flux history)
- **Method**: Goertzel analysis on novelty curve
- **Range**: 32-192 BPM (64 tempo bins)
- **Interlacing**: 2 bins per frame (32 frames full cycle)
- **Phase Tracking**: sin(phase) for beat oscillation (-π to +π)

### 5. Synchronization (goertzel.cpp:127-222)
- **Method**: Lock-free double-buffering with atomic sequence counter
- **Write Path**: Core 0 updates audio_back, commits via memcpy + sequence
- **Read Path**: Core 1 reads from audio_front with retry loop (max 1000)
- **Memory Barriers**: __sync_synchronize() ensures cache coherency
- **Invariant**: sequence even = valid, odd = writing in progress

### 6. Pattern Interface (pattern_audio_interface.h)
- **Macro**: PATTERN_AUDIO_START() creates local snapshot
- **Accessors**: AUDIO_SPECTRUM[i], AUDIO_TEMPO_PHASE(bin), AUDIO_BASS(), etc.
- **Queries**: AUDIO_IS_FRESH(), AUDIO_IS_STALE(), AUDIO_AGE_MS()
- **Safety**: No locking required (local snapshot)
- **Performance**: ~0.02ms for snapshot read (negligible)

### 7. Latency Breakdown
| Stage | Duration | Notes |
|-------|----------|-------|
| I2S read | 8ms | CHUNK_SIZE=128 @ 16kHz |
| Goertzel | 15-25ms | CPU-intensive, interlaced |
| Tempo | 5-10ms | Goertzel on novelty, interlaced |
| Other | ~1-2ms | Chromagram, novelty, phase, sync |
| **Total** | **40-50ms** | One-way mic → LED |

---

## Usage Examples

### Basic Spectrum Visualization
```cpp
void draw_spectrum(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();
    if (!AUDIO_IS_FRESH()) return;
    
    for (int i = 0; i < NUM_LEDS; i++) {
        float mag = AUDIO_SPECTRUM[i % NUM_FREQS];
        leds[i] = hsv(i * 5, 1.0, mag);
    }
}
```

### Bass-Reactive Effect
```cpp
void draw_bass_reactive(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();
    float bass = AUDIO_BASS();
    
    if (AUDIO_IS_STALE()) {
        bass *= 0.95f;  // Fade on silence
    }
    
    fill_solid(leds, NUM_LEDS, CRGBF(bass, bass * 0.5, 0));
}
```

### Beat-Synchronized Animation
```cpp
void draw_beat_sync(float time, const PatternParameters& params) {
    PATTERN_AUDIO_START();
    float beat = AUDIO_TEMPO_BEAT(32);  // Strongest tempo bin
    float brightness = 0.5 + 0.5 * beat;
    fill_solid(leds, NUM_LEDS, CRGBF(brightness, brightness, brightness));
}
```

---

## Performance Characteristics

### Timing Budget
- **Core 0**: 40-50ms per cycle (50-100 Hz effective)
- **Core 1**: <1ms per cycle (100+ FPS)
- **Synchronization Overhead**: <0.5ms per frame
- **No blocking**: Render never waits on audio

### Memory Usage
- **sample_history**: 16 KB (4096 × float32)
- **AudioDataSnapshot**: ~1.3 KB
- **Spectrogram arrays**: ~3 KB (64 bins × 3 + 12 chromagram)
- **Tempo state**: ~3 KB (64 tempo structs)
- **Total**: ~30 KB for audio subsystem

### CPU Load
- **Goertzel (hot path)**: 15-25ms @ 100 Hz = ~150-250ms per second
- **Other audio processing**: ~10-20ms @ 100 Hz = ~100-200ms per second
- **Synchronization**: <1ms @ 100 Hz = <10ms per second
- **Total**: ~25-50% CPU on Core 0 (varies with pattern complexity)

---

## Known Limitations

1. **Latency**: 40-50ms one-way (cannot be reduced below I2S block time)
2. **No Hard Real-Time**: FreeRTOS is not hard-RT (preemption possible)
3. **Audio Jitter**: ±5-10ms typical (depends on pattern load)
4. **Wifi Interference**: OTA updates cause temporary stalls
5. **256ms History**: Limits onset detection window for novelty

---

## Next Steps for Developers

### For Understanding
1. Read Quick Reference (5 min)
2. Study Flow Diagram (10 min)
3. Review Complete Map (30 min)

### For Implementation
1. Copy pattern example from this doc
2. Use PATTERN_AUDIO_START() macro
3. Access audio via provided macros
4. No synchronization code needed

### For Optimization
1. Profile Goertzel cost per bin
2. Measure Core 0 ↔ Core 1 sync overhead
3. Test sequence counter retry rates
4. Benchmark different interlacing schemes

### For Debugging
1. Check AUDIO_AGE_MS() for latency issues
2. Use AUDIO_IS_STALE() to detect silence
3. Monitor AUDIO_VU for microphone connectivity
4. Query tempo_confidence for beat detection reliability

---

## Related Documentation

- `docs/01-architecture/` - System design and component interaction
- `docs/02-adr/` - Architecture Decision Records (IDF selection, sync strategy, etc.)
- `docs/08-governance/` - Standards and conventions

---

**Last Updated**: November 14, 2025
**Analysis Date**: November 14, 2025
**Firmware Version**: K1.reinvented (Phase 3+)
