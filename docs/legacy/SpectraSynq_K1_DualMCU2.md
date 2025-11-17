# Architecture & Data-Flow Blueprint for SpectraSynq / K1-Lightwave Dual-MCU Real-Time Audio→Visual System

> Note: This document has been split into a structured documentation set under `docs/`. See:
> - `docs/README.md` (index)
> - `docs/architecture.md`, `docs/spi_protocol.md`, `docs/audio_pipeline.md`, `docs/visual_pipeline.md`, `docs/real_time.md`, `docs/resources_throughput.md`, `docs/error_robustness.md`, `docs/maintainability.md`, `docs/scalability.md`, `docs/telemetry_ops.md`, `docs/deliverables.md`, `docs/references.md`, `docs/appendix_examples.md`.

## 0. Mission Context

This document presents the foundational architecture for SpectraSynq's core product line (K1-Lightwave): a real-time audio-reactive visual system built initially on dual ESP32-S3 MCUs and designed for scalability to more powerful SoCs (P4, i.MX8, etc.).

### System Requirements
- **Real-time audio capture**: Live audio via PDM MEMS microphone (Infineon IM69D130) and/or digital/I²S sources
- **Low-latency processing**: Robust audio analysis with bounded latency from sound to photon
- **Inter-MCU communication**: Stream compact feature vectors over SPI between audio and render MCUs
- **High-performance rendering**: Drive >300 addressable LEDs at 60-120 FPS with predictable latency
- **Scalable architecture**: Designed as long-term backbone for multiple product generations

### Design Scope
This architecture supports both immediate prototyping on dual ESP32-S3 and provides evolution paths to complex multi-node systems with higher sample rates, richer analysis, and ML integration.

---

## 1. System Decomposition: High-Level Architecture

### Recommended Baseline: Dual-MCU Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SpectraSynq K1-Lightwave                    │
│                                                                 │
│  ┌──────────────┐          ┌──────────────┐                   │
│  │   Audio MCU  │          │  Render MCU  │                   │
│  │   (ESP32-S3) │◄────────►│ (ESP32-S3)   │                   │
│  │              │   SPI    │              │                   │
│  │  ┌────────┐ │          │  ┌────────┐ │                   │
│  │  │  PDM   │ │          │  │  LED   │ │                   │
│  │  │  Mic   │ │          │  │ Driver │ │                   │
│  │  └────────┘ │          │  └────────┘ │                   │
│  │              │          │              │                   │
│  │  ┌────────┐ │          │  ┌────────┐ │                   │
│  │  │  DSP   │ │          │  │  UI/   │ │                   │
│  │  │ Engine │ │          │  │  Ctrl  │ │                   │
│  │  └────────┘ │          │  └────────┘ │                   │
│  └──────────────┘          └──────────────┘                   │
│                                                                 │
│  ┌──────────────┐          ┌──────────────┐                   │
│  │   1.8V       │          │   5V         │                   │
│  │   Mic Power  │          │   LED Power  │                   │
│  └──────────────┘          └──────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

### Architecture Comparison

| Architecture | Pros | Cons | Recommendation |
|-------------|------|------|----------------|
| **Single MCU** | Simple, lower cost, unified memory | CPU contention, timing conflicts, limited headroom | ❌ Not suitable for real-time constraints |
| **Dual MCU (Recommended)** | Clean separation, dedicated resources, scalable, fault isolation | Higher cost, SPI complexity | ✅ **Baseline choice** |
| **Triple MCU** | Ultimate separation, backup audio path | Overkill for initial product, complexity | ❌ Future consideration only |

### Component Responsibilities

#### Audio MCU (MCU-A)
- **Audio Capture**: PDM microphone interface, I²S digital audio inputs
- **Real-time DSP**: PDM→PCM conversion, filtering, spectral analysis
- **Feature Extraction**: Energy, spectral, beat detection, mood analysis
- **SPI Interface**: Slave mode, versioned feature packet transmission
- **Error Handling**: Mic failure detection, signal quality monitoring

#### Render MCU (MCU-B)
- **SPI Master**: Polls audio MCU for feature packets
- **Visual Pipeline**: Feature mapping, effect selection, rendering
- **LED Control**: RMT/DMA-driven LED strip output
- **User Interface**: Encoders, buttons, display (if present)
- **External Comms**: USB/serial, Wi-Fi/Ethernet (future)

#### Inter-MCU Link (SPI)
- **Master-Slave**: Render MCU polls Audio MCU
- **Versioned Protocol**: Extensible packet format with CRC
- **Deterministic Timing**: Fixed cadence per audio frame
- **Error Detection**: Sync words, checksums, timeout handling

---

## 2. Audio Domain: End-to-End Data Flow (MCU-A)

### 2.1 Capture & DSP Front-End

#### Microphone Configuration
- **Primary Mic**: Infineon IM69D130 PDM MEMS
- **Sample Rate**: 16 kHz PCM (initial), 32 kHz (future)
- **PDM Clock**: 1.024 MHz (16 kHz × 64 oversample)
- **SNR**: 69 dB(A), AOP: 130 dB SPL
- **Power Domain**: 1.8V with level shifting to 3.3V MCU

#### Signal Processing Chain
```
PDM Input → Level Shift → ESP32 I2S PDM RX → PCM Buffer → DC Removal → Windowing → FFT/Goertzel → Feature Extraction → SPI Output
```

#### Buffer Management
- **Window Size**: 128-160 samples @ 16 kHz (8-10 ms)
- **Overlap**: 50% for temporal resolution
- **Buffer Count**: Triple buffering for real-time constraints
- **Memory**: 2KB per buffer (128 samples × 16-bit)

#### Real-time Budget (8ms window @ 16 kHz)
- **Total Budget**: 8ms per window
- **PDM→PCM**: 0.5ms (hardware DMA)
- **DC Removal**: 0.2ms (simple high-pass)
- **Windowing**: 0.1ms (Hanning window)
- **FFT Processing**: 1.5ms (64-point FFT)
- **Feature Extraction**: 2.0ms (energy, spectral, beat)
- **SPI Transfer**: 0.5ms (feature packet)
- **Headroom**: 3.2ms (40% safety margin)

### 2.2 Feature Extraction

#### Tier 0 Features (MVP - Must Have)

| Feature | Definition | Range | Update Rate | Computation |
|---------|------------|--------|-------------|-------------|
| **Overall Energy** | RMS of full spectrum | 0-1 (normalized) | 125 Hz | 128 MACs |
| **Peak Level** | Max sample magnitude | 0-1 | 125 Hz | 128 compares |
| **Crest Factor** | Peak/RMS ratio | 0-20 dB | 125 Hz | 1 divide |
| **Band Energies** | 4-band spectral energy | 4×0-1 | 125 Hz | 4×32 MACs |
| **Envelope** | Smoothed loudness | 0-1 | 125 Hz | 1st-order IIR |

#### Tier 1 Features (Nice to Have)

| Feature | Definition | Range | Update Rate | Computation |
|---------|------------|--------|-------------|-------------|
| **Beat Detection** | Onset/transient energy | 0-1 | 125 Hz | 256 MACs |
| **Tempo Estimate** | BPM from beat intervals | 60-180 BPM | 2 Hz | History buffer |
| **Spectral Centroid** | Brightness indicator | 0-8 kHz | 125 Hz | 64 MACs |
| **Spectral Rolloff** | Frequency distribution | 0-8 kHz | 125 Hz | 64 MACs |
| **Zero Crossing Rate** | Noisiness metric | 0-1 | 125 Hz | 128 compares |

#### Tier 2 Features (Future)
- **Mood Classification**: Aggression vs Calm (ML-based)
- **Energy Curve**: Temporal energy patterns
- **Spectral Flux**: Timbre changes
- **Pitch Detection**: Fundamental frequency
- **Harmonic Content**: Harmonic vs noise ratio

### 2.3 Audio-Side Error Handling

#### Failure Detection
- **Mic Disconnect**: Constant values, DC offset > 0.9
- **Signal Clipping**: Consecutive samples at max value
- **Noise Floor**: RMS < 0.01 for >100ms
- **Clock Errors**: I2S buffer underflow/overflow

#### Error Signaling
- **SPI Status Flags**: 8-bit error code in feature packet
- **Safe Values**: Freeze last valid features, fade to zero
- **Recovery**: Auto-reset after 1 second of valid signal
- **Telemetry**: Error counters, quality metrics

---

## 3. Visual Domain: End-to-End Data Flow (MCU-B)

### 3.1 Inter-MCU Link & Data Contract

#### SPI Protocol Specification
```c
typedef struct {
    uint16_t sync_word;      // 0xAA55
    uint8_t  version;        // Protocol version
    uint8_t  feature_ver;    // Feature set version
    uint32_t frame_counter;  // Incrementing frame ID
    uint32_t timestamp;      // Optional: ms timestamp
    
    // Tier 0 Features (16 bytes)
    uint16_t overall_energy; // Q0.15 fixed point
    uint16_t peak_level;     // Q0.15 fixed point
    uint16_t crest_factor;   // Q4.11 (dB × 100)
    uint16_t band_energy[4]; // Q0.15 fixed point
    uint16_t envelope;       // Q0.15 fixed point
    
    // Tier 1 Features (12 bytes)
    uint16_t beat_intensity; // Q0.15 fixed point
    uint16_t tempo_bpm;      // BPM × 10
    uint16_t spectral_centroid; // Hz / 10
    uint16_t spectral_rolloff;  // Hz / 10
    uint16_t zero_crossing_rate; // Q0.15
    uint8_t  beat_phase;     // 0-255 (0-2π)
    uint8_t  reserved;       // Alignment
    
    uint16_t crc16;          // CRC16-CCITT
} AudioFeaturePacket;
```

#### Timing Model
- **Poll Rate**: 125 Hz (8ms intervals)
- **SPI Clock**: 10 MHz (packet transfer < 0.5ms)
- **Timeout**: 16ms (2 frame periods)
- **Jitter Budget**: ±1ms acceptable

#### Error Handling
- **Missing Packet**: Hold last valid frame, fade to 50% over 500ms
- **CRC Error**: Discard packet, increment error counter
- **Timeout**: Switch to demo/fallback mode
- **Version Mismatch**: Negotiate compatible subset

### 3.2 Visual Pipeline Stages

#### Stage 1: Feature Ingestion & Smoothing
```cpp
class FeatureProcessor {
    // Temporal smoothing
    ExponentialSmoothing energy_smoothing;
    ExponentialSmoothing band_smoothing[4];
    
    // Derived features
    float bass_energy;      // Low band emphasis
    float mid_energy;       // Mid band balance
    float treble_energy;    // High band brightness
    float dynamics;         // Crest factor derivative
    
    // Beat tracking
    BeatPhaseTracker beat_tracker;
    TempoEstimator tempo_estimator;
};
```

#### Stage 2: Scene & Effect Selection
```cpp
class SceneManager {
    // Scene selection based on features
    Scene select_scene(const AudioFeatures& features) {
        if (features.energy < 0.1) return Scene::AMBIENT;
        if (features.beat_intensity > 0.7) return Scene::BEAT_REACTIVE;
        if (features.spectral_centroid > 4000) return Scene::BRIGHT;
        return Scene::BALANCED;
    }
    
    // Effect blending
    Effect blend_effects(const Scene& scene, float intensity) {
        return lerp(scene.base_effect, scene.intense_effect, intensity);
    }
};
```

#### Stage 3: Parameter Mapping
```cpp
class ParameterMapper {
    // Audio feature → visual parameter mappings
    void map_parameters(const AudioFeatures& features, 
                       VisualParams& params) {
        // Speed mapping: tempo → animation speed
        params.speed = clamp(features.tempo_bpm / 120.0f, 0.5f, 2.0f);
        
        // Color mapping: spectral centroid → hue
        params.hue_offset = features.spectral_centroid / 8000.0f * 360.0f;
        
        // Intensity mapping: energy → brightness/saturation
        params.brightness = sqrt(features.overall_energy);
        params.saturation = lerp(0.3f, 1.0f, features.dynamics);
        
        // Scale mapping: bass energy → pattern scale
        params.scale = lerp(0.5f, 2.0f, features.bass_energy);
    }
};
```

#### Stage 4: Rendering Pipeline
```cpp
class RenderPipeline {
    // Layered rendering
    void render_frame(const VisualParams& params) {
        // Base layer: ambient wash
        render_base_layer(params);
        
        // Mid layer: animated patterns
        render_pattern_layer(params);
        
        // Top layer: beat-reactive accents
        if (params.beat_trigger) {
            render_beat_accents(params);
        }
        
        // Output to LED buffer
        gamma_correct();
        color_calibrate();
        output_to_leds();
    }
};
```

#### Stage 5: LED Output
- **Target FPS**: 60-120 Hz
- **LED Count**: 300+ addressable LEDs
- **Color Depth**: 24-bit RGB
- **Refresh Rate**: 400 Hz per LED (WS2812B timing)
- **DMA**: Hardware RMT for jitter-free timing

### 3.3 Visual-Side Error Handling

#### LED Failure Detection
- **Bus Monitoring**: Check data line integrity
- **Current Sensing**: Detect short circuits, open circuits
- **Thermal Monitoring**: LED temperature protection
- **Color Validation**: Sanity-check output values

#### Fallback Modes
- **No Audio**: Demo patterns, ambient cycling
- **LED Failure**: Reduce brightness, disable affected segments
- **Overload**: Drop to 30 FPS, reduce complexity
- **Recovery**: Gradual return to normal operation

---

## 4. Real-Time Processing Requirements & Determinism

### End-to-End Latency Budget
- **Audio Capture**: 8ms (window size)
- **Audio Processing**: 4ms (feature extraction)
- **SPI Transfer**: 0.5ms
- **Visual Processing**: 4ms (render pipeline)
- **LED Output**: 2.5ms (300 LEDs @ 60 FPS)
- **Total**: 19ms (target < 25ms for perceptual immediacy)

### Jitter Tolerance
- **Audio Frame**: ±0.1ms (0.1% of 8ms)
- **SPI Transfer**: ±0.5ms (12.5% of 4ms interval)
- **Render Frame**: ±1ms (6% of 16.7ms @ 60 FPS)
- **LED Refresh**: ±0.1ms (critical for WS2812B timing)

### Scheduling Model (FreeRTOS)

#### Audio MCU Tasks
```cpp
// Priority 4: Audio capture (highest)
Task_AudioCapture(void* pvParameters) {
    // I2S PDM RX via DMA
    // Double buffering
    // vTaskDelayUntil for precise timing
}

// Priority 3: Feature extraction
Task_FeatureExtraction(void* pvParameters) {
    // Process audio windows
    // Update feature packet
    // Signal SPI task when ready
}

// Priority 2: SPI communication
Task_SPICommunication(void* pvParameters) {
    // Wait for feature ready signal
    // Transmit packet to render MCU
    // Handle error conditions
}

// Priority 1: Diagnostics (lowest)
Task_Diagnostics(void* pvParameters) {
    // CPU monitoring
    // Error logging
    // Telemetry reporting
}
```

#### Render MCU Tasks
```cpp
// Priority 4: LED output (highest)
Task_LEDOutput(void* pvParameters) {
    // RMT DMA control
    // Precise timing critical
    // Double buffering
}

// Priority 3: SPI polling
Task_SPIPolling(void* pvParameters) {
    // Poll audio MCU for features
    // Update feature state
    // Handle timeouts
}

// Priority 2: Visual rendering
Task_VisualRendering(void* pvParameters) {
    // Process features
    // Generate LED colors
    // Prepare output buffer
}

// Priority 1: UI/Control (lowest)
Task_UIControl(void* pvParameters) {
    // Handle user input
    // Mode switching
    // Configuration updates
}
```

---

## 5. Computational Resource & Throughput Analysis

### ESP32-S3 Resource Assessment

#### CPU Usage Estimates (@ 240 MHz)

| Configuration | Audio MCU | Render MCU | Notes |
|---------------|-----------|------------|--------|
| **Tier 0 Only** | 25% | 35% | Comfortable headroom |
| **Tier 0 + 1** | 45% | 55% | Acceptable for production |
| **Tier 0 + 1 + 2** | 75% | 80% | Marginal, needs optimization |
| **32 kHz Sample Rate** | 60% | 70% | CPU scales with sample rate |

#### Memory Footprint

##### Audio MCU
- **Code**: 128 KB (firmware + DSP libraries)
- **Static Data**: 32 KB (coefficients, tables)
- **Heap**: 16 KB (dynamic allocation)
- **Stack**: 8 KB per task × 4 tasks = 32 KB
- **Audio Buffers**: 8 KB (triple buffering)
- **Feature History**: 4 KB (temporal analysis)
- **Total**: ~220 KB (ESP32-S3 has 512 KB SRAM)

##### Render MCU
- **Code**: 96 KB (firmware + effects)
- **Static Data**: 24 KB (palettes, patterns)
- **Heap**: 12 KB (dynamic allocation)
- **Stack**: 8 KB per task × 4 tasks = 32 KB
- **LED Buffers**: 18 KB (300 LEDs × 3 colors × 2 buffers)
- **Feature State**: 2 KB (current + smoothed)
- **Total**: ~184 KB

#### Data Throughput

| Interface | Data Rate | Notes |
|-----------|-----------|--------|
| **PDM Audio** | 16.4 Mbps | 1.024 MHz clock × 1 bit |
| **PCM Audio** | 256 kbps | 16 kHz × 16 bits |
| **SPI Features** | 16 kbps | 32 bytes × 125 Hz |
| **LED Data** | 432 kbps | 300 LEDs × 24 bits × 60 FPS |

### Bottleneck Analysis

#### Critical Path
1. **FFT Processing**: 64-point FFT dominates audio MCU
2. **LED Refresh**: 300 LEDs @ 60 FPS challenges RMT timing
3. **SPI Polling**: 125 Hz rate must be maintained
4. **Memory Bandwidth**: LED double buffering stresses DMA

#### Mitigation Strategies
- **Fixed-point math**: Q15 format for DSP operations
- **Assembly optimization**: ESP32-S3 SIMD instructions
- **DMA utilization**: Offload memory transfers
- **Pipeline optimization**: Parallel processing where possible

---

## 6. Error Handling, Recovery, and Robustness

### Error Categories

#### Transient Errors (Auto-Recovering)
- **SPI glitches**: Noise-induced transfer errors
- **Audio dropouts**: Temporary microphone disconnect
- **LED flicker**: Timing violations, power fluctuations
- **RF interference**: Wi-Fi/Bluetooth coexistence

#### Persistent Errors (Manual Intervention)
- **Hardware failure**: Mic damage, LED strip failure
- **Firmware corruption**: Flash memory errors
- **Configuration loss**: NVS corruption
- **Thermal shutdown**: Overtemperature protection

### Error Detection Mechanisms

#### Audio MCU Monitoring
```cpp
class AudioHealthMonitor {
    // Signal quality metrics
    float signal_to_noise_ratio;
    float clipping_percentage;
    float dc_offset_level;
    
    // Performance metrics
    uint32_t processing_deadlines_missed;
    uint32_t spi_transfers_failed;
    uint32_t buffer_overruns;
    
    // Environmental metrics
    float temperature;
    float supply_voltage;
    
    HealthStatus assess_health() {
        if (clipping_percentage > 10%) return DEGRADED;
        if (processing_deadlines_missed > 0) return CRITICAL;
        if (temperature > 80°C) return THERMAL_LIMIT;
        return HEALTHY;
    }
};
```

#### Render MCU Monitoring
```cpp
class RenderHealthMonitor {
    // LED health
    uint32_t led_refresh_errors;
    float estimated_current_draw;
    
    // SPI health
    uint32_t spi_timeouts;
    uint32_t crc_failures;
    uint32_t version_mismatches;
    
    // Performance
    uint32_t frame_drops;
    float cpu_utilization;
    uint32_t memory_fragmentation;
    
    void take_corrective_action() {
        if (led_refresh_errors > 10) reduce_fps();
        if (spi_timeouts > 5) switch_to_demo_mode();
        if (cpu_utilization > 90%) simplify_effects();
    }
};
```

### Recovery Strategies

#### Graceful Degradation
1. **Audio Quality**: Reduce sample rate → reduce features → fallback to energy only
2. **Visual Quality**: Reduce FPS → disable effects → static colors → off
3. **Connectivity**: SPI failure → demo mode → safe mode → shutdown

#### Watchdog Implementation
```cpp
// Independent watchdog timers
void configure_watchdogs() {
    // Task watchdogs (5 second timeout)
    esp_task_wdt_init(5, true);
    esp_task_wdt_add(audio_capture_task);
    esp_task_wdt_add(feature_extraction_task);
    
    // Interrupt watchdog (300ms timeout)
    esp_int_wdt_init(300, true);
    
    // RTC watchdog (as last resort)
    rtc_wdt_init();
    rtc_wdt_set_length_of_reset_signal(RTC_WDT_SYS_RESET_SIG);
    rtc_wdt_set_stage(RTC_WDT_STAGE0, RTC_WDT_STAGE_ACTION_RESET_SYSTEM);
}
```

### High-Load Behavior

#### Very Loud Audio (Near AOP)
- **Soft limiting**: Prevent hard clipping
- **Gain reduction**: Automatic level control
- **Dynamic range compression**: Maintain feature quality
- **Thermal protection**: Reduce LED brightness

#### Maximum LED Patterns
- **Current limiting**: Enforce power budget
- **Thermal throttling**: Temperature-based brightness control
- **Complexity scaling**: Reduce pattern intricacy
- **Frame rate adaptation**: Dynamic FPS adjustment

---

## 7. Development Complexity & Long-Term Maintainability

### Development Complexity Assessment

#### Dual-MCU vs Single-MCU Comparison

| Aspect | Single MCU | Dual MCU (Chosen) | Complexity Impact |
|--------|------------|-------------------|-------------------|
| **Codebase Size** | 1 firmware | 2 firmwares | +40% (separate builds) |
| **Debug Complexity** | Unified view | Split debugging | +25% (logic analyzers) |
| **Testing Surface** | Single target | Multiple targets | +30% (integration tests) |
| **SPI Protocol** | N/A | Required | +20% (packet design) |
| **Resource Management** | Shared | Dedicated | -15% (no contention) |
| **Fault Isolation** | Difficult | Natural | -40% (clear boundaries) |

#### Development Workflow
1. **Independent Development**: Audio and visual teams work separately
2. **Versioned Interfaces**: SPI protocol acts as contract
3. **Simulation Environment**: PC-based feature generator for visual development
4. **Hardware-in-Loop**: Audio capture testing with real microphones
5. **Integration Testing**: Combined system validation

### Modular Architecture Design

#### Plugin System for Effects
```cpp
class EffectPlugin {
public:
    virtual const char* get_name() = 0;
    virtual void process(const AudioFeatures& features,
                        LEDBuffer& buffer) = 0;
    virtual void set_parameter(const std::string& name, float value) = 0;
    virtual std::vector<std::string> get_parameters() = 0;
};

// Dynamic loading
class EffectRegistry {
    std::vector<std::unique_ptr<EffectPlugin>> effects;
    
public:
    void load_plugin(const std::string& path);
    EffectPlugin* get_effect(const std::string& name);
};
```

#### Feature Module System
```cpp
class FeatureModule {
public:
    virtual bool initialize() = 0;
    virtual void process(const float* audio_buffer, size_t samples) = 0;
    virtual float get_feature(size_t index) = 0;
    virtual size_t get_feature_count() = 0;
    virtual const char* get_feature_name(size_t index) = 0;
};
```

### Coding Standards

#### Naming Conventions
- **Namespaces**: `spectrasynq::audio`, `spectrasynq::visual`
- **Classes**: `PascalCase` (e.g., `FeatureExtractor`)
- **Functions**: `camelCase` (e.g., `processFeatures()`)
- **Variables**: `snake_case` (e.g., `audio_buffer_size`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_LED_COUNT`)

#### Code Organization
```
src/
├── audio/
│   ├── capture/          # Microphone interfaces
│   ├── dsp/              # Signal processing
│   ├── features/           # Feature extraction modules
│   └── spi/              # Communication interface
├── visual/
│   ├── effects/          # Visual effect implementations
│   ├── mapping/          # Parameter mapping functions
│   ├── rendering/        # Core rendering engine
│   └── led/              # LED driver interfaces
├── shared/
│   ├── protocol/         # SPI packet definitions
│   ├── types/            # Common type definitions
│   └── utils/            # Utility functions
└── platform/
    ├── esp32/            # ESP32-specific code
    └── hal/               # Hardware abstraction
```

#### Documentation Requirements
- **API Documentation**: Doxygen comments for all public interfaces
- **Architecture Docs**: Markdown files for subsystem design
- **Protocol Specs**: Formal specifications for all interfaces
- **Performance Budgets**: Documented timing requirements
- **Error Handling**: Comprehensive error condition documentation

---

## 8. Scalability, Integration, and Upgrade Paths

### Hardware Evolution Path

#### Phase 1: Dual ESP32-S3 (Current)
- **Capability**: Basic audio→visual, 300 LEDs, Tier 0+1 features
- **Limitation**: CPU-bound at higher feature counts
- **Use Case**: Consumer products, art installations

#### Phase 2: ESP32-S3 + ESP32-P4
- **Upgrade**: Replace render MCU with ESP32-P4 (dual-core, 400 MHz)
- **Benefit**: 3× CPU performance, hardware acceleration
- **Capability**: Complex ML effects, higher LED counts (1000+)
- **Migration**: Maintain SPI protocol, upgrade visual firmware

#### Phase 3: Multi-Node Network
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Base Station  │    │   Audio Node    │    │  Render Nodes   │
│   (i.MX8/i.MX9) │◄──►│  (ESP32-S3)     │◄──►│ (ESP32-P4 × N)  │
│                 │    │                 │    │                 │
│ • Heavy ML DSP  │    │ • Multi-mic     │    │ • 1000s LEDs    │
│ • Content Mgmt  │    │ • Beamforming   │    │ • 3D effects    │
│ • Network Sync  │    │ • Spatial audio │    │ • Distributed   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Protocol Evolution

#### Version 1.0 (Current)
- **Features**: Tier 0 + basic Tier 1
- **Bandwidth**: 16 kbps SPI
- **Latency**: 19ms end-to-end
- **Compatibility**: Dual ESP32-S3

#### Version 2.0 (Future)
- **Features**: Full Tier 1 + basic Tier 2
- **Bandwidth**: 64 kbps (higher SPI clock)
- **Latency**: 15ms (optimized pipeline)
- **Compatibility**: ESP32-S3 + ESP32-P4

#### Version 3.0 (Networked)
- **Features**: Full Tier 2 + ML features
- **Bandwidth**: 1 Mbps (Ethernet/Wi-Fi)
- **Latency**: 10ms (dedicated DSP)
- **Compatibility**: Multi-node architecture

### Integration Capabilities

#### Host Computer Integration
```cpp
class HostInterface {
    // Real-time feature streaming
    void stream_features(const AudioFeatures& features);
    
    // Configuration management
    void update_parameters(const SystemConfig& config);
    
    // Content management
    void upload_pattern(const PatternData& pattern);
    void upload_palette(const ColorPalette& palette);
    
    // Diagnostics and telemetry
    SystemStatus get_system_status();
    PerformanceMetrics get_performance_metrics();
};
```

#### Mobile App Integration
- **Bluetooth LE**: Configuration and control
- **Wi-Fi**: Content updates and diagnostics
- **USB-C**: High-bandwidth content transfer
- **Cloud**: Pattern sharing and ML model updates

### Community/Ecosystem Support

#### Leverageable Libraries
- **ESP-DSP**: Optimized signal processing for ESP32
- **FastLED**: LED control library (adapt for RMT)
- **ArduinoFFT**: Lightweight FFT implementation
- **ESP32-audioI2S**: I2S/PDM audio capture
- **ESPAsyncWebServer**: Web-based configuration

#### Development Tools
- **ESP-IDF**: Official development framework
- **PlatformIO**: Cross-platform development
- **ESP-PROG**: JTAG debugging interface
- **Logic Analyzer**: SPI protocol debugging
- **Oscilloscope**: Real-time timing analysis

#### Risk Assessment
- **ESP32 Dependency**: Vendor lock-in mitigation via HAL
- **Library Abandonment**: Maintain local forks of critical libs
- **License Compatibility**: Audit all dependencies for commercial use
- **Security Updates**: Monitor for CVEs in dependencies

---

## 9. Telemetry, Observability, and Operations

### Telemetry Architecture

#### Data Collection Points
```cpp
struct SystemTelemetry {
    // Audio metrics
    struct {
        float cpu_utilization;
        uint32_t frame_drops;
        uint32_t spi_errors;
        float signal_quality;
        float microphone_temperature;
    } audio_metrics;
    
    // Visual metrics
    struct {
        float cpu_utilization;
        uint32_t frame_drops;
        uint32_t led_errors;
        float render_time_ms;
        float led_temperature;
    } visual_metrics;
    
    // System health
    struct {
        float supply_voltage;
        float current_draw;
        float temperature;
        uint32_t uptime_seconds;
        uint32_t reboot_count;
    } system_health;
};
```

#### Telemetry Transport
- **Serial Debug**: Real-time streaming during development
- **BLE Advertisements**: Low-power status broadcasting
- **Wi-Fi MQTT**: Periodic telemetry to cloud
- **USB CDC**: High-bandwidth diagnostic data
- **SD Card**: Local logging for field debugging

### Debug Modes

#### Development Mode
```cpp
enum DebugMode {
    DEBUG_NORMAL,        // Standard operation
    DEBUG_AUDIO_FEATURES, // Visualize features on LEDs
    DEBUG_SPI_TRAFFIC,   // LED pattern shows SPI activity
    DEBUG_TIMING,        // Color indicates processing time
    DEBUG_MEMORY,        // Memory usage visualization
    DEBUG_THERMAL,       // Temperature-based colors
};
```

#### Diagnostic Visualizations
- **Audio Spectrum**: LED bar graph of frequency bands
- **Beat Detection**: Flash on detected beats
- **Signal Quality**: Color indicates SNR level
- **CPU Load**: Brightness indicates utilization
- **Memory Usage**: Pattern density shows allocation

### Operations Integration

#### Field Diagnostics App
```cpp
class DiagnosticApp {
    // Real-time monitoring
    void connect_to_device(const std::string& device_id);
    SystemTelemetry get_live_telemetry();
    std::vector<LogEntry> get_recent_logs();
    
    // Configuration management
    void update_runtime_config(const RuntimeConfig& config);
    void upload_calibration_data(const CalibrationData& data);
    
    // Troubleshooting
    std::vector<DiagnosticResult> run_diagnostics();
    void generate_diagnostic_report(const std::string& filename);
};
```

#### Cloud Analytics Pipeline
```cpp
class CloudAnalytics {
    // Data ingestion
    void ingest_telemetry(const SystemTelemetry& data);
    void ingest_crash_report(const CrashReport& report);
    
    // Analytics processing
    PerformanceTrends analyze_performance_trends();
    FailurePredictions predict_failures();
    
    // Alerting
    void configure_alerts(const AlertConfig& config);
    void send_alert(const Alert& alert);
};
```

### Performance Monitoring

#### Key Performance Indicators (KPIs)
- **Latency**: End-to-end audio→visual delay
- **Frame Rate**: Consistency of LED refresh
- **CPU Utilization**: Headroom for future features
- **Memory Usage**: Fragmentation and leaks
- **Error Rate**: SPI failures, buffer overruns
- **Thermal Performance**: Operating temperature trends

#### Alert Thresholds
```cpp
struct AlertThresholds {
    // Performance alerts
    float max_latency_ms = 25.0f;
    uint32_t max_frame_drops_per_minute = 10;
    float max_cpu_utilization = 90.0f;
    
    // Quality alerts
    float min_signal_to_noise_ratio = 20.0f;
    uint32_t max_spi_errors_per_minute = 5;
    float max_temperature_celsius = 85.0f;
    
    // Health alerts
    float min_supply_voltage = 3.0f;
    uint32_t max_reboots_per_day = 3;
    uint32_t max_memory_fragmentation = 50;
};
```

---

## 10. Final Deliverables Summary

### Architecture Recommendation
**We recommend the Dual-MCU Architecture as the baseline** for the following reasons:

1. **Clean Separation**: Audio processing and visual rendering have distinct real-time requirements
2. **Fault Isolation**: Failures in one domain don't cascade to the other
3. **Scalability**: Clear upgrade path to more powerful processors
4. **Development Efficiency**: Teams can work independently on audio and visual components
5. **Performance Predictability**: Dedicated resources eliminate contention

### Critical Design Decisions

#### Audio Pipeline (MCU-A)
- **Sample Rate**: 16 kHz PCM (scalable to 32 kHz)
- **Window Size**: 8-10 ms (128-160 samples)
- **Feature Set**: Tier 0 (MVP) + Tier 1 (enhanced)
- **Output**: Versioned SPI packets at 125 Hz
- **Real-time Budget**: 4ms processing, 4ms headroom

#### Visual Pipeline (MCU-B)
- **Input**: SPI feature packets at 125 Hz
- **Processing**: Feature smoothing → scene selection → parameter mapping
- **Rendering**: Layered approach (base + pattern + accents)
- **Output**: 300+ LEDs at 60-120 FPS via RMT/DMA
- **Latency**: 15ms total (4ms processing + 2.5ms LED output)

#### SPI Protocol
- **Data Rate**: 16 kbps (32-byte packets at 125 Hz)
- **Timing**: 10 MHz clock, 0.5ms transfer time
- **Reliability**: CRC16, sync words, timeout handling
- **Extensibility**: Versioned protocol with feature negotiation

### Risk Mitigation
- **CPU Headroom**: 40% spare capacity for future features
- **Memory Safety**: 50% SRAM utilization leaves room for growth
- **Error Recovery**: Multi-level fallback strategies
- **Hardware Evolution**: Clear migration path to ESP32-P4 and beyond

### Success Criteria
1. **Latency**: < 25ms end-to-end audio→visual delay
2. **Reliability**: > 99.9% uptime under normal conditions
3. **Scalability**: Support 300+ LEDs at 60 FPS minimum
4. **Maintainability**: Modular design enables feature evolution
5. **Manufacturability**: Dual-ESP32 design is cost-effective and reliable

This architecture provides the foundation for a successful product line that can evolve from the initial K1-Lightwave implementation to future high-performance variants while maintaining backward compatibility and development efficiency.

---

## 11. Research References & Citations

### Microphone (Infineon IM69D130)
- Product page: https://www.infineon.com/part/IM69D130
- Datasheet (SNR 69 dB(A), AOP 130 dB SPL, PDM interface): https://www.infineon.com/dgdl/Infineon-IM69D130-DataSheet-v01_00-EN.pdf
- Product brief: https://www.infineon.cn/assets/row/public/documents/24/45/infineon-im69d130-pb--productbrief-en.pdf

### ESP32‑S3 I2S PDM RX (PDM→PCM)
- ESP‑IDF I2S (PDM RX/TX, PCM conversion): https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/i2s.html
- ESP32 TRM references (I2S/APLL clocking): http://www.ee.ic.ac.uk/pcheung/teaching/DE1_EE/Labs/esp32_technical_reference_manual_en.pdf
- ESP32‑S3 TRM (overview): https://files.waveshare.com/upload/1/11/Esp32-s3_technical_reference_manual_en.pdf

### LED Driving (WS2812 via RMT, SPI backends) 
- RMT peripheral (DMA guidance on S3): https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-reference/peripherals/rmt.html
- LED strip driver (RMT and SPI backends): https://components.espressif.com/components/espressif/led_strip/
- ESP‑IDF RMT WS2812 example: https://github.com/espressif/esp-idf/blob/master/examples/peripherals/rmt/led_strip/README.md
- Community RMT timing example: https://github.com/JSchaenzle/ESP32-NeoPixel-WS2812-RMT
- ESP FAQ on RMT DMA and Wi‑Fi/BLE coexistence: https://docs.espressif.com/projects/esp-faq/en/latest/software-framework/peripherals/rmt.html

### APA102 / HD108 (SPI LEDs)
- APA102 protocol and end frame analysis: https://hackaday.com/2014/12/09/digging-into-the-apa102-serial-led-protocol/
- APA102 PWM frequency and practical notes: https://cpldcpu.com/2014/08/27/apa102/
- End frame length ≥ n/2 bits for long strings: https://cpldcpu.com/2014/11/30/understanding-the-apa102-superled/
- SparkFun guide: https://learn.sparkfun.com/tutorials/apa102-addressable-led-hookup-guide/all
- ESP32 forum APA102 SPI usage: https://www.esp32.com/viewtopic.php?t=16231
- HD108 practitioner notes: https://www.reddit.com/r/FastLED/comments/mod8mn/fastled_branch_with_16bit_support_hd108/

### SPI Master/Slave & Handshake
- SPI master timing considerations (MISO delays, IO_MUX): https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/spi_master.html
- SPI slave driver (handshake GPIO recommendation): https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/spi_slave.html
- Tutorial with handshake GPIO example: https://esp32tutorials.com/esp32-spi-master-slave-communication-esp-idf/

### CRC16‑CCITT
- Polynomial 0x1021 overview and code: https://srecord.sourceforge.net/crc16-ccitt.html
- Table‑driven example: http://docs.ros.org/en/diamondback/api/clearpath_base/html/group__crc.html

### DSP Algorithms & Spectral Descriptors
- Goertzel algorithm overview: https://en.wikipedia.org/wiki/Goertzel_algorithm
- Embedded Goertzel article: https://www.embedded.com/the-goertzel-algorithm/
- Generalized Goertzel (non‑integer bins): https://asp-eurasipjournals.springeropen.com/articles/10.1186/1687-6180-2012-56
- KissFFT library (fixed‑point capable): https://github.com/mborgerding/kissfft
- Spectral descriptors (centroid, roll‑off, flatness) overview: https://www.mathworks.com/help/audio/ug/spectral-descriptors.html

### FreeRTOS Scheduling & Performance (ESP32‑S3)
- Performance and task priority guidance: https://docs.espressif.com/projects/esp-idf/en/v5.0/esp32s3/api-guides/performance/speed.html
- SMP behavior, pinning and preemption: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/freertos_idf.html

---

## 12. Appendix: Reference Implementations

### ESP‑IDF Examples
- RMT WS2812: https://github.com/espressif/esp-idf/blob/master/examples/peripherals/rmt/led_strip/README.md
- LED strip SPI backend (WS2812 clockless): https://components.espressif.com/components/espressif/led_strip/versions/2.5.4/examples/led_strip_spi_ws2812?language=en

### Community Implementations
- WS2812 via RMT: https://github.com/JSchaenzle/ESP32-NeoPixel-WS2812-RMT
- SPI WS28xx with DMA: https://github.com/okhsunrog/esp_ws28xx