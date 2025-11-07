---
status: published
author: Architect-Review
date: 2025-11-05
intent: Define stateful node system architecture for audio-reactive patterns
---

# ADR-0007: Stateful Node Architecture

## Decision

**Implement 35-40 node types with pre-allocated stateful buffers for audio-reactive pattern generation.**

## Node Categories

- **Input Nodes (7):** time, parameters, audio snapshots
- **Transform Nodes (12):** math, interpolation, response curves
- **Generator Nodes (6):** gradients, noise, particles
- **Stateful Nodes (8):** beat buffers, frequency analysis, attack detection
- **Output Nodes (2):** LED output, symmetry operations

## Stateful Node Implementation

Each stateful node maintains pre-allocated buffers:
- **Beat History:** 32 entries × 4 bytes = 128 bytes
- **Frequency Bins:** 128 FFT bins × 2 bytes = 256 bytes
- **Attack Detector:** Simple moving average (32 samples) = 128 bytes
- **Total per node:** ~500 bytes (pre-calculated, no malloc)

## Performance Requirements

- **FPS Impact:** <2% overhead from graph interpretation
- **Memory:** <1KB per stateful node
- **Thread Safety:** Lock-free audio snapshot passing to render pipeline
- **Compile Time:** <5 seconds for pattern graph→C++

## Implementation Strategy

1. Pre-allocate all buffers at pattern load time
2. Use circular buffers for audio history (no dynamic allocation)
3. Lock-free queue for audio snapshot passing between threads
4. Compile graphs to C++ with inline optimization

---
**Decision Date:** November 5, 2025
**References:** STATEFUL_NODE_FEASIBILITY_ASSESSMENT.md
