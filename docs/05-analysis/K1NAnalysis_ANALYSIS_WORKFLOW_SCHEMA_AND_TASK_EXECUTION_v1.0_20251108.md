# Workflow Schema & Task Execution Analysis
**K1.node1 Pattern Compilation to Real Task Management**

**Date:** November 8, 2025
**Status:** Draft Analysis
**Scope:** Gap analysis between current mock workflows and 22 real development tasks
**Owner:** Claude Agent (Haiku 4.5)

---

## Executive Summary

The current Orkes workflow implementation handles **pattern compilation only** (mock/simulated tasks). The project has **22 real development tasks** spanning security, audio, architecture, code generation, testing, and documentation—none of which are executable through the current workflow system.

**Key Findings:**
1. ✅ **Infrastructure exists**: Worker pattern, task handlers, REST API
2. ❌ **Coverage gap**: No workflows for 95% of real tasks
3. ❌ **Schema mismatch**: Type system doesn't reflect real task structure (subtasks, dependencies, testStrategy)
4. ❌ **Worker implementations missing**: 21 task types have no handlers
5. ❌ **Validation strategy absent**: No quality gates or execution constraints

**Recommendation:** Implement 5 meta-workflows covering task categories + refactor schema to support real task dependency graphs.

---

## Part 1: Current State Analysis

### 1.1 Existing Pattern Compilation Workflow

**File:** `orkes-service/src/workflows/pattern-compilation.ts`

**Coverage:** Handles ONLY LED pattern → C++ → Firmware pipeline
- ✅ Validate pattern syntax
- ✅ Generate C++ from pattern DSL
- ✅ Compile firmware (PlatformIO)
- ✅ Run unit tests
- ✅ Deploy to test device
- ✅ Benchmark performance

**Implementation:**
- 6 task handlers in `pattern-compiler.ts` (lines 112-374)
- Mock implementations for development
- Output parameters: `success`, `binaryPath`, `testResults`, `benchmarks`, `errors`
- Timeout: 30 minutes
- Polling interval: 1000ms, concurrency: 5 tasks

### 1.2 Task Execution Infrastructure

**Location:** `orkes-service/src/workers/pattern-compiler.ts`

**Worker Pattern:**
```
Orkes Cloud (external) ← polls every 1000ms ← TaskManager (node process)
     ↓
task.inputData → handler → { status, outputData } → Orkes Cloud
```

**Example Handler (validate_pattern):**
```typescript
async function handleValidatePattern(task: any): Promise<void> {
  const { patternCode, patternName } = task.inputData;

  try {
    const result = validatePatternSyntax(patternCode); // Real validation

    task.status = 'COMPLETED';
    task.outputData = {
      validatedCode: patternCode,
      errors: result.errors,
      warnings: result.warnings,
    };
  } catch (error) {
    task.status = 'FAILED';
    task.outputData = { errors: [error.message] };
  }
}
```

**Constraints:**
- Task handlers must complete within worker poll timeout
- Input/output via `task.inputData` and `task.outputData`
- Status must be `'COMPLETED'` or `'FAILED'`
- No built-in retry logic at task level (only workflow level)

---

## Part 2: Real Task Requirements Analysis

### 2.1 Task Inventory (22 Total)

**Security Tasks (3):**
1. Remove WiFi Credentials (5 subtasks, HIGH priority)
2. Fix I2S Audio Timeout (N/A subtasks)
3. Implement WebServer Buffer Bounds Checking (N/A subtasks)

**Architecture & Design (5):**
4. Create Comprehensive Error Code Registry
5. Create ADR for Code Generation Architecture
6. Design Graph System Architecture and Compiler
7. Implement Bloom Pattern Graph Conversion PoC
8. Implement Spectrum Pattern Graph Conversion PoC

**Code Generation & Patterns (7):**
9. Implement Stateful Node System
10. Extend Code Generation for Full Node Type Support
11. Migrate High-Value Patterns to Graph System
12. Implement Webapp Graph Editor UI
13. Create SDK Documentation and Templates
14. Implement Parameter Editor for SDK Patterns
15. Firmware Enhancements

**Testing & Validation (5):**
16. Conduct Graph System Memory and Performance Profiling
17. Conduct Hardware Validation Testing
18. Execute Stress Testing and Stability Validation
19. Perform Code Quality and Coverage Review
20. Decision Gate Validation and Path Selection
21. Execute Graph System Integration Testing

**Other (2):**
22. Webapp Fixes

### 2.2 Real Task Structure

**From tasks.json analysis:**

```json
{
  "id": 1,
  "title": "Remove WiFi Credentials from Firmware Source Code",
  "description": "...",
  "status": "pending",
  "priority": "high",
  "dependencies": [],
  "testStrategy": "Static analysis scan using grep/ripgrep to verify...",
  "subtasks": [
    {
      "id": 1,
      "title": "Audit and remove all hardcoded WiFi credentials",
      "description": "...",
      "dependencies": [],
      "details": "Using grep/ripgrep analysis, identified...",
      "status": "pending",
      "testStrategy": "Static analysis using ripgrep patterns..."
    },
    {
      "id": 2,
      "title": "Implement certificate-based WiFi provisioning",
      "description": "...",
      "dependencies": [1],  // ← DEPENDS ON SUBTASK 1
      "details": "Build upon existing...",
      "status": "pending",
      "testStrategy": "Certificate validation testing..."
    }
    // ... more subtasks
  ]
}
```

**Key Characteristics:**
- Multi-level hierarchy: Master task → Subtasks (up to 5 levels deep)
- Explicit dependencies between subtasks
- Test strategy defined at both task and subtask level
- Details field contains implementation context and file paths
- Status tracking at multiple levels

---

## Part 3: Schema Gap Analysis

### 3.1 Current Type System
**File:** `orkes-service/src/types/workflows.ts`

**Defined Types:**
- ✅ `PatternCompilationInput/Output`
- ✅ `PatternTestInput/Output`
- ✅ `PatternBenchmarkInput/Output`
- ✅ `AudioAssetInput/Output`
- ✅ `PresetGenerationInput/Output`
- ✅ `BuildInput/Output`
- ✅ `DeploymentInput/Output`
- ✅ `TelemetryCollectionInput/Output`
- ✅ `AnalyticsReportInput/Output`
- ✅ `WorkflowExecutionRequest/Response`
- ✅ `WorkflowStatusResponse`

**Missing Types:**
- ❌ Generic task execution (master task + subtasks)
- ❌ Dependency graph representation
- ❌ Test strategy specification
- ❌ Task progress tracking (subtask level)
- ❌ Validation gate definitions
- ❌ Quality metrics schema

### 3.2 Proposed Schema Additions

**New Base Types:**

```typescript
// Task dependency and execution types
export interface TaskDependency {
  taskId: number;
  subtaskId?: number;
  type: 'BLOCKS' | 'REQUIRES_OUTPUT'; // Blocking vs data dependency
}

export interface SubtaskDefinition {
  id: number;
  title: string;
  description: string;
  details: string;
  dependencies: number[]; // subtask IDs
  testStrategy: string;
  expectedOutputs?: string[]; // File names, code artifacts
}

export interface MasterTaskDefinition {
  id: number;
  title: string;
  description: string;
  category: 'security' | 'architecture' | 'codegen' | 'testing' | 'documentation' | 'bug-fix';
  priority: 'low' | 'medium' | 'high' | 'critical';
  dependencies: TaskDependency[];
  subtasks: SubtaskDefinition[];
  testStrategy: string;
  estimatedHours?: number;
  context?: Record<string, string>; // File paths, build files, etc
}

export interface TaskExecutionInput {
  taskId: number;
  subtaskId?: number;
  context: Record<string, any>; // Git commit, branch, environment
  skipValidation?: boolean;
}

export interface TaskExecutionOutput {
  taskId: number;
  subtaskId?: number;
  success: boolean;
  status: 'COMPLETED' | 'FAILED' | 'BLOCKED' | 'SKIPPED';
  artifacts: Array<{
    type: 'code' | 'test' | 'report' | 'build';
    path: string;
    checksum?: string;
  }>;
  metrics?: {
    linesChanged?: number;
    testsAdded?: number;
    coverageIncrease?: number;
    performanceImpact?: number;
  };
  errors?: string[];
  nextSubtasks?: number[]; // Which subtasks can now execute
}

export interface QualityGate {
  name: string;
  metric: 'coverage' | 'performance' | 'security' | 'quality';
  threshold: number;
  operator: 'gte' | 'lte' | 'eq';
  required: boolean; // Blocks if fails
}

export interface ValidationStrategy {
  staticAnalysis: {
    tools: string[]; // 'ripgrep', 'tsc', 'eslint'
    patterns?: string[];
  };
  unitTests: {
    framework: string;
    minCoverage: number;
  };
  integrationTests?: {
    fixtures: string[];
    timeout: number;
  };
  qualityGates: QualityGate[];
}
```

---

## Part 4: Workflow Design

### 4.1 Meta-Workflow Architecture

Instead of 1 workflow per task, implement 5 meta-workflows that handle task categories:

**1. Security Task Workflow** (`k1_security_tasks`)
- Subtasks: Code audit → Fix implementation → Security validation → Testing
- Example: WiFi credentials removal
- Handlers: Static analysis, code patching, security scanning

**2. Architecture & Design Workflow** (`k1_architecture_tasks`)
- Subtasks: Research → Design document → ADR creation → Team review
- Example: Code generation architecture ADR
- Handlers: Documentation, ADR templates, review routing

**3. Code Generation & Implementation Workflow** (`k1_codegen_tasks`)
- Subtasks: Design → Code generation → Unit tests → Integration tests → Benchmarking
- Example: Pattern graph conversion PoC
- Handlers: Code generation, compilation, testing, profiling

**4. Testing & Validation Workflow** (`k1_testing_tasks`)
- Subtasks: Test setup → Run tests → Analyze results → Generate report
- Example: Stress testing and stability validation
- Handlers: Test execution, analysis, reporting

**5. Documentation Workflow** (`k1_documentation_tasks`)
- Subtasks: Content creation → Examples → Review → Publishing
- Example: SDK documentation
- Handlers: Markdown generation, code examples, validation

### 4.2 Example: Security Task Workflow Definition

```typescript
export const securityTaskWorkflow: WorkflowDef = {
  name: 'k1_security_tasks',
  description: 'Execute security-focused development tasks',
  version: 1,
  tasks: [
    // Step 1: Load task definition and context
    {
      name: 'load_task_context',
      taskReferenceName: 'load_task_context_ref',
      type: 'SIMPLE',
      inputParameters: {
        taskId: '${workflow.input.taskId}',
        subtaskId: '${workflow.input.subtaskId}',
      },
    },

    // Step 2: Run static analysis (audit)
    {
      name: 'static_analysis_audit',
      taskReferenceName: 'audit_ref',
      type: 'SIMPLE',
      inputParameters: {
        taskContext: '${load_task_context_ref.output.context}',
        searchPatterns: '${load_task_context_ref.output.searchPatterns}',
        scanPath: '${load_task_context_ref.output.scanPath}',
      },
    },

    // Step 3: Decision - Issues found?
    {
      name: 'check_audit_results',
      taskReferenceName: 'check_audit_ref',
      type: 'SWITCH',
      inputParameters: {
        issuesFound: '${audit_ref.output.issuesCount > 0}',
      },
      evaluatorType: 'javascript',
      expression: '$.issuesFound ? "HAS_ISSUES" : "CLEAN"',
      decisionCases: {
        HAS_ISSUES: [
          // Step 4a: Implement fix
          {
            name: 'implement_fix',
            taskReferenceName: 'fix_ref',
            type: 'SIMPLE',
            inputParameters: {
              taskContext: '${load_task_context_ref.output.context}',
              issues: '${audit_ref.output.issues}',
              fixStrategy: '${load_task_context_ref.output.fixStrategy}',
            },
          },

          // Step 5a: Verify fix
          {
            name: 'verify_fix',
            taskReferenceName: 'verify_fix_ref',
            type: 'SIMPLE',
            inputParameters: {
              patchPath: '${fix_ref.output.patchPath}',
              buildCommand: '${load_task_context_ref.output.buildCommand}',
            },
          },
        ],
        CLEAN: [
          {
            name: 'skip_fix',
            taskReferenceName: 'skip_ref',
            type: 'SIMPLE',
            inputParameters: {
              reason: 'No issues found in audit',
            },
          },
        ],
      },
    },

    // Step 6: Run security tests
    {
      name: 'run_security_tests',
      taskReferenceName: 'security_tests_ref',
      type: 'SIMPLE',
      inputParameters: {
        taskContext: '${load_task_context_ref.output.context}',
        testStrategy: '${load_task_context_ref.output.testStrategy}',
      },
    },

    // Step 7: Check quality gates
    {
      name: 'validate_quality_gates',
      taskReferenceName: 'quality_gates_ref',
      type: 'SIMPLE',
      inputParameters: {
        auditResults: '${audit_ref.output}',
        testResults: '${security_tests_ref.output}',
        gates: '${load_task_context_ref.output.qualityGates}',
      },
    },

    // Step 8: Final decision
    {
      name: 'check_final_validation',
      taskReferenceName: 'final_check_ref',
      type: 'SWITCH',
      inputParameters: {
        allGatesPassed: '${quality_gates_ref.output.allPassed}',
      },
      evaluatorType: 'javascript',
      expression: '$.allGatesPassed ? "PASS" : "FAIL"',
      decisionCases: {
        PASS: [
          {
            name: 'mark_complete',
            taskReferenceName: 'mark_complete_ref',
            type: 'SIMPLE',
            inputParameters: {
              taskId: '${workflow.input.taskId}',
              subtaskId: '${workflow.input.subtaskId}',
              status: 'COMPLETED',
            },
          },
        ],
        FAIL: [
          {
            name: 'report_failure',
            taskReferenceName: 'report_failure_ref',
            type: 'SIMPLE',
            inputParameters: {
              taskId: '${workflow.input.taskId}',
              errors: '${quality_gates_ref.output.failures}',
            },
          },
        ],
      },
    },
  ],
  outputParameters: {
    success: '${quality_gates_ref.output.allPassed}',
    artifacts: '${fix_ref.output.artifacts}',
    testResults: '${security_tests_ref.output}',
    qualityMetrics: '${quality_gates_ref.output.metrics}',
  },
  timeoutSeconds: 3600, // 1 hour for security tasks
};
```

---

## Part 5: Required Worker Implementations

### 5.1 New Task Handlers Needed

**Security Workers:**
- `audit_code` - Static analysis (ripgrep patterns)
- `implement_security_fix` - Code patching with verification
- `security_validation` - Certificate, encryption, auth testing

**Architecture Workers:**
- `create_adr` - Architecture Decision Record generation
- `design_review` - Design validation against patterns
- `research_task` - Information gathering and synthesis

**Code Generation Workers:**
- `generate_cpp_from_graph` - Pattern graph → C++ code
- `compile_with_options` - PlatformIO with custom flags
- `profile_performance` - Memory/FPS/latency benchmarks
- `graph_conversion_poc` - Proof-of-concept implementations

**Testing Workers:**
- `run_stress_tests` - Sustained load testing
- `hardware_validation` - Physical device testing
- `code_coverage_report` - Coverage analysis
- `test_result_aggregation` - Multi-suite result synthesis

**Documentation Workers:**
- `generate_documentation` - From code and templates
- `validate_examples` - Test code samples
- `publish_docs` - Generate HTML/PDF from Markdown

### 5.2 Example Handler: Static Code Audit

```typescript
export async function handleAuditCode(task: any): Promise<void> {
  const { taskContext, searchPatterns, scanPath } = task.inputData;

  try {
    const issues: any[] = [];

    // For WiFi credentials task, search for WIFI_SSID, WIFI_PASS patterns
    for (const pattern of searchPatterns) {
      const command = `rg "${pattern}" "${scanPath}" -n --color=never`;
      const result = execSync(command, { encoding: 'utf-8' });

      if (result) {
        result.split('\n').forEach(line => {
          if (line.trim()) {
            const [file, lineNum, content] = line.split(':');
            issues.push({
              file,
              lineNum: parseInt(lineNum),
              pattern,
              content: content.trim(),
              severity: 'high',
            });
          }
        });
      }
    }

    task.status = 'COMPLETED';
    task.outputData = {
      issuesCount: issues.length,
      issues,
      scanPath,
      searchPatterns,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    task.status = 'FAILED';
    task.outputData = {
      error: error instanceof Error ? error.message : String(error),
      issuesCount: -1,
    };
  }
}
```

---

## Part 6: Validation Strategy & Quality Gates

### 6.1 Quality Gate Definitions by Task Category

**Security Tasks:**
- Gate 1: No hardcoded credentials in source (required)
- Gate 2: Security audit passing (required)
- Gate 3: Build succeeds without warnings (required)
- Gate 4: Unit tests passing (required)
- Gate 5: Code coverage ≥ 90% (required)

**Architecture Tasks:**
- Gate 1: ADR follows template (required)
- Gate 2: All alternatives documented (required)
- Gate 3: Team review approval (required)
- Gate 4: Backwards compatibility analysis (required)

**Code Generation Tasks:**
- Gate 1: Code compiles without warnings (required)
- Gate 2: Tests passing (required)
- Gate 3: Code coverage ≥ 95% (required)
- Gate 4: Performance benchmarks within targets (required)
- Gate 5: Binary size < 500KB (required for firmware)

**Testing Tasks:**
- Gate 1: All subtests passing (required)
- Gate 2: No timeout failures (required)
- Gate 3: Results reproducible (3+ runs) (required)
- Gate 4: No memory leaks detected (required)

### 6.2 Execution Constraints

**Dependency Blocking:**
- Subtask N cannot start until all its dependencies (subtask N-1) complete successfully
- If a subtask fails, dependent subtasks marked BLOCKED

**Timeout Rules:**
- Security audits: 10 minutes
- Code generation: 20 minutes
- Testing: 60 minutes
- Documentation: 30 minutes
- Architecture/Design: 120 minutes

**Resource Allocation:**
- Max 2 concurrent security tasks (serial code modifications)
- Max 5 concurrent code generation tasks
- Max 3 concurrent test suites
- 1 architecture task at a time (consensus needed)

---

## Part 7: Execution Roadmap

### Phase 1: Schema & Infrastructure (Week 1)
- [ ] Refactor `types/workflows.ts` with new schema
- [ ] Add `tasks/index.ts` to load and query tasks.json
- [ ] Implement task dependency resolver
- [ ] Add quality gate validation service

### Phase 2: Core Workflows (Week 2)
- [ ] Implement 5 meta-workflows (security, architecture, codegen, testing, docs)
- [ ] Register workflows with Orkes
- [ ] Add workflow routes to REST API

### Phase 3: Worker Implementations (Week 2-3)
- [ ] Implement 15+ task handlers
- [ ] Add mock implementations for device-dependent tasks
- [ ] Write unit tests for each handler

### Phase 4: Integration & Testing (Week 3)
- [ ] E2E test workflow execution
- [ ] Validate quality gate enforcement
- [ ] Test dependency blocking
- [ ] Performance profiling (throughput, latency)

### Phase 5: Execution & Iteration (Week 4+)
- [ ] Execute first real task via workflow
- [ ] Collect metrics and feedback
- [ ] Refine handlers based on results

---

## Part 8: Risk Assessment & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| Task handler timeouts | Workflow stuck | Medium | Add bounded timeouts, implement early failure |
| Dependency deadlock | Tasks never complete | Low | Topological sort validation, circular dep detection |
| External service failures (Orkes) | Tasks unreachable | Low | Local mock mode, health checks |
| Code generation errors | Invalid output artifacts | Medium | Validation gate after generation, test compilation |
| Flaky tests | False negatives | Medium | 3-run validation, increased timeout |
| Device unavailability | Hardware tests fail | High | Mock device simulation, CI environment |

---

## Part 9: Recommendations

### Immediate (This Week)
1. ✅ Create task loading service from tasks.json
2. ✅ Refactor types to support task dependencies and validation
3. ✅ Implement 5 meta-workflows (don't try to do 22 individual ones)
4. ✅ Build task handler for static code analysis (reusable)

### Short Term (Week 2-3)
1. Implement 3-5 high-priority task handlers (security focus)
2. Build quality gate validation framework
3. Execute first real task end-to-end
4. Document results and lessons learned

### Medium Term (Week 4+)
1. Implement remaining task handlers
2. Build task scheduling and parallel execution
3. Create task result analytics and reporting
4. Integrate with version control (auto-PRs, branches)

---

## References

- **Tasks:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/.taskmaster/tasks/tasks.json`
- **Current Workflows:** `orkes-service/src/workflows/`
- **Worker Implementation:** `orkes-service/src/workers/pattern-compiler.ts`
- **Types:** `orkes-service/src/types/workflows.ts`
- **CLAUDE.md:** Architecture operations manual
- **Patterns Used:** Clean Architecture, Hexagonal (Ports/Adapters), Task Dependency Graph

---

**Next Step:** Proceed to Phase 1 implementation with schema refactoring + meta-workflow design.
