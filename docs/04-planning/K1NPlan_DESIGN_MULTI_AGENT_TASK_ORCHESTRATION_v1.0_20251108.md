# Multi-Agent Task Orchestration Design
**K1.node1 Developer Swarm Architecture**

**Date:** November 8, 2025
**Status:** Design Proposal
**Author:** Claude Agent (Haiku 4.5)
**Scope:** Conductor-based parallel agent execution for 22 development tasks

---

## Executive Summary

Transform K1.node1 task execution from sequential, isolated workflows to a **collaborative multi-agent swarm** where:

- **Agents** execute assigned tasks in parallel (20+ concurrent)
- **Dependencies** are resolved automatically (agents wait for prerequisites)
- **Coordination** happens via shared state + status channels
- **Communication** is structured: task context → agent execution → status reporting
- **Validation** is distributed (agents validate before marking complete)
- **Scaling** works: add agents = increase parallelism without changing logic

**Architecture:** Conductor orchestrates a **task queue + agent pool** model where agents autonomously claim work, execute with full context, coordinate dependencies, and report results.

---

## Part 1: Core Concepts

### 1.1 The Agent Model

An **Agent** is a specialized worker that:

1. **Reads task from queue** (Conductor or Redis)
2. **Loads full context** (task definition, subtasks, dependencies, environment)
3. **Executes autonomously** (knows what to do, when to validate, when to ask for help)
4. **Coordinates with peers** (aware of other agents on same master task)
5. **Reports status** (progress, completion, failure with root cause)
6. **Accepts feedback** (quality gate failures, review comments, rework)

**Agent Types:**

```
SecurityAgent → Audits, patches, validates security fixes
ArchitectureAgent → Designs, documents, writes ADRs
CodeGenAgent → Generates C++, tests code generation
TestingAgent → Runs tests, profiles, benchmarks
DocumentationAgent → Writes docs, validates examples
BugFixAgent → Isolates, fixes, verifies bugs
```

Each agent type knows:
- What tools it has (ripgrep, compiler, test runner, etc)
- What validation means for its domain
- How to coordinate with other agents
- How to report failure clearly

### 1.2 Task Execution Model

```
┌─────────────────────────────────────────────────────┐
│ Conductor Task Queue                                │
│ (redis or in-memory)                                │
│                                                     │
│ [ Task-1-Audit ]  [ Task-2-Fix ]  [ Task-3-Test ] │
└────────┬──────────────┬───────────────┬────────────┘
         │              │               │
         ↓              ↓               ↓
    ┌────────┐     ┌────────┐    ┌────────┐
    │ Agent1 │     │ Agent2 │    │ Agent3 │  (Parallel execution)
    │Security│     │CodeGen │    │Testing │
    └────┬───┘     └────┬───┘    └───┬────┘
         │              │            │
         ↓              ↓            ↓
    [executing]   [executing]   [executing]
         │              │            │
         ↓              ↓            ↓
    [validate]    [validate]    [validate]
         │              │            │
         ↓              ↓            ↓
    [report] ──────► Conductor Status API
                          ↓
                   Master Task Progress
```

**Key:** Agents work **concurrently**, not sequentially. Task dependencies are resolved by Conductor—agents wait automatically if prerequisites aren't done.

### 1.3 Agent Lifecycle

```
1. AWAITING TASK
   ↓
2. TASK ASSIGNED (receives full task context)
   ↓
3. EXECUTING (performs work: audit, generate, test, etc)
   ↓
4. VALIDATING (runs quality gates, checks artifacts)
   ↓
5. REPORTING (sends results to Conductor)
   ↓
6. COMPLETE or FAILED
   ├─→ REWORK (if gates failed, knows exactly what failed)
   └─→ UNBLOCKED DEPENDENTS (other agents waiting on this task can now proceed)
```

---

## Part 2: Agent Interface Design

### 2.1 Agent Initialization

When an agent is assigned a task, it receives:

```typescript
export interface AgentContext {
  // Task Identity
  taskId: number;
  subtaskId?: number;
  taskTitle: string;
  category: 'security' | 'architecture' | 'codegen' | 'testing' | 'documentation' | 'bug-fix';

  // Full Task Definition
  definition: {
    title: string;
    description: string;
    details: string; // Implementation context, file paths, etc
    priority: string;
    dependencies: TaskDependency[];
    testStrategy: string;
    expectedOutputs?: string[]; // Artifact names
  };

  // Related Work
  relatedSubtasks: Array<{
    id: number;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'BLOCKED';
    assignedAgent?: string; // Agent ID
  }>;

  // Environment
  environment: {
    gitBranch: string;
    gitCommit: string;
    workspaceDir: string;
    nodeVersion: string;
    pythonVersion?: string;
    platformioVersion?: string;
  };

  // Quality Gates (what must pass before complete)
  qualityGates: Array<{
    name: string;
    metric: string;
    threshold: number;
    required: boolean;
  }>;

  // Communication
  statusChannel: string; // Redis pub/sub or webhook
  coordinationEndpoint: string; // HTTP endpoint to coordinate with peers

  // Tools Available
  tools: {
    shell: boolean; // Can run bash commands
    fileSystem: boolean; // Can read/write files
    compiler: boolean; // Can invoke PlatformIO
    testRunner: boolean; // Can run tests
    documentGenerator: boolean; // Can generate docs
  };
}
```

**Agent reads context and knows:**
- Exactly what to do (task details)
- What must pass (quality gates)
- When it can start (dependencies)
- Who else is working on related subtasks
- What tools it has
- Where to report status

### 2.2 Agent Status Reporting

Agents continuously report status via **Conductor Task Handler**:

```typescript
export interface AgentStatusUpdate {
  agentId: string;
  taskId: number;
  subtaskId?: number;

  status: 'AWAITING_TASK' | 'EXECUTING' | 'VALIDATING' | 'REPORTING' | 'COMPLETE' | 'FAILED';

  // Progress
  progress: {
    percentComplete: number; // 0-100
    currentStep: string; // "Scanning source code for credentials..."
    estimatedTimeRemaining?: number; // seconds
  };

  // Results
  results?: {
    success: boolean;
    artifactsPaths: string[];
    metrics?: Record<string, number>;
    logs?: string;
  };

  // Failures
  error?: {
    code: string; // 'VALIDATION_FAILED', 'COMPILATION_ERROR', etc
    message: string;
    details?: string;
    suggestedFix?: string;
  };

  // Coordination
  blockingOn?: {
    taskId: number;
    subtaskId?: number;
    expectedCompletionTime?: string;
  };

  timestamp: string; // ISO 8601
}
```

**Critical:** Status updates are **continuous**, not just at completion. Conductor dashboard can show real-time progress.

### 2.3 Inter-Agent Coordination Protocol

When subtasks have dependencies, agents coordinate:

**Protocol:**
1. Agent-A working on Subtask-1 finishes
2. Writes status: `COMPLETE` with artifacts to shared state
3. Posts to coordination endpoint: `"Task-1-Subtask-1 complete, artifacts at /path"`
4. Agent-B (waiting on Subtask-1) receives webhook notification
5. Agent-B reads artifacts and continues

**Shared State Format:**

```typescript
export interface SubtaskResult {
  taskId: number;
  subtaskId: number;
  agentId: string;
  status: 'COMPLETED' | 'FAILED';

  artifacts: Array<{
    type: 'code' | 'test' | 'report' | 'document' | 'patch';
    path: string;
    checksum: string; // for integrity
    description: string;
  }>;

  metrics: {
    executionTimeMs: number;
    artifactSizeBytes?: number;
    qualityMetrics?: Record<string, number>;
  };

  usableBy: number[]; // Subtask IDs that can now proceed

  timestamp: string;
}
```

**Storage:** Redis or Postgres (simple table)

---

## Part 3: Conductor Orchestration Strategy

### 3.1 Master Workflow: Task Distribution

```typescript
export const agentSwarmMasterWorkflow: WorkflowDef = {
  name: 'k1_agent_swarm_master',
  description: 'Dispatch tasks to agent pool with dependency resolution',
  version: 1,
  tasks: [
    // Step 1: Load all tasks from tasks.json
    {
      name: 'load_task_manifest',
      taskReferenceName: 'load_manifest_ref',
      type: 'SIMPLE',
      inputParameters: {
        taskFile: '${workflow.input.taskFile}',
        filterCategory: '${workflow.input.filterCategory}', // Optional: security, codegen, etc
      },
    },

    // Step 2: Resolve dependency graph (topological sort)
    {
      name: 'resolve_dependencies',
      taskReferenceName: 'resolve_deps_ref',
      type: 'SIMPLE',
      inputParameters: {
        tasks: '${load_manifest_ref.output.tasks}',
        readinessChecker: 'true', // Check which tasks can start immediately
      },
    },

    // Step 3: Dispatch ready tasks to agent pool
    {
      name: 'dispatch_to_agents',
      taskReferenceName: 'dispatch_ref',
      type: 'SIMPLE',
      inputParameters: {
        readyTasks: '${resolve_deps_ref.output.readyTasks}',
        agentPoolSize: '${workflow.input.agentPoolSize || 20}',
        priorityQueue: 'true',
      },
    },

    // Step 4: Wait for agents (loop until all complete)
    {
      name: 'agent_completion_loop',
      taskReferenceName: 'wait_agents_ref',
      type: 'SIMPLE',
      inputParameters: {
        dispatchedTasks: '${dispatch_ref.output.dispatchedTasks}',
        statusCheckIntervalSec: 5,
        maxWaitSeconds: 86400, // 24 hours
      },
    },

    // Step 5: Aggregate results
    {
      name: 'aggregate_results',
      taskReferenceName: 'aggregate_ref',
      type: 'SIMPLE',
      inputParameters: {
        completedTasks: '${wait_agents_ref.output.completedTasks}',
        failedTasks: '${wait_agents_ref.output.failedTasks}',
      },
    },

    // Step 6: Final report
    {
      name: 'generate_report',
      taskReferenceName: 'report_ref',
      type: 'SIMPLE',
      inputParameters: {
        results: '${aggregate_ref.output}',
        generateHTML: 'true',
        uploadToS3: 'true',
      },
    },
  ],

  outputParameters: {
    totalTasks: '${load_manifest_ref.output.totalTasks}',
    completedTasks: '${aggregate_ref.output.completed}',
    failedTasks: '${aggregate_ref.output.failed}',
    reportUrl: '${report_ref.output.reportUrl}',
    executionTimeSeconds: '${aggregate_ref.output.durationSeconds}',
  },

  timeoutSeconds: 86400, // 24 hours
  restartable: true,
};
```

### 3.2 Agent Task Handler: Individual Task Execution

Each agent is a **Conductor task handler** that:

```typescript
// In pattern-compiler.ts, add new handler:
export async function handleAgentTaskExecution(task: any): Promise<void> {
  const agentId = `agent-${Date.now()}`;
  const context: AgentContext = task.inputData;

  try {
    // Log agent startup
    console.log(`[Agent-${agentId}] Starting task: ${context.taskTitle}`);

    // Wait for dependencies
    const blockedOn = await waitForDependencies(context.definition.dependencies);
    if (blockedOn) {
      task.status = 'IN_PROGRESS';
      task.outputData = {
        status: 'BLOCKED',
        blockingOn,
        message: `Waiting for prerequisite: ${blockedOn.taskTitle}`,
      };
      return; // Conductor will retry
    }

    // Route to specialized handler based on category
    let result: any;
    switch (context.category) {
      case 'security':
        result = await handleSecurityTask(agentId, context);
        break;
      case 'architecture':
        result = await handleArchitectureTask(agentId, context);
        break;
      case 'codegen':
        result = await handleCodeGenTask(agentId, context);
        break;
      case 'testing':
        result = await handleTestingTask(agentId, context);
        break;
      case 'documentation':
        result = await handleDocumentationTask(agentId, context);
        break;
      default:
        throw new Error(`Unknown task category: ${context.category}`);
    }

    // Validate results against quality gates
    const validation = await validateQualityGates(result, context.qualityGates);
    if (!validation.passed) {
      task.status = 'FAILED';
      task.outputData = {
        status: 'VALIDATION_FAILED',
        errors: validation.failures,
        suggestedFix: validation.remedy,
        rerunCommand: `conductor run agent-task --taskId=${context.taskId}`,
      };
      return;
    }

    // Report success
    task.status = 'COMPLETED';
    task.outputData = {
      status: 'COMPLETE',
      agentId,
      artifacts: result.artifacts,
      metrics: result.metrics,
      duration: result.durationMs,
      nextUnblockedTasks: result.unblocks,
    };

    // Publish completion event (triggers dependent agents)
    await publishTaskCompletion(context.taskId, result);

  } catch (error) {
    task.status = 'FAILED';
    task.outputData = {
      status: 'ERROR',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      agentId,
    };
  }
}
```

---

## Part 4: Category-Specific Agent Implementations

### 4.1 Security Agent Handler

```typescript
async function handleSecurityTask(agentId: string, context: AgentContext): Promise<any> {
  const startTime = Date.now();
  const artifacts: any[] = [];

  console.log(`[Agent-${agentId}] Security task: ${context.taskTitle}`);

  // For WiFi credentials task:
  if (context.taskId === 1) {
    // Step 1: Audit source code
    console.log(`[Agent-${agentId}] Step 1/3: Auditing source code for hardcoded credentials`);
    const auditResults = await auditSourceCode(context);
    artifacts.push({
      type: 'report',
      path: auditResults.reportPath,
      description: `Found ${auditResults.issues.length} security issues`,
    });

    // Step 2: Apply fix (patch credentials)
    console.log(`[Agent-${agentId}] Step 2/3: Applying security fix (removing hardcoded credentials)`);
    const patchResult = await applySecurityPatch(context, auditResults.issues);
    artifacts.push({
      type: 'patch',
      path: patchResult.patchPath,
      checksum: patchResult.checksum,
    });

    // Step 3: Verify fix
    console.log(`[Agent-${agentId}] Step 3/3: Verifying fix compiles and passes tests`);
    const verifyResult = await verifySecurityFix(context, patchResult.patchPath);
    if (!verifyResult.success) {
      throw new Error(`Security fix verification failed: ${verifyResult.error}`);
    }

    return {
      artifacts,
      metrics: {
        issuesFound: auditResults.issues.length,
        issuesFixed: patchResult.patchesApplied,
        testsPassed: verifyResult.testsPassed,
      },
      durationMs: Date.now() - startTime,
      unblocks: context.relatedSubtasks
        .filter(st => st.dependencies?.includes(context.subtaskId))
        .map(st => st.id),
    };
  }

  throw new Error(`Unknown security task: ${context.taskId}`);
}
```

### 4.2 Code Generation Agent Handler

```typescript
async function handleCodeGenTask(agentId: string, context: AgentContext): Promise<any> {
  const startTime = Date.now();
  const artifacts: any[] = [];

  console.log(`[Agent-${agentId}] CodeGen task: ${context.taskTitle}`);

  // Example: Bloom Pattern Graph Conversion PoC
  if (context.taskId === 7) {
    // Step 1: Parse pattern definition
    console.log(`[Agent-${agentId}] Step 1/4: Parsing Bloom pattern definition`);
    const pattern = await parsePattern(context.definition.details);

    // Step 2: Convert to graph
    console.log(`[Agent-${agentId}] Step 2/4: Converting pattern to graph structure`);
    const graph = await convertToGraph(pattern);
    artifacts.push({
      type: 'code',
      path: graph.outputPath,
      description: 'Graph representation of pattern',
    });

    // Step 3: Generate C++ from graph
    console.log(`[Agent-${agentId}] Step 3/4: Generating C++ code from graph`);
    const generated = await generateCppFromGraph(graph);
    artifacts.push({
      type: 'code',
      path: generated.cppPath,
      description: 'Generated C++ implementation',
    });

    // Step 4: Compile and test
    console.log(`[Agent-${agentId}] Step 4/4: Compiling and running unit tests`);
    const compiled = await compileAndTest(context, generated.cppPath);
    if (!compiled.success) {
      throw new Error(`Compilation failed: ${compiled.error}`);
    }
    artifacts.push({
      type: 'test',
      path: compiled.testReportPath,
      description: 'Test results',
    });

    return {
      artifacts,
      metrics: {
        linesOfCode: generated.lineCount,
        compilationTimeMs: compiled.compilationTimeMs,
        testsPassed: compiled.testsPassed,
        binarySize: compiled.binarySize,
      },
      durationMs: Date.now() - startTime,
      unblocks: context.relatedSubtasks
        .filter(st => st.dependencies?.includes(context.subtaskId))
        .map(st => st.id),
    };
  }

  throw new Error(`Unknown codegen task: ${context.taskId}`);
}
```

### 4.3 Testing Agent Handler

```typescript
async function handleTestingTask(agentId: string, context: AgentContext): Promise<any> {
  const startTime = Date.now();
  const artifacts: any[] = [];

  console.log(`[Agent-${agentId}] Testing task: ${context.taskTitle}`);

  // Example: Stress testing
  if (context.taskId === 18) {
    console.log(`[Agent-${agentId}] Running stress test: ${context.definition.description}`);

    // Run 1000-iteration stress test
    const stressResult = await runStressTest({
      iterations: 1000,
      patternChangeFrequency: 'random',
      audioInputFrequency: 'random',
      deviceId: 'test-device-001',
      timeoutMs: 3600000, // 1 hour
    });

    artifacts.push({
      type: 'report',
      path: stressResult.reportPath,
      description: 'Stress test results',
    });

    if (!stressResult.success) {
      throw new Error(`Stress test failed: ${stressResult.failureReason}`);
    }

    return {
      artifacts,
      metrics: {
        iterationsCompleted: stressResult.iterations,
        failuresDetected: stressResult.failures.length,
        avgLatencyMs: stressResult.avgLatency,
        p95LatencyMs: stressResult.p95Latency,
        p99LatencyMs: stressResult.p99Latency,
      },
      durationMs: Date.now() - startTime,
      unblocks: [],
    };
  }

  throw new Error(`Unknown testing task: ${context.taskId}`);
}
```

---

## Part 5: Dependency Resolution & Blocking

### 5.1 Dependency Resolver

```typescript
export interface TaskDependency {
  taskId: number;
  subtaskId?: number;
  type: 'BLOCKS' | 'REQUIRES_OUTPUT';
}

export async function resolveTaskDependencies(
  tasks: MasterTaskDefinition[]
): Promise<{
  readyTasks: any[];
  blockedTasks: any[];
  dependencyGraph: Map<number, number[]>; // taskId → dependencies
}> {
  const dependencyGraph = new Map<number, number[]>();
  const completedTasks = new Set<number>(); // From prior execution
  const readyTasks: any[] = [];
  const blockedTasks: any[] = [];

  // Build dependency graph
  for (const task of tasks) {
    const deps = task.dependencies.map(d => d.taskId);
    dependencyGraph.set(task.id, deps);
  }

  // Topological sort: find tasks with no unmet dependencies
  for (const task of tasks) {
    const deps = dependencyGraph.get(task.id) || [];
    const unmetDeps = deps.filter(d => !completedTasks.has(d));

    if (unmetDeps.length === 0) {
      readyTasks.push(task);
    } else {
      blockedTasks.push({
        task,
        blockingOn: unmetDeps,
      });
    }
  }

  return {
    readyTasks,
    blockedTasks,
    dependencyGraph,
  };
}
```

### 5.2 Blocking Behavior

When agent tries to execute task with unmet dependencies:

```typescript
async function waitForDependencies(dependencies: TaskDependency[]): Promise<any | null> {
  for (const dep of dependencies) {
    const depTask = await getTaskStatus(dep.taskId, dep.subtaskId);

    if (depTask.status === 'PENDING') {
      return depTask; // Still waiting
    }
    if (depTask.status === 'FAILED') {
      throw new Error(`Dependency failed: Task-${dep.taskId}`);
    }
    if (depTask.status === 'COMPLETED') {
      // Check if we need output
      if (dep.type === 'REQUIRES_OUTPUT') {
        const result = await getTaskResult(dep.taskId, dep.subtaskId);
        if (!result.artifacts || result.artifacts.length === 0) {
          throw new Error(`Dependency ${dep.taskId} produced no artifacts`);
        }
      }
    }
  }

  return null; // All dependencies met
}
```

When dependency completes, **dependent tasks are automatically unblocked**:

```typescript
async function publishTaskCompletion(taskId: number, result: any): Promise<void> {
  // Store result
  await storeTaskResult(taskId, result);

  // Find dependent tasks
  const dependents = await findDependentTasks(taskId);

  // Publish event to trigger retry
  for (const dependent of dependents) {
    await publishEvent('task:dependency-met', {
      dependentTaskId: dependent.id,
      prerequisiteTaskId: taskId,
      artifacts: result.artifacts,
    });
  }
}
```

---

## Part 6: Status Aggregation & Reporting

### 6.1 Real-Time Dashboard

Conductor dashboard shows:

```
Master Task: K1.node1 Development
Status: IN_PROGRESS (18/22 tasks complete)
Start: 2025-11-08 14:30:00
Est. Complete: 2025-11-15 18:00:00

COMPLETED (18)
├─ Task 1: Remove WiFi Credentials ✓ (2h 15m)
├─ Task 4: Error Code Registry ✓ (45m)
├─ Task 5: Code Gen Architecture ADR ✓ (1h 30m)
└─ ... (15 more)

IN_PROGRESS (2)
├─ Task 7: Bloom Pattern Graph Conversion (Agent-8, 34m elapsed, est. 15m remaining)
└─ Task 16: Graph System Memory Profiling (Agent-12, 28m elapsed, est. 45m remaining)

BLOCKED (2)
├─ Task 8: Spectrum Pattern (waiting for Task-7)
└─ Task 15: Parameter Editor (waiting for Task-7)

FAILED (0)

Agent Pool Status:
├─ Agent-1: AVAILABLE
├─ Agent-2: AVAILABLE
├─ Agent-3: AVAILABLE
├─ Agent-8: EXECUTING (Task-7)
└─ ... (15 agents total)
```

### 6.2 Result Aggregation

```typescript
export async function aggregateTaskResults(
  completedTasks: any[],
  failedTasks: any[]
): Promise<{
  totalTasks: number;
  completed: number;
  failed: number;
  metrics: Record<string, number>;
  artifacts: any[];
  report: string;
}> {
  const report = {
    summary: {
      totalTasks: completedTasks.length + failedTasks.length,
      completedCount: completedTasks.length,
      failedCount: failedTasks.length,
      successRate: (completedTasks.length / (completedTasks.length + failedTasks.length)) * 100,
    },
    byCategory: {
      security: calculateCategoryStats(completedTasks, 'security'),
      architecture: calculateCategoryStats(completedTasks, 'architecture'),
      codegen: calculateCategoryStats(completedTasks, 'codegen'),
      testing: calculateCategoryStats(completedTasks, 'testing'),
      documentation: calculateCategoryStats(completedTasks, 'documentation'),
    },
    artifacts: completedTasks.flatMap(t => t.artifacts),
    failures: failedTasks.map(t => ({
      taskId: t.id,
      title: t.title,
      error: t.error,
      suggestedFix: t.suggestedFix,
    })),
  };

  return report;
}
```

---

## Part 7: Execution Lifecycle

### 7.1 Full Execution Flow

```
Time T0: Master workflow starts
├─ Load tasks.json (1 min)
├─ Resolve dependencies (30 sec)
└─ Dispatch ready tasks to agent pool (30 sec)

Time T1: Agents begin execution (20 agents working in parallel)
├─ Agent-1: Task-1 (Security: WiFi Credentials) [2h 15m]
├─ Agent-2: Task-4 (Architecture: Error Code Registry) [45m]
├─ Agent-3: Task-5 (Architecture: Code Gen ADR) [1h 30m]
├─ Agent-4: Task-6 (Architecture: Graph Design) [2h]
├─ ...
└─ Agent-20: Task-22 (Webapp Fixes) [1h]

Time T2: Task-1 completes
├─ Agent-1 publishes: "Task-1 COMPLETE"
├─ Executor finds: Task-2, Task-3 were waiting on Task-1
├─ Disposes agents for blocked tasks
├─ Task-2, Task-3 become READY
└─ [Continue]

Time T3: Agent pool reaches saturation
├─ 20 agents all executing
├─ No idle agents
├─ Blocked tasks queue up waiting for slots

Time TN: Final task completes
├─ All agents finish
├─ Master workflow aggregates results
├─ Generate final report (HTML + JSON)
└─ SUCCESS

Total execution: ~14 hours with 20 parallel agents
(vs. ~300+ hours if completely sequential)
```

### 7.2 Failure Handling

If an agent fails:

```
Agent-5 executing Task-7 encounters compilation error
├─ Agent catches error
├─ Reports: FAILED with error code 'COMPILATION_ERROR'
├─ Includes: Error message, file path, line number
├─ Suggests: "Check C++ code generation, verify includes"
├─ Updates task status in Conductor

Master workflow sees Task-7 failed:
├─ Option A: Halt entire swarm (for critical tasks)
│   └─ Human reviews error, decides next step
│
├─ Option B: Mark dependents as BLOCKED (not failed)
│   └─ Continue with independent tasks
│   └─ Task-8, Task-9 (depending on Task-7) marked BLOCKED
│
└─ Option C: Retry with alternative strategy
    └─ Agent-5 retries with debug logging
    └─ Or different agent type tries different approach

Final report shows:
├─ Task-7 FAILED (Compilation Error)
├─ Root cause: Missing #include <fastled.h>
├─ Dependent tasks: Task-8, Task-9 (BLOCKED)
├─ Human action needed: Review Task-7 error and rerun
```

---

## Part 8: Implementation Roadmap

### Phase 1: Foundation (Week 1)
- [ ] Define AgentContext and related types
- [ ] Implement `load_task_manifest` handler
- [ ] Implement `resolve_dependencies` handler
- [ ] Implement status reporting infrastructure
- [ ] Create Redis/Postgres schema for task results

### Phase 2: Master Workflow (Week 1-2)
- [ ] Register `k1_agent_swarm_master` workflow
- [ ] Implement `dispatch_to_agents` handler
- [ ] Implement `agent_completion_loop` handler
- [ ] Test with 5 mock agents

### Phase 3: Category Agents (Week 2-3)
- [ ] Implement SecurityAgent handler
- [ ] Implement CodeGenAgent handler
- [ ] Implement TestingAgent handler
- [ ] Implement ArchitectureAgent handler
- [ ] Implement DocumentationAgent handler

### Phase 4: Integration Testing (Week 3)
- [ ] E2E test with 22 real tasks
- [ ] Verify dependency blocking works
- [ ] Test failure handling
- [ ] Validate quality gates
- [ ] Measure execution time

### Phase 5: Execution & Iteration (Week 4+)
- [ ] Run full swarm execution
- [ ] Collect metrics and feedback
- [ ] Refine handlers based on results
- [ ] Iterate on quality gates

---

## Part 9: Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Agent pooling** | 20 concurrent agents | Parallel efficiency without resource exhaustion |
| **Dependency model** | Explicit graph with topological sort | Clear blocking semantics, easy to debug |
| **Status reporting** | Continuous + event-driven | Real-time visibility, fast unblocking |
| **Failure handling** | Block dependents, don't fail swarm | Maximize throughput, manual review for failures |
| **Coordination** | Redis pub/sub for events | Low latency, simple message passing |
| **Result storage** | Postgres for durability | Survives worker restarts, queryable |
| **Agent types** | Category-specific handlers | Domain expertise, clear responsibilities |

---

## Part 10: Success Criteria

**Swarm is "production ready" when:**

1. ✅ All 22 tasks execute without human intervention
2. ✅ Dependencies are respected (no premature execution)
3. ✅ Quality gates pass for all tasks
4. ✅ Execution time < 20 hours (with 20 parallel agents)
5. ✅ Failure recovery is semi-automatic (knows what to retry)
6. ✅ Dashboard shows real-time progress to human observers
7. ✅ Final report is comprehensive and actionable

---

**Next Step:** Proceed to Phase 1 implementation with AgentContext design + task manifest loader.
