---
author: Claude Audit Agent
date: 2025-11-05 14:30 UTC+8
status: draft
intent: Comprehensive audit identifying untracked ONWARDS work items beyond Week 1 (Nov 6-13) execution plan
references:
  - TASKS.md (Week 1 execution plan)
  - PHASE_2_COMPLETE_ROADMAP.md (30-week Phase C + PF-5 scope)
  - firmware/src/ codebase analysis
  - webapp/src/ codebase analysis
---

# ONWARDS Task Audit: Complete Phase 2 & Beyond Work Items
**Status:** Draft | **Generated:** 2025-11-05 14:30 UTC+8

---

## Executive Summary

**Scope:** Full identification of tasks NOT currently tracked in TaskMaster that belong to Phase 2 (Weeks 2-20+) and beyond.

**Findings:**
- **56+ untracked Phase C tasks** (Node Graph Editor infrastructure, canvas, features, polish)
- **60+ untracked PF-5 tasks** (Audio reactivity, color intelligence, NLP, personalization, safety)
- **5 pending code refactors/TODOs** (WebSocket transport, testing gaps)
- **3 critical infrastructure gaps** (CI/CD, test harness expansion, profiling framework)
- **Total effort:** ~1,200 hours over 20+ weeks (30-person weeks, 3-4 engineers)

**Decision Gate Impact:** Nov 13 outcome determines which path (A or B) to track:
- **Path A (Graph System):** Execute 56 Phase C + 30 PF-5.1-5.2 tasks compressed (8 weeks)
- **Path B (C++ SDK):** Defer Phase C; execute 20 C++ SDK + 15 pattern port tasks (10 weeks)

---

## SECTION 1: Pending Code Refactors & TODOs

### Webapp TODOs (Immediate Priority)

**1.1: WebSocket Transport Implementation**
- **Location:** `webapp/src/hooks/useParameterTransport.ts`
- **Status:** TODO marker found in code
- **Work Items:**
  - Implement actual WebSocket detection (currently stubbed)
  - Implement WebSocket transport layer
  - Add connection pooling & reconnection logic
  - Add message queuing for offline scenarios
- **Effort:** 8 hours
- **Blocking:** Real-time parameter updates, audio reactivity features
- **Recommendation:** Move to Week 2 startup (add to TaskMaster before Nov 13)

**1.2: Test Coverage Gaps (Webapp)**
- **Identified via code audit:**
  - `RealTimeParameterControls.test.tsx` — partial coverage
  - `PatternSelector.test.tsx` — partial coverage
  - Missing: Graph editor test suite (planned but not started)
  - Missing: WebSocket integration tests
- **Work Items:**
  - Expand control component tests (60 hours)
  - Add graph editor unit tests (80 hours)
  - Add WebSocket integration tests (40 hours)
  - Add E2E tests for critical flows (60 hours)
- **Effort:** 240 hours total
- **Recommendation:** Phase into weeks 2-4 per QA roadmap

### Firmware TODOs (Code Quality)

**1.3: Firmware Logging Refactor**
- **Note:** No explicit TODO markers found, but logging is verbose
- **Observations:**
  - `firmware/src/logging/` system in place with DEBUG level control
  - Profiler, WiFi, audio, webserver all have heavy LOG_DEBUG calls
  - Performance: Debug logs may impact ~1-2% FPS in debug builds
- **Recommendation:** Leave as-is for Week 1; optimize in Phase 2 hardening

**1.4: Pattern Code Generation**
- **File:** `firmware/src/generated_patterns.h` (15 hardcoded patterns)
- **Note:** This will be REPLACED by Phase C node graph compiler
- **Recommendation:** No refactor needed; Graph PoC will obsolete this

---

## SECTION 2: Phase C Node Graph Editor Tasks (56 Total, 400 hours)

### Phase C.1: Core Infrastructure & Architecture (Weeks 1-3 post-decision, ~80 hours)

**2.1.1: Node Type Specification & Registry**
- **Subtasks:**
  - [ ] Define 35-40 node type specs (Input, Transform, Generator, Stateful, Output)
  - [ ] Create node type registry (C++ enum + metadata)
  - [ ] Add runtime type validation
  - [ ] Create documentation for each type
  - [ ] Add visual icons for node palette
- **Effort:** 25 hours | **Owner:** Architect
- **Blocking:** Everything in C.2-C.4

**2.1.2: Graph-to-C++ Compiler**
- **Subtasks:**
  - [ ] JSON graph format specification
  - [ ] Parser + validator (error messages)
  - [ ] C++ code generation engine
  - [ ] Symbol table & type inference
  - [ ] Memory layout optimizer
  - [ ] Unit tests (20+ test graphs)
- **Effort:** 35 hours | **Owner:** Backend Engineer
- **Blocking:** C.3 pattern preview, C.4 deployment

**2.1.3: Type System & Validation Engine**
- **Subtasks:**
  - [ ] Type compatibility rules (float→int, signal→trigger, etc.)
  - [ ] Dataflow analysis (cycle detection, deadlock prevention)
  - [ ] Memory pre-allocation strategy (node lifecycle)
  - [ ] Error reporting (clear messages for user)
  - [ ] Validation test suite
- **Effort:** 15 hours | **Owner:** Architect
- **Blocking:** C.2 canvas interactions

**2.1.4: Memory Pooling Infrastructure**
- **Subtasks:**
  - [ ] Memory pool allocator design
  - [ ] Pre-allocation for node instances
  - [ ] Fragmentation analysis tools
  - [ ] Memory accounting per node (<500 bytes target)
  - [ ] Stress tests (100+ nodes)
- **Effort:** 5 hours | **Owner:** Firmware Engineer
- **Blocking:** C.3 performance targets

---

### Phase C.2: Canvas & Interactive Graph Editor (Weeks 4-7 post-decision, ~120 hours)

**2.2.1: Canvas Rendering Engine**
- **Subtasks:**
  - [ ] Choose rendering backend (WebGL vs Canvas 2D + React)
  - [ ] Implement node position rendering
  - [ ] Implement connection lines (bezier curves)
  - [ ] Implement selection highlighting
  - [ ] Performance optimization (culling, batching)
- **Effort:** 30 hours | **Owner:** Frontend Engineer
- **Blocking:** C.2.2-2.2.5

**2.2.2: Node Palette & Dragging**
- **Subtasks:**
  - [ ] Design node palette UI (searchable, categorized)
  - [ ] Implement drag-from-palette interaction
  - [ ] Implement node creation on canvas
  - [ ] Implement node property editor sidebar
  - [ ] Add icons for each node type
- **Effort:** 25 hours | **Owner:** Frontend Engineer
- **Blocking:** C.2.3-2.2.5

**2.2.3: Connection/Linking System**
- **Subtasks:**
  - [ ] Implement click-to-connect interaction
  - [ ] Validate connections (type checking)
  - [ ] Visual feedback for invalid connections
  - [ ] Connection deletion
  - [ ] Multi-connection handling (fan-out/fan-in)
- **Effort:** 20 hours | **Owner:** Frontend Engineer
- **Blocking:** C.2.4

**2.2.4: Zoom/Pan Controls & Viewport**
- **Subtasks:**
  - [ ] Mouse wheel zoom
  - [ ] Panning (middle-click drag)
  - [ ] Fit-to-view button
  - [ ] Minimap overlay
  - [ ] Keyboard shortcuts (+ / - / Home)
- **Effort:** 15 hours | **Owner:** Frontend Engineer
- **Blocking:** C.2.5

**2.2.5: Real-Time Validation Feedback**
- **Subtasks:**
  - [ ] Type error highlighting
  - [ ] Cycle detection visual indicators
  - [ ] Memory warnings (approaching limits)
  - [ ] Tooltip error messages
  - [ ] Error panel summary
- **Effort:** 15 hours | **Owner:** Frontend Engineer
- **Blocking:** Polish phase

**2.2.6: Undo/Redo Stack**
- **Subtasks:**
  - [ ] Command pattern implementation
  - [ ] History buffer (50+ actions)
  - [ ] Undo/Redo buttons
  - [ ] Keyboard shortcuts (Ctrl+Z / Ctrl+Y)
- **Effort:** 10 hours | **Owner:** Frontend Engineer

**2.2.7: Graph Save/Load (JSON Persistence)**
- **Subtasks:**
  - [ ] JSON schema for graph format
  - [ ] Serializer (graph → JSON)
  - [ ] Deserializer (JSON → graph)
  - [ ] File I/O (download/upload)
  - [ ] LocalStorage backup (auto-save every 30s)
- **Effort:** 10 hours | **Owner:** Frontend Engineer
- **Blocking:** C.3 pattern library

---

### Phase C.3: Features & Pattern Preview (Weeks 8-10 post-decision, ~100 hours)

**2.3.1: Embedded Pattern Executor**
- **Subtasks:**
  - [ ] Create embedded C++ executor (compiles + loads patterns at runtime)
  - [ ] WebAssembly compilation option
  - [ ] Safety sandbox (memory limits, timeout)
  - [ ] Error reporting (stack traces)
- **Effort:** 30 hours | **Owner:** Firmware + Backend Engineer
- **Blocking:** C.3.2-2.3.4

**2.3.2: Live Preview on Virtual Simulator**
- **Subtasks:**
  - [ ] Create LED array simulator (Canvas/WebGL)
  - [ ] Render LED state in real-time
  - [ ] Show FPS counter + metrics
  - [ ] Add adjustable LED count + layout
  - [ ] Zoom/pan controls
- **Effort:** 25 hours | **Owner:** Frontend Engineer
- **Blocking:** C.3.3

**2.3.3: Audio Input Capture (Web Audio API)**
- **Subtasks:**
  - [ ] Microphone permission handling
  - [ ] Real-time audio capture pipeline
  - [ ] Frequency analysis (FFT)
  - [ ] Beat detection integration
  - [ ] Audio level visualization
- **Effort:** 20 hours | **Owner:** Backend Engineer
- **Blocking:** PF-5.1 (audio reactivity)

**2.3.4: Real-Time Performance Metrics**
- **Subtasks:**
  - [ ] FPS measurement + display
  - [ ] Memory usage tracking
  - [ ] CPU load estimation
  - [ ] Frame time breakdown (compile, render, wait, transmit)
  - [ ] Metrics history chart
- **Effort:** 15 hours | **Owner:** Firmware + Frontend Engineer

**2.3.5: Pattern Library Management**
- **Subtasks:**
  - [ ] Library UI (list view, search, tags)
  - [ ] Save current graph to library
  - [ ] Load library pattern to canvas
  - [ ] Delete/rename patterns
  - [ ] Export library (JSON, share)
- **Effort:** 15 hours | **Owner:** Frontend Engineer

**2.3.6: Hard-Coded Pattern Importer**
- **Subtasks:**
  - [ ] Analyze existing 15 patterns in `generated_patterns.h`
  - [ ] Extract pattern logic to node graphs (1-2h per pattern)
  - [ ] Create conversion tool (automated where possible)
  - [ ] Validate output vs original (visual comparison)
  - [ ] Test on hardware (24h+ stability)
- **Effort:** 30 hours total (2-3h per pattern × 15 patterns)
- **Owner:** Architect
- **Blocking:** C.4 release

---

### Phase C.4: Polish & Release Prep (Weeks 11-12 post-decision, ~60 hours)

**2.4.1: Design Iteration Cycles**
- **Subtasks:**
  - [ ] Gather UX feedback (3-5 rounds of testing)
  - [ ] Refine UI layouts based on feedback
  - [ ] A/B test canvas rendering approaches
  - [ ] Polish animations (transitions, hover states)
  - [ ] User testing with 10+ external users
- **Effort:** 20 hours | **Owner:** Frontend Engineer + Designer
- **Blocking:** Release

**2.4.2: Performance Profiling & Optimization**
- **Subtasks:**
  - [ ] Profile canvas rendering (target 60 FPS with 50+ nodes)
  - [ ] Optimize graph compiler (target <500ms for complex graphs)
  - [ ] Memory footprint analysis (target <100MB total UI)
  - [ ] Identify & fix bottlenecks
  - [ ] Stress test (large graphs, rapid interactions)
- **Effort:** 15 hours | **Owner:** Frontend + Firmware Engineer
- **Blocking:** Release

**2.4.3: Accessibility Audit (WCAG 2.1 AA)**
- **Subtasks:**
  - [ ] Automated accessibility scan
  - [ ] Manual keyboard navigation testing
  - [ ] Screen reader testing
  - [ ] Color contrast verification
  - [ ] Add missing ARIA labels
- **Effort:** 10 hours | **Owner:** Frontend Engineer
- **Blocking:** Release

**2.4.4: User Documentation + Tutorials**
- **Subtasks:**
  - [ ] Write Node Graph Editor guide (5-10 pages)
  - [ ] Create video tutorials (3-5 videos)
  - [ ] Write API documentation for node types
  - [ ] Create troubleshooting guide
  - [ ] Add in-app tooltips + help
- **Effort:** 10 hours | **Owner:** Technical Writer
- **Blocking:** Release

**2.4.5: Storybook Component Library**
- **Subtasks:**
  - [ ] Create Storybook config + stories for 30+ components
  - [ ] Document component props + variants
  - [ ] Add accessibility annotations
  - [ ] Create design tokens documentation
- **Effort:** 5 hours | **Owner:** Frontend Engineer
- **Blocking:** Marketplace / future extensions

---

## SECTION 3: PF-5 AI-Powered Creative Features Tasks (60 Total, 800+ hours)

### PF-5.1: Audio Reactivity (Weeks 1-4 post-decision, ~120 hours)

**3.1.1: Web Audio API Integration**
- **Subtasks:**
  - [ ] Audio context setup
  - [ ] Microphone permission + fallback
  - [ ] System audio capture (optional, browser-dependent)
  - [ ] Audio buffer management
- **Effort:** 12 hours | **Owner:** Backend Engineer

**3.1.2: Spectral Analysis Pipeline**
- **Subtasks:**
  - [ ] FFT implementation (or Web Audio analyser)
  - [ ] Frequency band extraction (bass, mid, treble)
  - [ ] Energy calculation per band
  - [ ] Smoothing filter (avoid jitter)
  - [ ] Real-time visualization
- **Effort:** 20 hours | **Owner:** Backend Engineer

**3.1.3: Tempo Tracking & Beat Detection**
- **Subtasks:**
  - [ ] Implement beat detection algorithm (>85% accuracy target)
  - [ ] Tempo estimation (BPM detection)
  - [ ] Confidence scoring
  - [ ] Fallback for silence/speech
  - [ ] Test suite (100+ audio samples across genres)
- **Effort:** 40 hours | **Owner:** Backend Engineer
- **Blocking:** PF-5.3 (language model needs tempo context)

**3.1.4: Audio-Reactive Node Types**
- **Subtasks:**
  - [ ] BeatDetector node (fires on detected beats)
  - [ ] FrequencyMapper node (maps frequencies to parameters)
  - [ ] EnergyNode (outputs audio energy level)
  - [ ] TempoNode (outputs BPM info)
  - [ ] Unit tests for each node type
- **Effort:** 25 hours | **Owner:** Architect
- **Blocking:** C.1 (must be in node registry)

**3.1.5: Testing & Validation**
- **Subtasks:**
  - [ ] Beat detection accuracy tests (10+ genres)
  - [ ] Frequency mapping tests
  - [ ] Latency tests (<100ms)
  - [ ] Stress tests (continuous audio for 24h)
  - [ ] User testing (does it feel responsive?)
- **Effort:** 23 hours | **Owner:** QA Engineer
- **Blocking:** PF-5.2

---

### PF-5.2: Color Intelligence (Weeks 5-10 post-decision, ~160 hours)

**3.2.1: ONNX Runtime Integration**
- **Subtasks:**
  - [ ] Choose ML model (e.g., MobileNet for image classification)
  - [ ] Set up ONNX inference (browser or Node.js)
  - [ ] Model quantization for speed
  - [ ] Fallback for unsupported platforms
- **Effort:** 20 hours | **Owner:** Backend Engineer

**3.2.2: Video Frame Analysis**
- **Subtasks:**
  - [ ] Capture video frame (webcam or uploaded)
  - [ ] Resize for model (e.g., 224×224)
  - [ ] Run inference (object detection)
  - [ ] Extract key regions (dominant objects)
  - [ ] Cache results (avoid redundant inference)
- **Effort:** 25 hours | **Owner:** Backend Engineer

**3.2.3: Color Extraction & Clustering**
- **Subtasks:**
  - [ ] Extract dominant colors from frame
  - [ ] K-Means clustering (3-5 colors)
  - [ ] Color sorting (saturation, brightness)
  - [ ] Palette export (list of hex colors)
- **Effort:** 20 hours | **Owner:** Backend Engineer

**3.2.4: Harmony Rules Engine**
- **Subtasks:**
  - [ ] Implement color harmony rules (complementary, analogous, triadic)
  - [ ] Generate alternative palettes from extracted colors
  - [ ] Score palettes for aesthetic quality
  - [ ] Fallback to default palettes if generation fails
- **Effort:** 30 hours | **Owner:** Backend Engineer

**3.2.5: Palette Adjustment UI**
- **Subtasks:**
  - [ ] Color picker for each palette color
  - [ ] Palette preview on LED simulator
  - [ ] Save adjusted palette
  - [ ] Undo/redo for palette changes
- **Effort:** 20 hours | **Owner:** Frontend Engineer

**3.2.6: Color Node Types**
- **Subtasks:**
  - [ ] ColorExtract node (outputs dominant color)
  - [ ] PaletteNode (outputs color palette)
  - [ ] ColorAdjust node (HSL adjustments)
  - [ ] HarmonyNode (generates harmony palettes)
- **Effort:** 25 hours | **Owner:** Architect

**3.2.7: Testing & Validation**
- **Subtasks:**
  - [ ] Palette aesthetic quality tests (4.0+/5.0 rating)
  - [ ] Model inference speed tests (<50ms target)
  - [ ] Harmony rule validation
  - [ ] User testing (is the palette usable?)
  - [ ] Stress tests (100+ rapid uploads)
- **Effort:** 20 hours | **Owner:** QA Engineer

---

### PF-5.3: Natural Language Control (Weeks 11-18 post-decision, ~200 hours)

**3.3.1: Intent Classification Model**
- **Subtasks:**
  - [ ] Fine-tune MiniLM for intent classification
  - [ ] Define intent taxonomy (20-30 intents)
  - [ ] Training dataset prep (500+ examples)
  - [ ] Model evaluation (>90% accuracy target)
  - [ ] Deployment (ONNX or API endpoint)
- **Effort:** 50 hours | **Owner:** ML Engineer (contract)

**3.3.2: Intent-to-Graph Generation**
- **Subtasks:**
  - [ ] Define mapping: intent → node graph pattern
  - [ ] Template system for common intents
  - [ ] Parameter generation from user input
  - [ ] Fallback patterns for unknown intents
- **Effort:** 40 hours | **Owner:** Backend Engineer

**3.3.3: Voice Input UI**
- **Subtasks:**
  - [ ] Speech-to-text API integration (Web Speech API or Whisper)
  - [ ] Microphone permission handling
  - [ ] Visual feedback during listening
  - [ ] Transcription display
  - [ ] Edit transcription before sending
- **Effort:** 25 hours | **Owner:** Frontend Engineer

**3.3.4: Conversation Loop**
- **Subtasks:**
  - [ ] Parse user clarifications ("darker", "faster", "more bass")
  - [ ] Generate refined graphs from feedback
  - [ ] Conversation history UI
  - [ ] Save conversation (can replay modifications)
- **Effort:** 40 hours | **Owner:** Backend Engineer

**3.3.5: Personality System**
- **Subtasks:**
  - [ ] Define 3-5 creative personalities (e.g., "vibrant", "calm", "psychedelic")
  - [ ] Modify generation rules per personality
  - [ ] Personality selector UI
  - [ ] Store user's preferred personality
- **Effort:** 25 hours | **Owner:** Backend Engineer

**3.3.6: Fallback Patterns**
- **Subtasks:**
  - [ ] Create 10+ fallback patterns for unknown intents
  - [ ] Route unknown intents to fallbacks with user notification
  - [ ] Improve intent detection over time (user feedback loop)
- **Effort:** 20 hours | **Owner:** Backend Engineer

---

### PF-5.4: Personalization & Learning (Weeks 19-28 post-decision, ~240 hours)

**3.4.1: User Preference Tracking**
- **Subtasks:**
  - [ ] Track pattern usage (play count, duration)
  - [ ] Track pattern ratings (thumbs up/down)
  - [ ] Track saves (user library)
  - [ ] Track parameter changes (what do users customize?)
  - [ ] Analytics pipeline (batch + real-time)
- **Effort:** 40 hours | **Owner:** Backend Engineer

**3.4.2: Recommendation Engine**
- **Subtasks:**
  - [ ] Collaborative filtering (user-user, item-item)
  - [ ] Content-based filtering (pattern features → similar patterns)
  - [ ] Hybrid approach (combine both)
  - [ ] Cold-start problem (new users, new patterns)
  - [ ] A/B test recommendations (measure engagement)
- **Effort:** 60 hours | **Owner:** Backend Engineer
- **Blocking:** A/B testing framework

**3.4.3: A/B Testing Framework**
- **Subtasks:**
  - [ ] Experiment assignment (user cohorts)
  - [ ] Variant management (5+ concurrent tests)
  - [ ] Metrics collection (conversion, engagement, retention)
  - [ ] Statistical significance testing
  - [ ] Result reporting dashboard
- **Effort:** 50 hours | **Owner:** Backend Engineer + Data Analyst
- **Blocking:** PF-5.5 (release needs data)

**3.4.4: Analytics Pipeline**
- **Subtasks:**
  - [ ] Event tracking (20+ event types)
  - [ ] Data warehouse (BigQuery, Snowflake, or self-hosted)
  - [ ] ETL pipeline (real-time + batch)
  - [ ] Dashboard (user behavior, trends, anomalies)
  - [ ] Alerts (unusual usage patterns)
- **Effort:** 50 hours | **Owner:** Data Analyst
- **Blocking:** PF-5.5

**3.4.5: Personalized Generation**
- **Subtasks:**
  - [ ] Adapt generation to user style (color preferences, tempo, complexity)
  - [ ] Boost recommendations for user's preferred patterns
  - [ ] Avoid recommending disliked categories
  - [ ] Freshness vs. relevance (balance novelty and known good)
- **Effort:** 30 hours | **Owner:** Backend Engineer
- **Blocking:** Recommendation engine must be working

**3.4.6: Marketplace Integration**
- **Subtasks:**
  - [ ] Pattern publishing UI (share with community)
  - [ ] Marketplace discovery (search, filter, sort)
  - [ ] Creator revenue share (10-30% for pattern authors)
  - [ ] Pattern preview before download
  - [ ] Ratings + reviews (community feedback)
- **Effort:** 40 hours | **Owner:** Frontend + Backend Engineer
- **Blocking:** PF-5.5

---

### PF-5.5: Safety & Release (Weeks 29-30 post-decision, ~80 hours)

**3.5.1: Photosensitivity Analysis**
- **Subtasks:**
  - [ ] Detect flashing patterns >3Hz
  - [ ] Flag patterns with high red/blue content (migraine risk)
  - [ ] Show warning to users
  - [ ] Allow user override (acknowledge risk)
  - [ ] Log warnings (for compliance)
- **Effort:** 15 hours | **Owner:** Backend Engineer

**3.5.2: WCAG 2.1 AA Compliance Audit**
- **Subtasks:**
  - [ ] Automated accessibility testing (axe-core, etc.)
  - [ ] Manual testing (keyboard, screen reader, vision)
  - [ ] Color contrast verification (4.5:1 for text)
  - [ ] Fix all issues
  - [ ] Retest & document
- **Effort:** 20 hours | **Owner:** QA Engineer + Accessibility Specialist

**3.5.3: Penetration Testing**
- **Subtasks:**
  - [ ] Contract security consultant (or use bug bounty platform)
  - [ ] API endpoint testing (auth, injection, XSS)
  - [ ] Data privacy testing (user data handling)
  - [ ] Infrastructure testing (cloud security)
  - [ ] Fix critical/high vulnerabilities
- **Effort:** 20 hours | **Owner:** Security Consultant (contract)

**3.5.4: Load Testing**
- **Subtasks:**
  - [ ] Simulate 1000+ concurrent users
  - [ ] Measure p95 latency (target <100ms)
  - [ ] Identify bottlenecks
  - [ ] Scale infrastructure as needed
  - [ ] Verify database performance
- **Effort:** 15 hours | **Owner:** Ops Engineer

**3.5.5: Performance Profiling**
- **Subtasks:**
  - [ ] Profile all critical paths (pattern generation, inference, etc.)
  - [ ] Identify hot spots (>10ms threshold)
  - [ ] Optimize or cache results
  - [ ] Retest after optimization
- **Effort:** 10 hours | **Owner:** Backend Engineer

---

## SECTION 4: Infrastructure & QA Tasks (Ongoing, ~200 hours)

### CI/CD & DevOps

**4.1: GitHub Actions Expansion (Beyond Week 1)**
- **Current:** Basic firmware build pipeline
- **Gaps:**
  - [ ] Webapp build + test automation
  - [ ] Graph compiler testing
  - [ ] E2E test automation (Playwright)
  - [ ] Performance regression detection
  - [ ] Security scanning (SAST, dependency check)
  - [ ] Code coverage reporting (CodeCov integration)
- **Effort:** 40 hours over Weeks 2-5

**4.2: Profiling Framework Expansion (Beyond Week 1)**
- **Current:** Basic FPS + memory tracking
- **Gaps:**
  - [ ] Detailed frame time breakdown per node type
  - [ ] Memory allocation profiler
  - [ ] CPU profiler (flame graphs)
  - [ ] Audio latency measurement
  - [ ] Network bandwidth monitoring
  - [ ] Historical trend analysis
- **Effort:** 60 hours over Weeks 2-6

**4.3: Stress Test Framework (Beyond Week 1)**
- **Current:** Basic stability testing
- **Gaps:**
  - [ ] Multi-pattern rapid switching stress test
  - [ ] WiFi disconnection + reconnection stress
  - [ ] Memory leak detection
  - [ ] Thermal stress testing (sustained high CPU)
  - [ ] Random parameter mutation (fuzzing)
- **Effort:** 40 hours over Weeks 2-5

### QA & Validation (Ongoing)

**4.4: Test Expansion Plan**
- **Firmware tests:**
  - [ ] Audio module unit tests (40 hours)
  - [ ] WiFi module integration tests (25 hours)
  - [ ] WebServer bounds testing (fuzz) (20 hours)
- **Webapp tests:**
  - [ ] Graph editor unit tests (80 hours)
  - [ ] Component integration tests (60 hours)
  - [ ] E2E tests for critical user journeys (100 hours)
- **Total:** 325 hours over Weeks 2-8

---

## SECTION 5: Design & UX Work (Pending)

### Phase C UI Design

**5.1: Node Graph Editor Visual Design**
- **Status:** Design concepts exist in `design/` folder
- **Work:**
  - [ ] High-fidelity mockups (5-10 screens)
  - [ ] Component library design (30+ components)
  - [ ] Design system documentation (colors, typography, spacing)
  - [ ] Handoff to frontend (Figma → code)
- **Effort:** 50 hours over Weeks 2-4
- **Owner:** UX Designer

**5.2: PF-5 Feature UX**
- **Work:**
  - [ ] Audio reactivity visualization design
  - [ ] Color palette adjustment UI design
  - [ ] Natural language interface design (voice + chat)
  - [ ] Recommendation UI design
  - [ ] Settings / preferences design
- **Effort:** 40 hours over Weeks 6-10
- **Owner:** UX Designer
- **Blocking:** Feature implementation

---

## SECTION 6: Documentation & Knowledge Gaps

### Pending Documentation

**6.1: Architecture Documentation**
- [ ] Node type system architecture (10 hours)
- [ ] Graph compiler architecture (10 hours)
- [ ] Memory management design (5 hours)
- [ ] Audio pipeline design (10 hours)
- [ ] AI model integration guide (10 hours)

**6.2: API Documentation**
- [ ] Node API specification (15 hours)
- [ ] Graph JSON schema (5 hours)
- [ ] REST API for pattern management (10 hours)
- [ ] WebSocket message protocol (5 hours)

**6.3: Developer Guides**
- [ ] Creating custom node types (10 hours)
- [ ] Building patterns with the editor (10 hours)
- [ ] Deploying to production (5 hours)
- [ ] Troubleshooting guide (5 hours)

**Total Documentation:** 115 hours over Weeks 2-10

---

## SECTION 7: Path-Specific Tasks (Decision-Gated)

### Path A: Graph System (IF GO Decision)
**Post-Nov 13, execute parallel Phase C + PF-5.1-5.2**
- Week 2-4: Compressed Phase C.1-C.2 (canvas)
- Week 2-5: PF-5.1 (audio) parallel start
- Week 5-8: PF-5.2 (color) parallel start
- Week 8-10: Finish C.3-C.4 (preview + polish)
- Week 9-14: PF-5.3-5.5 (language, personalization, safety)
- **Total:** 56 Phase C + 60 PF-5 tasks = **116 tasks, ~950 hours**

### Path B: C++ SDK (IF NO-GO Decision)
**Post-Nov 13, defer Phase C graph editor**
- Week 2-10: Build C++ SDK + pattern porting
  - [ ] C++ SDK architecture design (30 hours)
  - [ ] Port 15 hardcoded patterns to C++ SDK (2-3h each, 30-45 hours total)
  - [ ] SDK documentation (20 hours)
  - [ ] SDK tests (40 hours)
  - [ ] Hard-code remaining 10 patterns (20-30 hours)
- Week 8-14: Minimal UI improvements (no Phase C)
  - [ ] WebSocket transport (8 hours)
  - [ ] Minor UX polish (20 hours)
- **Total:** ~20 C++ SDK + 15 pattern port = **35 tasks, ~200 hours**

---

## SECTION 8: Technical Debt & Refactoring (Low Priority)

**8.1: Firmware Code Quality**
- Logging is verbose (but not blocking)
- `generated_patterns.h` will be replaced by graph compiler
- Pattern audio interface could be cleaner (deferred to Phase C)
- **Recommendation:** Leave as-is for Week 1; optimize during Phase 2.4 polish

**8.2: Webapp Code Quality**
- WebSocket transport needs implementation (HIGH priority)
- Component test coverage gaps (MEDIUM priority)
- Graph editor tests don't exist yet (will be created in Phase C.1-C.2)
- **Recommendation:** WebSocket first (Week 2); tests scale during Phase C

---

## SECTION 9: Resource Requirements (Phase 2)

### Team Composition (3-4 Engineers)

| Role | Path A (Graph) | Path B (C++ SDK) | Hours | Weeks |
|------|---|---|---|---|
| Frontend Engineer | Phase C canvas + PF-5 UI | Minimal UI polish | 200 | 8 |
| Backend Engineer | PF-5 AI (audio, color, language) | C++ SDK + patterns | 400 | 10 |
| Firmware Engineer | Node system + optimization | C++ optimization | 150 | 8 |
| QA Engineer | Testing + metrics | Regression + stability | 150 | 10 |
| **TOTAL** | **900 hours** | **400 hours** | **1000+ hours** | **8-10 weeks** |

---

## SECTION 10: Priority Ranking (Immediate Next Steps)

### MUST DO BEFORE NOV 13
- [ ] **Finalize Phase 2D1 fixes** (firmware critical path)
- [ ] **Validate Graph PoC** (decision gate requirement)
- [ ] **Plan Week 2 kickoff** (whichever path is chosen)

### MUST DO WEEK 2 (Whichever Path)
**Path A Tasks:**
- [ ] Task PC-001: Node type spec + registry (Phase C.1.1)
- [ ] Task PC-002: Graph compiler architecture (Phase C.1.2)
- [ ] Task PA-001: Audio reactivity pipeline (PF-5.1)

**Path B Tasks:**
- [ ] Task SDK-001: C++ SDK architecture design
- [ ] Task SDK-002: Pattern #1 (Bloom) ported to C++
- [ ] Task WS-001: WebSocket transport implementation

### WEEKS 2-5 BACKLOG
- [ ] WebSocket transport (HIGH - blocks real-time features)
- [ ] Canvas rendering engine (HIGH - blocks Phase C)
- [ ] Audio input capture (HIGH - blocks PF-5.1)
- [ ] Node palette UI (HIGH - blocks Phase C.2)

---

## SECTION 11: Key Dependencies & Risks

### Critical Path Blockers
1. **Decision Gate (Nov 13)** → determines Path A or B
2. **Phase C.1 completion** → unblocks C.2-C.4
3. **Node type registry** → required for all feature work
4. **Audio pipeline** → required for PF-5.1, 5.3, 5.4

### High-Risk Items
1. **Graph compiler performance** (target <500ms) — complex
2. **ML model inference speed** (<50ms) — requires optimization
3. **Real-time synchronization** (LED updates <10ms) — hardware constraint
4. **Scale testing** (1000+ concurrent users) — infrastructure

### Unknowns to Validate Week 2
- Canvas rendering approach (WebGL vs Canvas 2D) trade-offs
- ONNX.js inference performance in browser
- WebSocket latency on embedded WiFi
- Team capacity for parallel Path A execution

---

## APPENDIX A: Complete Task Breakdown by Week (Path A Assumed)

```
WEEK 2 (Nov 14-20): Phase C.1 kickoff + PF-5.1.1-1.2 start
- PC-001: Node type spec (25h)
- PC-002: Graph compiler (35h)
- PA-001: Web Audio API (12h)
- PA-002: Spectral analysis (20h)

WEEK 3 (Nov 21-27): Phase C.1 polish + Phase C.2 kickoff
- PC-003: Type system + validation (15h)
- PC-004: Memory pooling (5h)
- PC-201: Canvas rendering (30h)
- PA-003: Beat detection (40h)

WEEK 4 (Nov 28-Dec 4): Phase C.2 canvas + PF-5.1 polish
- PC-202: Node palette (25h)
- PC-203: Connection system (20h)
- PA-004: Audio reactive nodes (25h)
- PA-005: Testing & validation (23h)

[... continues through Week 20]
```

---

## CONCLUSION

**Total Untracked Work Items:** 56 Phase C + 60 PF-5 + 40 infrastructure = **156+ tasks**

**Total Effort:** ~1,200 hours across 20+ weeks

**Next Steps:**
1. Await Nov 13 decision gate (GO = Path A, NO-GO = Path B)
2. Create TaskMaster tasks for chosen path (immediately post-decision)
3. Kickoff Week 2 sprint (Nov 14 or Nov 17)
4. Weekly standups + decision gate memo review (Nov 13)

**This audit is DRAFT.** Post-decision gate (Nov 13), convert relevant tasks to TaskMaster immediately.

---

**Generated:** 2025-11-05 14:30 UTC+8 | **Status:** Ready for review and transformation to active tasks

