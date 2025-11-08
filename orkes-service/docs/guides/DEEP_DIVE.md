# Orkes Conductor Deep Dive: Complete Guide

**Status:** Comprehensive Reference
**Date:** 2025-11-08
**Owner:** System Architect
**Related:** [Integration Guide](orkes-integration-guide.md), [Service README](../../orkes-service/README.md)

## Table of Contents

1. [Understanding Orkes Architecture](#1-understanding-orkes-architecture)
2. [Key Features and Capabilities](#2-key-features-and-capabilities)
3. [Implementation Process](#3-implementation-process)
4. [Integration Patterns](#4-integration-patterns)
5. [Monitoring and Maintenance](#5-monitoring-and-maintenance)
6. [Security Considerations](#6-security-considerations)
7. [Scaling Strategies](#7-scaling-strategies)
8. [Best Practices](#8-best-practices)

---

## 1. Understanding Orkes Architecture

### Core Components

Orkes Conductor (based on Netflix Conductor) is a distributed workflow orchestration platform with these key components:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Orkes Cloud Platform                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│  │  Workflow    │     │  Metadata    │     │   Event      │   │
│  │   Engine     │────▶│   Storage    │◀────│   System     │   │
│  └──────────────┘     └──────────────┘     └──────────────┘   │
│         │                     │                     │           │
│         │                     │                     │           │
│  ┌──────▼──────┐     ┌───────▼──────┐     ┌───────▼──────┐   │
│  │   Task      │     │   Schema     │     │   Queue      │   │
│  │   Queue     │     │  Registry    │     │   System     │   │
│  └──────────────┘     └──────────────┘     └──────────────┘   │
│         │                                                       │
└─────────┼───────────────────────────────────────────────────────┘
          │
          │ Long Polling (HTTP/gRPC)
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Your Infrastructure                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│  │   Worker 1   │     │   Worker 2   │     │   Worker N   │   │
│  │  (Compiler)  │     │  (Tester)    │     │  (Deploy)    │   │
│  └──────────────┘     └──────────────┘     └──────────────┘   │
│         │                     │                     │           │
│         └─────────────────────┴─────────────────────┘           │
│                               │                                 │
│                      ┌────────▼─────────┐                       │
│                      │  Your Services   │                       │
│                      │ (K1 Firmware,    │                       │
│                      │  Webapp, etc.)   │                       │
│                      └──────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

#### 1.1 Workflow Engine

**Purpose:** Orchestrates the execution of workflows by managing task dependencies, branching, looping, and error handling.

**How it works:**
1. Receives workflow execution requests via API
2. Parses workflow definition (JSON/Code)
3. Creates execution state machine
4. Schedules tasks in dependency order
5. Tracks execution state in real-time
6. Handles failures, retries, and timeouts

**Example workflow state machine:**
```
START → Task A → Decision → Task B (if true) → END
                     ↓
              Task C (if false) → END
```

#### 1.2 Task Queue System

**Purpose:** Decouples workflow orchestration from task execution using reliable message queues.

**How it works:**
- Each task type has a dedicated queue (e.g., `compile_firmware`, `run_tests`)
- Workers poll queues for tasks using long-polling
- Tasks are locked to prevent duplicate processing
- Failed tasks are requeued with exponential backoff
- Queue depth metrics enable auto-scaling

**Queue characteristics:**
- **At-least-once delivery:** Tasks may be delivered multiple times (workers must be idempotent)
- **FIFO within priority:** Higher priority tasks execute first
- **Visibility timeout:** Locked tasks automatically return to queue if worker crashes

#### 1.3 Metadata Storage

**Purpose:** Stores workflow definitions, task definitions, and execution history.

**Stored data:**
- **Workflow definitions:** JSON schemas defining workflow structure
- **Task definitions:** Configuration for each task type (timeouts, retry policies)
- **Execution history:** All workflow runs with inputs, outputs, and state transitions
- **Event handlers:** Triggers for external events

**Storage backend:** PostgreSQL (managed by Orkes Cloud)

#### 1.4 Event-Driven Architecture

**Purpose:** React to external events and integrate with event streams.

**Event sources:**
- HTTP webhooks (GitHub, Stripe, custom)
- Message queues (Kafka, SQS, RabbitMQ)
- Scheduled triggers (cron-like)
- Manual triggers (API calls)

**Event flow:**
```
External Event → Event Handler → Workflow Trigger → Execution
```

### Distributed Design

**How Orkes handles distribution:**

1. **Stateless Workers:** Workers can run anywhere (cloud, on-prem, edge)
2. **Location Independence:** Workers pull tasks; they don't need to be directly accessible
3. **Fault Tolerance:** If a worker crashes, tasks automatically return to queue
4. **Load Balancing:** Multiple workers share queue load automatically
5. **Cross-Region:** Workers can be in different regions/clouds

**Benefits for K1.node1:**
- Run pattern compiler workers on powerful CI servers
- Run deployment workers close to devices (edge)
- Scale workers independently based on load
- No VPN/firewall configuration needed

---

## 2. Key Features and Capabilities

### 2.1 Workflow Definition (Code vs. JSON)

**JSON Definition (Traditional):**
```json
{
  "name": "k1_pattern_compilation",
  "version": 1,
  "tasks": [
    {
      "name": "validate_pattern",
      "taskReferenceName": "validate_ref",
      "type": "SIMPLE",
      "inputParameters": {
        "code": "${workflow.input.patternCode}"
      }
    }
  ]
}
```

**Code Definition (Recommended for K1):**
```typescript
import { ConductorWorkflow, ConductorTask } from '@io-orkes/conductor-javascript';

const workflow = new ConductorWorkflow()
  .name('k1_pattern_compilation')
  .version(1)
  .add(new ConductorTask('validate_pattern')
    .inputParameters({ code: '${workflow.input.patternCode}' }));
```

**Advantages of Code:**
- Type safety with TypeScript
- IDE autocomplete
- Easier testing and versioning
- Programmatic workflow generation

### 2.2 Task Types

#### SIMPLE Task
Basic task executed by a worker.

```typescript
{
  name: 'compile_firmware',
  taskReferenceName: 'compile_ref',
  type: 'SIMPLE',
  inputParameters: {
    sourceCode: '${generate_cpp_ref.output.code}',
    optimizationLevel: 'O2'
  }
}
```

#### FORK_JOIN (Parallel Execution)
Execute multiple tasks in parallel, then join.

```typescript
{
  name: 'parallel_build',
  type: 'FORK_JOIN',
  forkTasks: [
    [{ name: 'build_firmware', type: 'SIMPLE' }],
    [{ name: 'build_webapp', type: 'SIMPLE' }]
  ]
}
// Both tasks run concurrently
```

#### SWITCH (Conditional Branching)
Branch based on conditions.

```typescript
{
  name: 'check_tests',
  type: 'SWITCH',
  evaluatorType: 'javascript',
  expression: '$.testsPassed === true ? "PASS" : "FAIL"',
  decisionCases: {
    PASS: [{ name: 'deploy', type: 'SIMPLE' }],
    FAIL: [{ name: 'notify_failure', type: 'SIMPLE' }]
  }
}
```

#### DO_WHILE (Looping)
Repeat tasks until condition is met.

```typescript
{
  name: 'optimize_pattern',
  type: 'DO_WHILE',
  loopCondition: '$.benchmarks.fps < 60',
  loopOver: [
    { name: 'compile', type: 'SIMPLE' },
    { name: 'benchmark', type: 'SIMPLE' }
  ]
}
```

#### DYNAMIC (Runtime Task Selection)
Determine which task to run at runtime.

```typescript
{
  name: 'dynamic_deploy',
  type: 'DYNAMIC',
  dynamicTaskNameParam: 'deployStrategy', // "canary" or "bluegreen"
  inputParameters: {
    deployStrategy: '${workflow.input.strategy}'
  }
}
```

#### SUB_WORKFLOW
Embed another workflow.

```typescript
{
  name: 'run_e2e_tests',
  type: 'SUB_WORKFLOW',
  subWorkflowParam: {
    name: 'k1_test_suite',
    version: 1
  }
}
```

#### HTTP Task (System Task)
Make HTTP calls without a worker.

```typescript
{
  name: 'notify_slack',
  type: 'HTTP',
  inputParameters: {
    uri: 'https://hooks.slack.com/services/XXX',
    method: 'POST',
    body: { text: 'Build completed!' }
  }
}
```

### 2.3 State Management

**Workflow State Machine:**
```
NOT_STARTED → RUNNING → COMPLETED
                  ↓
               FAILED → RETRYING → RUNNING
                  ↓
              TERMINATED
                  ↓
               PAUSED → RUNNING (on resume)
```

**Task State Transitions:**
```
SCHEDULED → IN_PROGRESS → COMPLETED
               ↓
            FAILED → SCHEDULED (retry)
               ↓
         FAILED_WITH_TERMINAL_ERROR
```

**State persistence:**
- All state stored in PostgreSQL
- Survives platform restarts
- Full audit trail maintained
- Queryable via API

### 2.4 Fault Tolerance

**Retry Policies:**
```typescript
{
  name: 'flaky_task',
  type: 'SIMPLE',
  retryCount: 3,
  retryDelaySeconds: 10,
  retryLogic: 'EXPONENTIAL_BACKOFF', // 10s, 20s, 40s
  backoffScaleFactor: 2
}
```

**Timeout Handling:**
```typescript
{
  name: 'long_compile',
  type: 'SIMPLE',
  timeoutSeconds: 600, // 10 minutes
  timeoutPolicy: 'RETRY', // or 'ALERT_ONLY', 'TIME_OUT_WF'
  responseTimeoutSeconds: 60 // Response expected within 60s
}
```

**Compensation (Rollback):**
```typescript
{
  name: 'deploy',
  type: 'SIMPLE',
  inputParameters: { version: '2.0' }
}
// On failure:
{
  name: 'rollback',
  type: 'SIMPLE',
  inputParameters: { version: '1.9' }
}
```

### 2.5 Scalability Features

**Horizontal Scaling:**
- Add more workers → automatic load balancing
- Workers can scale to 0 (serverless)
- Queue-based backpressure

**Partitioning:**
- Task queues partitioned by domain
- Workflows can target specific worker pools
- E.g., "gpu-workers" vs "cpu-workers"

**Rate Limiting:**
```typescript
{
  name: 'api_call',
  type: 'SIMPLE',
  rateLimitPerFrequency: 10, // 10 executions
  rateLimitFrequencyInSeconds: 60 // per minute
}
```

---

## 3. Implementation Process

### Step 1: Set up Orkes Environment

#### Option A: Orkes Cloud (Recommended for K1)

1. **Sign up:**
   ```bash
   # Visit https://cloud.orkes.io
   # Create account (free tier available)
   ```

2. **Create Application:**
   - Navigate to **Security** → **Applications**
   - Click **Create Application**
   - Name: `k1-node1-dev`
   - Copy **Key ID** and **Key Secret**

3. **Configure Environment:**
   ```bash
   cd orkes-service
   cp .env.example .env.local
   ```

   Edit `.env.local`:
   ```bash
   ORKES_SERVER_URL=https://developer.orkescloud.com/api
   ORKES_KEY_ID=your_key_id_here
   ORKES_KEY_SECRET=your_key_secret_here
   ```

4. **Initialize Client:**
   ```typescript
   import { orkesConductorClient } from '@io-orkes/conductor-javascript';

   const client = await orkesConductorClient({
     serverUrl: process.env.ORKES_SERVER_URL,
     keyId: process.env.ORKES_KEY_ID,
     keySecret: process.env.ORKES_KEY_SECRET,
   });
   ```

#### Option B: Self-Hosted Conductor

```bash
# Docker Compose
docker-compose -f docker-compose.yaml up -d

# Or Kubernetes
kubectl apply -f conductor-k8s.yaml
```

**Note:** Self-hosted requires managing PostgreSQL, Elasticsearch, and Redis.

### Step 2: Define Workflows

#### Using TypeScript SDK (Recommended)

```typescript
import type { WorkflowDef } from '@io-orkes/conductor-javascript';

export const patternCompilationWorkflow: WorkflowDef = {
  name: 'k1_pattern_compilation',
  description: 'Compile LED pattern with testing and benchmarking',
  version: 1,

  // Input/output schema (optional but recommended)
  inputParameters: ['patternName', 'patternCode', 'optimizationLevel'],
  outputParameters: {
    success: '${compile_ref.output.success}',
    binaryPath: '${compile_ref.output.binaryPath}',
    benchmarks: '${benchmark_ref.output}'
  },

  // Tasks in execution order
  tasks: [
    {
      name: 'validate_pattern',
      taskReferenceName: 'validate_ref',
      type: 'SIMPLE',
      inputParameters: {
        patternCode: '${workflow.input.patternCode}'
      }
    },
    {
      name: 'generate_cpp',
      taskReferenceName: 'generate_cpp_ref',
      type: 'SIMPLE',
      inputParameters: {
        validatedCode: '${validate_ref.output.code}'
      }
    },
    // ... more tasks
  ],

  // Workflow-level configuration
  schemaVersion: 2,
  restartable: true,
  timeoutPolicy: 'ALERT_ONLY',
  timeoutSeconds: 1800, // 30 minutes

  // Failure workflow (optional)
  failureWorkflow: 'k1_pattern_compilation_cleanup',

  // Owner/tags for organization
  ownerEmail: 'dev@k1.com',
  tags: ['pattern', 'compilation']
};
```

#### Register Workflow

```typescript
export async function registerWorkflow(client: ConductorClient) {
  try {
    await client.metadataResource.create(patternCompilationWorkflow, true);
    console.log('Workflow registered:', patternCompilationWorkflow.name);
  } catch (error) {
    console.error('Registration failed:', error);
    throw error;
  }
}
```

### Step 3: Configure Task Workers

#### Worker Implementation

```typescript
// orkes-service/src/workers/pattern-compiler.ts
import { TaskManager, Task } from '@io-orkes/conductor-javascript';
import { getOrkesClient } from '../config/orkes.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function startPatternCompilerWorker() {
  const client = await getOrkesClient();

  const taskManager = new TaskManager(client, {
    // Polling configuration
    pollingIntervals: 1000,        // Poll every 1 second
    concurrency: 5,                // Process up to 5 tasks concurrently
    domain: 'pattern-workers',     // Worker domain (optional)
    workerID: 'worker-01',         // Unique worker ID
  });

  // Task 1: Validate Pattern
  taskManager.startPolling('validate_pattern', async (task: Task) => {
    console.log('[Worker] Validating pattern:', task.inputData.patternName);

    try {
      const { patternCode } = task.inputData;

      // Validation logic
      const isValid = await validatePatternSyntax(patternCode);

      if (!isValid) {
        return {
          status: 'FAILED',
          outputData: {
            errors: ['Invalid pattern syntax'],
          },
          logs: ['Pattern validation failed'],
        };
      }

      return {
        status: 'COMPLETED',
        outputData: {
          validatedCode: patternCode,
          warnings: [],
        },
        logs: ['Pattern validated successfully'],
      };
    } catch (error) {
      return {
        status: 'FAILED',
        outputData: {
          errors: [error.message],
        },
        logs: [error.stack],
      };
    }
  });

  // Task 2: Generate C++ Code
  taskManager.startPolling('generate_cpp', async (task: Task) => {
    console.log('[Worker] Generating C++:', task.inputData.patternName);

    const { validatedCode } = task.inputData;

    // Code generation
    const cppCode = await generateCppFromPattern(validatedCode);

    return {
      status: 'COMPLETED',
      outputData: {
        generatedCode: cppCode,
        linesOfCode: cppCode.split('\n').length,
      },
    };
  });

  // Task 3: Compile Firmware
  taskManager.startPolling('compile_firmware', async (task: Task) => {
    console.log('[Worker] Compiling firmware:', task.workflowInstanceId);

    const { generatedCode, optimizationLevel } = task.inputData;

    // Write code to temporary file
    const tempFile = `/tmp/pattern_${task.taskId}.cpp`;
    await fs.writeFile(tempFile, generatedCode);

    try {
      // Run PlatformIO build
      const { stdout, stderr } = await execAsync(
        `pio run -e esp32-s3-devkitc-1 -DOPTIMIZATION=${optimizationLevel}`,
        { cwd: '/path/to/firmware', timeout: 600000 }
      );

      const binaryPath = '/path/to/firmware/.pio/build/esp32-s3-devkitc-1/firmware.bin';
      const stats = await fs.stat(binaryPath);

      return {
        status: 'COMPLETED',
        outputData: {
          success: true,
          binaryPath,
          binarySize: stats.size,
          compileTime: Date.now() - task.startTime,
          buildLogs: stdout,
        },
      };
    } catch (error) {
      return {
        status: 'FAILED',
        outputData: {
          success: false,
          errors: [error.message],
          buildLogs: error.stderr,
        },
      };
    } finally {
      await fs.unlink(tempFile);
    }
  });

  console.log('[Worker] Pattern compiler worker started');
  console.log('[Worker] Polling tasks: validate_pattern, generate_cpp, compile_firmware');
}

// Helper functions
async function validatePatternSyntax(code: string): Promise<boolean> {
  // Pattern syntax validation logic
  return true;
}

async function generateCppFromPattern(code: string): Promise<string> {
  // Pattern-to-C++ code generation
  return '// Generated C++ code\nvoid pattern() { ... }';
}
```

#### Worker Lifecycle Management

```typescript
// orkes-service/src/index.ts
import { startPatternCompilerWorker } from './workers/pattern-compiler.js';
import { startCICDWorker } from './workers/cicd.js';

async function startup() {
  // Initialize Orkes client
  await getOrkesClient();

  // Start all workers
  await Promise.all([
    startPatternCompilerWorker(),
    startCICDWorker(),
  ]);

  // Start HTTP server
  app.listen(PORT);
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Worker] Stopping workers gracefully...');
  // Workers automatically stop polling when process exits
  process.exit(0);
});
```

### Step 4: Set Up Event Listeners

#### Webhook Event Handler

```typescript
// Register event handler in Orkes
const eventHandler = {
  name: 'github_push_handler',
  event: 'github:push',
  actions: [
    {
      action: 'start_workflow',
      start_workflow: {
        name: 'k1_cicd_pipeline',
        version: 1,
        input: {
          repository: '${event.repository.url}',
          branch: '${event.ref}',
          commit: '${event.after}',
        },
        correlationId: '${event.after}',
      },
    },
  ],
  active: true,
};

await client.eventResource.createEventHandler(eventHandler);
```

#### Send Event to Orkes

```typescript
// From GitHub webhook endpoint
app.post('/webhooks/github', async (req, res) => {
  const event = req.body;

  // Forward to Orkes
  await client.eventResource.postEvent({
    event: 'github:push',
    payload: event,
  });

  res.sendStatus(200);
});
```

### Step 5: Deploy and Monitor

#### Deployment Checklist

- [ ] Register all workflows
- [ ] Deploy workers (Docker/K8s/PM2)
- [ ] Configure environment variables
- [ ] Set up monitoring (see section 5)
- [ ] Test end-to-end workflow execution
- [ ] Configure alerting

#### Monitoring Setup

```typescript
// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const client = await getOrkesClient();
    const health = await client.healthResource.check();
    res.json({ status: 'healthy', orkes: health });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});
```

---

## 4. Integration Patterns

### 4.1 Request-Response Pattern

**Use case:** Webapp triggers workflow and waits for result.

```typescript
// Webapp: Trigger and poll for result
async function compilePatternSync(input: PatternInput): Promise<PatternOutput> {
  // Start workflow
  const { workflowId } = await fetch('/api/workflows/execute', {
    method: 'POST',
    body: JSON.stringify({
      workflowName: 'k1_pattern_compilation',
      input,
    }),
  }).then(r => r.json());

  // Poll for completion
  while (true) {
    const status = await fetch(`/api/workflows/${workflowId}`).then(r => r.json());

    if (status.status === 'COMPLETED') {
      return status.output;
    } else if (status.status === 'FAILED') {
      throw new Error('Workflow failed');
    }

    await sleep(2000); // Poll every 2 seconds
  }
}
```

### 4.2 Fire-and-Forget Pattern

**Use case:** Trigger workflow and don't wait (async processing).

```typescript
// Webapp: Trigger and show notification later
async function compilePatternAsync(input: PatternInput): Promise<string> {
  const { workflowId } = await fetch('/api/workflows/execute', {
    method: 'POST',
    body: JSON.stringify({
      workflowName: 'k1_pattern_compilation',
      input,
    }),
  }).then(r => r.json());

  // Show toast: "Compilation started, you'll be notified"
  return workflowId;
}

// Later: Workflow sends webhook when complete
```

### 4.3 Event-Driven Pattern

**Use case:** External event triggers workflow (GitHub push → CI/CD).

```typescript
// GitHub webhook → Orkes event → Workflow
eventHandler: {
  event: 'github:push',
  actions: [{ start_workflow: 'k1_cicd_pipeline' }]
}
```

### 4.4 Scheduled Pattern

**Use case:** Daily analytics report generation.

```typescript
// Cron-like scheduling
const cronWorkflow = {
  name: 'daily_analytics_report',
  schedule: '0 0 * * *', // Every day at midnight
  startWorkflow: {
    name: 'k1_analytics_pipeline',
    input: {
      startDate: '${yesterday}',
      endDate: '${today}',
    },
  },
};

await client.metadataResource.registerSchedule(cronWorkflow);
```

### 4.5 Human-in-the-Loop Pattern

**Use case:** Manual approval before deployment.

```typescript
{
  name: 'approval_gate',
  type: 'WAIT',
  inputParameters: {
    timeout: 3600, // 1 hour
  }
}

// Webapp: Show approval UI
async function approveDeployment(workflowId: string) {
  await fetch(`/api/workflows/${workflowId}/tasks/approval_gate/complete`, {
    method: 'POST',
    body: JSON.stringify({ approved: true }),
  });
}
```

### 4.6 Saga Pattern (Distributed Transactions)

**Use case:** Multi-step deployment with rollback.

```typescript
{
  tasks: [
    { name: 'deploy_firmware', type: 'SIMPLE' },
    { name: 'deploy_webapp', type: 'SIMPLE' },
    { name: 'health_check', type: 'SIMPLE' },
    {
      name: 'check_health',
      type: 'SWITCH',
      decisionCases: {
        FAILED: [
          { name: 'rollback_webapp', type: 'SIMPLE' },
          { name: 'rollback_firmware', type: 'SIMPLE' }
        ]
      }
    }
  ]
}
```

---

## 5. Monitoring and Maintenance

### 5.1 Orkes Cloud UI

**Dashboard features:**
- Live workflow executions
- Task queue depths
- Worker health status
- Execution history
- Performance metrics

**Navigation:**
1. **Executions** → View running/completed workflows
2. **Workflows** → Manage workflow definitions
3. **Tasks** → Configure task definitions
4. **Workers** → Monitor worker status
5. **Events** → View event handlers and logs

### 5.2 Metrics and KPIs

**Key metrics to track:**

```typescript
// Workflow metrics
{
  totalExecutions: 1234,
  successRate: 0.95,
  avgExecutionTime: 120000, // ms
  p95ExecutionTime: 180000,
  p99ExecutionTime: 240000,
  failureRate: 0.05,
}

// Task metrics
{
  taskType: 'compile_firmware',
  totalExecutions: 500,
  avgExecutionTime: 90000,
  queueTime: 1000, // Time waiting in queue
  retryRate: 0.10,
}

// Worker metrics
{
  workerID: 'worker-01',
  tasksProcessed: 150,
  uptime: 86400, // seconds
  cpuUsage: 0.45,
  memoryUsage: 512, // MB
}
```

### 5.3 Programmatic Monitoring

```typescript
// Query workflow execution stats
const executions = await client.workflowResource.getExecutions({
  workflowName: 'k1_pattern_compilation',
  startTime: Date.now() - 86400000, // Last 24 hours
  endTime: Date.now(),
});

const successRate = executions.filter(e => e.status === 'COMPLETED').length / executions.length;
console.log('Success rate:', successRate);

// Get queue stats
const queueDepth = await client.taskResource.getQueueSize('compile_firmware');
console.log('Queue depth:', queueDepth);

// Worker metrics
const workers = await client.taskResource.getAllPollData();
console.log('Active workers:', workers.length);
```

### 5.4 Alerting

**Set up alerts for:**
- Workflow failure rate > 10%
- Task queue depth > 100
- Worker downtime > 5 minutes
- Execution time > 2x average

**Example: Slack alert on failure**

```typescript
{
  name: 'send_alert',
  type: 'HTTP',
  inputParameters: {
    uri: 'https://hooks.slack.com/services/XXX',
    method: 'POST',
    body: {
      text: `🚨 Workflow ${workflow.workflowId} failed: ${workflow.reasonForIncompletion}`
    }
  }
}
```

### 5.5 Troubleshooting

**Common issues:**

**Issue:** Workflow stuck in RUNNING
- **Cause:** Worker not polling or crashed
- **Fix:** Check worker logs, restart workers

**Issue:** Task keeps failing
- **Cause:** Bad input data or worker bug
- **Fix:** Check task input/output, review worker logs

**Issue:** High queue depth
- **Cause:** Not enough workers or slow execution
- **Fix:** Scale up workers, optimize task logic

**Debug tools:**

```typescript
// Get workflow execution details
const execution = await client.workflowResource.getExecutionStatus(workflowId, true);
console.log('Status:', execution.status);
console.log('Failed task:', execution.tasks.find(t => t.status === 'FAILED'));

// Retry failed workflow
await client.workflowResource.retry(workflowId);

// Terminate stuck workflow
await client.workflowResource.terminate(workflowId, 'Stuck, manual intervention');
```

---

## 6. Security Considerations

### 6.1 Authentication and Authorization

**Application Keys:**
- Each application has unique Key ID and Secret
- Rotate keys every 90 days
- Use environment-specific keys (dev/staging/prod)

**RBAC (Role-Based Access Control):**
```typescript
// Define roles in Orkes Cloud
const roles = {
  developer: {
    workflows: ['k1_pattern_compilation'],
    permissions: ['READ', 'EXECUTE']
  },
  admin: {
    workflows: ['*'],
    permissions: ['READ', 'WRITE', 'EXECUTE', 'DELETE']
  }
};
```

**Token-based auth (for webapp):**
```typescript
// Backend generates short-lived token
const token = await orkesClient.auth.generateToken({
  keyId: process.env.ORKES_KEY_ID,
  keySecret: process.env.ORKES_KEY_SECRET,
  expiresIn: 3600, // 1 hour
});

// Webapp uses token
const client = await orkesConductorClient({
  serverUrl: process.env.ORKES_SERVER_URL,
  token,
});
```

### 6.2 Data Protection

**Encryption:**
- **In transit:** TLS 1.3 (enforced by Orkes Cloud)
- **At rest:** AES-256 (PostgreSQL encryption)

**Sensitive data handling:**
```typescript
// DO NOT store secrets in workflow input/output
{
  inputParameters: {
    apiKey: '${workflow.input.apiKey}' // ❌ WRONG
  }
}

// DO use secret management
{
  inputParameters: {
    apiKeyRef: 'aws-secrets:k1-api-key' // ✅ CORRECT
  }
}
```

**PII handling:**
- Avoid storing PII in workflow data
- Use correlation IDs instead of user emails
- Implement data retention policies

### 6.3 Secure Communication

**Worker authentication:**
```typescript
// Workers authenticate with application keys
const client = await orkesConductorClient({
  serverUrl: process.env.ORKES_SERVER_URL,
  keyId: process.env.ORKES_KEY_ID,
  keySecret: process.env.ORKES_KEY_SECRET,
});
```

**Webhook verification:**
```typescript
// Verify GitHub webhook signature
app.post('/webhooks/github', (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const payload = JSON.stringify(req.body);
  const hmac = crypto.createHmac('sha256', GITHUB_WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');

  if (signature !== digest) {
    return res.status(401).send('Invalid signature');
  }

  // Process webhook
});
```

### 6.4 Network Security

**Firewall rules:**
- Workers only need outbound HTTPS (443) to Orkes Cloud
- No inbound ports required for workers
- Orkes service API should be behind firewall/VPN for production

**Rate limiting:**
```typescript
// Prevent abuse
app.use('/api/workflows', rateLimit({
  windowMs: 60000, // 1 minute
  max: 100, // 100 requests per minute
}));
```

---

## 7. Scaling Strategies

### 7.1 Horizontal Worker Scaling

**Auto-scaling based on queue depth:**

```yaml
# Kubernetes HorizontalPodAutoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: pattern-compiler-worker
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: pattern-compiler-worker
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: External
    external:
      metric:
        name: orkes_queue_depth
        selector:
          matchLabels:
            task: compile_firmware
      target:
        type: AverageValue
        averageValue: "10" # Scale up if queue depth > 10 per worker
```

**Manual scaling:**
```bash
# Docker
docker run -d --name worker-02 k1-pattern-worker

# Kubernetes
kubectl scale deployment pattern-compiler-worker --replicas=5

# PM2
pm2 scale pattern-compiler-worker +3
```

### 7.2 Workflow Partitioning

**Domain-based isolation:**
```typescript
// High-priority workflows
{
  name: 'urgent_pattern_compilation',
  taskToDomain: {
    '*': 'high-priority' // All tasks run in high-priority domain
  }
}

// Workers poll specific domain
const taskManager = new TaskManager(client, {
  domain: 'high-priority',
  concurrency: 10,
});
```

**Resource-based isolation:**
```typescript
// GPU-intensive tasks
{
  taskToDomain: {
    'render_visualization': 'gpu-workers'
  }
}

// CPU-intensive tasks
{
  taskToDomain: {
    'compile_firmware': 'cpu-workers'
  }
}
```

### 7.3 Throughput Optimization

**Batch processing:**
```typescript
// Instead of 100 workflows for 100 patterns
{
  name: 'batch_pattern_compilation',
  inputParameters: {
    patterns: ['pattern1', 'pattern2', ..., 'pattern100']
  },
  tasks: [
    {
      name: 'compile_all',
      type: 'DYNAMIC_FORK',
      dynamicForkTasksParam: 'patterns',
      // Compile all patterns in parallel
    }
  ]
}
```

**Connection pooling:**
```typescript
// Reuse HTTP connections in workers
import axios from 'axios';

const httpClient = axios.create({
  maxSockets: 50,
  keepAlive: true,
});
```

### 7.4 Cost Optimization

**Serverless workers (AWS Lambda):**
```typescript
// Deploy workers as Lambda functions
export const handler = async (event) => {
  const task = event.task;
  const result = await processTask(task);
  return result;
};

// Triggered by SQS queue (Orkes → SQS → Lambda)
```

**Spot instances:**
- Run workers on AWS Spot or GCP Preemptible VMs
- Save 60-80% on compute costs
- Tasks automatically requeue if instance terminated

**Right-sizing:**
- Monitor worker CPU/memory usage
- Use smaller instances for lightweight tasks
- Reserve larger instances for heavy tasks

---

## 8. Best Practices

### 8.1 Workflow Design Principles

**1. Keep workflows simple and focused**
```typescript
// ✅ GOOD: Single responsibility
const compileWorkflow = {
  name: 'compile_pattern',
  tasks: [validate, generate, compile]
};

// ❌ BAD: Too many responsibilities
const megaWorkflow = {
  name: 'do_everything',
  tasks: [validate, compile, deploy, test, analytics, notify, ...]
};
```

**2. Use sub-workflows for reusability**
```typescript
// ✅ GOOD: Reusable test workflow
{
  name: 'run_tests',
  type: 'SUB_WORKFLOW',
  subWorkflowParam: { name: 'k1_test_suite' }
}

// ❌ BAD: Duplicate test tasks in every workflow
```

**3. Design for idempotency**
```typescript
// ✅ GOOD: Idempotent deployment
async function deploy(version) {
  const current = await getCurrentVersion();
  if (current === version) {
    return { status: 'ALREADY_DEPLOYED' };
  }
  await performDeploy(version);
  return { status: 'DEPLOYED' };
}

// ❌ BAD: Deploy always runs, causes issues on retry
async function deploy(version) {
  await performDeploy(version); // Fails if already deployed
}
```

**4. Use correlation IDs for traceability**
```typescript
// ✅ GOOD: Unique correlation ID
{
  correlationId: `pattern-${patternName}-${timestamp}-${userId}`,
  input: { ... }
}

// ❌ BAD: No correlation ID (hard to trace)
```

### 8.2 Error Handling Best Practices

**1. Distinguish transient vs. permanent failures**
```typescript
{
  name: 'api_call',
  retryCount: 3,
  retryLogic: 'EXPONENTIAL_BACKOFF',
  // Retry on 500, 502, 503 (transient)
  // Don't retry on 400, 401, 404 (permanent)
}
```

**2. Implement circuit breakers**
```typescript
// Worker-side circuit breaker
const breaker = new CircuitBreaker(callExternalAPI, {
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
});

taskManager.startPolling('api_call', async (task) => {
  try {
    const result = await breaker.fire(task.inputData);
    return { status: 'COMPLETED', outputData: result };
  } catch (error) {
    if (breaker.opened) {
      return { status: 'FAILED', outputData: { error: 'Circuit breaker open' } };
    }
    throw error;
  }
});
```

**3. Add failure workflows for cleanup**
```typescript
{
  name: 'deploy_workflow',
  failureWorkflow: 'deploy_cleanup_workflow',
  tasks: [...]
}

// Cleanup workflow runs on failure
{
  name: 'deploy_cleanup_workflow',
  tasks: [
    { name: 'rollback', type: 'SIMPLE' },
    { name: 'notify_team', type: 'SIMPLE' }
  ]
}
```

### 8.3 Performance Optimization

**1. Minimize task count**
```typescript
// ✅ GOOD: Combine related operations
{
  name: 'build_and_test',
  type: 'SIMPLE',
  // Worker does both build and test
}

// ❌ BAD: Unnecessary task overhead
{
  tasks: [
    { name: 'build' },
    { name: 'test' }
  ]
  // Extra network round-trips
}
```

**2. Use parallel execution**
```typescript
// ✅ GOOD: Parallel builds
{
  type: 'FORK_JOIN',
  forkTasks: [
    [{ name: 'build_firmware' }],
    [{ name: 'build_webapp' }]
  ]
}

// ❌ BAD: Sequential builds (2x slower)
{
  tasks: [
    { name: 'build_firmware' },
    { name: 'build_webapp' }
  ]
}
```

**3. Optimize polling intervals**
```typescript
// ✅ GOOD: Balanced polling
const taskManager = new TaskManager(client, {
  pollingIntervals: 1000, // 1 second (responsive)
});

// ❌ BAD: Too frequent (wastes resources)
pollingIntervals: 100 // 100ms

// ❌ BAD: Too slow (delays execution)
pollingIntervals: 30000 // 30 seconds
```

### 8.4 Testing Workflows

**1. Unit test task logic**
```typescript
// Test worker task logic independently
import { validatePattern } from './workers/pattern-compiler';

describe('validatePattern', () => {
  it('should validate correct pattern', async () => {
    const result = await validatePattern({
      inputData: { patternCode: 'valid code' }
    });
    expect(result.status).toBe('COMPLETED');
  });

  it('should reject invalid pattern', async () => {
    const result = await validatePattern({
      inputData: { patternCode: 'invalid' }
    });
    expect(result.status).toBe('FAILED');
  });
});
```

**2. Integration test workflows**
```typescript
// Test full workflow execution
describe('pattern compilation workflow', () => {
  it('should compile pattern successfully', async () => {
    const workflowId = await client.workflowResource.startWorkflow({
      name: 'k1_pattern_compilation',
      input: testInput,
    });

    // Poll for completion
    const result = await waitForWorkflow(workflowId);

    expect(result.status).toBe('COMPLETED');
    expect(result.output.success).toBe(true);
  });
});
```

**3. Test error scenarios**
```typescript
it('should handle compilation failure', async () => {
  const workflowId = await client.workflowResource.startWorkflow({
    name: 'k1_pattern_compilation',
    input: invalidInput,
  });

  const result = await waitForWorkflow(workflowId);

  expect(result.status).toBe('FAILED');
  expect(result.output.errors).toBeDefined();
});
```

### 8.5 Documentation

**1. Document workflow purpose**
```typescript
{
  name: 'k1_pattern_compilation',
  description: 'Compiles LED pattern code, runs tests, benchmarks performance',
  // Clear, concise description
}
```

**2. Add input/output schemas**
```typescript
{
  inputParameters: ['patternName', 'patternCode', 'optimizationLevel'],
  outputParameters: {
    success: '${compile_ref.output.success}',
    binaryPath: '${compile_ref.output.binaryPath}',
  }
}
```

**3. Version workflows properly**
```typescript
// Increment version on breaking changes
{
  name: 'k1_pattern_compilation',
  version: 2, // Breaking change from v1
}

// Maintain backward compatibility when possible
```

---

## Summary

Orkes Conductor provides a powerful, scalable platform for orchestrating complex workflows in K1.node1:

**Key Takeaways:**

1. **Architecture:** Distributed, queue-based system with stateless workers
2. **Workflows:** Define using code (TypeScript) or JSON
3. **Workers:** Poll task queues, execute business logic, return results
4. **Scaling:** Horizontal worker scaling, partitioning, auto-scaling
5. **Monitoring:** Real-time dashboards, metrics, alerting
6. **Security:** Application keys, RBAC, encryption, network isolation
7. **Best Practices:** Idempotency, error handling, testing, documentation

**For K1.node1:**
- Pattern compilation becomes a repeatable, monitored workflow
- CI/CD pipelines are automated and observable
- Analytics processing scales automatically
- Workers can run anywhere (cloud, edge, on-prem)

**Next Steps:**
1. Implement remaining task workers
2. Add monitoring dashboards
3. Set up alerting
4. Production deployment
5. Load testing and optimization

For questions or deep dives into specific topics, refer to:
- [Orkes Documentation](https://orkes.io/content/)
- [Integration Guide](orkes-integration-guide.md)
- [Service README](../../orkes-service/README.md)
