# Audio Domain: End-to-End Data Flow (MCU-A)

## Capture & DSP Front-End

### Microphone Configuration
- Primary Mic: Adafruit SPH0645 I2S MEMS Microphone
- Sample Rate: 16-48 kHz PCM (configurable)
- I2S Interface: Standard I2S protocol, 32-bit samples
- SNR: 65 dB, Sensitivity: -26 dBFS
- Power Domain: 3.3V direct connection to ESP32-S3

### Signal Processing Chain
```
I2S Input → ESP32 I2S RX → PCM Buffer → DC Removal → Windowing → FFT/Goertzel → Feature Extraction → SPI Output
```

### Buffer Management
- Window Size: 128-160 samples @ 16 kHz (8-10 ms)
- Overlap: 50% for temporal resolution
- Buffer Count: Triple buffering for real-time constraints
- Memory: 2KB per buffer (128 samples × 16-bit)

### Real-time Budget (8ms window @ 16 kHz)
- Total Budget: 8ms per window
- I2S→PCM: 0.2ms (hardware DMA)
- DC Removal: 0.2ms (simple high-pass)
- Windowing: 0.1ms (Hanning window)
- FFT Processing: 1.5ms (64-point FFT)
- Feature Extraction: 2.0ms (energy, spectral, beat)
- SPI Transfer: 0.5ms (feature packet)
- Headroom: 3.5ms (44% safety margin)

## Feature Extraction

### Tier 0 Features (MVP)

| Feature | Definition | Range | Update Rate | Computation |
|---------|------------|--------|-------------|-------------|
| Overall Energy | RMS of full spectrum | 0-1 (normalized) | 125 Hz | 128 MACs |
| Peak Level | Max sample magnitude | 0-1 | 125 Hz | 128 compares |
| Crest Factor | Peak/RMS ratio | 0-20 dB | 125 Hz | 1 divide |
| Band Energies | 4-band spectral energy | 4×0-1 | 125 Hz | 4×32 MACs |
| Envelope | Smoothed loudness | 0-1 | 125 Hz | 1st-order IIR |

### Tier 1 Features

| Feature | Definition | Range | Update Rate | Computation |
|---------|------------|--------|-------------|-------------|
| Beat Detection | Onset/transient energy | 0-1 | 125 Hz | 256 MACs |
| Tempo Estimate | BPM from beat intervals | 60-180 BPM | 2 Hz | History buffer |
| Spectral Centroid | Brightness indicator | 0-8 kHz | 125 Hz | 64 MACs |
| Spectral Rolloff | Frequency distribution | 0-8 kHz | 125 Hz | 64 MACs |
| Zero Crossing Rate | Noisiness metric | 0-1 | 125 Hz | 128 compares |

### Tier 2 Features (Future)
- Mood Classification: Aggression vs Calm (ML-based)
- Energy Curve: Temporal energy patterns
- Spectral Flux: Timbre changes
- Pitch Detection: Fundamental frequency
- Harmonic Content: Harmonic vs noise ratio

## Audio-Side Error Handling

### Failure Detection
- Mic Disconnect: Constant values, DC offset > 0.9
- Signal Clipping: Consecutive samples at max value
- Noise Floor: RMS < 0.01 for >100ms
- Clock Errors: I2S buffer underflow/overflow

### Error Signaling
- SPI Status Flags: 8-bit error code in feature packet
- Safe Values: Freeze last valid features, fade to zero
- Recovery: Auto-reset after 1 second of valid signal
- Telemetry: Error counters, quality metrics