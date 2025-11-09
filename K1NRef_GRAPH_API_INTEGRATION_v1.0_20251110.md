---
title: Graph System API Integration Guide
owner: Backend Engineer (Claude)
date: 2025-11-10
status: accepted
version: v1.0
scope: Complete API specification for graph compilation and device integration
tags: [api, graph-system, codegen, rest-api, specification, task-18]
related_docs:
  - K1NReport_INTEGRATION_TESTING_v1.0_20251110.md
  - K1NImp_GRAPH_INTEGRATION_WORKFLOW_v1.0_20251110.md
  - K1NArch_GRAPH_SYSTEM_ARCHITECTURE_v1.0_20251110.md
---

# Graph System API Integration Guide

**Purpose:** Complete API specification for graph compilation, code generation, validation, and device communication.

**Target Audience:** Frontend engineers integrating with graph compiler, backend engineers implementing endpoints, mobile developers using graph API

**API Version:** v1.0
**Status:** Production Ready

---

## 1. API Overview

### Base URL

```
Development:  http://localhost:3000/api/v1/graph
Production:   https://api.k1node.io/v1/graph
Device:       http://device.local/api/v1/graph (local)
```

### Authentication

```
Authorization: Bearer <token>
Content-Type: application/json
```

### Rate Limiting

```
Limit: 100 requests/minute
Burst: 10 requests/second
Reset: Every minute
Headers:
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 87
  X-RateLimit-Reset: 1699594500
```

---

## 2. Core Endpoints

### 2.1 POST /compile

Compile a graph definition to C++ code.

**Request:**
```json
{
  "graph": {
    "id": "bloom_v2",
    "name": "Bloom Effect",
    "nodes": [
      {
        "id": "audio_bass_1",
        "type": "audio_bass",
        "parameters": {
          "gain": 1.5,
          "floor": 0.1
        },
        "position": { "x": 100, "y": 100 }
      },
      {
        "id": "output_1",
        "type": "output",
        "parameters": {}
      }
    ],
    "wires": [
      {
        "from": "audio_bass_1",
        "from_output": "output",
        "to": "output_1",
        "to_input": "brightness"
      }
    ],
    "metadata": {
      "version": "1.0",
      "created_at": "2025-11-10T12:00:00Z"
    }
  },
  "options": {
    "optimize": true,
    "generate_debug_info": false,
    "estimate_performance": true
  }
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "compilation_id": "comp_abc123def456",
  "code": {
    "language": "cpp",
    "version": "17",
    "content": "// Generated C++ code...",
    "lines": 142
  },
  "statistics": {
    "node_count": 2,
    "wire_count": 1,
    "state_size_bytes": 0,
    "estimated_cycles_per_frame": 50000,
    "estimated_fps": 120,
    "compilation_time_ms": 12
  },
  "warnings": [],
  "metadata": {
    "compiler_version": "1.0.0",
    "target": "esp32-s3"
  }
}
```

**Response (Error - 400):**
```json
{
  "success": false,
  "error": {
    "code": "GRAPH_VALIDATION_FAILED",
    "message": "Graph validation failed: No output node found",
    "details": {
      "missing_output": true,
      "node_count": 1,
      "wire_count": 0
    }
  }
}
```

**Error Codes:**

| Code | HTTP | Description |
|------|------|-------------|
| `GRAPH_VALIDATION_FAILED` | 400 | Graph structure invalid (missing nodes, wires, etc.) |
| `STATE_BUDGET_EXCEEDED` | 400 | Total state size > 10240 bytes |
| `NODE_COUNT_EXCEEDED` | 400 | Node count > 50 |
| `WIRE_COUNT_EXCEEDED` | 400 | Wire count > 100 |
| `INVALID_NODE_TYPE` | 400 | Unknown node type |
| `INVALID_PARAMETER` | 400 | Parameter out of range |
| `COMPILATION_TIMEOUT` | 504 | Compilation took too long |
| `INTERNAL_ERROR` | 500 | Server error during compilation |

---

### 2.2 POST /validate

Validate a graph without compiling.

**Request:**
```json
{
  "graph": {
    "id": "test_graph",
    "name": "Test Pattern",
    "nodes": [...],
    "wires": [...]
  },
  "strict": true
}
```

**Response (Valid - 200):**
```json
{
  "valid": true,
  "graph_stats": {
    "node_count": 4,
    "wire_count": 3,
    "depth": 4,
    "stateful_nodes": 1,
    "estimated_state_size": 100
  },
  "warnings": [
    "Node 'audio_1' has low gain (0.1), may be below audible threshold"
  ],
  "performance_estimate": {
    "estimated_fps": 85,
    "estimated_cycles_per_frame": 450000,
    "performance_tier": "good"
  }
}
```

**Response (Invalid - 400):**
```json
{
  "valid": false,
  "errors": [
    {
      "type": "missing_node_type",
      "node_id": "node_5",
      "message": "No output node found"
    },
    {
      "type": "invalid_wire",
      "wire_index": 2,
      "message": "Wire references non-existent node: 'unknown_node'"
    }
  ],
  "warnings": []
}
```

---

### 2.3 GET /nodes/schema

Get complete node taxonomy and validation schema.

**Request:**
```
GET /nodes/schema?categories=audio_input,spatial_transform&include_examples=true
```

**Response:**
```json
{
  "version": "1.0",
  "total_nodes": 38,
  "categories": [
    {
      "name": "audio_input",
      "description": "Audio input and analysis nodes",
      "node_count": 6,
      "nodes": [
        {
          "type": "audio_bass",
          "display_name": "Bass Input",
          "description": "Extract bass frequency component (20-250 Hz)",
          "inputs": [],
          "outputs": [
            {
              "name": "output",
              "type": "float",
              "range": [0.0, 1.0],
              "description": "Normalized bass level"
            }
          ],
          "parameters": [
            {
              "name": "gain",
              "type": "float",
              "default": 1.0,
              "min": 0.1,
              "max": 5.0,
              "description": "Output gain multiplier"
            },
            {
              "name": "floor",
              "type": "float",
              "default": 0.0,
              "min": 0.0,
              "max": 0.5,
              "description": "Noise floor threshold"
            }
          ],
          "stateful": false,
          "state_size_bytes": 0,
          "example": {
            "id": "bass_1",
            "type": "audio_bass",
            "parameters": { "gain": 1.5, "floor": 0.1 }
          }
        }
      ]
    },
    {
      "name": "spatial_transform",
      "description": "Spatial manipulation and transforms",
      "node_count": 8,
      "nodes": [...]
    }
  ]
}
```

---

### 2.4 GET /nodes/schema/:nodeType

Get detailed schema for specific node type.

**Request:**
```
GET /nodes/schema/state_buffer_persist?include_performance=true
```

**Response:**
```json
{
  "type": "state_buffer_persist",
  "category": "state_management",
  "display_name": "State Buffer (Persistent)",
  "description": "Persistent buffer for accumulating and fading values over time",
  "stateful": true,
  "state_size_bytes": "size parameter",
  "inputs": [
    {
      "name": "value",
      "type": "float",
      "description": "Input value to accumulate"
    },
    {
      "name": "index",
      "type": "int",
      "description": "Buffer index (0 to size-1)"
    }
  ],
  "outputs": [
    {
      "name": "output",
      "type": "float[]",
      "size": "size parameter",
      "description": "Persistent buffer contents"
    }
  ],
  "parameters": [
    {
      "name": "size",
      "type": "int",
      "default": 100,
      "min": 8,
      "max": 2048,
      "step": 1,
      "description": "Buffer size in elements"
    },
    {
      "name": "decay",
      "type": "float",
      "default": 0.95,
      "min": 0.0,
      "max": 0.99,
      "step": 0.01,
      "description": "Decay rate per frame (multiplier)"
    },
    {
      "name": "reset_on_change",
      "type": "bool",
      "default": true,
      "description": "Reset buffer when pattern changes"
    }
  ],
  "performance": {
    "cpu_cycles_min": 100,
    "cpu_cycles_max": 300,
    "memory_bytes": "size * 4",
    "notes": "Linear time complexity O(size)"
  },
  "examples": [
    {
      "name": "Trail Effect",
      "parameters": { "size": 100, "decay": 0.95, "reset_on_change": true }
    }
  ]
}
```

---

### 2.5 POST /device/send

Send compiled code to device.

**Request:**
```json
{
  "device_id": "dev_esp32_kitchen",
  "compilation_id": "comp_abc123def456",
  "code": "// Generated C++ code...",
  "metadata": {
    "pattern_name": "Bloom Effect",
    "version": "1.0"
  }
}
```

**Response (Success - 202):**
```json
{
  "success": true,
  "device_id": "dev_esp32_kitchen",
  "pattern_id": "pat_xyz789",
  "status": "transferring",
  "transfer_progress": 45,
  "estimated_time_remaining_ms": 2500,
  "device_status": {
    "connected": true,
    "current_pattern": "previous_pattern_id",
    "memory_available": 65536,
    "ready_to_receive": true
  }
}
```

**Response (Error - 503):**
```json
{
  "success": false,
  "error": {
    "code": "DEVICE_NOT_AVAILABLE",
    "message": "Device not reachable: Connection timeout",
    "device_id": "dev_esp32_kitchen",
    "retry_after_ms": 5000
  }
}
```

---

### 2.6 GET /device/:deviceId/status

Get device compilation and execution status.

**Request:**
```
GET /device/dev_esp32_kitchen/status?include_performance=true
```

**Response:**
```json
{
  "device_id": "dev_esp32_kitchen",
  "connected": true,
  "current_pattern": {
    "pattern_id": "pat_xyz789",
    "name": "Bloom Effect",
    "compiled_at": "2025-11-10T12:05:00Z",
    "running": true,
    "compilation_status": "success",
    "device_compilation_time_ms": 8432
  },
  "performance_metrics": {
    "fps": 74.5,
    "estimated_fps": 75.0,
    "fps_delta_percent": -0.67,
    "avg_frame_time_ms": 13.42,
    "min_frame_time_ms": 12.8,
    "max_frame_time_ms": 14.2,
    "total_frames_rendered": 1247,
    "uptime_seconds": 16.7
  },
  "visual_output": {
    "brightness_avg": 0.45,
    "brightness_max": 1.0,
    "color_distribution": {
      "red": 0.35,
      "green": 0.25,
      "blue": 0.40
    }
  },
  "system_health": {
    "memory_used_bytes": 18432,
    "memory_free_bytes": 49152,
    "cpu_load_percent": 68,
    "temperature_celsius": 35,
    "uptime_seconds": 3847,
    "last_error": null
  }
}
```

---

### 2.7 POST /device/:deviceId/execute

Start executing a pattern on device.

**Request:**
```json
{
  "pattern_id": "pat_xyz789",
  "start_time": "immediate",
  "options": {
    "loop": true,
    "auto_adjust_fps": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "device_id": "dev_esp32_kitchen",
  "pattern_id": "pat_xyz789",
  "execution_status": "started",
  "timestamp": "2025-11-10T12:06:00Z"
}
```

---

### 2.8 POST /device/:deviceId/stop

Stop current pattern execution.

**Request:**
```json
{
  "graceful": true,
  "fade_out_ms": 500
}
```

**Response:**
```json
{
  "success": true,
  "device_id": "dev_esp32_kitchen",
  "stopped_pattern": "pat_xyz789",
  "final_metrics": {
    "total_frames": 1247,
    "total_uptime_seconds": 16.7,
    "avg_fps": 74.5
  }
}
```

---

## 3. Data Models

### 3.1 GraphNode

```typescript
interface GraphNode {
  id: string;                          // Unique node identifier
  type: string;                        // Node type (e.g., "audio_bass")
  parameters: Record<string, any>;     // Node-specific parameters
  position?: {                         // Optional UI position
    x: number;
    y: number;
  };
}
```

### 3.2 GraphWire

```typescript
interface GraphWire {
  from: string;                        // Source node ID
  from_output?: string;                // Source output name (default: "output")
  to: string;                          // Destination node ID
  to_input?: string;                   // Destination input name (default: "input")
}
```

### 3.3 GraphDefinition

```typescript
interface GraphDefinition {
  id: string;                          // Unique graph ID
  name: string;                        // Human-readable name
  nodes: GraphNode[];                  // All nodes
  wires: GraphWire[];                  // All connections
  metadata?: {
    version: string;                   // Graph version
    created_at?: string;               // ISO 8601 timestamp
    modified_at?: string;              // ISO 8601 timestamp
    author?: string;
    description?: string;
    tags?: string[];
  };
}
```

### 3.4 CompilationResult

```typescript
interface CompilationResult {
  success: boolean;
  compilation_id: string;
  code?: {
    language: "cpp";
    version: string;
    content: string;
    lines: number;
  };
  statistics?: {
    node_count: number;
    wire_count: number;
    state_size_bytes: number;
    estimated_cycles_per_frame: number;
    estimated_fps: number;
    compilation_time_ms: number;
  };
  errors?: Array<{
    code: string;
    message: string;
    node_id?: string;
    wire_index?: number;
  }>;
  warnings?: string[];
}
```

---

## 4. Webhook Events

### Pattern Compilation Complete

```
POST /webhooks/pattern/compiled
Content-Type: application/json

{
  "event": "pattern.compiled",
  "timestamp": "2025-11-10T12:05:00Z",
  "compilation_id": "comp_abc123",
  "status": "success",
  "statistics": {...}
}
```

### Device Status Change

```
POST /webhooks/device/status_changed
Content-Type: application/json

{
  "event": "device.status_changed",
  "device_id": "dev_esp32_kitchen",
  "timestamp": "2025-11-10T12:05:00Z",
  "new_status": "running",
  "pattern_id": "pat_xyz789"
}
```

### Pattern Execution Started/Stopped

```
POST /webhooks/device/pattern_status
Content-Type: application/json

{
  "event": "device.pattern_status_changed",
  "device_id": "dev_esp32_kitchen",
  "pattern_id": "pat_xyz789",
  "timestamp": "2025-11-10T12:05:00Z",
  "status": "running|stopped",
  "final_metrics": {...}
}
```

---

## 5. Code Examples

### Example 1: Simple Compilation (JavaScript)

```javascript
async function compilePattern() {
  const graph = {
    id: 'simple_bass',
    name: 'Simple Bass',
    nodes: [
      {
        id: 'audio_1',
        type: 'audio_bass',
        parameters: { gain: 1.0, floor: 0.0 }
      },
      {
        id: 'output_1',
        type: 'output',
        parameters: {}
      }
    ],
    wires: [
      { from: 'audio_1', to: 'output_1', to_input: 'brightness' }
    ]
  };

  const response = await fetch('http://localhost:3000/api/v1/graph/compile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_TOKEN'
    },
    body: JSON.stringify({ graph })
  });

  const result = await response.json();

  if (result.success) {
    console.log('Compilation successful!');
    console.log(`FPS: ${result.statistics.estimated_fps}`);
    console.log(`State size: ${result.statistics.state_size_bytes} bytes`);
  } else {
    console.error('Compilation failed:', result.error.message);
  }

  return result;
}
```

### Example 2: Deploy to Device (TypeScript)

```typescript
async function deployPatternToDevice(
  compilationId: string,
  code: string,
  deviceId: string
) {
  const response = await fetch(
    `http://localhost:3000/api/v1/device/${deviceId}/send`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_TOKEN'
      },
      body: JSON.stringify({
        device_id: deviceId,
        compilation_id: compilationId,
        code,
        metadata: {
          pattern_name: 'My Pattern',
          version: '1.0'
        }
      })
    }
  );

  const result = await response.json();

  if (result.success) {
    console.log(`Pattern sent to device. Transfer progress: ${result.transfer_progress}%`);

    // Poll for completion
    let completed = false;
    while (!completed) {
      await new Promise(r => setTimeout(r, 500));

      const statusResponse = await fetch(
        `http://localhost:3000/api/v1/device/${deviceId}/status`,
        {
          headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
        }
      );

      const status = await statusResponse.json();

      if (status.current_pattern.pattern_id === compilationId) {
        completed = true;
        console.log('Pattern deployed successfully!');
        console.log(`Measured FPS: ${status.performance_metrics.fps}`);
      }
    }
  } else {
    console.error('Deployment failed:', result.error.message);
  }
}
```

### Example 3: Validate Before Compile (React)

```jsx
function GraphValidator({ graph }) {
  const [validation, setValidation] = useState(null);

  async function validateGraph() {
    const response = await fetch(
      'http://localhost:3000/api/v1/graph/validate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graph, strict: true })
      }
    );

    const result = await response.json();
    setValidation(result);
  }

  return (
    <div>
      <button onClick={validateGraph}>Validate</button>

      {validation && (
        <div>
          {validation.valid ? (
            <div style={{ color: 'green' }}>
              <p>Graph is valid!</p>
              <p>Estimated FPS: {validation.performance_estimate.estimated_fps}</p>
              <p>Node count: {validation.graph_stats.node_count}</p>
            </div>
          ) : (
            <div style={{ color: 'red' }}>
              <p>Validation errors:</p>
              <ul>
                {validation.errors.map((err, i) => (
                  <li key={i}>{err.message}</li>
                ))}
              </ul>
            </div>
          )}

          {validation.warnings.length > 0 && (
            <div style={{ color: 'orange' }}>
              <p>Warnings:</p>
              <ul>
                {validation.warnings.map((warn, i) => (
                  <li key={i}>{warn}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## 6. Error Handling

### Standard Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {
      "field": "value"
    },
    "timestamp": "2025-11-10T12:05:00Z",
    "request_id": "req_abc123"
  }
}
```

### Common Error Codes

| Code | HTTP | Cause | Recovery |
|------|------|-------|----------|
| `GRAPH_VALIDATION_FAILED` | 400 | Graph structure invalid | Fix graph, retry |
| `STATE_BUDGET_EXCEEDED` | 400 | Too much state allocation | Reduce buffer sizes |
| `NODE_COUNT_EXCEEDED` | 400 | Too many nodes | Simplify graph |
| `INVALID_NODE_TYPE` | 400 | Unknown node type | Check node type spelling |
| `INVALID_PARAMETER` | 400 | Parameter out of range | Check parameter ranges |
| `DEVICE_NOT_AVAILABLE` | 503 | Device unreachable | Check device connection |
| `INTERNAL_ERROR` | 500 | Server error | Retry, contact support |

---

## 7. Rate Limiting & Quotas

### Tier System

| Tier | Requests/min | Compile/day | Devices | Price |
|------|--------------|------------|---------|-------|
| Free | 10 | 10 | 1 | Free |
| Pro | 100 | 1000 | 5 | $9.99/mo |
| Enterprise | Unlimited | Unlimited | Unlimited | Custom |

### Quota Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1699594500
X-Quota-Daily-Limit: 1000
X-Quota-Daily-Used: 234
X-Quota-Daily-Reset: 1699680000
```

---

## 8. Testing & Mocking

### Mock Server Setup

```bash
# Install mock server
npm install -g @k1node/graph-api-mock

# Start with example data
graph-api-mock --port 3001 --seed examples/basic.json

# Now use http://localhost:3001/api/v1/graph
```

### Test Graphs

```bash
# Get test graphs
curl http://localhost:3001/api/v1/test-graphs

# Use specific test graph
curl -X POST http://localhost:3001/api/v1/graph/compile \
  -H "Content-Type: application/json" \
  -d @test-graphs/bloom-effect.json
```

---

## 9. SDK & Libraries

### Available SDKs

- **JavaScript:** `npm install @k1node/graph-sdk`
- **Python:** `pip install k1node-graph-sdk`
- **TypeScript:** Included with JavaScript SDK
- **Go:** `go get github.com/k1node/graph-sdk-go`

### SDK Usage Example (JavaScript)

```javascript
import { GraphCompiler, DeviceClient } from '@k1node/graph-sdk';

const compiler = new GraphCompiler({
  apiUrl: 'http://localhost:3000/api/v1',
  token: 'your_token'
});

const graph = {...};
const result = await compiler.compile(graph);

if (result.success) {
  const client = new DeviceClient(result.code);
  await client.sendToDevice('dev_esp32_kitchen');
}
```

---

**Last Updated:** 2025-11-10
**API Version:** v1.0
**Status:** Production Ready
**Support:** api-support@k1node.io
