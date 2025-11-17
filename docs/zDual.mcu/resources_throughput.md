# Computational Resource & Throughput Analysis

## ESP32‑S3 Resource Assessment

### CPU Usage Estimates (@ 240 MHz)

| Configuration | Audio MCU | Render MCU | Notes |
|---------------|-----------|------------|--------|
| Tier 0 Only | 25% | 35% | Comfortable headroom |
| Tier 0 + 1 | 45% | 55% | Acceptable for production |
| Tier 0 + 1 + 2 | 75% | 80% | Marginal, needs optimization |
| 32 kHz Sample Rate | 60% | 70% | CPU scales with sample rate |

### Memory Footprint

#### Audio MCU
- Code: 128 KB
- Static Data: 32 KB
- Heap: 16 KB
- Stack: 8 KB per task × 4 tasks = 32 KB
- Audio Buffers: 8 KB
- Feature History: 4 KB
- Total: ~220 KB

#### Render MCU
- Code: 96 KB
- Static Data: 24 KB
- Heap: 12 KB
- Stack: 8 KB per task × 4 tasks = 32 KB
- LED Buffers: 18 KB (300 LEDs × 3 colors × 2 buffers)
- Feature State: 2 KB
- Total: ~184 KB

### Data Throughput

| Interface | Data Rate | Notes |
|-----------|-----------|--------|
| PDM Audio | 16.4 Mbps | 1.024 MHz clock × 1 bit |
| PCM Audio | 256 kbps | 16 kHz × 16 bits |
| SPI Features | 16 kbps | 32 bytes × 125 Hz |
| LED Data | 432 kbps | 300 LEDs × 24 bits × 60 FPS |

## Bottleneck Analysis

### Critical Path
1. FFT Processing: 64‑point FFT dominates audio MCU
2. LED Refresh: 300 LEDs @ 60 FPS challenges RMT timing
3. SPI Polling: 125 Hz rate must be maintained
4. Memory Bandwidth: LED double buffering stresses DMA

### Mitigation Strategies
- Fixed‑point math: Q15 format for DSP operations
- Assembly optimization: ESP32‑S3 SIMD instructions
- DMA utilization: Offload memory transfers
- Pipeline optimization: Parallel processing where possible