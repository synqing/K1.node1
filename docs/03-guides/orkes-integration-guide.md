# Orkes Cloud Integration Guide

**Status:** Initial Setup Complete
**Date:** 2025-11-08
**Owner:** System Architect
**Related:** Pattern Compilation, CI/CD, Analytics

## Purpose

Guide for integrating Orkes Conductor workflow orchestration into K1.node1 for:
- Pattern compilation pipelines
- Asset processing workflows
- CI/CD orchestration
- Analytics and telemetry processing

## Architecture Overview

### System Components

```
┌──────────────────────────────────────────────────────────────┐
│                        K1.node1 System                        │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐         ┌──────────────────┐               │
│  │   Webapp    │────────▶│  Orkes Service   │               │
│  │ (React/TS)  │  HTTP   │  (Express/Node)  │               │
│  │  Node 24    │         │    Node 20       │               │
│  └─────────────┘         └──────────────────┘               │
│        │                          │                          │
│        │                          │ SDK                      │
│        │                          ▼                          │
│        │                 ┌─────────────────┐                │
│        │                 │  Orkes Cloud    │                │
│        │                 │  (Workflows)    │                │
│        │                 └─────────────────┘                │
│        │                          │                          │
│        │                          │ Triggers                 │
│        │                          ▼                          │
│        │                 ┌─────────────────┐                │
│        │                 │     Workers     │                │
│        │                 ├─────────────────┤                │
│        │                 │ Pattern Compiler│                │
│        │                 │ Build System    │                │
│        │                 │ Test Runners    │                │
│        │                 │ Analytics       │                │
│        │                 └─────────────────┘                │
│        │                          │                          │
│        │                          ▼                          │
│        │                 ┌─────────────────┐                │
│        └────────────────▶│   ESP32-S3      │                │
│          WebSocket/HTTP  │   Firmware      │                │
│                          └─────────────────┘                │
└──────────────────────────────────────────────────────────────┘
```

### Why Separate Service?

**Problem:** The Orkes JavaScript SDK requires Node.js 20.x due to the `isolated-vm` dependency, but the webapp uses Node.js 24.x.

**Solution:** Created a dedicated `orkes-service` that:
- Runs on Node 20.x
- Provides REST API for the webapp
- Manages Orkes client connection
- Registers and executes workflows

## Setup Instructions

### 1. Prerequisites

- Node.js 20.x (NOT 24.x)
- Orkes Cloud account (free tier available)
- Git, Docker (optional for deployment)

### 2. Get Orkes Credentials

1. Sign up at https://cloud.orkes.io
2. Navigate to **Security** → **Applications**
3. Click **Create Application**
4. Name: `k1-node1-dev`
5. Copy the generated:
   - Application Key ID
   - Application Key Secret

### 3. Configure Environment

```bash
cd orkes-service
cp .env.example .env.local
```

Edit `.env.local`:
```bash
ORKES_SERVER_URL=https://developer.orkescloud.com/api
ORKES_KEY_ID=your_key_id_here
ORKES_KEY_SECRET=your_key_secret_here
PORT=4002
ALLOWED_ORIGINS=http://localhost:5173
```

### 4. Install and Run

```bash
# Ensure Node 20.x
nvm use 20

# Install dependencies
npm install

# Run in development mode
npm run dev
```

Verify:
```bash
curl http://localhost:4002/health
curl http://localhost:4002/api/status
```

## Workflow Definitions

### Pattern Compilation Workflow

**Name:** `k1_pattern_compilation`
**Purpose:** Orchestrate pattern design → C++ generation → compilation → testing → benchmarking

**Flow:**
```
Validate Pattern
      ↓
Generate C++ Code
      ↓
Compile Firmware
      ↓
Run Tests ──────→ FAIL → Analyze Failures
      ↓ PASS
Deploy to Device
      ↓
Run Benchmarks
      ↓
Check Performance
      ├─→ PASS → Complete
      └─→ FAIL → Suggest Optimizations
```

**Input:**
```json
{
  "patternName": "rainbow_pulse",
  "patternCode": "...",
  "targetDevice": "esp32-s3",
  "optimizationLevel": "O2"
}
```

**Output:**
```json
{
  "success": true,
  "binaryPath": "/builds/rainbow_pulse.bin",
  "testResults": { "passed": 15, "failed": 0 },
  "benchmarks": {
    "fps": 60,
    "memoryUsageMb": 45,
    "latencyMs": 12
  }
}
```

### CI/CD Pipeline Workflow

**Name:** `k1_cicd_pipeline`
**Purpose:** Build, test, and deploy firmware and webapp

**Flow:**
```
Clone Repository
      ↓
   ┌──┴──┐
   ↓     ↓
Build   Build
Firmware Webapp
   ↓     ↓
Test    Test
Firmware Webapp
   └──┬──┘
      ↓
Security Scan
      ↓
Quality Gates ──────→ FAIL → Notify
      ↓ PASS
     Deploy
      ↓
Health Check ───────→ FAIL → Rollback
      ↓ PASS
   Complete
```

**Input:**
```json
{
  "repository": "https://github.com/user/K1.node1",
  "branch": "main",
  "commit": "abc123",
  "target": "both",
  "environment": "staging",
  "rolloutStrategy": "canary",
  "deviceIds": ["device-001", "device-002"]
}
```

## Triggering Workflows

### From Webapp (TypeScript)

Create `webapp/src/lib/orkesClient.ts`:

```typescript
const ORKES_SERVICE_URL = import.meta.env.VITE_ORKES_SERVICE_URL || 'http://localhost:4002';

export interface WorkflowRequest {
  workflowName: string;
  input: unknown;
  correlationId?: string;
  priority?: number;
  tags?: Record<string, string>;
}

export async function executeWorkflow(request: WorkflowRequest) {
  const response = await fetch(`${ORKES_SERVICE_URL}/api/workflows/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Workflow execution failed: ${response.statusText}`);
  }

  return await response.json();
}

export async function getWorkflowStatus(workflowId: string) {
  const response = await fetch(`${ORKES_SERVICE_URL}/api/workflows/${workflowId}`);

  if (!response.ok) {
    throw new Error(`Failed to get workflow status: ${response.statusText}`);
  }

  return await response.json();
}

export async function terminateWorkflow(workflowId: string, reason?: string) {
  const response = await fetch(`${ORKES_SERVICE_URL}/api/workflows/${workflowId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });

  return await response.json();
}
```

Usage example:
```typescript
import { executeWorkflow, getWorkflowStatus } from '@/lib/orkesClient';

// Trigger pattern compilation
const result = await executeWorkflow({
  workflowName: 'k1_pattern_compilation',
  input: {
    patternName: 'rainbow_pulse',
    patternCode: generatedCode,
    optimizationLevel: 'O2',
  },
  correlationId: `pattern-${Date.now()}`,
  tags: { environment: 'dev', user: userId },
});

console.log('Workflow ID:', result.workflowId);

// Poll for status
const status = await getWorkflowStatus(result.workflowId);
console.log('Status:', status.status);
console.log('Output:', status.output);
```

### From Firmware (HTTP)

```cpp
#include <HTTPClient.h>

void triggerWorkflow() {
  HTTPClient http;
  http.begin("http://orkes-service:4002/api/workflows/execute");
  http.addHeader("Content-Type", "application/json");

  String payload = R"({
    "workflowName": "k1_telemetry_upload",
    "input": {
      "deviceId": "esp32-001",
      "metrics": {
        "fps": 60,
        "memoryUsageMb": 45,
        "uptime": 3600
      }
    }
  })";

  int httpCode = http.POST(payload);

  if (httpCode == 202) {
    String response = http.getString();
    Serial.println("Workflow triggered: " + response);
  }

  http.end();
}
```

## Implementing Task Workers

Workers execute the actual work for workflow tasks.

### Worker Structure

```typescript
// orkes-service/src/workers/pattern-compiler.ts
import { TaskManager } from '@io-orkes/conductor-javascript';
import { getOrkesClient } from '../config/orkes.js';

export async function startPatternCompilerWorker() {
  const client = await getOrkesClient();
  const taskManager = new TaskManager(client, {
    pollingIntervals: 1000, // Poll every 1 second
    concurrency: 5,         // Process up to 5 tasks concurrently
  });

  // Validate Pattern Task
  taskManager.startPolling('validate_pattern', async (task) => {
    const { patternName, patternCode } = task.inputData;

    try {
      // Validation logic
      const isValid = validatePatternSyntax(patternCode);

      if (!isValid) {
        return {
          status: 'FAILED',
          outputData: {
            errors: ['Invalid pattern syntax'],
          },
        };
      }

      return {
        status: 'COMPLETED',
        outputData: {
          validatedCode: patternCode,
        },
      };
    } catch (error) {
      return {
        status: 'FAILED',
        outputData: {
          errors: [error.message],
        },
      };
    }
  });

  // Generate C++ Task
  taskManager.startPolling('generate_cpp', async (task) => {
    const { patternCode } = task.inputData;

    // C++ code generation logic
    const generatedCode = await generateCppFromPattern(patternCode);

    return {
      status: 'COMPLETED',
      outputData: {
        generatedCode,
      },
    };
  });

  console.log('[Worker] Pattern compiler worker started');
}
```

Start workers in `src/index.ts`:
```typescript
import { startPatternCompilerWorker } from './workers/pattern-compiler.js';

async function startup() {
  await getOrkesClient();
  await startPatternCompilerWorker();
  // ... start server
}
```

## Monitoring and Debugging

### Orkes Cloud UI

1. Navigate to https://cloud.orkes.io
2. Go to **Executions** → **Workflows**
3. View running/completed workflows
4. Inspect task details, inputs, outputs
5. View execution timeline
6. Debug failed tasks

### Service Logs

```bash
# Development mode (detailed logs)
npm run dev

# Production mode
pm2 logs k1-orkes-service
```

### API Testing

```bash
# Execute workflow
curl -X POST http://localhost:4002/api/workflows/execute \
  -H "Content-Type: application/json" \
  -d '{
    "workflowName": "k1_pattern_compilation",
    "input": {
      "patternName": "test",
      "patternCode": "...",
      "optimizationLevel": "O2"
    }
  }'

# Get status
curl http://localhost:4002/api/workflows/{workflowId}

# Terminate
curl -X DELETE http://localhost:4002/api/workflows/{workflowId} \
  -H "Content-Type: application/json" \
  -d '{"reason": "Testing"}'
```

## Best Practices

### Workflow Design

1. **Keep tasks atomic** - Each task should do one thing well
2. **Use decision tasks** - Branch on conditions instead of complex logic
3. **Set timeouts** - Prevent workflows from running indefinitely
4. **Enable restartability** - Allow workflows to be retried from failure points
5. **Add correlation IDs** - Track workflows across systems

### Error Handling

1. **Validate inputs** - Check inputs before processing
2. **Graceful degradation** - Provide fallbacks for non-critical failures
3. **Meaningful error messages** - Help debugging with clear errors
4. **Retry strategies** - Configure retry policies for transient failures

### Security

1. **Credential management** - Use environment variables, not hardcoded secrets
2. **CORS restrictions** - Only allow trusted origins
3. **Input validation** - Sanitize all workflow inputs
4. **Access control** - Use Orkes RBAC for production deployments

## Troubleshooting

### Common Issues

**Issue:** npm install fails with C++20 errors
- **Cause:** Using Node.js 24 instead of 20
- **Fix:** `nvm use 20 && npm install`

**Issue:** "Failed to initialize client"
- **Cause:** Invalid credentials or network issues
- **Fix:** Verify `.env.local` credentials, check network

**Issue:** CORS errors from webapp
- **Cause:** Webapp origin not in ALLOWED_ORIGINS
- **Fix:** Add origin to `.env.local`

**Issue:** Workflow stuck in RUNNING
- **Cause:** Worker not polling or crashed
- **Fix:** Check worker logs, restart workers

## Next Steps

1. ✅ Set up Orkes service
2. ✅ Define workflows
3. ⬜ Implement task workers
4. ⬜ Integrate with webapp UI
5. ⬜ Add monitoring dashboards
6. ⬜ Production deployment
7. ⬜ Load testing and optimization

## Resources

- [Orkes Service README](../../orkes-service/README.md)
- [Orkes Documentation](https://orkes.io/content/)
- [JavaScript SDK Docs](https://orkes.io/content/sdks/javascript)
- [Workflow Examples](https://github.com/conductor-sdk/conductor-javascript)
