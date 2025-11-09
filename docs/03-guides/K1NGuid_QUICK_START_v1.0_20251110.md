# K1.node1 Quick Start Guide

**Status**: Production Ready
**Version**: 1.0
**Date**: 2025-11-10
**Owner**: K1 Development Team

## Your First Pattern in 30 Minutes

This guide walks you through creating, generating, and running a simple LED pattern on your K1.node1 device.

### Prerequisites

- K1.node1 device with WiFi
- Device IP address (check your router)
- curl or similar HTTP client
- Text editor
- Basic understanding of JSON

### Time Breakdown

- Design: 5 minutes
- Implementation: 10 minutes
- Testing: 15 minutes

---

## Step 1: Understand the Pattern Concept (3 min)

A **pattern** is an animation of your LED strip. It defines:

1. **Inputs**: Audio, time, parameters
2. **Processing**: Effects, transforms, analysis
3. **Output**: LED colors

Our first pattern: **Fill all LEDs with a solid red color**

This is the simplest possible pattern - no effects, just output.

---

## Step 2: Design the Pattern (2 min)

Our pattern has one job: fill all LEDs with red.

**Node Flow**:

```
┌──────────────┐
│  Color Init  │  (Set color to red)
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│  Loop (per LED)  │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│   LED Assign     │  (Write red to each LED)
└──────────────────┘
```

---

## Step 3: Create Pattern JSON (5 min)

Create file `hello_world_graph.json`:

```json
{
  "pattern": {
    "name": "hello_world",
    "version": "1.0",
    "description": "Hello World - Fill all LEDs with red color"
  },
  "nodes": [
    {
      "id": "color_init",
      "type": "calculation",
      "name": "Initialize Red Color",
      "logic": {
        "r": "1.0f",
        "g": "0.0f",
        "b": "0.0f"
      },
      "outputs": {
        "color": "CRGBF"
      }
    },
    {
      "id": "render_loop",
      "type": "loop",
      "name": "Render All LEDs",
      "range": "0 to NUM_LEDS",
      "body": [
        {
          "id": "led_assign",
          "type": "rendering",
          "name": "Assign Color to LED",
          "inputs": ["color"],
          "logic": {
            "op": "leds[i] = color"
          }
        }
      ]
    }
  ],
  "flow": [
    "color_init -> render_loop",
    "render_loop[0..NUM_LEDS] -> led_assign"
  ],
  "data_flow": {
    "inputs": [],
    "constants": ["NUM_LEDS"],
    "outputs": ["leds[NUM_LEDS]"]
  }
}
```

---

## Step 4: Validate Locally (2 min)

Validate your JSON syntax:

```bash
# Install jq if needed
brew install jq  # macOS
# apt install jq  # Ubuntu
# choco install jq  # Windows

# Validate JSON structure
jq . hello_world_graph.json

# Should output the JSON with no errors
```

Expected output: The JSON formatted nicely with no errors.

**Troubleshooting**:
- If you see `parse error`: Check JSON syntax
- Use an online JSON validator: https://jsonlint.com

---

## Step 5: Validate on Device (3 min)

Send graph to device validator:

```bash
DEVICE_IP="192.168.1.100"  # Replace with your device IP

curl -X POST http://$DEVICE_IP:8080/api/codegen/validate \
  -H "Content-Type: application/json" \
  -d @hello_world_graph.json | jq .
```

**Success Response**:
```json
{
  "status": "ok",
  "valid": true,
  "errors": [],
  "warnings": [],
  "metrics": {
    "node_count": 2,
    "edge_count": 1,
    "complexity": 0.2,
    "estimated_code_size_bytes": 256,
    "estimated_time_us": 150
  }
}
```

**If validation fails**:
1. Check error message in response
2. Fix JSON according to error
3. Retry validation

---

## Step 6: Generate C++ Code (2 min)

Generate the executable C++ from your graph:

```bash
DEVICE_IP="192.168.1.100"

curl -X POST http://$DEVICE_IP:8080/api/codegen/generate \
  -H "Content-Type: application/json" \
  -d @hello_world_graph.json > hello_world_generated.h
```

**Inspect generated code**:
```bash
head -50 hello_world_generated.h
```

You should see:
- Function declaration: `void draw_hello_world_generated(...)`
- Loop over LED indices
- LED assignment code

---

## Step 7: Load Pattern on Device (3 min)

Flash the pattern to your device:

**Option A: Via REST API** (Recommended for first time)

The device already has pattern code generation built-in. Just select the pattern:

```bash
curl -X POST http://$DEVICE_IP:8080/api/patterns/hello_world/select \
  -H "Content-Type: application/json" \
  -d '{"fade_time_ms": 0}'
```

**Response**:
```json
{
  "status": "ok",
  "pattern": "hello_world"
}
```

**Option B: Manual Integration** (For your own patterns)

1. Copy `hello_world_generated.h` to firmware project
2. Register in pattern registry
3. Rebuild and flash firmware (see Advanced section)

---

## Step 8: Test Pattern (2 min)

Check that your pattern is running:

```bash
# Get current pattern
curl http://$DEVICE_IP:8080/api/patterns/current | jq .

# Expected output shows:
# "pattern_id": "hello_world"
# "active": true
# "fps": ~60
```

**On Device**:
- All LEDs should be red
- LED strip should be responsive
- No flickering or artifacts

---

## Troubleshooting

### Device doesn't respond

**Problem**: `curl: (7) Failed to connect`

**Solutions**:
1. Check device is on and WiFi connected
2. Verify IP address: `ping device`
3. Check device has power
4. Restart device and retry

### Pattern doesn't appear

**Problem**: LEDs stay dark or show previous pattern

**Solutions**:
1. Verify pattern selection succeeded: `curl http://$DEVICE_IP:8080/api/patterns/current`
2. Check device performance: `curl http://$DEVICE_IP:8080/api/device/performance`
3. Verify pattern is valid: `curl http://$DEVICE_IP:8080/api/patterns/hello_world`

### LEDs show wrong color or flicker

**Problem**: Color isn't pure red, or LEDs flicker

**Solutions**:
1. Check color values: Each should be 0.0-1.0 (1.0 = 255 in 8-bit)
2. Verify brightness parameter: `curl http://$DEVICE_IP:8080/api/patterns/hello_world/parameters`
3. Reduce to minimum complexity if flickering

---

## What's Next?

Congratulations! You've created and deployed your first pattern. Now:

### Next: Add Audio Reactivity

Modify `hello_world_graph.json` to use audio:

```json
{
  "id": "audio_rms",
  "type": "audio_input",
  "name": "Read Audio RMS",
  "logic": {
    "rms": "compute_rms(AUDIO_SAMPLES)"
  },
  "outputs": {
    "rms": "float"
  }
}
```

Then use RMS to control brightness:
```json
"brightness": "rms * 2.0f"
```

### Next: Add Parameters

Make pattern customizable:

```json
{
  "id": "brightness_apply",
  "type": "calculation",
  "inputs": ["color", "brightness"],
  "logic": {
    "color_bright": "color * params.brightness"
  }
}
```

Then adjust via REST:
```bash
curl -X PUT http://$DEVICE_IP:8080/api/patterns/hello_world/parameters \
  -H "Content-Type: application/json" \
  -d '{"brightness": 0.5}'
```

### Next: Learn More

- **Full SDK Guide**: See `docs/06-reference/K1NRef_SDK_DEVELOPER_GUIDE_v1.0_20251110.md`
- **Node Catalog**: See `docs/06-reference/K1NRef_NODE_CATALOG_v1.0_20251110.md`
- **API Reference**: See `docs/06-reference/K1NRef_API_REFERENCE_v1.0_20251110.md`

---

## Advanced: Firmware Integration

For production patterns, integrate directly into firmware:

### Step 1: Add to Firmware Tree

```bash
firmware/src/generated_patterns/
├── hello_world_graph.json      # Your pattern definition
├── hello_world_generated.h     # Generated code
└── hello_world_codegen.sh      # Script to regenerate
```

### Step 2: Register Pattern

In `firmware/src/pattern_registry.cpp`:

```cpp
// Forward declare generated function
void draw_hello_world_generated(uint32_t time, CRGBF* leds, const PatternParameters& params);

// Register pattern
PatternInfo hello_world = {
    .name = "hello_world",
    .id = PATTERN_ID_HELLO_WORLD,
    .draw_fn = draw_hello_world_generated,
    .description = "Hello World - Fill all LEDs with red",
    .category = PATTERN_CATEGORY_STATIC
};

void init_patterns() {
    pattern_registry.register_pattern(hello_world);
}
```

### Step 3: Rebuild Firmware

```bash
cd firmware
pio run -e esp32s3 -t upload
```

---

## Quick Reference: Common Tasks

### List All Patterns

```bash
curl http://$DEVICE_IP:8080/api/patterns | jq '.patterns[].name'
```

### Change Pattern Parameter

```bash
curl -X PUT http://$DEVICE_IP:8080/api/patterns/hello_world/parameters \
  -H "Content-Type: application/json" \
  -d '{"brightness": 0.7}'
```

### Monitor Real-Time Performance

```bash
watch -n 1 'curl -s http://$DEVICE_IP:8080/api/device/performance | jq ".timing.fps"'
```

### Get Audio Metrics

```bash
curl http://$DEVICE_IP:8080/api/device/performance | jq '.audio'
```

### View Device Info

```bash
curl http://$DEVICE_IP:8080/api/device/info | jq '.'
```

---

## Glossary

- **Node**: Single computational unit (audio input, color lookup, etc.)
- **Graph**: Directed graph of connected nodes
- **Pattern**: Complete graph defining one animation
- **Code Generation**: Converting JSON graph to C++ code
- **LED Buffer**: Array of RGB colors to display on strip
- **Parameters**: Adjustable settings (brightness, speed, etc.)

---

## Support

Stuck? Try these resources:

1. **Check FAQ**: See `K1NGuid_FAQ_TROUBLESHOOTING_v1.0_20251110.md`
2. **Read Full Guide**: See `K1NRef_SDK_DEVELOPER_GUIDE_v1.0_20251110.md`
3. **Review Examples**: Check `examples/` directory
4. **Check Device Logs**: `curl http://$DEVICE_IP:8080/api/device/logs`

---

**Congratulations on your first K1.node1 pattern!**

You now understand:
- Pattern design
- JSON graph structure
- Code generation
- Device deployment
- Testing and validation

Next steps: Explore the Node Catalog to create more complex patterns!

---

**End of Quick Start Guide v1.0**
