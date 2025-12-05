# SpectraSynq K1-Lightwave: Dual-MCU Real-Time Audio→Visual System Architecture & Data-Flow Blueprint

## Executive Summary

This document presents the foundational architecture for SpectraSynq's K1-Lightwave product line: a real-time audio-reactive visual system built on dual ESP32-S3 MCUs. The system ingests live audio via I2S MEMS microphones, performs low-latency DSP analysis, streams compact feature vectors over SPI, and drives hundreds of addressable LEDs with predictable, bounded latency from sound to photon.

**Key Design Decisions:**
- **Architecture**: Asymmetric dual-MCU with SPI master-slave communication
- **Audio Processing**: 16kHz I2S with 8ms analysis windows
- **LED Control**: 60-120 FPS via RMT DMA for WS2812/APA102 strips
- **Latency Target**: <20ms end-to-end audio→visual response
- **Scalability**: Protocol designed for future multi-node and higher-power SoC migration

## 1. System Architecture Analysis

### 1.1 Architecture Comparison

#### Architecture 1: Asymmetric Dual-MCU (RECOMMENDED)
**Components:**
- **MCU-A (Audio Node)**: ESP32-S3 as SPI slave - I2S interface, DSP, feature extraction
- **MCU-B (Render Node)**: ESP32-S3 as SPI master - LED control, UI, external comms
- **Interconnect**: SPI with deterministic packet protocol

**Advantages:**
- Deterministic performance with bounded latency
- Clear failure domains and recovery strategies
- Optimized resource allocation per MCU
- Simple development and debugging

#### Architecture 2: Symmetric Dual-MCU with Shared Memory
**Components:**
- Identical ESP32-S3 units with configurable roles
- Shared dual-port RAM interface
- Failover capability

**Disadvantages:**
- Complex shared memory arbitration
- Higher BOM cost
- Over-engineered for initial requirements

#### Architecture 3: Hierarchical Multi-Node with Gateway
**Components:**
- Audio gateway with network distribution
- Multiple render nodes
- Centralized control

**Disadvantages:**
- Network latency unacceptable for real-time
- Complex for single-device deployment
- Higher power consumption

### 1.2 Recommended Architecture Justification

**We recommend Architecture 1** based on:
1. **Real-time Constraints**: 8ms audio windows require predictable communication
2. **Resource Optimization**: Dedicated roles maximize ESP32-S3 capabilities
3. **Development Simplicity**: Clear interfaces enable parallel development
4. **Evolution Path**: Protocol foundation supports future network migration
5. **Cost Effectiveness**: Minimal BOM increase over single-MCU solution

## 2. Audio Domain: MCU-A Pipeline (Audio Node)

### 2.1 Hardware Interface

**Microphone**: Adafruit SPH0645 I2S MEMS
- **SNR**: 65dB
- **Sensitivity**: -26dBFS
- **Voltage**: 3.3V domain (direct connection to ESP32-S3)
- **I2S Clock**: Standard I2S protocol

**ESP32-S3 I2S Configuration:**
```
I2S Mode: Standard I2S RX, Slave
Sample Rate: 16kHz PCM output
I2S Clock: Standard bit clock
Data Lines: CLK, DIN
DMA Buffer: 128 samples × 8 buffers
```

### 2.2 DSP Front-End Processing

**Stage 1: I2S Audio Input**
- Hardware I2S receiver on I2S0
- Direct 16-bit PCM at 16kHz
- Standard I2S protocol handling

**Stage 2: Windowing & Overlap**
- **Analysis Window**: 8ms (128 samples)
- **Overlap**: 50% for smooth transitions
- **Window Function**: Hann window for spectral leakage control

**Stage 3: Pre-processing**
- DC removal: 1st-order HPF at 20Hz
- Optional pre-emphasis: +6dB/octave above 2kHz
- Dynamic range compression for loud environments

### 2.3 Feature Extraction Pipeline

#### Tier 0 Features (MVP - Every Frame)

**1. Energy Metrics**
```
RMS_Energy = sqrt(Σ(x²[n]) / N)
Peak_Energy = max(|x[n]|)
Crest_Factor = Peak_Energy / RMS_Energy
```
- **Range**: 0.0-1.0 (normalized)
- **Update Rate**: Every frame (125Hz)
- **Smoothing**: 3-frame moving average

**2. Spectral Bands (4-Band Goertzel)**
```
Band 1: 20-200Hz (Bass)
Band 2: 200-1000Hz (Low-Mid)
Band 3: 1000-4000Hz (High-Mid)
Band 4: 4000-8000Hz (Treble)
```
- **Implementation**: 4-point Goertzel filter bank
- **Range**: 0.0-1.0 (normalized magnitude)
- **Update Rate**: Every frame
- **Computational Cost**: ~200 cycles per band

**3. Envelope Follower**
```
Attack: 2ms, Release: 20ms
Smoothing: Exponential decay
Output: 8-bit logarithmic scale
```

#### Tier 1 Features (Optional - When Available)

**4. Beat/Onset Detection**
```
Spectral Flux = Σ(max(0, X[k] - X_prev[k]))
Onset_Threshold = μ + 3σ (adaptive)
Beat_Phase = Accumulated tempo phase
```

**5. Spectral Shape**
```
Centroid = Σ(k × |X[k]|) / Σ|X[k]|
Rolloff = max(k where Σ|X[0:k]| < 0.85 × Σ|X|)
Flatness = exp(mean(log(|X|))) / mean(|X|)
```

### 2.4 Real-Time Performance Budget

**Per-Frame Budget (8ms window):**
- I2S Input: 0.2ms
- Windowing: 0.1ms
- Feature Extraction: 1.5ms
- SPI Transfer: 0.2ms
- **Total**: 2.3ms (29% of 8ms)
- **Headroom**: 71% for future features

### 2.5 Error Handling & Robustness

**Microphone Failure Detection:**
- DC bias monitoring (constant values)
- Noise floor analysis (excessive high-frequency)
- Signal correlation checks

**Recovery Strategies:**
- Feature freeze with fade-out
- Sentinel values in SPI packets
- Automatic gain control reset
- Watchdog timer for lockup detection

## 3. Visual Domain: MCU-B Pipeline (Render Node)

### 3.1 SPI Interface & Protocol

**SPI Configuration:**
```
Mode: Master, Mode 0 (CPOL=0, CPHA=0)
Clock: 10MHz (deterministic timing)
Data Order: MSB first
CS: Active low with frame synchronization
```

**Feature Packet Format (20 bytes):**
```c
typedef struct {
    uint8_t sync_word;      // 0xAA
    uint8_t version;        // Protocol version
    uint8_t frame_counter;  // Rolling counter
    uint8_t status_flags;   // Error/status bits
    
    // Tier 0 Features
    uint16_t rms_energy;    // 0-65535 (normalized)
    uint16_t peak_energy;   // 0-65535
    uint16_t band_energy[4]; // 4×16-bit spectral bands
    uint8_t envelope;       // 8-bit log envelope
    
    // Tier 1 Features (optional)
    uint8_t beat_detected;  // Boolean + confidence
    uint8_t tempo_bpm;      // 60-200 BPM
    uint16_t spectral_centroid; // Frequency centroid
    
    uint8_t crc8;           // Packet integrity
} AudioFeatures_t;
```

### 3.2 Visual Pipeline Stages

**Stage 1: Feature Ingestion & Smoothing**
```
Input: Raw SPI feature packets
Processing: 
  - CRC validation
  - Feature interpolation (125Hz → 60-120Hz)
  - Temporal smoothing (IIR filter)
  - Normalization and scaling
Output: Smoothed feature set
```

**Stage 2: Scene & Effect Selection**
```
Input: Smoothed features + user configuration
Processing:
  - Effect priority evaluation
  - Blend weight calculation
  - Parameter mapping curves
  - Scene transition logic
Output: Active effect list with parameters
```

**Stage 3: Rendering Engine**
```
Input: Effect parameters + LED configuration
Processing:
  - Multi-layer composition
  - Color space conversions
  - Gamma correction
  - LED-specific optimizations
Output: Raw RGB pixel data
```

**Stage 4: LED Output Generation**
```
Input: RGB pixel data
Processing:
  - Protocol encoding (WS2812/APA102)
  - DMA buffer preparation
  - Timing synchronization
  - RMT peripheral programming
Output: Hardware LED signals
```

### 3.3 LED Control Implementation

**WS2812 Timing (RMT-based):**
```
T0H: 0.4μs ±150ns
T1H: 0.8μs ±150ns
T0L: 0.85μs
T1L: 0.45μs
Reset: >50μs low
```

**RMT Configuration:**
```c
rmt_config_t config = {
    .rmt_mode = RMT_MODE_TX,
    .channel = RMT_CHANNEL_0,
    .gpio_num = LED_PIN,
    .mem_block_num = 2,
    .tx_config = {
        .carrier_freq_hz = 0,
        .carrier_level = RMT_CARRIER_LEVEL_LOW,
        .idle_level = RMT_IDLE_LEVEL_LOW,
        .carrier_duty_percent = 50,
        .carrier_en = false,
        .loop_en = false,
        .idle_output_en = true,
    }
};
```

**Performance Optimization:**
- DMA double-buffering for continuous output
- Parallel RMT channels for multi-strip support
- PSRAM utilization for large LED counts
- Core affinity: LED task pinned to core 1

### 3.4 Visual Effects Architecture

**Layer-Based Composition:**
```
Base Layer: Ambient/color wash
Mid Layer: Motion/patterns  
Top Layer: Accents/beat spikes
Overlay: UI/telemetry (if enabled)
```

**Effect Categories:**
1. **Reactive Effects**: Direct audio feature mapping
2. **Generative Effects**: Procedural patterns with audio influence
3. **Utility Effects**: Solid colors, fades, diagnostics

**Parameter Mapping Functions:**
```python
def map_energy_to_brightness(energy):
    return energy ** 0.5  # Square root for natural response

def map_bass_to_color(bass_energy):
    hue = 240 - (bass_energy * 120)  # Blue→Red with bass
    return hue

def map_tempo_to_speed(tempo):
    return clamp(tempo / 120, 0.5, 2.0)  # 0.5x to 2x speed
```

## 4. SPI Protocol Specification

### 4.1 Physical Layer

**Electrical Characteristics:**
- **Voltage**: 3.3V logic levels
- **Clock**: 10MHz maximum
- **Lines**: MOSI, MISO, SCLK, CS
- **Termination**: Source termination on MCU-B (master)

**Timing Constraints:**
- **Setup Time**: 10ns minimum
- **Hold Time**: 10ns minimum  
- **CS Setup**: 1μs before first clock
- **CS Hold**: 1μs after last clock

### 4.2 Data Link Layer

**Frame Structure:**
```
[CS Low] → [Header: 4 bytes] → [Payload: 15 bytes] → [CRC: 1 byte] → [CS High]
```

**Error Detection:**
- CRC-8 (polynomial: 0x07)
- Frame counter for loss detection
- Timeout monitoring (2ms max between frames)

### 4.3 Application Layer

**Feature Update Rate:**
- **Primary**: 125Hz (every 8ms audio frame)
- **Fallback**: 60Hz (interpolated for LED timing)
- **Burst Mode**: 250Hz for special effects

**Version Negotiation:**
- MCU-B requests version on startup
- MCU-A responds with supported features
- Graceful degradation for mismatched versions

## 5. Real-Time Analysis & Performance

### 5.1 Latency Budget

**End-to-End Latency Breakdown:**
```
Audio Capture: 8ms (window) + 0.5ms (processing)
Feature Extraction: 1.5ms
SPI Transfer: 0.2ms (20 bytes @ 10MHz)
Visual Processing: 2.0ms
LED Output: 1.0ms (300 LEDs @ 60FPS)
----------------------------------------
Total: ~13ms (target: <20ms)
```

### 5.2 Determinism Guarantees

**Audio Side (MCU-A):**
- I2S DMA double-buffering prevents underruns
- Fixed-point DSP ensures consistent timing
- Feature computation deadline: 6ms per 8ms window

**Visual Side (MCU-B):**
- RMT DMA eliminates CPU intervention
- Frame timing: 16.67ms for 60FPS
- SPI polling synchronized to frame boundaries

**Inter-MCU Synchronization:**
- SPI transfer completes within 0.5ms
- Feature interpolation handles timing mismatch
- Buffering absorbs jitter (<1ms acceptable)

### 5.3 Jitter Analysis

**Sources of Jitter:**
- Audio window alignment: ±4ms
- SPI transfer timing: ±0.1ms  
- LED refresh alignment: ±8.33ms
- **Total Worst Case**: ±12.43ms

**Mitigation Strategies:**
- Phase-locked feature generation
- Predictive LED timing
- Temporal smoothing in visual domain

## 6. Resource Analysis

### 6.1 MCU-A (Audio) Resource Budget

**CPU Utilization:**
- I2S/DMA: 5% (background)
- DSP Pipeline: 25% (peak during FFT)
- Feature Extraction: 15% (sustained)
- SPI Communication: 2% (burst)
- **Total**: 47% (leaves 53% headroom)

**Memory Footprint:**
- Code: 128KB (includes DSP libraries)
- Data Buffers: 8KB (I2S audio windows)
- Feature History: 4KB (temporal analysis)
- Stack: 8KB (generous for safety)
- **Total RAM**: 48KB of 320KB available

**DMA Resources:**
- I2S RX: 1 channel (continuous)
- SPI TX: 1 channel (burst)
- Memory: 8KB total

### 6.2 MCU-B (Visual) Resource Budget

**CPU Utilization:**
- LED DMA: 3% (background)
- Effect Processing: 35% (depends on complexity)
- SPI Communication: 5% (polling)
- UI/Control: 10% (user interaction)
- **Total**: 53% (leaves 47% headroom)

**Memory Footprint:**
- Code: 156KB (includes graphics libraries)
- LED Buffers: 12KB (300 LEDs × 4 bytes)
- Effect Workspace: 8KB (multi-layer)
- Feature Cache: 2KB (recent history)
- Stack: 8KB
- **Total RAM**: 66KB of 320KB available

**DMA Resources:**
- RMT Channels: 2-4 channels (LED outputs)
- SPI RX: 1 channel (burst)
- Memory: 16KB (LED data triple-buffered)

### 6.3 Performance Scaling

**LED Count Scaling:**
- 300 LEDs: 60FPS achievable
- 600 LEDs: 30FPS maximum
- 1000+ LEDs: Requires APA102 or parallel strips

**Effect Complexity Scaling:**
- Simple effects: <10% CPU
- Medium effects: 20-30% CPU  
- Complex effects: 40-50% CPU
- Multi-layer: Add 10-20% per layer

## 7. Error Handling & Robustness Strategy

### 7.1 Failure Classification

**Transient Failures:**
- SPI communication errors
- Single-frame audio dropouts
- LED data corruption
- **Recovery**: Automatic retry, interpolation

**Persistent Failures:**
- Microphone hardware failure
- Complete SPI link loss
- LED strip malfunction
- **Recovery**: Safe mode, user notification

**Systemic Failures:**
- Power supply issues
- Clock instability
- Memory corruption
- **Recovery**: Watchdog reset, failsafe defaults

### 7.2 Error Detection Mechanisms

**Audio Health Monitoring:**
```c
typedef struct {
    uint32_t dc_offset;      // Constant value detection
    uint32_t noise_floor;    // Excessive high-frequency
    uint32_t correlation;    // Signal vs. noise correlation
    uint32_t level_variance; // Dynamic range analysis
} AudioHealth_t;
```

**Communication Health:**
- SPI timeout detection
- Frame counter discontinuity
- CRC failure rate monitoring
- Latency measurement

**Visual Health:**
- LED current monitoring (if available)
- Frame timing violations
- DMA error flags
- RMT underrun detection

### 7.3 Recovery Strategies

**Audio Recovery:**
- Feature freeze with exponential decay
- Automatic gain control reset
- Microphone power-cycle (if supported)
- Fallback to internal noise generation

**Communication Recovery:**
- SPI re-initialization with backoff
- Feature packet interpolation
- Safe mode with reduced effects
- Manual override via UI

**Visual Recovery:**
- Last-known-good pattern display
- Monochrome diagnostic mode
- Reduced LED count operation
- Hardware reset of LED strips

## 8. Scalability & Upgrade Roadmap

### 8.1 Near-Term Evolution (6-12 months)

**Higher Sample Rates:**
- 32kHz PCM support (standard I2S clocking)
- Maintains 8ms windows (256 samples)
- Requires 40% more DSP processing
- Protocol remains compatible

**Additional Features:**
- Stereo microphone support
- Line-in audio input
- Bluetooth audio reception
- Enhanced beat detection algorithms

**LED Improvements:**
- APA102 support for higher refresh rates
- Multiple LED strip outputs
- RGBW LED support
- Higher LED counts (1000+)

### 8.2 Medium-Term Evolution (1-2 years)

**Multi-Node Architecture:**
- Wireless audio distribution
- Synchronized multi-device shows
- Centralized control hub
- Mesh networking capabilities

**Advanced Processing:**
- Machine learning inference
- Advanced audio classification
- Adaptive effects based on genre
- User preference learning

**Enhanced Hardware:**
- ESP32-P4 migration path
- External DSP acceleration
- Higher memory configurations
- Professional audio interfaces

### 8.3 Long-Term Vision (2+ years)

**Ecosystem Integration:**
- Professional lighting protocols (DMX512, Art-Net)
- Home automation integration
- Cloud-based content management
- Mobile app control platform

**Advanced Features:**
- Spatial audio processing
- 3D LED cube support
- Video synchronization
- Professional show control

## 9. Development & Testing Strategy

### 9.1 Development Environment

**Hardware Setup:**
- Dual ESP32-S3 development boards
- SPH0645 I2S microphone breakout
- WS2812/APA102 LED strips
- Logic analyzer for SPI debugging
- Oscilloscope for timing verification

**Software Stack:**
- ESP-IDF 5.x with FreeRTOS
- Custom DSP library optimized for ESP32-S3
- LED control library (RMT-based)
- SPI protocol implementation
- Telemetry and debugging tools

### 9.2 Testing Methodology

**Unit Tests:**
- DSP algorithm verification
- Feature extraction accuracy
- SPI protocol compliance
- LED timing validation

**Integration Tests:**
- End-to-end latency measurement
- Stress testing at maximum LED counts
- Error injection and recovery
- Power consumption analysis

**Performance Tests:**
- CPU utilization profiling
- Memory usage monitoring
- Real-time constraint verification
- Jitter measurement and analysis

### 9.3 Debugging Infrastructure

**Telemetry System:**
- Real-time feature streaming
- Performance metric collection
- Error log aggregation
- Remote diagnostic capabilities

**Diagnostic Modes:**
- Audio feature visualization on LEDs
- SPI packet sniffer mode
- LED timing analysis mode
- Memory usage reporting

## 10. Conclusion

The SpectraSynq K1-Lightwave architecture provides a robust foundation for real-time audio-reactive visual systems. The asymmetric dual-MCU design with SPI communication offers:

- **Deterministic Performance**: Bounded latency suitable for live performance
- **Scalable Architecture**: Protocol foundation supports future enhancements  
- **Robust Operation**: Comprehensive error handling and recovery mechanisms
- **Development Efficiency**: Clear separation enables parallel development
- **Cost Effectiveness**: Minimal BOM overhead for significant capability gain

The design successfully balances immediate product requirements with long-term evolution goals, providing a platform that can grow from dual ESP32-S3 prototypes to sophisticated multi-node professional installations.

**Key Success Metrics:**
- End-to-end latency: <20ms achieved
- Feature update rate: 125Hz sustained
- LED control: 60-120FPS for 300+ LEDs
- System reliability: 99.9% uptime target
- Development timeline: 6-9 months to production

This architecture establishes SpectraSynq's technical foundation for the K1-Lightwave product line while maintaining flexibility for future innovation and market expansion.