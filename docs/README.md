# SpectraSynq / K1-Lightwave Documentation

## Overview

This documentation set describes the architecture and data-flow for SpectraSynq’s dual-MCU real-time audio→visual system, built initially on ESP32‑S3 and designed for scalability.

### Sections
- [Mission Context](#mission-context)
- [Architecture](architecture.md)
- [SPI Protocol](spi_protocol.md)
- [Audio Pipeline](audio_pipeline.md)
- [Visual Pipeline](visual_pipeline.md)
- [Real-Time & Scheduling](real_time.md)
- [Resources & Throughput](resources_throughput.md)
- [Error & Robustness](error_robustness.md)
- [Maintainability](maintainability.md)
- [Scalability & Integration](scalability.md)
- [Telemetry & Ops](telemetry_ops.md)
- [Deliverables Summary](deliverables.md)
- [Research References](references.md)
- [Appendix Examples](appendix_examples.md)

### Legacy
- Archived consolidated documents are under `docs/legacy/`.

## Mission Context

This system ingests live audio (I2S MEMS mic and/or digital/I²S), performs low-latency analysis, streams compact feature vectors over SPI to a renderer, and drives hundreds of addressable LEDs with bounded latency from sound to photon. It supports immediate prototyping on dual ESP32‑S3 and provides a long-term path to more complex multi-node and SoC-based systems.
