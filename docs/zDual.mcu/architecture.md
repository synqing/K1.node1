# System Decomposition: High-Level Architecture

## Recommended Baseline: Dual-MCU Architecture

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

## Architecture Comparison

| Architecture | Pros | Cons | Recommendation |
|-------------|------|------|----------------|
| Single MCU | Simple, lower cost, unified memory | CPU contention, timing conflicts, limited headroom | Not suitable for real-time constraints |
| Dual MCU (Recommended) | Clean separation, dedicated resources, scalable, fault isolation | Higher cost, SPI complexity | Baseline choice |
| Triple MCU | Ultimate separation, backup audio path | Overkill for initial product, complexity | Future consideration only |

## Component Responsibilities

### Audio MCU (MCU-A)
- Audio Capture: PDM microphone interface, I²S digital audio inputs
- Real-time DSP: PDM→PCM conversion, filtering, spectral analysis
- Feature Extraction: Energy, spectral, beat detection, mood analysis
- SPI Interface: Slave mode, versioned feature packet transmission
- Error Handling: Mic failure detection, signal quality monitoring

### Render MCU (MCU-B)
- SPI Master: Polls audio MCU for feature packets
- Visual Pipeline: Feature mapping, effect selection, rendering
- LED Control: RMT/DMA-driven LED strip output
- User Interface: Encoders, buttons, display (if present)
- External Comms: USB/serial, Wi‑Fi/Ethernet (future)

### Inter-MCU Link (SPI)
- Master-Slave: Render MCU polls Audio MCU
- Versioned Protocol: Extensible packet format with CRC
- Deterministic Timing: Fixed cadence per audio frame
- Error Detection: Sync words, checksums, timeout handling