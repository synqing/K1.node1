---
Title: K1.node1 Firmware Subsystem Architecture Diagram
Date: 2025-11-07
Status: draft
Related: docs/05-analysis/K1NAnalysis_REVIEW_FIRMWARE_ARCHITECTURE_v1.0_20251108.md
Tags: architecture, embedded, subsystems, data-flow
---

# Firmware Subsystem Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        K1.node1 FIRMWARE ARCHITECTURE                   │
│                          ESP32-S3 Dual-Core System                      │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                           CORE 0 (PRO_CPU)                              │
│                        GPU Task - Rendering Pipeline                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌────────────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│  │  Pattern       │───→│   Pattern    │───→│  CRGBF LED Buffer    │   │
│  │  Registry      │    │   Rendering  │    │  (180 LEDs × 12B)    │   │
│  │  (draw funcs)  │    │   Loop       │    │  leds[]              │   │
│  └────────────────┘    └──────────────┘    └──────────┬───────────┘   │
│                                                        │               │
│  ┌────────────────┐                                   ▼               │
│  │  Audio         │    ┌──────────────┐    ┌──────────────────────┐   │
│  │  Snapshot      │◄───│  PATTERN     │    │  Color Quantizer     │   │
│  │  (read-only)   │    │  AUDIO API   │    │  (CRGBF → 8-bit)     │   │
│  │  audio_front   │    │  (macros)    │    │  + Dithering         │   │
│  └────────────────┘    └──────────────┘    └──────────┬───────────┘   │
│         ▲                                              │               │
│         │ Lock-free read (sequence counter)           ▼               │
│         │                               ┌──────────────────────┐      │
│         │                               │  RMT LED Driver      │      │
│         │                               │  raw_led_data[]      │      │
│         │                               │  (540 bytes)         │      │
│         │                               └──────────┬───────────┘      │
│         │                                          │                  │
│         │                                          ▼                  │
│         │                               ┌──────────────────────┐      │
│         │                               │  ⚠️  STUBBED!  ⚠️    │      │
│         │                               │  transmit_leds()     │      │
│         │                               │  (RMT v4 TODO)       │      │
│         │                               └──────────┬───────────┘      │
│         │                                          │                  │
│         │                                          ▼                  │
│         │                               ┌──────────────────────┐      │
│         │                               │   GPIO 5 (WS2812B)   │      │
│  Priority: 1 ⚠️                          │   LED Data Output    │      │
│  Stack: 16KB ✅                           └──────────────────────┘      │
│  FPS: 200+ ✅                                                          │
└─────────────────────────────────────────────────────────────────────────┘

        ▲ Lock-free audio snapshot copy (sequence counters)
        │
        │
        ▼

┌─────────────────────────────────────────────────────────────────────────┐
│                          CORE 1 (APP_CPU)                               │
│                   Audio Task + Main Loop (Network)                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │                    AUDIO PROCESSING TASK                     │      │
│  │  ┌────────────────┐    ┌──────────────┐    ┌────────────┐   │      │
│  │  │  I2S Mic       │───→│  Goertzel    │───→│  Tempo     │   │      │
│  │  │  SPH0645       │    │  DFT (64bins)│    │  Detection │   │      │
│  │  │  16kHz         │    │  15-25ms     │    │  (64 bins) │   │      │
│  │  │  acquire_      │    │  calculate_  │    │  update_   │   │      │
│  │  │  sample_chunk()│    │  magnitudes()│    │  tempo()   │   │      │
│  │  └────────────────┘    └──────────────┘    └────────────┘   │      │
│  │          │                      │                  │         │      │
│  │          ▼                      ▼                  ▼         │      │
│  │  ┌────────────────────────────────────────────────────┐     │      │
│  │  │        Audio Back Buffer (AudioDataSnapshot)       │     │      │
│  │  │  • spectrogram[64] (frequency bins)                │     │      │
│  │  │  • chromagram[12] (musical notes)                  │     │      │
│  │  │  • tempo_magnitude[64] + tempo_phase[64]           │     │      │
│  │  │  • vu_level, tempo_confidence, novelty             │     │      │
│  │  │  • sequence counter (torn read detection)          │     │      │
│  │  │  Total: 1876 bytes                                 │     │      │
│  │  └────────────────────┬───────────────────────────────┘     │      │
│  │                       │                                     │      │
│  │                       ▼                                     │      │
│  │           ┌───────────────────────────┐                    │      │
│  │           │  commit_audio_data()      │                    │      │
│  │           │  (atomic swap)            │                    │      │
│  │           │  audio_back → audio_front │                    │      │
│  │           └───────────────────────────┘                    │      │
│  │                                                             │      │
│  │  Rate: ~50 Hz (target: 100 Hz)                             │      │
│  │  Priority: 1 ⚠️                                             │      │
│  │  Stack: 12KB (margin: 1.7KB ⚠️)                            │      │
│  └─────────────────────────────────────────────────────────────┘      │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │                      MAIN LOOP (Core 1)                      │     │
│  │  ┌────────────┐  ┌──────────┐  ┌────────────┐  ┌─────────┐  │     │
│  │  │  WiFi      │  │  OTA     │  │  WebServer │  │  Beat   │  │     │
│  │  │  Monitor   │  │  Update  │  │  + WS      │  │  Events │  │     │
│  │  │  (state    │  │  Handler │  │  Cleanup   │  │  Drain  │  │     │
│  │  │  machine)  │  │          │  │            │  │         │  │     │
│  │  └────────────┘  └──────────┘  └────────────┘  └─────────┘  │     │
│  │                                                              │     │
│  │  ⚠️  Overloaded: Network blocking can affect audio cadence  │     │
│  │  Recommendation: Separate network_task (priority 0)         │     │
│  └──────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         SHARED SUBSYSTEMS                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────┐     ┌───────────────────────┐                │
│  │  Parameter System    │     │  Beat Event Buffer    │                │
│  │  (Double-Buffered)   │     │  (Ring Buffer)        │                │
│  ├──────────────────────┤     ├───────────────────────┤                │
│  │ • g_params_buffers[] │     │ • BeatEvent[53]       │                │
│  │ • Atomic swap        │     │ • Lock-free push/pop  │                │
│  │ • Validation/clamp   │     │ • 10s history @ 5Hz   │                │
│  │ • Web API updates    │     │ • Latency probes      │                │
│  └──────────────────────┘     └───────────────────────┘                │
│                                                                         │
│  ┌──────────────────────┐     ┌───────────────────────┐                │
│  │  LED TX Events       │     │  CPU Monitor          │                │
│  │  (Rolling Buffer)    │     │  (Core 0 + Core 1)    │                │
│  ├──────────────────────┤     ├───────────────────────┤                │
│  │ • TX timestamps      │     │ • FPS tracking        │                │
│  │ • 256 event capacity │     │ • Stack monitoring    │                │
│  │ • 5-10s history      │     │ • Profiling counters  │                │
│  └──────────────────────┘     └───────────────────────┘                │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                      HARDWARE PERIPHERALS                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  I2S (Microphone)          RMT (LEDs)               NVS (Config)       │
│  ┌──────────────┐          ┌──────────────┐        ┌──────────────┐   │
│  │ SPH0645      │          │ ⚠️ STUBBED!  │        │ WiFi config  │   │
│  │ GPIO 12,13,14│          │ GPIO 5       │        │ Params       │   │
│  │ 16kHz stereo │          │ WS2812B      │        │ Palettes     │   │
│  │ I2S DMA      │          │ 180 LEDs     │        │              │   │
│  └──────────────┘          └──────────────┘        └──────────────┘   │
│                                                                         │
│  WiFi (Network)            UART (Daisy Chain)       SPIFFS (Assets)    │
│  ┌──────────────┐          ┌──────────────┐        ┌──────────────┐   │
│  │ 802.11 b/g   │          │ GPIO 37,38   │        │ Web UI files │   │
│  │ WebServer    │          │ 115200 baud  │        │ Config JSON  │   │
│  │ WebSockets   │          │ s3z sync     │        │              │   │
│  │ OTA updates  │          │ (optional)   │        │              │   │
│  └──────────────┘          └──────────────┘        └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Audio → Rendering

### Lock-Free Synchronization Pipeline

```
CORE 1 (Producer)                    CORE 0 (Consumer)
─────────────────                    ─────────────────

1. I2S DMA → sample_history[]
   (128 samples @ 16kHz)
        │
        ▼
2. Goertzel DFT
   (15-25ms per frame)
   → spectrogram[64]
   → chromagram[12]
        │
        ▼
3. Beat Detection
   → tempo_magnitude[64]
   → tempo_phase[64]
   → tempo_confidence
        │
        ▼
4. WRITE TO BACK BUFFER
   ┌──────────────────────────┐
   │ audio_back.sequence++    │ (mark dirty)
   │ ... copy all fields ...  │
   │ audio_back.sequence++    │ (mark clean)
   └────────────┬─────────────┘
                │
                ▼
5. commit_audio_data()
   ATOMIC SWAP
   ┌──────────────────────────┐
   │ Swap audio_back ↔        │
   │      audio_front         │
   │ (sequence counters)      │
   └────────────┬─────────────┘
                │
                │ Lock-free read
                │ (retry on torn read)
                │
                ▼
        1. READ FROM FRONT BUFFER
           ┌──────────────────────────┐
           │ seq1 = audio_front.seq   │
           │ memcpy(snapshot, front)  │
           │ seq2 = audio_front.seq   │
           │ if (seq1 != seq2) retry  │
           └────────────┬─────────────┘
                        │
                        ▼
                2. PATTERN RENDERING
                   ┌──────────────────────────┐
                   │ PATTERN_AUDIO_START()    │
                   │ bass = AUDIO_BASS()      │
                   │ leds[i] = CRGBF(bass...) │
                   └────────────┬─────────────┘
                                │
                                ▼
                        3. COLOR QUANTIZATION
                           ┌──────────────────────────┐
                           │ quantize_color()         │
                           │ CRGBF → 8-bit RGB        │
                           │ (with dithering)         │
                           └────────────┬─────────────┘
                                        │
                                        ▼
                                4. RMT TRANSMISSION
                                   ┌──────────────────────────┐
                                   │ ⚠️ STUBBED OUT ⚠️        │
                                   │ transmit_leds()          │
                                   │ (RMT v4 TODO)            │
                                   └──────────────────────────┘
```

**Key:** No mutexes on critical path - sequence counters enable optimistic lock-free reads.

---

## Synchronization Primitive Map

```
Primitive                    Location                    Purpose
──────────────────────────   ─────────────────────────   ───────────────────────
std::atomic<uint32_t>        AudioDataSnapshot.sequence  Torn read detection
__sync_synchronize()         get_audio_snapshot()        Memory barriers (ESP32-S3)
portENTER_CRITICAL()         main.cpp (tempo sync)       ⚠️ REDUNDANT - spinlock
SemaphoreHandle_t            audio_swap_mutex            ⚠️ UNUSED - legacy?
SemaphoreHandle_t            audio_read_mutex            ⚠️ UNUSED - legacy?
std::atomic<uint8_t>         g_active_buffer             Param double-buffer swap
std::atomic<bool>            magnitudes_locked           Goertzel state flag
std::atomic<bool>            waveform_locked             I2S sync flag
```

**Issues:**
1. Redundant spinlocks in `audio_task` (sequence counters already provide sync)
2. Unused mutexes allocated but never locked (`audio_swap_mutex`, `audio_read_mutex`)
3. Over-use of `__sync_synchronize()` (acquire/release semantics would suffice)

**Recommendations:** See `/docs/05-analysis/K1NAnalysis_REVIEW_FIRMWARE_ARCHITECTURE_v1.0_20251108.md` §6

---

## Subsystem Dependencies

```
┌───────────────────┐
│  main.cpp         │  Top-level orchestrator
└─────────┬─────────┘
          │
    ┌─────┴────────────────────────────────────────┐
    │                                              │
    ▼                                              ▼
┌────────────────┐                        ┌────────────────┐
│ Pattern        │                        │ Audio          │
│ Registry       │                        │ Processing     │
└────┬───────────┘                        └────┬───────────┘
     │                                         │
     ├─► pattern_audio_interface.h            ├─► goertzel.h
     │   (macros for safe access)             │   (DFT, spectrogram)
     │                                         │
     └─► parameters.h                         ├─► tempo.h
         (validation, double-buffer)          │   (beat detection)
                                              │
                                              ├─► vu.h
                                              │   (audio level)
                                              │
                                              └─► microphone.h
                                                  (I2S input)

┌────────────────┐                        ┌────────────────┐
│ LED Driver     │                        │ Network        │
│ (RMT)          │                        │ Services       │
└────────────────┘                        └────────────────┘
     │                                         │
     ├─► led_driver.h                         ├─► webserver.h
     │   (quantize, transmit)                 │   (REST, WebSocket)
     │                                         │
     └─► profiler.h                           ├─► wifi_monitor.h
         (timing counters)                    │   (state machine)
                                              │
                                              └─► connection_state.h
                                                  (callbacks)
```

**Coupling Analysis:**
- ✅ Minimal circular dependencies (`goertzel.h ↔ tempo.h` share constants)
- ✅ Clean layer separation (application → service → hardware)
- ⚠️ Global `leds[]` buffer exposed (consider accessor function)

---

## Error Propagation Paths

```
Subsystem Error                  Detection                 Recovery
──────────────────               ─────────────────         ─────────────────
Task creation failure            xTaskCreatePinnedToCore   esp_restart() (FATAL)
I2S timeout                      ⚠️ MISSING (blocks       ⚠️ TODO: timeout + silence
                                  forever on portMAX_DELAY)
RMT transmission error           ⚠️ STUBBED               N/A (driver incomplete)
WiFi disconnect                  Connection callback       Auto-reconnect (state machine)
Audio snapshot timeout           Mutex timeout (1ms)       ⚠️ Silent failure (no log)
Parameter validation             NaN/Inf check             Clamp to safe defaults
WebSocket overflow               Client count limit        Drop new connections
Beat event buffer overwrite      Capacity check            LOG_WARN, continue
Stack overflow                   Watchdog timer            ⚠️ REACTIVE (reboot after crash)
```

**Critical Gaps:**
1. I2S has no timeout - audio task hangs on microphone fault
2. Audio snapshot failure not logged - patterns may read stale data
3. Stack overflow detection is reactive (watchdog crash) not proactive

**Recommendations:** See `/docs/05-analysis/K1NAnalysis_REVIEW_FIRMWARE_ARCHITECTURE_v1.0_20251108.md` §5

---

## Performance Characteristics

| Metric | Measured | Target | Status |
|--------|----------|--------|--------|
| Render FPS (Core 0) | 200+ | >100 | ✅ PASS |
| Audio Rate (Core 1) | ~50 Hz | ~100 Hz | ⚠️ ACCEPTABLE |
| Audio Latency | <20ms | <20ms | ✅ PASS |
| Goertzel DFT | 15-25ms | <10ms | ⚠️ SLOW (acceptable) |
| Pattern Switch | 96% success | >95% | ✅ PASS |
| Memory Leak | <1KB/10min | 0 | ✅ PASS |
| GPU Stack Margin | 4.3KB | >2KB | ✅ PASS |
| Audio Stack Margin | 1.7KB | >2KB | ⚠️ MARGINAL |

**Source:** Test suite results (`test_fix5_dual_core.cpp`, `test_hardware_stress.cpp`)

---

## References

- **Full Analysis:** `/docs/05-analysis/K1NAnalysis_REVIEW_FIRMWARE_ARCHITECTURE_v1.0_20251108.md`
- **Executive Summary:** `/docs/09-reports/K1NReport_SUMMARY_ARCHITECTURE_REVIEW_v1.0_20251108.md`
- **Test Suites:** `/firmware/test/test_fix5_dual_core/` (and 9 others)
- **Git History:** Recent commits `4f111af`, `e4299ee`, `dd186d8` (watchdog fixes)

---

**Diagram Version:** 1.0
**Last Updated:** 2025-11-07
**Maintainer:** Architecture Team
