# Graph System Telemetry Endpoints Reference

**Date:** 2025-11-10
**Version:** 1.0.0
**Status:** SPECIFICATION (Ready for Implementation)
**Related:** K1NReport_GRAPH_PERF_PROFILE_v1.0_20251110.md

---

## Overview

This document specifies REST API endpoints for graph system performance monitoring and diagnostics. These endpoints enable:

- Real-time performance monitoring (FPS, frame time, memory usage)
- Debugging graph compilation and state management
- Validation of performance targets during development
- Live profiling without halting the device

---

## 1. Performance Endpoint

### Endpoint: `GET /api/graph/perf`

**Purpose:** Retrieve current graph system performance metrics

**Response Format (JSON):**

```json
{
  "graph_system": {
    "enabled": true,
    "version": "1.0.0",
    "implementation": "stateful-nodes",
    "codegen_time_ms": 363,
    "graph_validation_ms": 18,
    "patterns_compiled": 22,
    "total_state_bytes": 74432,
    "last_codegen_timestamp": "2025-11-10T14:32:30Z"
  },
  "performance": {
    "frame_time_ms": 9.5,
    "fps": 104.7,
    "fps_variance": 0.3,
    "frame_time_min_ms": 9.2,
    "frame_time_max_ms": 9.8,
    "frame_time_p50_ms": 9.5,
    "frame_time_p95_ms": 9.7,
    "audio_snapshot_us": 12,
    "state_ops_us": 50,
    "render_us": 8000,
    "led_write_us": 500,
    "housekeeping_us": 1000,
    "frame_count": 987654,
    "uptime_seconds": 3600
  },
  "memory": {
    "heap_total": 320000,
    "heap_used": 74432,
    "heap_free": 245568,
    "state_active": 4321,
    "state_inactive": 70111,
    "fragmentation_pct": 0.0,
    "largest_free_block": 245568
  },
  "validation": {
    "fps_target": 105,
    "fps_actual": 104.7,
    "fps_delta_pct": -0.3,
    "fps_threshold": 103,
    "fps_pass": true,
    "memory_target_kb": 5.0,
    "memory_actual_kb": 4.3,
    "memory_threshold_kb": 5.0,
    "memory_pass": true,
    "codegen_target_ms": 2000,
    "codegen_actual_ms": 363,
    "codegen_pass": true,
    "state_init_us_actual": 210,
    "state_init_us_target": 1000,
    "state_init_pass": true,
    "overall_status": "PASS"
  }
}
```

**Response Codes:**
- `200 OK` - Success
- `503 Service Unavailable` - Graph system not initialized

**Update Frequency:** Every frame (10 ms)

---

## 2. Memory Endpoint

### Endpoint: `GET /api/graph/memory`

**Purpose:** Detailed memory breakdown and state buffer inspection

**Response Format (JSON):**

```json
{
  "memory_profile": {
    "timestamp": "2025-11-10T14:32:45Z",
    "active_pattern": {
      "name": "draw_bloom_mirror",
      "pattern_id": 5,
      "state_buffers": [
        {
          "id": "bloom_buffer",
          "type": "CRGBF[180]",
          "element_type": "CRGBF",
          "element_size": 12,
          "element_count": 180,
          "total_bytes": 2160,
          "initialized": true,
          "last_reset_ms": 45230,
          "last_reset_pattern_id": 5
        },
        {
          "id": "bloom_buffer_prev",
          "type": "CRGBF[180]",
          "element_type": "CRGBF",
          "element_size": 12,
          "element_count": 180,
          "total_bytes": 2160,
          "initialized": true,
          "last_reset_ms": 45230,
          "last_reset_pattern_id": 5
        },
        {
          "id": "_guard",
          "type": "uint8_t",
          "element_type": "uint8_t",
          "element_size": 1,
          "element_count": 1,
          "total_bytes": 1,
          "initialized": true,
          "last_reset_ms": 45230,
          "last_reset_pattern_id": 5
        }
      ],
      "total_active_bytes": 4321,
      "guard_overhead_bytes": 1,
      "actual_data_bytes": 4320
    },
    "pattern_inventory": [
      {
        "pattern_id": 0,
        "name": "draw_vu_meter",
        "state_bytes": 0,
        "active": false
      },
      {
        "pattern_id": 1,
        "name": "draw_rainbow",
        "state_bytes": 400,
        "active": false
      },
      {
        "pattern_id": 5,
        "name": "draw_bloom_mirror",
        "state_bytes": 4321,
        "active": true
      }
    ],
    "inactive_state_bytes": 70111
  },
  "heap_stats": {
    "heap_total": 320000,
    "heap_allocated": 74432,
    "heap_free": 245568,
    "allocation_ratio": 0.233,
    "largest_free_block": 245568,
    "fragmentation_percent": 0.0,
    "estimated_max_allocation": 245568
  },
  "allocation_map": {
    "static_buffers": 74432,
    "graph_metadata": 0,
    "pattern_registry": 128,
    "audio_buffers": 12288,
    "led_buffers": 8160,
    "misc": 0
  }
}
```

**Response Codes:**
- `200 OK` - Success
- `503 Service Unavailable` - Graph system not initialized

**Update Frequency:** Every 100 ms (on-demand)

---

## 3. Codegen Endpoint

### Endpoint: `GET /api/graph/codegen`

**Purpose:** Query code generation metrics and status

**Response Format (JSON):**

```json
{
  "codegen": {
    "last_compile": {
      "timestamp": "2025-11-10T14:32:30Z",
      "pattern_count": 22,
      "total_time_ms": 363,
      "stages": {
        "parse_json_ms": 45,
        "validate_topology_ms": 18,
        "type_inference_ms": 12,
        "code_generation_ms": 185,
        "optimization_passes_ms": 75,
        "write_output_ms": 28
      },
      "output_stats": {
        "lines_of_code": 2123,
        "functions_generated": 22,
        "state_nodes": 12,
        "total_state_bytes": 74432,
        "binary_size_bytes": 28672
      },
      "status": "SUCCESS",
      "errors": []
    },
    "patterns": [
      {
        "pattern_id": 0,
        "name": "draw_vu_meter",
        "codegen_time_ms": 18,
        "output_lines": 45,
        "state_nodes": 0,
        "state_bytes": 0,
        "status": "SUCCESS"
      },
      {
        "pattern_id": 1,
        "name": "draw_rainbow",
        "codegen_time_ms": 22,
        "output_lines": 52,
        "state_nodes": 1,
        "state_bytes": 400,
        "status": "SUCCESS"
      },
      {
        "pattern_id": 5,
        "name": "draw_bloom_mirror",
        "codegen_time_ms": 35,
        "output_lines": 78,
        "state_nodes": 2,
        "state_bytes": 4321,
        "status": "SUCCESS"
      }
    ]
  }
}
```

**Response Codes:**
- `200 OK` - Success
- `202 Accepted` - Codegen in progress
- `503 Service Unavailable` - Graph system not initialized

**Update Frequency:** On-demand (triggered by pattern change)

---

## 4. State Debug Endpoint

### Endpoint: `GET /api/graph/state?pattern_id=<id>`

**Purpose:** Detailed state buffer inspection for debugging

**Query Parameters:**
- `pattern_id` (optional): Pattern ID to inspect. If omitted, returns active pattern.

**Response Format (JSON):**

```json
{
  "state_debug": {
    "pattern_id": 5,
    "pattern_name": "draw_bloom_mirror",
    "timestamp": "2025-11-10T14:32:45Z",
    "state_buffers": [
      {
        "buffer_id": "bloom_buffer",
        "address": "0x3ffb2000",
        "type": "CRGBF[180]",
        "size_bytes": 2160,
        "first_8_elements": [
          { "r": 0.5234, "g": 0.2345, "b": 0.7123 },
          { "r": 0.4123, "g": 0.3456, "b": 0.6234 },
          { "r": 0.3234, "g": 0.4567, "b": 0.5345 },
          { "r": 0.2345, "g": 0.5678, "b": 0.4456 },
          { "r": 0.1456, "g": 0.6789, "b": 0.3567 },
          { "r": 0.0567, "g": 0.7890, "b": 0.2678 },
          { "r": 0.0, "g": 0.8901, "b": 0.1789 },
          { "r": 0.0, "g": 0.9012, "b": 0.0890 }
        ],
        "min": { "r": 0.0, "g": 0.0, "b": 0.0 },
        "max": { "r": 1.0, "g": 1.0, "b": 1.0 },
        "mean": { "r": 0.3456, "g": 0.5234, "b": 0.4567 },
        "initialized": true,
        "reset_count": 1,
        "last_reset_ms": 45230
      },
      {
        "buffer_id": "bloom_buffer_prev",
        "address": "0x3ffb3670",
        "type": "CRGBF[180]",
        "size_bytes": 2160,
        "first_8_elements": [
          { "r": 0.5123, "g": 0.2234, "b": 0.7012 },
          { "r": 0.4012, "g": 0.3345, "b": 0.6123 },
          { "r": 0.3123, "g": 0.4456, "b": 0.5234 },
          { "r": 0.2234, "g": 0.5567, "b": 0.4345 },
          { "r": 0.1345, "g": 0.6678, "b": 0.3456 },
          { "r": 0.0456, "g": 0.7789, "b": 0.2567 },
          { "r": 0.0, "g": 0.8890, "b": 0.1678 },
          { "r": 0.0, "g": 0.9901, "b": 0.0789 }
        ],
        "min": { "r": 0.0, "g": 0.0, "b": 0.0 },
        "max": { "r": 1.0, "g": 1.0, "b": 1.0 },
        "mean": { "r": 0.3345, "g": 0.5123, "b": 0.4456 },
        "initialized": true,
        "reset_count": 1,
        "last_reset_ms": 45230
      }
    ],
    "frame_context": {
      "frame_number": 987654,
      "timestamp_ms": 9876540,
      "audio_level": 0.6234,
      "audio_bass": 0.5123,
      "audio_mid": 0.4345,
      "audio_treble": 0.3456,
      "parameter_palette": 2,
      "parameter_speed": 0.75
    }
  }
}
```

**Response Codes:**
- `200 OK` - Success
- `400 Bad Request` - Invalid pattern_id
- `503 Service Unavailable` - Graph system not initialized

**Update Frequency:** On-demand

---

## 5. Health Check Endpoint

### Endpoint: `GET /api/graph/health`

**Purpose:** Quick health status of graph system

**Response Format (JSON):**

```json
{
  "health": {
    "status": "healthy",
    "timestamp": "2025-11-10T14:32:45Z",
    "checks": [
      {
        "name": "fps_target",
        "status": "pass",
        "value": 104.7,
        "threshold": 103,
        "message": "FPS within acceptable range"
      },
      {
        "name": "memory_usage",
        "status": "pass",
        "value": 23.3,
        "threshold": 75.0,
        "unit": "percent",
        "message": "Heap utilization normal"
      },
      {
        "name": "frame_time_stability",
        "status": "pass",
        "value": 0.15,
        "threshold": 1.0,
        "unit": "ms",
        "message": "Frame time variance low"
      },
      {
        "name": "state_management",
        "status": "pass",
        "message": "No state corruption detected"
      },
      {
        "name": "audio_pipeline",
        "status": "pass",
        "message": "Audio snapshot fresh"
      }
    ],
    "overall_status": "OK",
    "errors": [],
    "warnings": []
  }
}
```

**Response Codes:**
- `200 OK` - Healthy
- `500 Internal Server Error` - Unhealthy

**Update Frequency:** Every 100 ms

---

## 6. Heartbeat Format

### Heartbeat Message (Emitted to Serial/UDP every 1 second)

**Plain Text Format:**

```
[Graph System Heartbeat @ 2025-11-10T14:32:45Z]
FPS: 104.7 (target: >105, delta: -0.3%)
Frame: 9.5 ms (std: 0.15 ms)
Memory: 74.4 KB active, 245.6 KB free
State: 4.3 KB (pattern #5: draw_bloom_mirror)
Audio: 12 µs, fresh, bass=0.52
Status: OK [fps:✓ mem:✓ audio:✓]
```

**JSON Format (Optional):**

```json
{
  "heartbeat": {
    "timestamp": "2025-11-10T14:32:45Z",
    "interval_seconds": 1,
    "fps": 104.7,
    "fps_target": 105,
    "fps_status": "OK",
    "frame_time_ms": 9.5,
    "frame_time_std_ms": 0.15,
    "memory_kb": 74.4,
    "memory_free_kb": 245.6,
    "state_kb": 4.3,
    "pattern_id": 5,
    "pattern_name": "draw_bloom_mirror",
    "audio_latency_us": 12,
    "audio_fresh": true,
    "audio_bass": 0.52,
    "overall_status": "OK"
  }
}
```

---

## 7. Implementation Notes

### 7.1 Data Collection Strategy

**Lock-Free Profiling:**
```cpp
// Atomic counters for zero-cost profiling
static std::atomic<uint64_t> frame_count{0};
static std::atomic<uint64_t> total_frame_time_us{0};
static std::atomic<uint32_t> max_frame_time_us{0};
static std::atomic<uint32_t> min_frame_time_us{UINT32_MAX};

// Per-frame measurement (no locks)
{
    uint64_t t0 = esp_timer_get_time();
    // ... frame rendering ...
    uint64_t t1 = esp_timer_get_time();
    uint32_t frame_time = (uint32_t)(t1 - t0);

    frame_count.fetch_add(1, std::memory_order_relaxed);
    total_frame_time_us.fetch_add(frame_time, std::memory_order_relaxed);

    // Update max/min with compare-and-swap
    // (fast path: no CAS needed if no update)
}
```

### 7.2 Update Frequency Justification

| Endpoint | Frequency | Rationale |
|----------|-----------|-----------|
| `/api/graph/perf` | Every frame | Real-time monitoring |
| `/api/graph/memory` | Every 100 ms | Moderate overhead, sufficient granularity |
| `/api/graph/codegen` | On-demand | Expensive operation (363 ms) |
| `/api/graph/state` | On-demand | Intrusive (requires buffer access) |
| `/api/graph/health` | Every 100 ms | Quick summary |
| Heartbeat | Every 1 second | Serial bandwidth limited |

### 7.3 Memory Overhead

**Telemetry Data Overhead:**
```
Per-frame counters:     8 × 8 bytes = 64 bytes
Frame time history:     100 entries × 4 bytes = 400 bytes
Memory samples:         50 entries × 4 bytes = 200 bytes
Codegen metrics:        20 fields × 4 bytes = 80 bytes
────────────────────────────────────────────
Total telemetry:        ~800 bytes (0.25% of heap)
```

### 7.4 Performance Impact

**Telemetry Overhead:**
- Atomic counter update: ~5 ns per frame
- Frame time calculation: ~10 ns per frame
- Heartbeat aggregation: ~1 µs per second
- **Total impact:** <100 ns per frame (~0.001% FPS impact)

---

## 8. Usage Examples

### 8.1 Monitor Performance During Development

```bash
# Terminal 1: Start monitoring loop
while true; do
  curl -s http://device-ip:8080/api/graph/perf \
    | jq '.validation | {fps_pass, memory_pass, codegen_pass, overall_status}'
  sleep 1
done

# Output:
# {
#   "fps_pass": true,
#   "memory_pass": true,
#   "codegen_pass": true,
#   "overall_status": "PASS"
# }
```

### 8.2 Profile Specific Pattern

```bash
# Inspect memory usage of Bloom pattern (ID=5)
curl -s http://device-ip:8080/api/graph/memory \
  | jq '.memory_profile.active_pattern | {name, total_active_bytes, state_buffers}'
```

### 8.3 Debug State Corruption

```bash
# Get detailed state buffer values for debugging
curl -s http://device-ip:8080/api/graph/state?pattern_id=5 \
  | jq '.state_debug.state_buffers[0] | {buffer_id, mean, max, min}'
```

---

## 9. Future Extensions

**Possible endpoints for future phases:**

1. `/api/graph/validate` - Validate graph topology before codegen
2. `/api/graph/optimize` - Suggest optimization opportunities
3. `/api/graph/compare` - Compare hand-written vs generated code
4. `/api/graph/export` - Export performance profile as CSV/JSON
5. `/api/graph/replay` - Replay frame sequence with state debug

---

## References

- `K1NReport_GRAPH_PERF_PROFILE_v1.0_20251110.md` - Performance profiling results
- `docs/01-architecture/K1NArch_ASSESSMENT_STATEFUL_NODE_FEASIBILITY_v1.0_20251108.md` - System architecture

---

**Status:** SPECIFICATION COMPLETE
**Next Step:** Implementation in firmware (Task 11)

