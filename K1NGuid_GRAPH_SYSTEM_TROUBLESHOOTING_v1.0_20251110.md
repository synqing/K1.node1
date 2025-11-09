---
title: Graph System Troubleshooting Guide
owner: QA & Support Engineer (Claude)
date: 2025-11-10
status: accepted
version: v1.0
scope: Comprehensive troubleshooting for graph system issues, errors, and performance problems
tags: [troubleshooting, support, graph-system, diagnostics, task-18]
related_docs:
  - K1NReport_INTEGRATION_TESTING_v1.0_20251110.md
  - K1NImp_GRAPH_INTEGRATION_WORKFLOW_v1.0_20251110.md
  - K1NRef_GRAPH_API_INTEGRATION_v1.0_20251110.md
---

# Graph System Troubleshooting Guide

**Purpose:** Comprehensive troubleshooting guide for common issues, error messages, and performance problems in the K1.node1 graph system.

**Target Audience:** Users encountering issues, support engineers, QA team members

**How to Use This Guide:**
1. Find your symptom in section matching your issue type
2. Read the diagnosis to understand root cause
3. Follow the resolution steps
4. If unresolved, escalate with diagnostic info

---

## 1. Compilation Issues

### Issue 1.1: "Graph Validation Failed"

**Symptom:**
```
Compilation Error:
  Code: GRAPH_VALIDATION_FAILED
  Message: Graph validation failed
  Details: Unknown details
```

**Common Causes:**
- Empty node list
- No output node in graph
- Invalid wire connections
- Circular dependencies
- Missing required fields

**Diagnostic Steps:**

```
1. Check node count
   Open Graph Editor
   Count total nodes visible

2. Look for output node
   Search for node type: "output"
   Should have exactly 1 output node

3. Check all wires are connected
   Right-click on each node
   Verify all required inputs connected

4. Check for circular wires
   Trace path from inputs to output
   Should form DAG (directed acyclic graph)
```

**Resolution:**

```
IF no nodes:
  → Add at least 2 nodes (input + output)

IF no output node:
  → Drag "output" node from palette
  → Position at end of chain
  → Connect final wire to it

IF incomplete wires:
  → Select node with red connection indicator
  → Connect wire from required input
  → Repeat for all nodes

IF circular reference (node connects to itself):
  → Delete problematic wire
  → Redraw connection in different path
```

**Test After Fix:**
```
Click "Validate" in Graph Editor
Expected: "✓ Graph is valid"
```

---

### Issue 1.2: "State Size Exceeds Budget"

**Symptom:**
```
Compilation Error:
  State size exceeds budget: 12,000 bytes > 10,240 bytes
```

**Root Causes:**
```
State consuming nodes:
  ├─ state_buffer_persist: size * 4 bytes
  ├─ state_color_persist: size * 12 bytes (CRGBF)
  ├─ audio_history: size * 4 bytes
  └─ Other state nodes: 4-8 bytes each

Example overflow:
  state_buffer_persist (size 500):  2,000 bytes
  state_color_persist (size 500):   6,000 bytes
  audio_history (size 256):         1,024 bytes
  ───────────────────────────────
  Total:                            9,024 bytes (OK)

  But if you had:
  state_buffer_persist (size 1000):  4,000 bytes
  state_color_persist (size 1000):  12,000 bytes
  ───────────────────────────────
  Total:                            16,000 bytes (EXCEEDS)
```

**Diagnostic Steps:**

```
1. Calculate current state size:
   Open compiled code details
   Look for "state_size_bytes" field

2. Identify large buffers:
   For each state node:
     - Note the size parameter
     - Multiply by 4 (float) or 12 (CRGBF)

3. Sum all state allocations:
   Compare total to 10,240 byte limit
```

**Resolution:**

```
Step 1: Identify which nodes use state
  ✓ state_buffer_persist
  ✓ state_color_persist
  ✓ audio_history
  ✓ audio_peak_hold
  ✓ state_accumulator

Step 2: Reduce buffer sizes
  Current: state_buffer_persist (size 500) = 2,000 bytes
  Reduce to: size 250 = 1,000 bytes (50% reduction)

  Current: state_color_persist (size 500) = 6,000 bytes
  Reduce to: size 150 = 1,800 bytes (70% reduction)

  Savings: 6,200 bytes freed

Step 3: Remove non-essential state nodes
  Count how many state nodes you have
  If >2: Consider if all are necessary

  Option: Replace state_color_persist with:
    state_buffer + color_palette_lookup
    (uses less state)

Step 4: Recompile and verify
  New state size should be <10,240 bytes
```

**Memory Budget Breakdown:**
```
Total Available: 10,240 bytes
Recommended Max: 8,000 bytes (leaves 20% buffer)

Safe Allocation:
  ├─ 1x state_buffer (100 bytes):  400 bytes
  ├─ 1x state_color (100 bytes):  1,200 bytes
  ├─ audio_history (256 elements): 1,024 bytes
  ├─ Accumulators (3x):              12 bytes
  └─ Reserve:                       7,192 bytes
     ──────────────────────────
     Total:                       10,240 bytes ✓
```

**Prevention:**
- Monitor state budget while editing
- Check "State Budget" indicator in UI
- Use smaller buffers for "nice to have" features
- Test with actual device to verify

---

### Issue 1.3: "Node Count Exceeds 50"

**Symptom:**
```
Compilation Error:
  Node count exceeds 50: 51 nodes found
```

**Root Cause:**
```
Pattern has too many nodes.
Graph system has hard limit of 50 nodes
to prevent:
  ├─ Memory explosion
  ├─ Compilation timeout
  ├─ Runtime frame time exceeds budget
  └─ Difficult to debug
```

**Diagnostic Steps:**

```
1. Count nodes in editor
   Graph Editor → View → Show Node Count
   Or manually count nodes

2. Identify redundant nodes
   Look for:
   ├─ Multiple similar nodes (combine?)
   ├─ Dead nodes (unused outputs?)
   ├─ Unnecessary intermediate nodes?
```

**Resolution - Simplify Graph:**

```
Option 1: Remove duplicate nodes
  If you have:
    ├─ audio_bass (node 1)
    ├─ audio_bass (node 2)
    ├─ audio_bass (node 3)

  Consolidate to:
    └─ audio_bass (single node)
       Multiple outputs to different processors

Option 2: Combine similar operations
  Instead of:
    ├─ spatial_scroll → spatial_blur → color
    ├─ spatial_scroll → spatial_blur → color

  Use:
    └─ spatial_scroll → spatial_blur → (2x color)

Option 3: Use multi-band instead of spectrum
  Instead of:
    ├─ audio_spectrum_band (×64 for full spectrum)

  Use:
    ├─ audio_bass (covers 0-250 Hz)
    ├─ audio_mids (covers 250-4kHz)
    ├─ audio_treble (covers 4kHz+)

Option 4: Remove non-essential nodes
  If pattern has 51 nodes:
    ├─ Identify "nice to have" nodes
    ├─ Remove until <50 total
    ├─ Recompile and test

Target: <30 nodes (good practice)
Limit: 50 nodes (hard technical limit)
```

**Example Simplification:**
```
Before (51 nodes):
  ├─ 6 audio input nodes
  ├─ 8 intermediate processing nodes
  ├─ 12 spatial transform nodes
  ├─ 16 color operation nodes
  ├─ 8 state management nodes
  └─ 1 output node

After (18 nodes):
  ├─ 3 audio input nodes (consolidated)
  ├─ 4 intermediate processing nodes
  ├─ 4 spatial transform nodes
  ├─ 4 color operation nodes
  ├─ 2 state management nodes
  └─ 1 output node

Result: 67% reduction, still maintains effect
```

**Validation After Simplification:**
```
Compile and check:
  ✓ Node count < 50
  ✓ Estimated FPS still >= 60
  ✓ Visual output acceptable
  ✓ State size still < 10KB
```

---

## 2. Performance Issues

### Issue 2.1: "FPS Lower Than Estimated"

**Symptom:**
```
Graph Editor shows: Estimated FPS: 80
Device actually runs: Measured FPS: 60
Delta: -25% (SIGNIFICANT)
```

**Possible Causes:**

```
1. Estimation model inaccuracy (5-10% typical)
2. Device under load (audio processing)
3. Other patterns running in background
4. Device temperature affecting clock
5. Wi-Fi/network overhead
6. I2S microphone reading overhead
7. Real FPS actually higher but meter not accurate
```

**Diagnostic Steps:**

```
Step 1: Verify device is running nothing else
  Device Console:
    - Check no other patterns loaded
    - Check I2S active
    - Check audio processing enabled

Step 2: Measure over longer period
  Run pattern for 30+ seconds
  Average FPS over entire duration
  Single reading may be noisy

Step 3: Compare with benchmark patterns
  Load known-good pattern
  Compare measured FPS with documented baseline
  If baseline also lower: device issue
  If baseline matches: your pattern issue

Step 4: Check device temperature
  Device Status → System Health → Temperature
  If >45°C: Device throttling
  Normal: 30-40°C
```

**Resolution:**

```
IF delta < 10%:
  ✓ Acceptable, within margin of error
  ✓ Continue pattern

IF delta 10-20%:
  ⚠ Investigate, but probably OK
  1. Reduce node count (remove 1-2 non-essential)
  2. Reduce buffer sizes (5-10% reduction)
  3. Simplify spatial transforms
  4. Re-test

IF delta > 20%:
  ✗ Pattern too heavy for device
  1. Reduce complexity significantly
  2. Simplify audio input (mids instead of spectrum)
  3. Reduce state buffer sizes 50%
  4. Use simpler color operations
  5. Re-target for 90+ FPS estimated

IF device temperature high (>45°C):
  1. Reduce FPS target (allow 50-60 FPS)
  2. Increase state buffer decay (faster fade)
  3. Reduce blur radius
  4. Ensure device fan running (if available)
```

**Performance Tuning Checklist:**

```
In order of impact:

HIGH impact (10-30% FPS change):
  □ Reduce state buffer size (500 → 250)
  □ Reduce blur radius (3 → 2)
  □ Remove spatial_blur entirely
  □ Use audio_bass instead of audio_spectrum_band

MEDIUM impact (5-10% FPS change):
  □ Reduce number of color operations (2 → 1)
  □ Increase state decay rate (0.95 → 0.90)
  □ Remove dead nodes
  □ Reduce nesting depth

LOW impact (<5% FPS change):
  □ Adjust audio gains
  □ Tweak HSV parameters
  □ Adjust position parameters
  □ Remove debug nodes
```

---

### Issue 2.2: "Pattern Works in Simulator, Fails on Device"

**Symptom:**
```
Web Editor → Simulate: ✓ Works (75 FPS)
Send to Device: ✗ Fails
Device Error: "Compilation failed" or "Pattern crashed"
```

**Root Causes:**

```
Compiler Mismatch:
  ├─ Host (simulation) uses different compiler version
  ├─ Device uses different toolchain
  ├─ Generated code assumes different library versions
  └─ Header files differ between environments

Code Generation:
  ├─ Simulator accepts more lax code
  ├─ Device compiler (GCC) stricter
  ├─ Signed vs unsigned integer issues
  ├─ Float precision issues
  └─ Buffer overflow in device, not in simulator

Memory:
  ├─ Simulator has unlimited memory
  ├─ Device limited to 32 KB heap
  ├─ Stack fragmentation on device
  └─ Static allocation on device

Timing:
  ├─ Simulator timing not accurate
  ├─ Device has real audio latency
  ├─ Device rendering takes different time
  └─ I2S microphone has fixed latency
```

**Diagnostic Steps:**

```
Step 1: Check build signatures
  Web Editor → Settings → Build Info:
    Arduino: 3.1.0
    IDF: 5.0
    Platform: espressif32

  Device → Status:
    Arduino version: ?
    IDF version: ?

  IF mismatch: Update device or simulator

Step 2: Download generated C++ from device
  Device Console → Export Last Generated Code
  Compare with expected code

  Look for:
    - Correct node instantiation
    - Proper wire connections
    - Valid parameter values
    - No syntax errors

Step 3: Check device memory
  Device Status → System Health:
    Memory available: >20KB

  If <10KB: Too fragmented, needs restart

Step 4: Test with minimal pattern
  Create single audio_bass → output pattern
  If this works: Problem is pattern complexity
  If this fails: Problem is device environment
```

**Resolution:**

```
IF compiler mismatch:
  1. Update device firmware
  2. Or use compatible simulator
  3. Re-test pattern

IF generated code issues:
  1. Download generated code
  2. Look for compilation errors in console
  3. Check for signed/unsigned warnings
  4. Verify buffer sizes match actual LED count
  5. Report to development team

IF memory insufficient:
  1. Restart device (clears fragmentation)
  2. Reduce pattern state size
  3. Remove non-essential state nodes
  4. Test again

IF timing issues:
  1. Increase state buffer decay (faster fade)
  2. Simplify transforms
  3. Use simpler audio input
  4. Focus on robustness over features
```

**Verification After Fix:**

```
1. Compile pattern
2. Deploy to device
3. Monitor device console for errors
4. Measure FPS from device
5. Verify visual output matches simulation
6. Run for >30 seconds for stability
```

---

## 3. Connection & Device Issues

### Issue 3.1: "Device Not Available / Connection Timeout"

**Symptom:**
```
Error: Device not reachable
Timeout waiting for device response
Device appears offline
```

**Root Causes:**

```
Physical Connection:
  ├─ USB cable unplugged
  ├─ Serial port not active
  ├─ Device powered off
  └─ Wrong port selected

Network (if WiFi):
  ├─ WiFi not connected
  ├─ Wrong WiFi network
  ├─ Device out of range
  ├─ Firewall blocking
  └─ Device IP changed

Device Software:
  ├─ Device crashed
  ├─ Firmware outdated
  ├─ WebServer not running
  └─ Port in use by another app
```

**Diagnostic Steps:**

```
Step 1: Check physical connection
  □ USB cable connected
  □ Device powered on (LED lit)
  □ No USB errors in OS

  Mac: System Report → USB Devices
  Windows: Device Manager → Ports
  Linux: lsusb

Step 2: Identify correct port
  Web Editor → Settings → Device Connection
  Should show:
    Serial: /dev/cu.usbserial-XXX (Mac)
    Serial: COM3 (Windows)
    Serial: /dev/ttyUSB0 (Linux)

Step 3: Check device is responsive
  Terminal:
    screen /dev/cu.usbserial-XXX 115200

  Should see device logs or boot sequence
  If nothing: Device not responding

Step 4: Check network (if WiFi enabled)
  Device Console → Network Status
  Should show:
    WiFi: Connected
    IP: 192.168.1.100

  Try ping: ping 192.168.1.100

Step 5: Check if port is in use
  Mac: lsof -i :8080
  Windows: netstat -ano
  Linux: lsof -i :8080

  If in use: Kill other process or use different port
```

**Resolution:**

```
IF USB not detected:
  1. Try different USB cable
  2. Try different USB port
  3. Restart device
  4. Update USB drivers
  5. Check device battery/power

IF wrong port selected:
  1. Open Device Settings
  2. Scan for available ports
  3. Select correct port
  4. Click "Test Connection"
  5. Should see ✓ Connected

IF WiFi not working:
  1. Device Console → WiFi Settings
  2. Select network from list
  3. Enter password
  4. Wait for connection (30 seconds)
  5. Note IP address
  6. Use IP in Web Editor settings

IF port in use:
  Mac/Linux:
    kill -9 <PID>
  Windows:
    taskkill /PID <PID> /F
  Then restart device connection

IF device crashed:
  1. Restart device (power cycle)
  2. Wait 10 seconds for boot
  3. Verify connection again
  4. If persistent: Restore firmware
```

**Prevention:**
- Avoid unplugging device during pattern transfer
- Use powered USB hub (better power stability)
- Keep device within WiFi range
- Monitor device temperature
- Restart device if unresponsive for >1 minute

---

## 4. Parameter Validation Issues

### Issue 4.1: "Invalid Parameter Value"

**Symptom:**
```
Compilation Error:
  Code: INVALID_PARAMETER
  Message: Parameter 'gain' out of range: 5.5
  Expected: 0.1 to 5.0
```

**Common Invalid Values:**

```
Audio Gain:
  Min: 0.1, Max: 5.0
  ✗ Example: gain = 6.0 (too high)
  ✓ Fix: gain = 5.0

State Decay:
  Min: 0.0, Max: 0.99
  ✗ Example: decay = 1.0 (no decay)
  ✓ Fix: decay = 0.99

Buffer Size:
  Min: 8, Max: NUM_LEDS (256)
  ✗ Example: size = 512 (too large)
  ✓ Fix: size = 256

Blur Radius:
  Min: 1, Max: 8
  ✗ Example: radius = 10 (too large)
  ✓ Fix: radius = 8

Audio Floor:
  Min: 0.0, Max: 0.5
  ✗ Example: floor = 0.8 (too high)
  ✓ Fix: floor = 0.3
```

**Resolution:**

```
Step 1: Identify which parameter is invalid
  Look at error message: "gain out of range"

Step 2: Check valid range
  Web Editor → Node Info → Parameter Range
  Or check API schema: GET /nodes/schema/audio_bass

Step 3: Adjust value to valid range
  If value too high: Use max value
  If value too low: Use min value

  Example:
    gain: 5.5 → gain: 5.0 (capped at max)
    floor: -0.1 → floor: 0.0 (floored at min)

Step 4: Recompile and verify
  Should now succeed
```

**Prevention:**
- Use UI sliders (automatically constrain range)
- Enable range validation while editing
- Check parameter ranges in node info panel
- Preview estimated impact before compiling

---

## 5. Visual Output Issues

### Issue 5.1: "LEDs Not Lighting / All Black"

**Symptom:**
```
Pattern deployed successfully (green checkmark)
Device shows: "Running" with 60+ FPS
Visual output: All LEDs black (no light)
Expected: Colorful pattern
```

**Possible Causes:**

```
Audio Input:
  ├─ No audio being provided to device
  ├─ Audio level too low (below floor threshold)
  ├─ Audio input disabled
  └─ Microphone not calibrated

Color Nodes:
  ├─ Brightness always 0
  ├─ Wrong color palette selected
  ├─ Saturation set to 0
  └─ Value set to 0

Output Node:
  ├─ Not connected to anything
  ├─ Receives zero input
  └─ LED array not initialized

LED Hardware:
  ├─ LEDs not powered
  ├─ LED strip disconnected
  ├─ Wrong LED count configured
  └─ Burned out LEDs
```

**Diagnostic Steps:**

```
Step 1: Verify audio input
  Device Console → Audio Status:
    Input: Enabled
    Sample Rate: 16000 Hz
    Level: >0.1 (not silent)

  If level is 0: No audio input

Step 2: Check graph connections
  Graph Editor → Validate Graph
  Look at final node connections:
    ├─ color_palette → output ✓
    ├─ All inputs connected ✓
    └─ output has input connected ✓

Step 3: Test with simple pattern
  Create: audio_bass → output pattern
  Should see LEDs respond to bass
  If works: Issue is complex pattern
  If fails: Issue is audio/LED hardware

Step 4: Check audio floor
  If audio signal is low:
    audio_bass node → floor: 0.0

  Increase if still black:
    audio_bass node → gain: 2.0

  Re-test

Step 5: Check LED hardware
  Device Console → LED Test
  Should see LED strip test pattern
  If no light: LED hardware issue (power, connection)
  If light works: Problem is pattern code

Step 6: Check audio calibration
  Device Console → Audio Calibration
  Verify microphone is detecting sound
  Make noise near device
  Level indicator should move
```

**Resolution:**

```
IF no audio input:
  1. Verify microphone connected
  2. Check audio input enabled
  3. Run audio calibration
  4. Test with speaker next to device
  5. Check if volume loud enough (>60dB recommended)

IF audio too quiet:
  1. audio_bass node → increase gain
     Original: gain = 1.0
     Try: gain = 2.0-3.0
  2. Reduce floor threshold
     Original: floor = 0.1
     Try: floor = 0.0

IF color nodes issue:
  1. Check color_hsv node:
     value parameter should be >0 (currently 0?)
     Change to: value = 1.0

  2. Check color_palette_lookup:
     palette should not be "none"
     Change to: palette = "heat"

IF output not connected:
  1. Verify final node connects to output
  2. Should see wire: color_node → output
  3. Create if missing

IF LED hardware:
  1. Check LED power supply
  2. Check data line connection
  3. Verify LED strip has power indicator lit
  4. Test with firmware LED test pattern
  5. May need to reset LED count if wrong
```

---

## 6. Quick Reference

### Checklist: Before Compiling

```
Graph Validation:
  □ At least 2 nodes (input + output)
  □ All nodes have parameters set
  □ All wires connected (no red indicators)
  □ Exactly 1 output node
  □ No circular dependencies visible

Constraints:
  □ Node count < 50
  □ Wire count < 100
  □ Estimated state size < 10KB
  □ Estimated FPS > 60

Audio:
  □ Audio input enabled on device
  □ Microphone working
  □ Audio level >0.1
  □ Audio floor set appropriately
```

### Checklist: After Deploying

```
Device Connection:
  □ Device shows "Connected" status
  □ No connection errors in console
  □ Device responds to commands

Pattern Execution:
  □ Pattern status shows "Running"
  □ FPS displayed and > 30
  □ No error messages
  □ No device crashes

Visual Output:
  □ LEDs lighting up
  □ Colors visible
  □ Pattern responds to audio
  □ Pattern stable for >30 seconds
```

### Common Error Codes & Quick Fixes

| Code | Cause | Fix |
|------|-------|-----|
| `GRAPH_VALIDATION_FAILED` | Missing output node | Add output node and connect |
| `STATE_BUDGET_EXCEEDED` | Buffers too large | Reduce buffer sizes 50% |
| `NODE_COUNT_EXCEEDED` | 50+ nodes | Remove 5-10 non-essential nodes |
| `INVALID_PARAMETER` | Parameter out of range | Use slider to auto-constrain |
| `DEVICE_NOT_AVAILABLE` | Device offline | Check USB/WiFi connection |
| `COMPILATION_TIMEOUT` | Pattern too complex | Simplify: remove nodes/buffers |

---

## 7. Escalation Path

**Tier 1: Self-Service**
1. Check this troubleshooting guide
2. Review graph schema documentation
3. Compare with example patterns
4. Restart device

**Tier 2: Community Support**
1. Post on K1.node1 forum
2. Share graph definition JSON
3. Include error message
4. Include device specs

**Tier 3: Developer Support**
1. Provide diagnostic report:
   ```
   Device Model: ESP32-S3
   Firmware: v2.1.0
   Arduino: 3.1.0
   IDF: 5.0
   Error: [error message]
   Graph: [graph JSON]
   Log: [device console output]
   ```
2. Contact: support@k1node.io
3. Include reproduction steps
4. Include expected vs. actual behavior

---

## 8. Performance Benchmarks

### Reference Patterns

```
Simple (2-3 nodes):
  Estimated FPS: 110+
  State size: 0 bytes
  Example: audio_bass → color → output

Bloom (5-6 nodes):
  Estimated FPS: 75
  State size: 100-200 bytes
  Example: bass → buffer → scroll → blur → color → output

Complex (10-15 nodes):
  Estimated FPS: 40-50
  State size: 500+ bytes
  Example: Multiple audio inputs, transforms, colors

Stress Test (30+ nodes):
  Estimated FPS: 20-30
  State size: 5+ KB
  Note: Not recommended for production
```

### Expected Measured FPS

Device should achieve 95-98% of estimated FPS:
- Estimated: 80 FPS → Measured: 76-80 FPS ✓
- Estimated: 100 FPS → Measured: 95-100 FPS ✓
- Estimated: 120 FPS → Measured: 115-120 FPS ✓

Larger deltas (>5%) suggest:
- Device under load
- Temperature throttling
- Compilation mismatch
- Estimation model error

---

**Last Updated:** 2025-11-10
**Test Coverage:** 12+ integration scenarios
**Status:** Production Ready
**Contact:** support@k1node.io
