---
author: Claude Agent (from Phase 2D1 Master Strategy)
date: 2025-11-05
status: published
intent: Technical context for Agent D (Integration Engineer) executing webapp integration and conditional path UI
references:
  - ../../PHASE_2_MASTER_PRD.txt (Workstream D)
  - ../../../webapp/ (target codebase)
  - ../../../docs/06-resources/testing_standards.md (frontend testing)
---

# Agent D: Integration Engineer Context Appendix

## Role & Responsibilities

**Engineer:** Integration & Frontend Specialist
**Primary Focus:** Webapp integration, graph UI (Path A) or parameter editor (Path B), real-time communication
**Workstreams:** Integration (Workstream D, conditional activation after Week 2 decision gate)
**Timeline:**
- Weeks 1-2: STANDBY (await decision gate outcome)
- Weeks 3-6: Path A UI (Graph Editor) OR Path B UI (Parameter Editor)
- Weeks 7-14: Integration + marketplace setup
**Deliverable Deadline:** Decision gate determines activation path

---

## Task Ownership (Master PRD Tasks)

**Conditional Task Activation (Nov 13 decision):**

**IF GO (Path A: Graph System):**
- **Task 17:** Implement Webapp Graph Editor UI (20 hours)
- **Task 18:** Graph System End-to-End Integration (16 hours)
- Phase C.3 in PHASE_2_MASTER_PRD.txt (Graph UI integration)

**IF NO-GO (Path B: C++ SDK):**
- **Task 20:** Implement Parameter Editor (16 hours)
- **Task 21:** SDK Webapp Integration (16 hours)
- Phase B.3 in PATH_B_SDK_FORMALIZATION.txt (Parameter editor)

---

## Webapp Architecture Overview

### Current Tech Stack

**Frontend:**
- Framework: React 18 + Vite
- Styling: Tailwind CSS + Radix UI
- State: React Query + Zustand
- Real-time: WebSocket + Server-Sent Events (SSE)
- Testing: Vitest + Playwright + Storybook

**Backend:**
- Framework: Express.js
- ORM: Prisma
- Database: SQLite (local), PostgreSQL (prod)
- Queue: Bull (for async tasks)
- API: REST + WebSocket

**Device Communication:**
- HTTP API: `/api/pattern`, `/api/status`, `/api/errors`
- WebSocket: Real-time telemetry (FPS, temperature, errors)
- Firmware update: OTA via HTTP multipart

### Component Architecture

```
/webapp
├── src/
│   ├── components/
│   │   ├── DeviceStatus.tsx        # Device connection status
│   │   ├── PatternSelector.tsx      # Current pattern display
│   │   ├── ParameterControls.tsx    # Slider/knob for parameters
│   │   ├── GraphEditor.tsx          # [NEW for Path A] Canvas editor
│   │   └── ErrorLog.tsx             # Error history viewer
│   ├── api/
│   │   ├── deviceApi.ts             # HTTP/WebSocket API client
│   │   └── graphApi.ts              # [NEW for Path A] Graph CRUD
│   ├── hooks/
│   │   ├── useDevice.ts             # Device connection state
│   │   ├── usePattern.ts            # Pattern management
│   │   └── useGraph.ts              # [NEW for Path A] Graph state
│   ├── stores/
│   │   └── deviceStore.ts           # Zustand store for device state
│   └── types/
│       └── graph.ts                 # [NEW for Path A] Graph TypeScript types
├── test/
│   ├── DeviceList.rtl.test.tsx      # RTL component tests
│   └── DevicesIntegration.msw.test.tsx  # MSW integration tests
└── public/
    └── index.html
```

---

## PATH A: React Graph Editor Implementation

**Conditional:** Only implemented if Graph PoC passes

### Graph Editor Architecture

**Libraries:**
- **ReactFlow:** Graph visualization + interaction (https://reactflow.dev)
- **Zustand:** Graph state management
- **TypeScript:** Type-safe graph operations

### Component: GraphEditor.tsx

```typescript
// webapp/src/components/GraphEditor.tsx
import React, { useCallback } from 'react';
import ReactFlow, {
  Node, Edge, addEdge, Connection, Controls,
  Background, MiniMap
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useGraphStore } from '../stores/graphStore';
import { NodeTypes } from '../types/graph';

export const GraphEditor: React.FC = () => {
  const {
    nodes,
    edges,
    selectedNode,
    addNode,
    updateNode,
    removeNode,
    addEdge: addGraphEdge
  } = useGraphStore();

  const onConnect = useCallback((connection: Connection) => {
    addGraphEdge(connection);
  }, [addGraphEdge]);

  const onNodeDragStop = useCallback((event, node) => {
    updateNode(node.id, { position: node.position });
  }, [updateNode]);

  return (
    <div style={{ height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onConnect={onConnect}
        nodeTypes={NodeTypes}
        onNodeDragStop={onNodeDragStop}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>

      {/* Node Palette */}
      <div className="node-palette">
        <h3>Node Types</h3>
        {['TimeNode', 'ParameterNode', 'GradientNode', 'LEDOutputNode'].map(type => (
          <button key={type} onClick={() => addNode(type)}>
            + {type}
          </button>
        ))}
      </div>

      {/* Properties Panel */}
      {selectedNode && (
        <div className="properties-panel">
          <h3>Properties</h3>
          <NodeProperties node={selectedNode} onUpdate={updateNode} />
        </div>
      )}
    </div>
  );
};
```

### Custom Node Types

```typescript
// webapp/src/components/nodes/TimeNode.tsx
import { Handle, Position } from 'reactflow';

export const TimeNode: React.FC<{ data: any }> = ({ data }) => {
  return (
    <div className="px-4 py-2 shadow-lg rounded-md bg-white border border-gray-300">
      <div className="text-xs font-bold">⏱ Time Node</div>
      <Handle type="output" position={Position.Right} />
    </div>
  );
};
```

### Graph Serialization (Save/Load)

```typescript
// webapp/src/api/graphApi.ts
export const saveGraph = async (graphJson: object): Promise<string> => {
  const response = await fetch('/api/graphs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(graphJson)
  });
  const { id } = await response.json();
  return id;
};

export const loadGraph = async (graphId: string): Promise<object> => {
  const response = await fetch(`/api/graphs/${graphId}`);
  return response.json();
};

export const compileGraph = async (graphJson: object): Promise<{ binary: Uint8Array }> => {
  const response = await fetch('/api/graphs/compile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(graphJson)
  });
  return response.json();
};
```

### Real-time Validation

```typescript
// In GraphEditor, validate on node/edge change
const validateGraph = () => {
  const errors = [];

  // Check all inputs are connected
  nodes.forEach(node => {
    if (node.type.endsWith('Node') && !node.type.startsWith('Input')) {
      // Should have at least one input edge
    }
  });

  // Check for cycles (acyclic constraint)
  // Check type compatibility

  return errors;
};
```

### Testing Strategy (Path A)

```bash
# Vitest component tests
npm run test:component -- GraphEditor

# E2E tests with Playwright
npm run test:e2e
  - Create 20-node graph
  - Save graph
  - Load graph
  - Compile graph
  - Deploy to device
```

---

## PATH B: Parameter Editor Implementation

**Conditional:** Only implemented if Graph PoC fails

### Parameter Editor Architecture

**Approach:** Simple UI with sliders/knobs for 200+ parameters

### Component: ParameterEditor.tsx

```typescript
// webapp/src/components/ParameterEditor.tsx
import React from 'react';
import { useParameterStore } from '../stores/parameterStore';

export const ParameterEditor: React.FC = () => {
  const { parameters, updateParameter, savePreset, loadPreset } = useParameterStore();

  return (
    <div className="space-y-4">
      <h2>Pattern Parameters</h2>

      {/* Parameter Grid */}
      <div className="grid grid-cols-3 gap-4">
        {parameters.map(param => (
          <div key={param.id} className="space-y-2">
            <label className="block text-sm font-medium">{param.name}</label>
            <input
              type="range"
              min={param.min}
              max={param.max}
              value={param.value}
              step={param.step}
              onChange={(e) => updateParameter(param.id, parseFloat(e.target.value))}
              className="w-full"
            />
            <span className="text-xs text-gray-500">{param.value.toFixed(2)}</span>
          </div>
        ))}
      </div>

      {/* Presets */}
      <div className="space-y-2">
        <button onClick={() => savePreset('default')}>Save Preset</button>
        <select onChange={(e) => loadPreset(e.target.value)}>
          <option value="">Load Preset...</option>
          <option value="default">Default</option>
          <option value="vibrant">Vibrant</option>
          <option value="calm">Calm</option>
        </select>
      </div>

      {/* Send to Device */}
      <button
        className="bg-blue-500 text-white px-4 py-2 rounded"
        onClick={() => sendParametersToDevice(parameters)}
      >
        Apply to Device
      </button>
    </div>
  );
};
```

### Real-time Parameter Update

```typescript
// webapp/src/api/deviceApi.ts
export const sendParametersToDevice = async (parameters: Parameter[]) => {
  await fetch('http://device.local/api/parameters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parameters })
  });
};

// WebSocket for real-time feedback
export const onDeviceParameterApplied = (callback: () => void) => {
  const ws = new WebSocket('ws://device.local/ws');
  ws.onmessage = (event) => {
    const { type } = JSON.parse(event.data);
    if (type === 'parameter_applied') callback();
  };
};
```

### Testing Strategy (Path B)

```bash
# Parameter editor tests
npm run test:component -- ParameterEditor

# Integration tests
npm run test:integration
  - Send 100 parameter combinations to device
  - Verify real-time application < 500ms
  - Test preset save/load
```

---

## Common Integration Patterns

### Device Connection Management

```typescript
// webapp/src/hooks/useDevice.ts
export const useDevice = () => {
  const [connected, setConnected] = React.useState(false);
  const [deviceInfo, setDeviceInfo] = React.useState(null);

  React.useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch('http://device.local/api/status', { timeout: 2000 });
        const info = await response.json();
        setDeviceInfo(info);
        setConnected(true);
      } catch {
        setConnected(false);
      }
    };

    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  return { connected, deviceInfo };
};
```

### Real-time Telemetry

```typescript
// WebSocket listener for FPS, temperature, errors
const ws = new WebSocket('ws://device.local/ws/telemetry');
ws.onmessage = (event) => {
  const { fps, temp, errors } = JSON.parse(event.data);
  // Update UI with live metrics
};
```

---

## Frontend Testing Strategy

**Test Pyramid for Webapp:**

```
                    /\
                   /  \
                  / E2E \        5-10 tests (full app flow)
                 /________\
                /          \
               /  Integr.   \      20-30 tests (API mocking)
              /____________\
             /              \
            / Unit / Snapshot \ 100+ tests (components)
           /____________________\
```

### Unit Tests (Vitest)

```typescript
// webapp/test/GraphEditor.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GraphEditor } from '../src/components/GraphEditor';

describe('GraphEditor', () => {
  it('renders node palette', () => {
    render(<GraphEditor />);
    expect(screen.getByText('TimeNode')).toBeInTheDocument();
  });

  it('adds node on palette button click', async () => {
    const { getByText } = render(<GraphEditor />);
    getByText('+ TimeNode').click();
    // Verify node added to graph
  });
});
```

### Integration Tests (MSW)

```typescript
// webapp/test/GraphIntegration.test.tsx
import { setupServer } from 'msw/node';
import { http } from 'msw';

const server = setupServer(
  http.post('/api/graphs/compile', () => {
    return Response.json({ binary: new Uint8Array([...]) });
  })
);

describe('Graph Compilation', () => {
  it('compiles graph to binary', async () => {
    const result = await compileGraph({ nodes: [...] });
    expect(result.binary).toBeDefined();
  });
});
```

### E2E Tests (Playwright)

```typescript
// webapp/test/graph-workflow.spec.ts
import { test, expect } from '@playwright/test';

test('create and deploy graph', async ({ page }) => {
  // Navigate to webapp
  await page.goto('http://localhost:5173');

  // Create graph
  await page.click('button:has-text("+ TimeNode")');
  await page.click('button:has-text("+ GradientNode")');

  // Save graph
  await page.click('button:has-text("Save")');
  const graphId = await page.locator('[data-testid="graph-id"]').textContent();

  // Compile and deploy
  await page.click('button:has-text("Deploy to Device")');
  await expect(page.locator('.success-message')).toBeVisible();
});
```

---

## Real-time Communication (<100ms Latency)

### WebSocket Configuration

```javascript
// webapp/src/api/deviceApi.ts
const ws = new WebSocket('ws://device.local/ws');

// Low-latency parameter updates
ws.send(JSON.stringify({
  type: 'parameter_update',
  param_id: 42,
  value: 0.75
}));

// Listen for ACK (< 100ms expected)
ws.onmessage = (event) => {
  const { type, param_id, value } = JSON.parse(event.data);
  if (type === 'parameter_applied') {
    console.log(`Parameter ${param_id} applied: ${value}`);
  }
};
```

### Latency Monitoring

```typescript
const sendAndMeasure = async (parameter: Parameter) => {
  const start = performance.now();
  await sendParametersToDevice([parameter]);
  const latency = performance.now() - start;

  console.log(`Parameter applied in ${latency.toFixed(1)}ms`);
  if (latency > 100) {
    console.warn('⚠️  Latency exceeded budget!');
  }
};
```

---

## API Endpoints Required

**Path A (Graph System):**
- `POST /api/graphs` — Save graph JSON
- `GET /api/graphs/{id}` — Load graph JSON
- `POST /api/graphs/compile` — Compile graph to C++
- `POST /api/graphs/deploy` — Deploy compiled binary
- `GET /api/graphs/library` — List available graphs

**Path B (Parameter Editor):**
- `POST /api/parameters` — Send parameters to device
- `GET /api/parameters/schema` — Get all parameter definitions
- `POST /api/presets` — Save parameter preset
- `GET /api/presets` — List presets

**Shared:**
- `GET /api/status` — Device status (FPS, temp, uptime)
- `GET /api/errors` — Error history
- `WS /ws/telemetry` — Real-time metrics (FPS, temp, errors)

---

## Success Criteria

**Path A (Graph Editor):**
- ✅ Canvas renders 50+ nodes at 60 FPS
- ✅ Graph serialization preserves all data
- ✅ Compilation < 2 seconds per graph
- ✅ Deployment to device < 5 seconds
- ✅ Latency to device < 100ms
- ✅ WCAG 2.1 AA compliant
- ✅ 95%+ test coverage

**Path B (Parameter Editor):**
- ✅ All 200+ parameters have controls
- ✅ Real-time updates < 500ms
- ✅ Preset save/load working
- ✅ Parameter history accessible
- ✅ WCAG 2.1 AA compliant
- ✅ 95%+ test coverage

---

**Appendix Status:** READY FOR CONDITIONAL EXECUTION
**Activation:** Awaiting Nov 13 decision gate (Path A or B)
**First Task:** Task 17 (Path A) or Task 20 (Path B)
**Last Sync:** 2025-11-05
