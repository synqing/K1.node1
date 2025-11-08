# K1.node1 Orkes Service

**Status:** Ready for Development
**Version:** 0.1.0
**Node Version Required:** 20.x (NOT 24.x - see compatibility note below)

Orkes Conductor workflow orchestration service for K1.node1 LED pattern system.

## Overview

This service provides a REST API for triggering and managing Orkes Cloud workflows for:

1. **Pattern Compilation Pipeline** - Design → C++ Generation → Compilation → Testing → Benchmarking
2. **Asset Processing** - Audio file conversion, preset generation, optimization
3. **CI/CD Orchestration** - Build, test, deploy workflows for firmware and webapp
4. **Analytics Pipelines** - Telemetry collection and reporting

## Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│   Webapp    │────────▶│  Orkes Service   │────────▶│ Orkes Cloud │
│ (React/TS)  │  HTTP   │  (Express/Node)  │   SDK   │ (Workflows) │
└─────────────┘         └──────────────────┘         └─────────────┘
                                │
                                │ Triggers Workers
                                ▼
                        ┌──────────────────┐
                        │ Pattern Compiler │
                        │ Build System     │
                        │ Test Runners     │
                        │ Analytics Engine │
                        └──────────────────┘
```

## Quick Start

### Prerequisites

**IMPORTANT:** You MUST use Node.js 20.x, NOT Node 24.x

The Orkes SDK depends on `isolated-vm` which requires:
- Node.js 20.x (LTS)
- C++20 compiler support
- Python 3.x for node-gyp

**Why not Node 24?**
The `isolated-vm` native module hasn't been updated for Node 24's V8 API changes yet. This is why we created a separate service instead of integrating directly into the webapp (which uses Node 24).

### Installation

1. **Switch to Node 20** (using nvm, volta, or your preferred version manager):
   ```bash
   nvm use 20  # or nvm install 20
   node --version  # Should show v20.x.x
   ```

2. **Install dependencies:**
   ```bash
   cd orkes-service
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Orkes credentials
   ```

4. **Get Orkes credentials:**
   - Sign up at https://cloud.orkes.io
   - Navigate to Applications → Create Application
   - Copy `Key ID` and `Key Secret`
   - Paste into `.env.local`

### Running the Service

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

The service will start on `http://localhost:4002` by default.

### Deploy First Workflow (Pattern Compilation)

1. Register the workflow with Orkes (requires valid Orkes credentials in `.env.local`):
   ```bash
   npm run register:pattern
   ```

2. Start the worker-backed service (already polls for `validate_pattern`, `generate_cpp`, `compile_firmware`, `run_tests`, `run_benchmarks`):
   ```bash
   npm run dev
   ```

3. Trigger a test execution:
   ```bash
   curl -X POST http://localhost:4002/api/workflows/execute \
     -H 'Content-Type: application/json' \
     -d '{
       "workflowName": "k1_pattern_compilation",
       "input": {
         "patternName": "rainbow_pulse",
         "patternCode": "pattern rainbow_pulse { color: red; timing: pulse(0.5s); }",
         "optimizationLevel": "O2"
       }
     }'
   ```

4. Monitor status:
   ```bash
   curl http://localhost:4002/api/workflows/<WORKFLOW_ID_FROM_PREVIOUS_STEP>
   ```

Notes:
- Use Node 20.x; Orkes SDK depends on `isolated-vm` which is not yet compatible with Node 24.x.
- Ensure your Orkes account/app has permission to create workflow metadata.

### Verify Installation

```bash
# Health check
curl http://localhost:4002/health

# Orkes connection status
curl http://localhost:4002/api/status
```

Expected response:
```json
{
  "connected": true,
  "serverUrl": "https://developer.orkescloud.com/api",
  "authenticated": true
}
```

## API Reference

### Health & Status

#### GET /health
Check service health.

**Response:**
```json
{
  "status": "healthy",
  "service": "k1-orkes-service",
  "version": "0.1.0",
  "timestamp": "2025-11-08T05:50:00.000Z"
}
```

#### GET /api/status
Check Orkes connection status.

**Response:**
```json
{
  "connected": true,
  "serverUrl": "https://developer.orkescloud.com/api",
  "authenticated": true
}
```

### Workflow Management

#### POST /api/workflows/execute
Execute a workflow.

**Request:**
```json
{
  "workflowName": "k1_pattern_compilation",
  "input": {
    "patternName": "rainbow_pulse",
    "patternCode": "...",
    "optimizationLevel": "O2"
  },
  "correlationId": "pattern-123",
  "priority": 5,
  "tags": {
    "environment": "dev",
    "user": "developer"
  }
}
```

**Response (202 Accepted):**
```json
{
  "workflowId": "abc123-def456-ghi789",
  "status": "RUNNING"
}
```

#### GET /api/workflows/:workflowId
Get workflow execution status.

**Response:**
```json
{
  "workflowId": "abc123-def456-ghi789",
  "status": "COMPLETED",
  "input": { "patternName": "rainbow_pulse", ... },
  "output": {
    "success": true,
    "binaryPath": "/builds/rainbow_pulse.bin",
    "benchmarks": { "fps": 60, "memoryUsageMb": 45 }
  },
  "startTime": "2025-11-08T05:50:00.000Z",
  "endTime": "2025-11-08T05:52:30.000Z",
  "tasks": [...]
}
```

#### DELETE /api/workflows/:workflowId
Terminate a running workflow.

**Request:**
```json
{
  "reason": "User cancelled"
}
```

#### POST /api/workflows/:workflowId/pause
Pause a running workflow.

#### POST /api/workflows/:workflowId/resume
Resume a paused workflow.

#### POST /api/workflows/:workflowId/retry
Retry a failed workflow from the last failed task.

**Request:**
```json
{
  "resumeSubworkflowTasks": false
}
```

## Workflows

### 1. Pattern Compilation Workflow (`k1_pattern_compilation`)

**Purpose:** Compile LED pattern code, test it, benchmark performance, and iterate.

**Input:**
```typescript
{
  patternName: string;
  patternCode: string;
  targetDevice?: string;
  optimizationLevel?: 'O0' | 'O1' | 'O2' | 'O3';
}
```

**Steps:**
1. Validate pattern code syntax
2. Generate C++ code from pattern graph
3. Compile firmware with PlatformIO
4. Run unit tests
5. Deploy to test device
6. Run benchmarks (FPS, memory, latency)
7. Decision: Pass → Complete | Fail → Suggest optimizations

**Output:**
```typescript
{
  success: boolean;
  binaryPath?: string;
  testResults: { ... };
  benchmarks: {
    fps: number;
    memoryUsageMb: number;
    latencyMs: number;
  };
  errors?: string[];
}
```

### 2. CI/CD Pipeline Workflow (`k1_cicd_pipeline`)

**Purpose:** Build, test, and deploy firmware and webapp.

**Input:**
```typescript
{
  repository: string;
  branch: string;
  commit: string;
  target: 'firmware' | 'webapp' | 'both';
  environment: 'dev' | 'staging' | 'production';
  rolloutStrategy?: 'immediate' | 'canary' | 'blue-green';
  deviceIds?: string[];
}
```

**Steps:**
1. Clone repository
2. Parallel build (firmware + webapp)
3. Run test suites
4. Security scan
5. Deploy to target environment
6. Health check
7. Rollback on failure

**Output:**
```typescript
{
  success: boolean;
  firmwareBinary?: string;
  webappBundle?: string;
  deployedDevices: string[];
  healthCheckPassed: boolean;
  rolledBack?: boolean;
}
```

### 3. Asset Processing Workflow (Coming Soon)

Audio file conversion, preset generation, optimization pipelines.

### 4. Analytics Pipeline Workflow (Coming Soon)

Telemetry collection from devices and reporting.

## Project Structure

```
orkes-service/
├── src/
│   ├── config/
│   │   └── orkes.ts              # Orkes client configuration
│   ├── routes/
│   │   └── workflows.ts          # REST API routes
│   ├── workflows/
│   │   ├── pattern-compilation.ts # Pattern workflow definition
│   │   ├── cicd.ts               # CI/CD workflow definition
│   │   ├── asset-processing.ts   # (TODO)
│   │   └── analytics.ts          # (TODO)
│   ├── workers/
│   │   ├── pattern-compiler.ts   # Pattern compilation task workers
│   │   ├── __tests__/
│   │   │   └── pattern-compiler.test.ts # 20 passing tests
│   │   └── index.ts              # Worker exports
│   ├── types/
│   │   └── workflows.ts          # TypeScript type definitions
│   └── index.ts                  # Express server entry point
├── docs/
│   ├── tab5/K1NAnalysis_INDEX_TAB5_v1.0_20251108.md                  # Documentation index
│   ├── guides/
│   │   ├── INTEGRATION_GUIDE.md  # Integration instructions
│   │   ├── DEEP_DIVE.md          # Architecture & design patterns
│   │   └── PATTERN_COMPILATION.md # Pattern compilation workflow
│   ├── architecture/             # System design documents
│   └── api-reference/            # API specifications
├── .env.example                  # Environment template
├── .env.local                    # Local config (gitignored)
├── package.json
├── tsconfig.json
├── vitest.config.ts              # Test configuration
└── README.md
```

## Development

### Adding a New Workflow

1. **Define the workflow in `src/workflows/`:**
   ```typescript
   export const myWorkflow: WorkflowDef = {
     name: 'k1_my_workflow',
     description: 'My workflow description',
     version: 1,
     tasks: [
       {
         name: 'my_task',
         taskReferenceName: 'my_task_ref',
         type: 'SIMPLE',
         inputParameters: {
           input: '${workflow.input.myInput}',
         },
       },
     ],
     outputParameters: {
       result: '${my_task_ref.output.result}',
     },
   };
   ```

2. **Define TypeScript types in `src/types/workflows.ts`:**
   ```typescript
   export interface MyWorkflowInput {
     myInput: string;
   }

   export interface MyWorkflowOutput {
     result: string;
   }
   ```

3. **Register the workflow:**
   ```typescript
   export async function registerMyWorkflow(client: ConductorClient) {
     await client.metadataResource.create(myWorkflow, true);
   }
   ```

4. **Add route or use existing `/api/workflows/execute`**

### Implementing Task Workers

Workers execute the actual work for workflow tasks. They can be implemented in any language.

**Example worker (Node.js):**
```typescript
import { TaskManager } from '@io-orkes/conductor-javascript';

const taskManager = new TaskManager(client);

taskManager.startPolling('validate_pattern', async (task) => {
  const { patternName, patternCode } = task.inputData;

  // Validate pattern code
  const isValid = validatePattern(patternCode);

  return {
    status: isValid ? 'COMPLETED' : 'FAILED',
    outputData: {
      validatedCode: patternCode,
      errors: isValid ? [] : ['Invalid syntax'],
    },
  };
});
```

Place workers in `src/workers/` directory.

## Integration with Webapp

The webapp can trigger workflows via HTTP requests:

```typescript
// webapp/src/lib/orkesClient.ts
const ORKES_SERVICE_URL = import.meta.env.VITE_ORKES_SERVICE_URL || 'http://localhost:4002';

export async function compilePattern(input: PatternCompilationInput) {
  const response = await fetch(`${ORKES_SERVICE_URL}/api/workflows/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflowName: 'k1_pattern_compilation',
      input,
    }),
  });

  return await response.json();
}

export async function getWorkflowStatus(workflowId: string) {
  const response = await fetch(`${ORKES_SERVICE_URL}/api/workflows/${workflowId}`);
  return await response.json();
}
```

Add to webapp `.env.example`:
```bash
VITE_ORKES_SERVICE_URL=http://localhost:4002
```

## Troubleshooting

### "C++20 or later required" error during npm install

**Cause:** You're using Node.js 24, which requires C++20 for native modules, but `isolated-vm` hasn't been updated yet.

**Solution:** Switch to Node.js 20:
```bash
nvm install 20
nvm use 20
cd orkes-service
rm -rf node_modules package-lock.json
npm install
```

### "Failed to initialize client" error

**Cause:** Invalid Orkes credentials or network issues.

**Solutions:**
- Verify credentials in `.env.local`
- Check that `ORKES_SERVER_URL` is correct
- Test connection: `curl https://developer.orkescloud.com/api/health`
- For public playground, remove `ORKES_KEY_ID` and `ORKES_KEY_SECRET`

### CORS errors from webapp

**Cause:** Webapp origin not in `ALLOWED_ORIGINS`.

**Solution:** Add webapp URL to `.env.local`:
```bash
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

## Security Considerations

- **Never commit `.env.local`** - Contains secrets
- **Use environment-specific credentials** - Different keys for dev/staging/prod
- **Restrict CORS origins** - Only allow trusted webapp URLs
- **Use HTTPS in production** - Reverse proxy with nginx/Caddy
- **Rotate credentials regularly** - Generate new keys monthly
- **Monitor workflow execution** - Set up alerts for failed workflows

## Production Deployment

### Docker Deployment (Recommended)

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

ENV NODE_ENV=production
ENV PORT=4002

EXPOSE 4002

CMD ["node", "dist/index.js"]
```

Build and run:
```bash
npm run build
docker build -t k1-orkes-service .
docker run -p 4002:4002 \
  -e ORKES_SERVER_URL=https://your-orkes-instance.com/api \
  -e ORKES_KEY_ID=your_key \
  -e ORKES_KEY_SECRET=your_secret \
  k1-orkes-service
```

### Process Manager (PM2)

```bash
npm install -g pm2
npm run build
pm2 start dist/index.js --name k1-orkes-service
pm2 save
pm2 startup  # Enable auto-start on boot
```

## Documentation

See `docs/K1NOrkes_INDEX_v1.0_20251108.md` for the complete documentation index.

Key guides:
- `docs/guides/K1NOrkes_GUIDE_INTEGRATION_v1.0_20251108.md` - Full integration instructions
- `docs/guides/K1NOrkes_GUIDE_DEEP_DIVE_v1.0_20251108.md` - Architecture and design patterns
- `docs/guides/K1NOrkes_GUIDE_PATTERN_COMPILATION_v1.0_20251108.md` - Workflow implementation details

## Resources

- **Orkes Documentation:** https://orkes.io/content/
- **JavaScript SDK:** https://orkes.io/content/sdks/javascript
- **Workflow Examples:** https://github.com/conductor-sdk/conductor-javascript
- **Conductor OSS:** https://github.com/conductor-oss/conductor

## Next Steps

1. ✅ Set up Orkes service with SDK
2. ✅ Create pattern compilation workflow
3. ✅ Create CI/CD workflow
4. ✅ Implement pattern compilation task workers (5 workers, 20 tests passing)
5. ⬜ Implement CI/CD task workers (build, test, deploy, etc.)
6. ⬜ Create asset processing workflow
7. ⬜ Create analytics workflow
8. ⬜ Integrate with webapp UI
9. ⬜ Add monitoring and alerting
10. ⬜ Production deployment

## Support

For issues or questions:
- Check this README
- Review Orkes documentation
- Check workflow logs in Orkes Cloud UI
- Inspect service logs: `npm run dev` (shows detailed output)
