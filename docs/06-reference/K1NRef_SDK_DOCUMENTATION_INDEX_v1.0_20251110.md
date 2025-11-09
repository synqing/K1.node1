# K1.node1 SDK Documentation Index

**Version**: 1.0
**Date**: 2025-11-10
**Status**: Complete and Production Ready

---

## Overview

Complete SDK documentation for the K1.node1 graph-based pattern system. Provides everything needed to design, generate, and deploy custom LED patterns.

**Total Documentation**: 5,200+ lines across 5 primary documents
**Examples**: 5 fully-working template patterns
**Node Types**: 38 documented with examples
**API Endpoints**: 20+ documented with response formats

---

## Documentation Structure

### 1. Getting Started (30 minutes)

**Start here if you're new to K1.node1**

**File**: `K1NGuid_QUICK_START_v1.0_20251110.md`
**Lines**: 462
**Reading Time**: 15 minutes
**Hands-On Time**: 15 minutes

**Contents**:
- Prerequisites and setup
- 8-step walkthrough to first pattern
- Copy-paste curl commands
- Troubleshooting for beginners
- Next steps and learning path

**What you'll create**: Hello World pattern (fill LEDs with color)

**Key Sections**:
1. Understand pattern concept (3 min)
2. Design pattern (2 min)
3. Create JSON (5 min)
4. Validate locally (2 min)
5. Validate on device (3 min)
6. Generate code (2 min)
7. Load on device (3 min)
8. Test pattern (2 min)

---

### 2. Complete Developer Guide (2-3 hours)

**Reference and learning guide for all SDK features**

**File**: `K1NRef_SDK_DEVELOPER_GUIDE_v1.0_20251110.md`
**Lines**: 1,732
**Reading Time**: 90 minutes
**Hands-On Time**: 60 minutes

**Comprehensive Contents**:

#### Section 1: SDK Overview
- What is the graph system
- Core concepts (nodes, graphs, patterns)
- Typical workflow
- Benefits vs. hand-coded C++

#### Section 2: Graph System Architecture (with diagrams)
- System architecture diagram
- Data flow architecture
- Node execution model
- JSON to C++ pipeline

#### Section 3: Node Type Catalog
- 9 node categories
- 5 audio input nodes
- 8 audio processing nodes
- 6 signal processing nodes
- 4 temporal nodes
- 5 spatial nodes
- 4 color nodes
- 3 rendering nodes
- 2 control flow nodes
- 2 state management nodes
- Complete reference table with all 38 types

#### Section 4: Code Generation Pipeline
- 5 stages of generation
- Validation rules and checks
- Optimization techniques
- Verification procedures

#### Section 5: Pattern Development Workflow
- Complete example: Spectrum pattern
- Design phase (paper sketch)
- JSON definition
- Local validation
- Code generation
- Integration testing
- Hardware testing
- Optimization iteration

#### Section 6: Best Practices
- Design principles
- Performance guidelines
- Code quality standards
- Common pitfalls and solutions

#### Section 7: API Reference (Quick)
- Pattern management endpoints
- Device management
- Code generation API
- Error codes

#### Section 8: Troubleshooting
- Common issues and solutions
- Debugging techniques
- FAQ section

#### Section 9: Advanced Topics
- Custom node extensions
- Graph composition
- Performance optimization techniques

---

### 3. Complete Node Type Catalog (1-2 hours)

**Exhaustive reference for all 38 node types**

**File**: `K1NRef_NODE_CATALOG_v1.0_20251110.md`
**Lines**: 1,348
**Reading Time**: 60 minutes
**Reference Format**: Searchable by type, category, performance

**Complete Details for Every Node**:

Each node includes:
- **Category**: Classification (audio, signal, color, etc.)
- **Execution Time**: Microseconds on ESP32-S3
- **Memory**: RAM required
- **Thread Safe**: Concurrency notes
- **Description**: What it does and why
- **Inputs**: Parameter types
- **Outputs**: Return types
- **Parameters**: All configurable values with ranges
- **JSON Definition**: Complete working example
- **Generated C++**: What code it produces
- **Use Cases**: When to use this node
- **Performance Notes**: Optimization tips
- **Compatibility**: Platform requirements

**Node Organization**:

**Audio Input Nodes** (5 types):
1. AudioMicrophone - Raw samples from ADC
2. AudioFFT - Frequency domain analysis
3. AudioEnvelope - Amplitude peak follower
4. AudioRMS - Energy measurement
5. AudioBeat - Onset detection

**Audio Processing Nodes** (8 types):
6. AudioFilter - IIR filtering
7. AudioCompressor - Dynamic range compression
8. AudioNormalizer - Automatic gain control
9. AudioGate - Threshold gating
10. AudioExpander - Inverse compression
11. AudioDelay - Time delay
12. AudioReverb - Reverberation
13. AudioDistortion - Nonlinear effects

**Signal Processing Nodes** (6 types):
14. SignalInterpolate - Array interpolation
15. SignalMagnitude - Response curves
16. SignalPhase - Phase extraction
17. SignalConvolve - Convolution
18. SignalDerivative - Derivative
19. SignalIntegrate - Integration

**Temporal Nodes** (4 types):
20. TemporalDecay - Time-based decay
21. TemporalDelay - Ring buffer delay
22. TemporalSmooth - Exponential smoothing
23. TemporalLag - Frame lag

**Spatial Nodes** (5 types):
24. SpatialMirror - Mirror positions
25. SpatialBlur - Gaussian blur
26. SpatialWave - Wave propagation
27. SpatialScroll - Motion effects
28. SpatialWarp - Coordinate distortion

**Color Nodes** (4 types):
29. ColorLookup - Palette color selection
30. ColorBlend - Linear color interpolation
31. ColorHSV - HSV to RGB conversion
32. ColorToGrayscale - Luminance extraction

**Rendering Nodes** (3 types):
33. RenderingAssign - Write to LED buffer
34. RenderingFill - Fill range of LEDs
35. RenderingAdditive - Blending mode

**Control Flow Nodes** (2 types):
36. Conditional - If/else branching
37. Loop - Iteration over range

**State Management Nodes** (2 types):
38. StatefulBuffer - Persistent float buffer
39. StatefulCounter - Persistent counter

**Features**:
- Quick reference table (all 38 types, one row each)
- Node selection guide (by use case)
- Performance comparison matrix
- Performance baseline (total budget analysis)

---

### 4. REST & WebSocket API Reference (1 hour)

**Complete API documentation with examples**

**File**: `K1NRef_API_REFERENCE_v1.0_20251110.md`
**Lines**: 971
**Format**: Reference with JSON examples

**API Coverage**:

**REST Endpoints** (20+):
- Pattern Management
  - GET /api/patterns (list all)
  - GET /api/patterns/{id} (details)
  - POST /api/patterns/{id}/select (switch pattern)
  - PUT /api/patterns/{id}/parameters (adjust settings)
  - GET /api/patterns/{id}/parameters (read current)
  - GET /api/patterns/current (active pattern)

- Device Management
  - GET /api/device/info (device details)
  - GET /api/device/performance (real-time metrics)
  - GET /api/device/status (current state)
  - POST /api/device/reset (soft restart)
  - POST /api/device/factory-reset (full reset)

- Code Generation
  - POST /api/codegen/validate (syntax/semantic check)
  - POST /api/codegen/generate (JSON to C++)

**WebSocket API**:
- Client actions (subscribe, ping)
- Server messages (pattern_changed, param_updated, telemetry, audio_data, error, heartbeat)
- Message format and timestamps
- Subscription types

**Features**:
- Complete JSON request/response examples
- HTTP status codes
- Error code reference (0-9)
- Rate limiting rules
- Authentication info (currently none)
- CORS headers
- Versioning strategy
- Example workflows
- SDK availability (JavaScript, Python, Go, Rust)

---

### 5. FAQ & Troubleshooting Guide (45 minutes)

**Quick answers to 25+ common questions**

**File**: `K1NGuid_FAQ_TROUBLESHOOTING_v1.0_20251110.md`
**Lines**: 685
**Format**: Q&A with practical solutions

**FAQ Sections**:

**General Questions** (5 questions):
- What is the graph system?
- Do I need C++?
- What patterns can I create?
- Can I run multiple patterns?
- How many patterns can I have?

**Pattern Design** (10 questions):
- Nodes vs. parameters
- Maximum complexity
- How to optimize
- Runtime modifications
- Audio reactivity best practices

**Code Generation** (5 questions):
- What does it do?
- Complexity accuracy
- Using generated code
- Failure scenarios
- Debugging generated code

**Performance** (5 questions):
- Frame drops
- Memory usage
- LED count impact
- Maximum LED count
- Benchmarking

**Audio** (5 questions):
- Enabling audio
- Microphone connection
- Sensitivity adjustment
- Bass/mid/treble separation
- Beat detection

**Troubleshooting Issues** (10+ scenarios):
- Pattern doesn't load
- Code generation fails
- Visual artifacts/flicker
- Audio not responding
- REST API slow/timeout
- Custom parameters not working
- Device out of memory
- WiFi drops

**Debugging Techniques** (4 methods):
1. REST diagnostics
2. WebSocket monitoring
3. Serial debugging
4. Minimal test patterns

**Best Practices** (5 tips)
**Glossary** (key terms)
**Getting Help** (resource links)

---

## Example Patterns (5 templates)

**Location**: `examples/`

### 1. Hello World

**File**: `examples/hello_world/hello_world_pattern.json`
**Complexity**: Beginner
**Time**: 5 minutes
**What it does**: Fill all LEDs with red

**Concepts**:
- Minimal node structure
- Basic loop
- Direct LED output

### 2. Spectrum (Audio-Reactive)

**File**: `examples/audio_reactive/spectrum_pattern.json`
**Complexity**: Intermediate
**Time**: 15 minutes
**What it does**: FFT visualization with center mirroring

**Concepts**:
- Audio input
- Conditional branching
- Spatial transforms
- Fallback behavior

### 3. Trail (Stateful)

**File**: `examples/stateful/trail_pattern.json`
**Complexity**: Intermediate
**Time**: 20 minutes
**What it does**: Audio-responsive peak with decay trail

**Concepts**:
- State persistence
- Frame-to-frame decay
- Audio responsiveness

### 4. Wave (Spatial)

**File**: `examples/spatial/wave_pattern.json`
**Complexity**: Advanced
**Time**: 25 minutes
**What it does**: Animated sine wave with audio modulation

**Concepts**:
- Phase accumulation
- Spatial positioning
- Trigonometry
- Speed modulation

### 5. Gradient (Color Processing)

**File**: `examples/color_processing/gradient_pattern.json`
**Complexity**: Advanced
**Time**: 25 minutes
**What it does**: Multi-palette color blending with audio response

**Concepts**:
- Color operations
- Palette blending
- Hue shifting
- Responsive colors

**Examples Guide**: `examples/README.md`
- Detailed walkthrough of each example
- How to modify each pattern
- Performance baselines
- Deployment workflow
- Common modifications
- Extending examples

---

## Documentation Statistics

### Coverage

| Category | Count | Status |
|----------|-------|--------|
| Node types | 38 | 100% documented |
| Documented with examples | 38 | 100% |
| REST endpoints | 20+ | 100% |
| WebSocket message types | 6+ | 100% |
| Example patterns | 5 | 100% with guides |
| Common issues in FAQ | 25+ | 100% with solutions |

### Scale

| Document | Lines | KB | Reading Time |
|-----------|-------|----|----|
| SDK Developer Guide | 1,732 | 43 | 90 min |
| Node Catalog | 1,348 | 42 | 60 min |
| API Reference | 971 | 38 | 45 min |
| Quick Start | 462 | 16 | 20 min |
| FAQ/Troubleshooting | 685 | 26 | 30 min |
| Examples Guide | 400+ | 20 | 45 min |
| **Total** | **5,598+** | **185** | **290 min** |

### Code Examples

| Type | Count |
|------|-------|
| JSON pattern definitions | 5 |
| REST curl commands | 30+ |
| C++ code snippets | 50+ |
| WebSocket examples | 8 |
| Parameter examples | 20+ |
| Complete workflows | 3 |

---

## How to Use This Documentation

### First Time (30 minutes)

1. **Read**: Quick Start Guide (`K1NGuid_QUICK_START_v1.0_20251110.md`)
2. **Do**: Follow the 8-step walkthrough
3. **Deploy**: Load first pattern on device
4. **Result**: Running Hello World pattern

### Learning Phase (2-3 hours)

1. **Read**: SDK Developer Guide (sections 1-3)
2. **Reference**: Node Catalog (look up node types as needed)
3. **Try**: Modify one of the 5 examples
4. **Deploy**: Test on device
5. **Profile**: Check performance metrics

### Reference Phase (ongoing)

- **Quick lookup**: Node Catalog for specific node details
- **API calls**: API Reference for REST/WebSocket
- **Issues**: FAQ & Troubleshooting for common problems
- **Examples**: Examples directory for patterns to modify
- **Best practices**: SDK Developer Guide sections 6-9

### Advanced (specialized tasks)

- **Custom nodes**: SDK Developer Guide section on "Custom Node Extensions"
- **Optimization**: SDK Developer Guide and Node Catalog performance sections
- **Debugging**: FAQ & Troubleshooting debugging section
- **Complex patterns**: Example patterns show composition techniques

---

## Key Features of This Documentation

### Completeness

- Every node type documented
- Every API endpoint documented
- Every common issue has a solution
- Every concept has examples
- Every workflow step explained

### Accessibility

- Quick Start for absolute beginners
- Glossary for unfamiliar terms
- Examples for every major concept
- Multiple learning paths (beginner to advanced)
- Clear navigation and cross-references

### Practical

- All examples are working patterns
- All code snippets are tested
- All curl commands copy-paste-ready
- All troubleshooting steps are actionable
- All performance metrics are realistic

### Searchable

- Document index (this file)
- Table of contents in each guide
- Node types organized by category
- API endpoints grouped logically
- FAQ indexed by topic

---

## Cross-References

### From Quick Start

→ SDK Developer Guide: Deep dives on any topic
→ Node Catalog: Details on specific node types
→ Examples: Working patterns to learn from
→ FAQ: If you get stuck

### From SDK Developer Guide

→ Node Catalog: Full documentation for each node
→ API Reference: REST/WebSocket details
→ Examples: Real patterns using concepts
→ Quick Start: Simple getting-started walkthrough

### From Node Catalog

→ SDK Developer Guide: How nodes fit together
→ API Reference: Code generation API
→ Examples: Nodes used in real patterns

### From API Reference

→ SDK Developer Guide: Integration patterns
→ Examples: Deployment workflow
→ FAQ: Troubleshooting API issues

### From FAQ

→ Quick Start: Step-by-step help
→ SDK Developer Guide: Detailed explanations
→ Examples: Working patterns to study
→ Node Catalog: Node-specific details

### From Examples

→ SDK Developer Guide: Concepts explained
→ Node Catalog: Details on each node
→ Quick Start: Beginner-friendly intro
→ FAQ: Troubleshooting issues

---

## Learning Paths

### Path 1: "I want to create my first pattern" (30 min)

1. Quick Start Guide (20 min)
2. Try example: Hello World (10 min)
→ Result: Red LED pattern running

### Path 2: "I want to understand the system" (3 hours)

1. Quick Start (20 min)
2. SDK Developer Guide: Sections 1-3 (60 min)
3. Node Catalog: Introduction (30 min)
4. Try example: Spectrum pattern (30 min)
5. Modify example (40 min)
→ Result: Understanding of architecture + custom pattern

### Path 3: "I want to build sophisticated patterns" (6 hours)

1. Complete SDK Developer Guide (90 min)
2. Complete Node Catalog (60 min)
3. Study all 5 example patterns (90 min)
4. Modify examples and combine techniques (120 min)
5. Build new original pattern (60 min)
→ Result: Ability to design any pattern

### Path 4: "I'm debugging/optimizing" (as needed)

1. FAQ & Troubleshooting (find relevant issue)
2. API Reference (debug via REST/WebSocket)
3. Node Catalog (performance section)
4. SDK Developer Guide (optimization section)
→ Result: Issue resolved, pattern optimized

---

## Related Documentation

Beyond this SDK documentation, see also:

- **Architecture Decision Records** (`docs/02-adr/`)
  - ADR-0006: Graph System Architecture Decision

- **Implementation Guides** (`docs/09-implementation/`)
  - Spectrum Graph Conversion implementation notes
  - Code generation integration

- **Analysis** (`docs/05-analysis/`)
  - Graph system validation and verification

---

## Version History

### v1.0 (2025-11-10)

- Initial release
- Complete SDK documentation (5 documents)
- 38 node types documented
- 20+ REST/WebSocket endpoints
- 5 working example patterns
- Comprehensive FAQ (25+ issues)
- Complete node catalog with performance

**Status**: Production Ready

---

## Feedback & Improvements

This documentation is complete and accurate as of 2025-11-10.

For updates:
- Check version number in each document
- See git history for changes
- Review related ADRs for architectural updates

---

## Quick Links

| Need | Go To |
|------|--------|
| Getting started | `K1NGuid_QUICK_START_v1.0_20251110.md` |
| Understand system | `K1NRef_SDK_DEVELOPER_GUIDE_v1.0_20251110.md` |
| Find node type | `K1NRef_NODE_CATALOG_v1.0_20251110.md` |
| Call API | `K1NRef_API_REFERENCE_v1.0_20251110.md` |
| Solve problem | `K1NGuid_FAQ_TROUBLESHOOTING_v1.0_20251110.md` |
| Copy pattern | `examples/README.md` |
| Something specific | Use Ctrl+F to search this index |

---

**Documentation Complete**

All 5,598+ lines of documentation are production-ready and validated.

Developers can now:
- Build their first pattern in 30 minutes
- Understand the complete system in 2-3 hours
- Create sophisticated visualizations with examples
- Debug issues systematically
- Optimize for best performance

Happy pattern creating!

---

**End of SDK Documentation Index v1.0**
