---
title: Graph System Integration Workflow Guide
owner: Test Automation Engineer (Claude)
date: 2025-11-10
status: accepted
version: v1.0
scope: Complete workflows for graph editor to device execution pipeline
tags: [workflow, graph-system, integration, editor, codegen, device, task-18]
related_docs:
  - K1NReport_INTEGRATION_TESTING_v1.0_20251110.md
  - K1NArch_GRAPH_SYSTEM_ARCHITECTURE_v1.0_20251110.md
  - NODE_TAXONOMY_QUICK_REFERENCE.md
---

# Graph System Integration Workflow Guide

**Purpose:** Document complete workflows for the K1.node1 graph system integration, covering graph creation, compilation, deployment, and iteration cycles.

**Target Audience:** Frontend engineers, pattern creators, QA engineers, device developers

---

## 1. Quick Reference Workflows

### Workflow 1: Create & Deploy Pattern (5 minutes)

```
START
  │
  ├─ 1. Open Graph Editor
  │
  ├─ 2. Create Pattern
  │    a. Add audio input nodes (e.g., audio_bass)
  │    b. Add processing nodes (e.g., state_buffer, spatial_scroll)
  │    c. Add color nodes (e.g., color_palette_lookup)
  │    d. Add output node
  │    e. Connect all wires
  │
  ├─ 3. Set Parameters
  │    a. Audio gain (0.1-5.0)
  │    b. State decay (0.0-0.99)
  │    c. Spatial speed (0.0-2.0)
  │    d. Color palette
  │
  ├─ 4. Validate Graph
  │    a. Check node count (<50)
  │    b. Check state size (<10KB)
  │    c. Check all wires connected
  │    d. Check output node exists
  │
  ├─ 5. Compile Pattern
  │    a. Click "Compile to C++"
  │    b. Wait for code generation
  │    c. Review performance metrics
  │
  ├─ 6. Deploy to Device
  │    a. Click "Send to Device"
  │    b. Confirm device connection
  │    c. Device compiles and loads
  │
  ├─ 7. See Live Preview
  │    a. Visual output displayed
  │    b. Performance metrics shown
  │    c. Adjust if needed
  │
  └─ END
```

**Time Budget:**
- Graph creation: 2-3 min
- Compilation: <100ms
- Device transfer: 1-2 sec
- Device compilation: 10-15 sec

---

## 2. Detailed Workflows

### Workflow A: Create Simple Audio-Reactive Pattern

#### Step 1: Open Graph Editor

```
Menu → "Create New Pattern" OR File → New
```

**UI Elements:**
- Node palette (left sidebar)
- Canvas (center)
- Parameters panel (right)
- Output console (bottom)

#### Step 2: Create Basic Audio Reactive Chain

```
1. Drag audio_bass from palette to canvas
   Position: (100, 100)

2. Drag state_buffer_persist from palette
   Position: (250, 100)
   Parameters:
     - size: 100
     - decay: 0.95
     - reset_on_change: true

3. Drag color_palette_lookup from palette
   Position: (400, 100)
   Parameters:
     - palette_name: "heat"

4. Drag output from palette
   Position: (550, 100)

5. Connect wires:
   a. audio_bass.output → state_buffer_persist.value
   b. state_buffer_persist.output → color_palette_lookup.brightness
   c. color_palette_lookup.output → output.colors
```

#### Step 3: Validate

```
Click "Validate" button

Validation output:
  ✓ 4 nodes found
  ✓ 3 wires connected
  ✓ All nodes referenced
  ✓ Output node exists
  ✓ State size: 100 bytes (OK, <10KB)
  ✓ Node count: 4 (OK, <50)
  ✓ Wire count: 3 (OK, <100)

Status: READY FOR COMPILATION
```

#### Step 4: Compile & Deploy

```
Click "Compile" button

Compilation output:
  [1/5] Parse: OK (4 nodes, 3 wires)
  [2/5] Validate: OK
  [3/5] Optimize: OK (0 dead nodes)
  [4/5] Generate C++: OK (145 lines)
  [5/5] Statistics: OK

Performance Metrics:
  • Estimated cycles/frame: 380K
  • Estimated FPS: 85
  • State size: 100 bytes
  • Code size: 2.3 KB

Click "Deploy to Device"

Deployment:
  • Sending C++ code... ✓
  • Device compiling... ✓
  • Device flashing... ✓
  • Starting pattern... ✓

Status: RUNNING
FPS: 84 (measured)
```

---

### Workflow B: Create Complex Bloom Effect Pattern

#### Pattern Chain

```
audio_bass
  ↓ (gain 1.5)
state_buffer_persist
  ↓ (size 100, decay 0.95)
spatial_scroll
  ↓ (direction: inward, speed: 0.5)
spatial_blur
  ↓ (radius: 2, sigma: 1.0)
color_palette_lookup
  ↓ (palette: heat)
output
```

#### Implementation Steps

**1. Audio Input**
```
Node: audio_bass_1
  Parameters:
    gain: 1.5 (emphasize bass)
    floor: 0.1 (noise gate)
```

**2. State Persistence**
```
Node: state_buffer_1
  Parameters:
    size: 100 (pixels to persist)
    decay: 0.95 (fade rate per frame)
    reset_on_change: true
  Purpose: Create trail/comet effect
```

**3. Spatial Scroll**
```
Node: spatial_scroll_1
  Parameters:
    direction: "inward"
    speed: 0.5 (0.5 pixels/frame)
    wrap: true (circular wrap)
  Purpose: Move trail toward center
```

**4. Spatial Blur**
```
Node: spatial_blur_1
  Parameters:
    radius: 2 (blur kernel)
    sigma: 1.0 (Gaussian sigma)
  Purpose: Smooth/bloom effect
```

**5. Color Palette**
```
Node: color_palette_1
  Parameters:
    palette_name: "heat" (black→red→yellow→white)
  Purpose: Map brightness to color
```

**6. Output**
```
Node: output_1
  Inputs:
    - colors (from color_palette)
  Purpose: Write to LED strip
```

#### Wire Connections

```
audio_bass_1.output → state_buffer_1.value
state_buffer_1.output → spatial_scroll_1.input
spatial_scroll_1.output → spatial_blur_1.input
spatial_blur_1.output → color_palette_1.brightness
color_palette_1.output → output_1.colors
```

#### Validation Checklist

- [x] 6 nodes created
- [x] All nodes have parameters set
- [x] 5 wires connecting all nodes
- [x] No disconnected nodes
- [x] Output node present
- [x] State size < 10KB: 100 bytes ✓
- [x] Node count < 50: 6 ✓
- [x] Wire count < 100: 5 ✓

#### Expected Performance

```
Estimated Cycles: 600K
Estimated FPS: 70-80
Actual FPS (device): 75
Status: EXCELLENT
```

---

### Workflow C: Edit Existing Pattern & Compare

#### Step 1: Load Pattern from Device

```
Menu → "Open Recent"
Select "Bloom Effect v2"

Pattern loaded in editor
```

#### Step 2: Make Edits

```
Current state: Bloom effect at 75 FPS

Changes to make:
  1. Increase audio gain: 1.5 → 2.0
  2. Increase state buffer size: 100 → 150
  3. Increase blur radius: 2 → 3

Implementation:
  1. Select audio_bass_1 node
     Change gain to 2.0

  2. Select state_buffer_1 node
     Change size to 150

  3. Select spatial_blur_1 node
     Change radius to 3
```

#### Step 3: Validate Changes

```
Before Compilation:
  • Original state size: 100 bytes
  • New state size: 150 bytes
  • Budget remaining: 9,950 bytes ✓

Estimate impact:
  • Larger buffer = slightly slower
  • Larger blur = slower
  • Overall FPS estimate: 60-70
```

#### Step 4: Compile & Deploy

```
Click "Compile"

Compilation:
  [1/5] Parse: OK
  [2/5] Validate: OK
  [3/5] Optimize: OK (1 buffer consolidation)
  [4/5] Generate C++: OK (167 lines)
  [5/5] Statistics: OK

New Metrics:
  • Estimated cycles/frame: 800K
  • Estimated FPS: 65
  • State size: 150 bytes
  • Performance delta: -15% FPS

Click "Deploy & Compare"
```

#### Step 5: Compare Results

```
Side-by-side Comparison:

Version 1 (Original)       Version 2 (Modified)
─────────────────────────  ─────────────────────
FPS: 75                    FPS: 68
State: 100 bytes           State: 150 bytes
Brightness: High           Brightness: Very High
Blur: Subtle               Blur: Strong
Color saturation: Good     Color saturation: Better

Visual Comparison:
  • More prominent bloom effect
  • Slightly slower but still smooth
  • Better visual impact for bass

Decision:
  ✓ Keep version 2 (improvement worth FPS cost)
```

---

### Workflow D: Import Hand-Coded Pattern & Convert to Graph

#### Scenario

You have existing hand-coded pattern in C++:

```cpp
void render_custom_pattern(const AudioBuffer& audio, CRGBF* leds) {
  static float trail[100] = {0};

  // Audio input: bass
  float bass = AUDIO_BASS();
  bass = bass * 1.5f - 0.1f;

  // State update: trail decay
  for (int i = 0; i < 100; i++) {
    trail[i] *= 0.95f;
  }

  // Update trail at center
  int idx = 50;
  trail[idx] = fmaxf(trail[idx], bass);

  // Apply color palette
  for (int i = 0; i < NUM_LEDS; i++) {
    float brightness = trail[i];
    leds[i] = CRGBF::from_HSV(brightness * 360, 1.0, brightness);
  }
}
```

#### Step 1: Reverse Engineer to Graph

```
Option A: Manual Conversion (Recommended for learning)
  1. Identify input: audio_bass
  2. Identify state: static float trail[100]
  3. Identify processing:
     - Decay: trail[i] *= 0.95
     - Update: trail[idx] = max(trail[idx], bass)
  4. Identify output: HSV color generation
  5. Map to nodes:
     - audio_bass → state_buffer_persist → color_hsv → output

Option B: Automated Reverse Engineering (Future)
  1. Paste C++ code
  2. Click "Reverse Engineer"
  3. System analyzes AST
  4. Extracts node structure
  5. Validates equivalence
```

#### Step 2: Create Equivalent Graph

```
Graph Definition:

Nodes:
  1. audio_bass_1
     gain: 1.5, floor: 0.1

  2. state_buffer_persist_1
     size: 100, decay: 0.95, reset_on_change: true

  3. color_hsv_1
     hue: 360, saturation: 1.0

  4. output_1

Wires:
  audio_bass_1 → state_buffer_persist_1
  state_buffer_persist_1 → color_hsv_1
  color_hsv_1 → output_1
```

#### Step 3: Validate Equivalence

```
Generate C++ from graph
Compare with original

Comparison:
  ✓ Logic flow matches
  ✓ State management equivalent
  ✓ Output colors match
  ✓ Performance within 2%

Status: EQUIVALENT
```

#### Step 4: Advantages of Graph Version

```
Original (C++):
  • Hard-coded parameters
  • Manual state management
  • Not editable in UI
  • Requires recompilation

Graph Version:
  • Adjustable via UI
  • Automatic state tracking
  • Visual representation
  • Real-time deployment

Recommendation:
  ✓ Use graph version for future edits
  ✓ Easier for non-programmers
  ✓ UI-based parameter tuning
```

---

## 3. Error Recovery Workflows

### Error: "State Size Exceeds Budget"

**Symptom:**
```
Compilation Error:
  State size exceeds budget: 12,000 bytes > 10,240 bytes
```

**Root Cause:**
```
Too many state nodes or buffers too large:
  - state_buffer_persist: size 500 (5,000 bytes)
  - state_color_persist: size 500 (7,500 bytes)
  - Plus other state nodes: 1,500 bytes
  Total: 14,000 bytes (TOO MUCH)
```

**Recovery Steps:**

```
1. Identify large state nodes:
   • state_buffer_persist: 5,000 bytes
   • state_color_persist: 7,500 bytes

2. Reduce sizes:
   • state_buffer_persist: size 500 → size 200 (2,000 bytes)
   • state_color_persist: size 500 → size 100 (1,500 bytes)

3. Recalculate:
   Total: 2,000 + 1,500 + 1,500 = 5,000 bytes
   Status: WITHIN BUDGET ✓

4. Recompile:
   Click "Compile"
   Status: SUCCESS
```

**Prevention:**
- Check state budget before adding large buffers
- Use preview of state size while editing
- Use 2-3 state nodes max per pattern

---

### Error: "No Output Node Found"

**Symptom:**
```
Compilation Error:
  Graph validation failed: No output node found
```

**Root Cause:**
```
Pattern has nodes but missing final output node
```

**Recovery:**

```
1. Review graph
   • See disconnected color nodes

2. Add output node:
   • Drag "output" from node palette
   • Position at end of chain

3. Connect final wire:
   • From last processing node to output
   • Specify input (colors or brightness)

4. Recompile: ✓
```

---

### Error: "Too Many Nodes (51 > 50)"

**Symptom:**
```
Compilation Error:
  Node count exceeds 50: 51 nodes found
```

**Root Cause:**
```
Pattern has too many nodes (complexity exceeded)
```

**Recovery:**

```
1. Simplify pattern:
   • Remove redundant nodes
   • Combine operations
   • Example: 3 audio_* nodes → 1 audio_spectrum_band

2. Use node fusion:
   • Identify adjacent similar nodes
   • Combine into single node with parameters

3. Reduce processing chain:
   • Remove optional transforms
   • Keep essential audio → state → color → output

4. Result:
   • Original: 51 nodes
   • Simplified: 18 nodes
   • Status: OK ✓
```

---

## 4. Best Practices

### Best Practice 1: Parameter Tuning

```
Audio Gain (0.1 - 5.0):
  ├─ 0.1-0.5: Quiet patterns (ambient)
  ├─ 0.5-1.0: Normal (most patterns)
  ├─ 1.0-2.0: Emphatic (reactive)
  └─ 2.0-5.0: Aggressive (extreme)

State Decay (0.0 - 0.99):
  ├─ 0.9-0.95: Long trails (2-5 seconds)
  ├─ 0.8-0.9: Medium trails (0.5-2 seconds)
  ├─ 0.5-0.8: Short trails (0.1-0.5 seconds)
  └─ 0.0-0.5: Very short (frame-by-frame)

Buffer Size (8 - NUM_LEDS):
  ├─ 8-50: Compact memory, small effects
  ├─ 50-150: Balanced (most common)
  ├─ 150-300: Large effects, more memory
  └─ >300: Stress test only
```

### Best Practice 2: Performance Monitoring

```
Compilation Output:

Metrics to monitor:
  ✓ Estimated FPS (target: >=60)
  ✓ State size (target: <5KB)
  ✓ Cycle count (target: <1.2M)
  ✓ Node count (target: <30)

If FPS drops below 60:
  1. Identify expensive nodes (blur, spectral analysis)
  2. Reduce buffer sizes
  3. Simplify spatial transforms
  4. Re-test

If FPS drops below 40:
  1. Reduce complexity significantly
  2. Consider splitting into 2 patterns
  3. Use simpler audio input (bass vs spectrum)
```

### Best Practice 3: Testing & Iteration

```
Pattern Development Cycle:

1. Create simple prototype
   • 2-4 nodes
   • Test basic concept
   • FPS: 95+

2. Add enhancements
   • State persistence
   • Spatial transforms
   • FPS: 70-80

3. Fine-tune parameters
   • Adjust audio gain
   • Adjust decay rates
   • FPS: 70-85

4. Performance validation
   • Run on actual device
   • Compare metrics
   • Verify visual quality

5. Deploy
   • Save to device
   • Create documentation
   • Share with community
```

---

## 5. Troubleshooting Guide

### Issue: Compilation Takes >500ms

**Symptoms:**
- Slow response when clicking "Compile"
- Browser feels unresponsive

**Causes:**
- Large complex graph (30+ nodes)
- Performance bottleneck in compiler

**Solutions:**
```
1. Check node count:
   If >30 nodes: Consider splitting into 2 patterns

2. Check state size:
   If >5KB: Reduce buffer sizes

3. Check wire count:
   If >50 wires: Consolidate nodes

4. Monitor performance:
   Click "Show Profiling" to identify slow stage
```

### Issue: Device Reports FPS Lower than Estimated

**Symptoms:**
```
Estimated FPS: 80
Actual FPS (device): 60
Delta: -25%
```

**Causes:**
- Estimation model not perfectly accurate
- Device under other load
- Audio processing overhead not accounted

**Solutions:**
```
1. Validate device state:
   • Check if other patterns running
   • Verify audio input is active
   • Check ESP32 clock frequency

2. Measure accurately:
   • Run pattern isolation test
   • Measure FPS over 10 seconds
   • Average the readings

3. Optimize if needed:
   • If delta < 10%: Acceptable
   • If delta 10-20%: Tune parameters
   • If delta > 20%: Simplify pattern
```

### Issue: Pattern Works in Simulator, Fails on Device

**Symptoms:**
```
Simulator: ✓ Pattern renders
Device: ✗ Pattern fails to compile or run
```

**Causes:**
- Different compiler versions (host vs ESP32)
- Missing header files on device
- Memory constraints on device
- Timing issues in device compilation

**Solutions:**
```
1. Check build signature:
   Device reports: Arduino 3.1.0, IDF 5.0
   Simulator expects: Arduino 3.1.0, IDF 5.0
   If mismatch: Update simulator or device

2. Verify generated code:
   • Download C++ from device
   • Compare with expected code
   • Look for compilation errors

3. Check device memory:
   • State size: <5KB ✓
   • Code size: <20KB ✓
   • RAM available: >20KB ✓

4. Test in isolation:
   • Deploy simple audio→output pattern first
   • If works: Pattern issue, not device
   • If fails: Device issue
```

---

## 6. Workflow Decision Tree

```
START: "I want to create a pattern"
│
├─ "Do I have existing C++ code?"
│  ├─ YES: Go to Workflow D (Reverse Engineer)
│  └─ NO: Continue
│
├─ "What type of effect?"
│  ├─ Simple audio-reactive: Go to Workflow A
│  ├─ Complex with trails: Go to Workflow B
│  ├─ Editing existing: Go to Workflow C
│  └─ Other: Create custom
│
├─ "Need to modify later?"
│  ├─ YES: Use Graph Editor (UI-friendly)
│  └─ NO: Hand-code C++ (slightly faster)
│
├─ "Performance critical?"
│  ├─ YES: Estimate FPS before deploying
│  ├─ Monitor metrics during development
│  └─ No: Deploy and iterate
│
└─ END: "Deploy to Device"
```

---

## 7. Deployment Checklist

Before deploying to device:

- [ ] All nodes have parameters set
- [ ] All wires are connected
- [ ] Output node exists
- [ ] Graph validates (no errors)
- [ ] State size < 10KB
- [ ] Node count < 50
- [ ] Estimated FPS >= 60
- [ ] Device is powered on
- [ ] Device is connected (USB or WiFi)
- [ ] No other pattern currently running
- [ ] User has reviewed pattern
- [ ] Backup existing pattern (if important)

---

## 8. Performance Tuning Checklist

Optimize your pattern:

- [ ] Reduce buffer sizes (state_buffer: 100 → 50)
- [ ] Reduce blur radius (3 → 2)
- [ ] Reduce spectral bins (64 → 32)
- [ ] Increase decay rate (0.95 → 0.90)
- [ ] Remove unused nodes (dead code elimination)
- [ ] Consolidate operations (2 nodes → 1)
- [ ] Profile specific nodes (Show Profiling)
- [ ] Test on actual device
- [ ] Compare with benchmark patterns
- [ ] Document final performance

---

**Last Updated:** 2025-11-10
**Test Coverage:** 12+ integration scenarios
**Status:** Production Ready
