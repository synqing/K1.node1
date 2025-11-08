# Orkes Cloud Integration - Setup Summary

**Date:** 2025-11-08
**Status:** ✅ Initial Setup Complete
**Next Steps:** Implement task workers and integrate with webapp UI

## What Was Built

### 1. Orkes Service (Separate Node 20.x Service)

**Location:** `orkes-service/`

A dedicated Express.js service that provides REST API for Orkes Conductor workflows.

**Why separate?** The Orkes SDK requires Node.js 20.x (due to `isolated-vm` dependency), but the webapp uses Node.js 24.x. This microservice architecture allows both to coexist.

**Key Components:**
- ✅ Orkes client configuration (`src/config/orkes.ts`)
- ✅ REST API routes (`src/routes/workflows.ts`)
- ✅ TypeScript type definitions (`src/types/workflows.ts`)
- ✅ Environment configuration (`.env.example`, `.env.local`)
- ✅ Express server setup (`src/index.ts`)

### 2. Workflow Definitions

**Pattern Compilation Workflow** (`k1_pattern_compilation`)
- Design → C++ Generation → Compilation → Testing → Benchmarking → Iteration
- File: `orkes-service/src/workflows/pattern-compilation.ts`

**CI/CD Pipeline Workflow** (`k1_cicd_pipeline`)
- Clone → Parallel Build (firmware + webapp) → Test → Security Scan → Deploy → Health Check → Rollback
- File: `orkes-service/src/workflows/cicd.ts`

**Asset Processing Workflow** (Planned)
- Audio conversion, preset generation, optimization

**Analytics Pipeline Workflow** (Planned)
- Telemetry collection and reporting

### 3. Documentation

- ✅ Service README: `orkes-service/README.md`
- ✅ Integration Guide: `docs/03-guides/K1N_GUIDE_ORKES_INTEGRATION_v1.0_20251108.md`
- ✅ API documentation with examples
- ✅ Troubleshooting guide

## Quick Start

### Prerequisites

```bash
# Install Node.js 20.x (REQUIRED - NOT Node 24!)
nvm install 20
nvm use 20
```

### Setup

```bash
# 1. Navigate to service
cd orkes-service

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your Orkes credentials

# 4. Run service
npm run dev
```

### Get Orkes Credentials

1. Sign up: https://cloud.orkes.io
2. Create Application: Security → Applications → Create
3. Copy Key ID and Key Secret
4. Paste into `.env.local`

### Verify

```bash
curl http://localhost:4002/health
curl http://localhost:4002/api/status
```

Expected:
```json
{
  "connected": true,
  "serverUrl": "https://developer.orkescloud.com/api",
  "authenticated": true
}
```

## API Endpoints

### Workflow Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/workflows/execute` | Execute a workflow |
| GET | `/api/workflows/:id` | Get workflow status |
| DELETE | `/api/workflows/:id` | Terminate workflow |
| POST | `/api/workflows/:id/pause` | Pause workflow |
| POST | `/api/workflows/:id/resume` | Resume workflow |
| POST | `/api/workflows/:id/retry` | Retry failed workflow |

### Health & Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |
| GET | `/api/status` | Orkes connection status |

## Integration Points

### From Webapp (TypeScript)

```typescript
// Trigger pattern compilation
const result = await fetch('http://localhost:4002/api/workflows/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    workflowName: 'k1_pattern_compilation',
    input: {
      patternName: 'rainbow_pulse',
      patternCode: generatedCode,
      optimizationLevel: 'O2',
    },
  }),
});

const { workflowId, status } = await result.json();
```

### From Firmware (HTTP)

```cpp
HTTPClient http;
http.begin("http://orkes-service:4002/api/workflows/execute");
http.addHeader("Content-Type", "application/json");
String payload = "{\"workflowName\":\"k1_telemetry_upload\",\"input\":{...}}";
http.POST(payload);
```

## File Structure

```
K1.node1/
├── orkes-service/              # NEW - Orkes orchestration service
│   ├── src/
│   │   ├── config/
│   │   │   └── orkes.ts       # Orkes client setup
│   │   ├── routes/
│   │   │   └── workflows.ts   # REST API routes
│   │   ├── workflows/
│   │   │   ├── pattern-compilation.ts
│   │   │   └── cicd.ts
│   │   ├── workers/           # (TODO) Task worker implementations
│   │   ├── types/
│   │   │   └── workflows.ts   # TypeScript types
│   │   └── index.ts           # Express server
│   ├── .env.example
│   ├── .env.local             # Gitignored - contains secrets
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
│
├── docs/
│   └── 03-guides/
│       └── K1N_GUIDE_ORKES_INTEGRATION_v1.0_20251108.md  # NEW - Integration guide
│
├── webapp/
│   └── .env.example           # UPDATED - Added VITE_ORKES_SERVICE_URL
│
└── .gitignore                  # UPDATED - Track orkes-service/
```

## Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│   Webapp    │────────▶│  Orkes Service   │────────▶│ Orkes Cloud │
│ (React/TS)  │  HTTP   │  (Express/Node)  │   SDK   │ (Workflows) │
│  Node 24    │         │    Node 20       │         └─────────────┘
└─────────────┘         └──────────────────┘               │
                                │                          │
                                │                    ┌─────▼─────┐
                                │                    │  Workers  │
                                │                    ├───────────┤
                                │                    │ Compiler  │
                                │                    │ Builder   │
                                │                    │ Tester    │
                                ▼                    └───────────┘
                        ┌──────────────┐
                        │  ESP32-S3    │
                        │  Firmware    │
                        └──────────────┘
```

## Workflows Overview

### 1. Pattern Compilation (`k1_pattern_compilation`)

**Purpose:** Compile LED patterns with testing and benchmarking

**Steps:**
1. Validate pattern code
2. Generate C++ code
3. Compile firmware (PlatformIO)
4. Run tests
5. Deploy to device
6. Benchmark (FPS, memory, latency)
7. Pass/Fail decision with optimization suggestions

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
  "testResults": {...},
  "benchmarks": {
    "fps": 60,
    "memoryUsageMb": 45,
    "latencyMs": 12
  }
}
```

### 2. CI/CD Pipeline (`k1_cicd_pipeline`)

**Purpose:** Build, test, deploy firmware and webapp

**Steps:**
1. Clone repository
2. **Parallel:** Build firmware + Build webapp
3. **Parallel:** Test firmware + Test webapp
4. Security scan
5. Quality gates check
6. Deploy (immediate/canary/blue-green)
7. Health check
8. Rollback on failure

**Input:**
```json
{
  "repository": "https://github.com/user/K1.node1",
  "branch": "main",
  "commit": "abc123",
  "target": "both",
  "environment": "staging",
  "rolloutStrategy": "canary"
}
```

## Next Steps (Roadmap)

### Immediate (Week 1-2)

- [ ] Implement task workers for pattern compilation
  - [ ] `validate_pattern` worker
  - [ ] `generate_cpp` worker
  - [ ] `compile_firmware` worker (PlatformIO integration)
  - [ ] `run_tests` worker
  - [ ] `run_benchmarks` worker

- [ ] Webapp integration
  - [ ] Create `webapp/src/lib/orkesClient.ts`
  - [ ] Add workflow trigger buttons to UI
  - [ ] Real-time workflow status display
  - [ ] Workflow history viewer

### Short-term (Week 3-4)

- [ ] Complete CI/CD workers
  - [ ] `clone_repository` worker
  - [ ] `build_firmware` worker
  - [ ] `build_webapp` worker
  - [ ] `deploy` worker
  - [ ] `health_check` worker

- [ ] Asset processing workflow
  - [ ] Audio conversion tasks
  - [ ] Preset generation tasks
  - [ ] Optimization tasks

### Medium-term (Month 2)

- [ ] Analytics pipeline
  - [ ] Telemetry collection workers
  - [ ] Report generation workers
  - [ ] Anomaly detection

- [ ] Production deployment
  - [ ] Docker containerization
  - [ ] Kubernetes manifests
  - [ ] Monitoring/alerting setup

### Long-term (Month 3+)

- [ ] Advanced features
  - [ ] A/B testing workflows
  - [ ] Auto-scaling based on load
  - [ ] Multi-region deployment
  - [ ] Advanced analytics dashboards

## Troubleshooting

### "C++20 or later required" during npm install

**Cause:** Using Node.js 24 instead of 20

**Fix:**
```bash
nvm use 20
cd orkes-service
rm -rf node_modules package-lock.json
npm install
```

### "Failed to initialize client"

**Cause:** Invalid Orkes credentials

**Fix:**
1. Verify credentials in `.env.local`
2. Test connection: `curl https://developer.orkescloud.com/api/health`
3. For playground, remove KEY_ID and KEY_SECRET

### CORS errors from webapp

**Cause:** Webapp origin not allowed

**Fix:** Add to `.env.local`:
```bash
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

## Resources

- **Service README:** [orkes-service/README.md](orkes-service/README.md)
- **Integration Guide:** [docs/03-guides/K1N_GUIDE_ORKES_INTEGRATION_v1.0_20251108.md](docs/03-guides/K1N_GUIDE_ORKES_INTEGRATION_v1.0_20251108.md)
- **Orkes Docs:** https://orkes.io/content/
- **JavaScript SDK:** https://orkes.io/content/sdks/javascript

## Summary

✅ **Complete:**
- Orkes service infrastructure
- REST API for workflow management
- Pattern compilation workflow definition
- CI/CD pipeline workflow definition
- Comprehensive documentation

⬜ **TODO:**
- Implement task workers
- Integrate with webapp UI
- Production deployment

The foundation is laid. Next step: implement workers to make workflows functional.
