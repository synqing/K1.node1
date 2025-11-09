# K1.node1 FAQ & Troubleshooting Guide

**Status**: Production Ready
**Version**: 1.0
**Date**: 2025-11-10
**Owner**: K1 Development Team

## Frequently Asked Questions

### General Questions

#### Q1: What is the K1.node1 Graph System?

**A**: The graph system is a declarative way to define LED patterns. Instead of writing C++ code, you:
1. Define a pattern as a JSON graph of nodes
2. Let the code generator create optimized C++
3. Deploy and test on device

Benefits:
- No C++ knowledge required
- Automatic optimization
- Type-safe data flow
- Easy to test and validate

#### Q2: Do I need to know C++?

**A**: No! You can:
- Create patterns using JSON graphs
- Use the code generator to create C++
- Deploy via REST API
- Adjust via parameters

If you want to:
- Extend with custom nodes
- Optimize performance
- Debug issues
- Understand generated code

Then C++ knowledge helps but isn't required.

#### Q3: What patterns can I create?

**A**: Any pattern that:
- Reads audio (microphone input)
- Processes signals (filters, effects)
- Renders to LEDs (output)

Examples:
- Spectrum visualizers
- Beat-synced effects
- Ambient/breathing patterns
- Animated trails
- Color gradients
- Audio-reactive light shows

You're limited only by your imagination and the 60fps performance budget.

#### Q4: Can I run multiple patterns simultaneously?

**A**: Not currently. K1.node1 runs one pattern at a time. You can:
- Switch patterns quickly (< 1 second fade)
- Create composite patterns that blend effects
- Use parameters to change appearance dynamically

Future versions may support pattern layering.

#### Q5: How many custom patterns can I have?

**A**: Limited by device storage (~1MB free flash). Typical pattern is 2-10KB generated code, so you can have 100+ patterns.

---

### Pattern Design Questions

#### Q6: What's the difference between nodes and parameters?

**A**:
- **Nodes**: Fixed structure (what the pattern does)
- **Parameters**: Runtime values (customize behavior)

Example:
```json
{
  "nodes": [
    {
      "type": "audio_fft",  // Node: Fixed
      "palette_id": "params.palette_id"  // Parameter reference
    }
  ]
}
```

You can change palette at runtime via `/api/patterns/{id}/parameters`, but changing nodes requires regeneration.

#### Q7: What's the maximum pattern complexity?

**A**: Measure by execution time:
- Target: < 16.67ms per frame (60fps)
- Safe budget: < 12ms (audio + rendering)
- Danger zone: > 14ms (frame drops)

Check complexity with:
```bash
curl http://device:8080/api/codegen/validate -d @pattern.json | jq '.metrics.estimated_time_us'
```

#### Q8: How do I optimize a slow pattern?

**A**: If pattern drops below 60fps:

1. **Profile** to find bottleneck:
   ```bash
   curl http://device:8080/api/device/performance | jq '.stages'
   ```

2. **Optimize by category**:
   - **Audio heavy**: Reduce FFT size, use envelope instead
   - **Rendering heavy**: Reduce LED count, simplify effects
   - **Effect heavy**: Remove non-critical effects, simplify color lookup

3. **Common optimizations**:
   - Replace `SignalConvolve` with `SignalBlur`
   - Use precomputed lookup tables
   - Reduce interpolation quality
   - Remove unused nodes
   - Cache palette lookups

#### Q9: Can I modify patterns at runtime?

**A**:
- **Parameters**: Yes, via REST API (instant)
- **Graph structure**: No, requires code generation
- **Node connections**: No, requires regeneration

If you need structure changes, regenerate and redeploy.

#### Q10: What's the best way to add audio reactivity?

**A**: Follow this pattern:

1. **Capture audio**:
   ```json
   {
     "id": "audio_rms",
     "type": "audio_input",
     "operation": "AUDIO_RMS()"
   }
   ```

2. **Process (optional)**:
   ```json
   {
     "id": "smooth_rms",
     "type": "temporal",
     "inputs": ["rms"],
     "logic": { "smoothed": "rms * 0.8 + smoothed * 0.2" }
   }
   ```

3. **Apply to rendering**:
   ```json
   {
     "id": "brightness_apply",
     "logic": { "color": "color * smoothed" }
   }
   ```

This gives responsive but stable effects.

---

### Code Generation Questions

#### Q11: What does code generation do?

**A**: Converts your JSON graph to optimized C++:

1. **Validates** graph structure
2. **Analyzes** data flow dependencies
3. **Optimizes** (dead code, constants, inlining)
4. **Emits** C++ in dependency order
5. **Verifies** output is valid

Result: Machine-optimized C++ that matches hand-written code in performance.

#### Q12: How accurate is the complexity estimate?

**A**: Very accurate for typical patterns (±10% error):
- Estimates based on node types and counts
- Includes loop iterations
- Accounts for branching

To verify: Deploy and measure with `/api/device/performance`.

#### Q13: Can I use the generated code for other purposes?

**A**: Yes! Generated C++ is:
- Self-contained (no external dependencies)
- Portable (standard C++17)
- Optimized for ESP32
- Can be integrated into other projects

License: Same as your pattern definition.

#### Q14: What if code generation fails?

**A**: Possible causes:

| Error | Cause | Fix |
|-------|-------|-----|
| "Invalid JSON" | Syntax error | Validate with jq |
| "Node type unknown" | Typo in type | Check `K1NRef_NODE_CATALOG_v1.0_20251110.md` |
| "Data type mismatch" | Input/output types don't match | Add type conversion node |
| "Circular dependency" | Nodes depend on each other | Break cycle with delay node |
| "Missing field" | Required field absent | Check node definition |

#### Q15: How do I debug generated code?

**A**: Generated code includes comments:

```cpp
// Node: magnitude_response
// Input: magnitude (float)
// Output: final_magnitude (float)
float final_magnitude = sqrtf(magnitude) * age_factor;
```

To see more detail:
1. Request with `"add_comments": true`
2. Check node inputs/outputs
3. Trace data flow through code
4. Use device telemetry to verify behavior

---

### Performance Questions

#### Q16: Why does my pattern drop frames?

**A**: Check in this order:

1. **Is it really dropping?**
   ```bash
   curl http://device/api/device/performance | jq '.timing.fps'
   ```
   Should be ~59.8 or higher.

2. **What's the bottleneck?**
   ```bash
   curl http://device/api/device/performance | jq '.stages'
   ```
   Look for stage > 3ms.

3. **Optimize the bottleneck**:
   - Audio heavy: Reduce FFT, use simpler filters
   - Rendering heavy: Reduce effects, simplify loops
   - Processing heavy: Remove nodes, cache calculations

#### Q17: How much memory do patterns use?

**A**: Breakdown:
- Generated code: ~2-10KB per pattern (flash)
- Runtime state: ~1-5KB per pattern (RAM)
- Stateful buffers: ~4KB per buffer (if used)
- Typical total: <50KB RAM, <100KB flash

Check usage:
```bash
curl http://device/api/device/info | jq '.memory'
```

#### Q18: Can I reduce LED strip size for better performance?

**A**: Yes! Smaller strips run faster:
- 32 LEDs: ~1ms rendering
- 100 LEDs: ~3ms rendering
- 180 LEDs: ~4ms rendering

If you have fewer LEDs, modify:
```json
{
  "constants": ["NUM_LEDS=100"]
}
```

Then regenerate.

#### Q19: What's the maximum LED count?

**A**: Theoretically unlimited (limited by memory/bandwidth):
- Practical limit: ~500 LEDs @ 60fps
- Hardware limit: 1000+ LEDs (but <30fps)

Performance scales linearly with LED count.

#### Q20: How do I benchmark my pattern?

**A**: Compare before/after metrics:

```bash
# Before optimization
curl http://device/api/device/performance | jq '{fps: .timing.fps, stages: .stages}'

# Make changes

# After optimization
curl http://device/api/device/performance | jq '{fps: .timing.fps, stages: .stages}'
```

Should see:
- Frame time decreased
- FPS increased (toward 60)
- No visible artifacts

---

### Audio Questions

#### Q21: How do I enable audio input?

**A**: Audio is enabled by default. To verify:

```bash
curl http://device/api/device/info | jq '.audio'
```

Should show:
- `enabled: true`
- `sample_rate: 44100`
- `fft_size: 512`

#### Q22: Where do I connect the microphone?

**A**: Device has I2S microphone input on:
- **GPIO**: 1 (CLK), 2 (WS), 42 (SD)
- **Standard**: Adafruit I2S MEMS microphone
- **Configuration**: Already set in firmware

If no audio:
1. Check microphone connected
2. Verify GPIO assignments
3. Restart device

#### Q23: Why is audio sensitivity low?

**A**: Microphone gain is adjustable:

```bash
curl -X PUT http://device/api/patterns/current/parameters \
  -H "Content-Type: application/json" \
  -d '{"audio_gain": 2.0}'
```

Valid range: 0.5 - 4.0
- < 1.0: Quiet (for loud sources)
- 1.0: Nominal
- > 1.0: Quiet sensitivity

#### Q24: How do I process bass/mids/treble separately?

**A**: Use FFT and bin extraction:

```json
{
  "id": "audio_fft",
  "type": "audio_input",
  "outputs": { "spectrum": "float[256]" }
},
{
  "id": "extract_bass",
  "type": "calculation",
  "logic": {
    "bass": "average(spectrum[0..20])"
  }
},
{
  "id": "extract_mids",
  "type": "calculation",
  "logic": {
    "mids": "average(spectrum[20..100])"
  }
}
```

#### Q25: How do I detect beats reliably?

**A**: Use energy-based onset detection:

```json
{
  "id": "beat_detect",
  "type": "audio_input",
  "logic": {
    "beat": "energy > (avg_energy * threshold)"
  }
},
{
  "id": "beat_debounce",
  "type": "temporal",
  "logic": {
    "min_interval": 100,
    "output": "beat && time_since_last_beat_ms > min_interval"
  }
}
```

Tuning:
- Threshold 1.5: Sensitive (may false trigger)
- Threshold 2.0: Balanced
- Threshold 3.0: Conservative (may miss beats)

---

### Troubleshooting

#### Problem: Pattern doesn't load

**Symptoms**: REST call succeeds but pattern doesn't appear

**Diagnosis**:
```bash
curl http://device/api/patterns/my_pattern
```

If 404: Pattern not registered

**Solution**:
1. Verify pattern name is correct
2. Check pattern is in registry
3. Restart device
4. Check firmware has pattern compiled in

---

#### Problem: Code generation fails with "type mismatch"

**Symptoms**: Error like "Cannot connect float[] to float"

**Diagnosis**:
```bash
curl -X POST http://device/api/codegen/validate -d @pattern.json | jq '.errors'
```

Check output types of one node match input types of next.

**Solution**:
1. Review node outputs/inputs
2. Add explicit type conversion if needed
3. Example: Use `SignalMagnitude` to convert array to scalar

---

#### Problem: Pattern flickers or has visual artifacts

**Symptoms**: LEDs flicker, colors jump, random pixels

**Diagnosis**:
1. Check FPS: `curl http://device/api/device/performance | jq '.timing.fps'`
2. If < 59.0: Frame drops causing flicker
3. If 60.0: Likely logic bug

**Solutions**:
- If frame drops: Optimize pattern (reduce nodes, effects)
- If logic issue: Check parameter ranges, clamp values to 0.0-1.0

---

#### Problem: Audio not responding

**Symptoms**: Pattern renders but doesn't react to audio

**Diagnosis**:
1. Check audio enabled: `curl http://device/api/device/info | jq '.audio.enabled'`
2. Check microphone connected
3. Check audio RMS: `curl http://device/api/device/performance | jq '.audio.rms_energy'`

If RMS = 0: No audio input (check microphone)

**Solutions**:
1. Verify microphone connected and powered
2. Increase audio gain: `PUT /api/patterns/*/parameters {"audio_gain": 2.0}`
3. Test with loud sound nearby
4. Restart device

---

#### Problem: REST API slow or timing out

**Symptoms**: curl takes >5 seconds, or times out

**Diagnosis**:
1. Check network: `ping device`
2. Check device performance: `curl http://device/api/device/performance`
3. Check memory: `curl http://device/api/device/info | jq '.memory'`

**Solutions**:
- If latency high: Check WiFi signal (RSSI)
- If CPU high: Reduce pattern complexity
- If memory low: Restart device
- If timeout: Device may be busy, retry after 2s

---

#### Problem: Custom parameters not working

**Symptoms**: Parameter update succeeds but pattern doesn't change

**Diagnosis**:
1. Verify parameter exists: `curl http://device/api/patterns/*/parameters`
2. Check value range in pattern definition
3. Verify node uses parameter

**Solution**:
```json
{
  "id": "use_param",
  "logic": {
    "output": "input * params.brightness"  // Must reference params
  }
}
```

If parameter not referenced in any node, it won't affect pattern.

---

#### Problem: Device out of memory

**Symptoms**: Errors like "Memory allocation failed"

**Diagnosis**:
```bash
curl http://device/api/device/info | jq '.memory.free_heap_bytes'
```

Should be > 50KB. If < 20KB: Memory pressure.

**Solutions**:
1. Reduce stateful buffer count
2. Reduce LED count
3. Simplify pattern (fewer nodes)
4. Restart device (clears fragmentation)

---

#### Problem: WiFi connection drops

**Symptoms**: Device unreachable, reconnects frequently

**Diagnosis**:
1. Check RSSI: `curl http://device/api/device/info | jq '.network.rssi_dbm'`
2. Check distance from router
3. Check interference (2.4GHz crowded)

**Solutions**:
1. Move closer to router (RSSI should be > -70dBm)
2. Switch to 5GHz WiFi if available
3. Reduce other WiFi devices
4. Restart router

---

## Debugging Techniques

### Method 1: REST Diagnostics

```bash
# Get full device state
curl http://device/api/device/info | jq '.'

# Get performance baseline
curl http://device/api/device/performance | jq '.'

# Check specific pattern
curl http://device/api/patterns/my_pattern | jq '.parameters'
```

### Method 2: WebSocket Monitoring

```javascript
const ws = new WebSocket('ws://device:8080/api/ws');
ws.send(JSON.stringify({
  action: 'subscribe',
  types: ['telemetry', 'audio_data', 'error']
}));
ws.onmessage = (msg) => {
  const data = JSON.parse(msg.data);
  console.log(data);
};
```

### Method 3: Serial Debugging

If device has USB serial:
```bash
screen /dev/ttyUSB0 115200
# Press reset button on device
# Look for debug output
```

### Method 4: Minimal Test Pattern

Create simplest pattern to isolate issue:
```json
{
  "pattern": { "name": "test" },
  "nodes": [
    {
      "id": "fill",
      "type": "rendering",
      "logic": { "op": "leds[0] = CRGBF(1,0,0)" }
    }
  ]
}
```

If this works, your device is fine - issue is in complex pattern.

---

## Best Practices

### For Reliable Patterns

1. **Always validate locally first**
   ```bash
   curl -X POST /api/codegen/validate -d @pattern.json
   ```

2. **Test audio sensitivity**
   ```bash
   curl http://device/api/device/performance | jq '.audio'
   ```

3. **Profile before optimizing**
   ```bash
   curl http://device/api/device/performance | jq '.stages'
   ```

4. **Clamp all outputs**
   ```json
   { "logic": { "output": "clamp(value, 0.0, 1.0)" } }
   ```

5. **Use meaningful parameter names**
   ```json
   { "brightness": 0.8 }  // Good
   { "param1": 0.8 }      // Bad
   ```

---

## Getting Help

If you're stuck:

1. **Check this FAQ** - Most issues covered
2. **Read the Quick Start** - Step-by-step walkthrough
3. **Review Node Catalog** - Understand each node type
4. **Check generated code** - See exactly what runs
5. **Use diagnostics** - Profile with device API
6. **Search documentation** - All guides are searchable

---

## Glossary

| Term | Meaning |
|------|---------|
| **Graph** | Directed acyclic graph of nodes |
| **Node** | Single computation unit |
| **Pattern** | Complete LED animation defined by graph |
| **Code Generation** | Converting JSON to C++ |
| **Parameter** | Runtime-adjustable value |
| **Telemetry** | Performance metrics from device |
| **Bottleneck** | Slowest stage limiting performance |
| **FFT** | Fast Fourier Transform (frequency analysis) |
| **RMS** | Root Mean Square (signal energy) |
| **IRAM** | Internal RAM (fast, limited) |

---

**End of FAQ & Troubleshooting Guide v1.0**

For more help, see the **SDK Developer Guide** and **Node Catalog** in the docs directory.
