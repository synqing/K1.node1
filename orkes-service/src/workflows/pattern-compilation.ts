/**
 * Pattern Compilation Workflow Definition
 *
 * Orchestrates: Pattern Design → C++ Generation → Compilation → Testing → Benchmarking → Iteration
 */

import type { ConductorClient, WorkflowDef } from '@io-orkes/conductor-javascript';
import type {
  PatternCompilationInput,
  PatternCompilationOutput,
  PatternTestInput,
  PatternTestOutput,
  PatternBenchmarkInput,
  PatternBenchmarkOutput,
} from '../types/workflows.js';

/**
 * Pattern Compilation Workflow
 *
 * Steps:
 * 1. Validate pattern code
 * 2. Generate C++ code from pattern graph
 * 3. Compile firmware with PlatformIO
 * 4. Run unit tests
 * 5. Deploy to test device
 * 6. Run benchmarks (FPS, memory, latency)
 * 7. Decision: Pass → Complete | Fail → Reiterate
 */
export const patternCompilationWorkflow: WorkflowDef = {
  name: 'k1_pattern_compilation',
  description: 'Compile, test, and benchmark LED pattern code',
  version: 1,
  tasks: [
    // Step 1: Validate pattern code syntax
    {
      name: 'validate_pattern',
      taskReferenceName: 'validate_pattern_ref',
      type: 'SIMPLE',
      inputParameters: {
        patternName: '${workflow.input.patternName}',
        patternCode: '${workflow.input.patternCode}',
      },
    },

    // Step 2: Generate C++ code
    {
      name: 'generate_cpp',
      taskReferenceName: 'generate_cpp_ref',
      type: 'SIMPLE',
      inputParameters: {
        patternCode: '${validate_pattern_ref.output.validatedCode}',
        targetDevice: '${workflow.input.targetDevice}',
      },
    },

    // Step 3: Compile firmware
    {
      name: 'compile_firmware',
      taskReferenceName: 'compile_firmware_ref',
      type: 'SIMPLE',
      inputParameters: {
        cppCode: '${generate_cpp_ref.output.generatedCode}',
        optimizationLevel: '${workflow.input.optimizationLevel}',
      },
    },

    // Step 4: Run unit tests
    {
      name: 'run_tests',
      taskReferenceName: 'run_tests_ref',
      type: 'SIMPLE',
      inputParameters: {
        binaryPath: '${compile_firmware_ref.output.binaryPath}',
        testSuites: ['unit', 'integration'],
      },
    },

    // Step 5: Decision - Continue if tests pass
    {
      name: 'check_tests',
      taskReferenceName: 'check_tests_ref',
      type: 'SWITCH',
      inputParameters: {
        testsPassed: '${run_tests_ref.output.success}',
      },
      decisionCases: {
        true: [
          // Step 6: Deploy to test device
          {
            name: 'deploy_to_device',
            taskReferenceName: 'deploy_to_device_ref',
            type: 'SIMPLE',
            inputParameters: {
              binaryPath: '${compile_firmware_ref.output.binaryPath}',
              deviceId: 'test-device-001',
            },
          },

          // Step 7: Run benchmarks
          {
            name: 'run_benchmarks',
            taskReferenceName: 'run_benchmarks_ref',
            type: 'SIMPLE',
            inputParameters: {
              deviceId: 'test-device-001',
              benchmarkType: 'all',
            },
          },

          // Step 8: Decision - Benchmark results acceptable?
          {
            name: 'check_benchmarks',
            taskReferenceName: 'check_benchmarks_ref',
            type: 'SWITCH',
            inputParameters: {
              fps: '${run_benchmarks_ref.output.fps}',
              memoryUsageMb: '${run_benchmarks_ref.output.memoryUsageMb}',
            },
            evaluatorType: 'javascript',
            expression: '$.fps >= 30 && $.memoryUsageMb < 100 ? "PASS" : "FAIL"',
            decisionCases: {
              PASS: [],
              FAIL: [
                {
                  name: 'suggest_optimizations',
                  taskReferenceName: 'suggest_optimizations_ref',
                  type: 'SIMPLE',
                  inputParameters: {
                    benchmarks: '${run_benchmarks_ref.output}',
                  },
                },
              ],
            },
          },
        ],
        false: [
          {
            name: 'analyze_test_failures',
            taskReferenceName: 'analyze_test_failures_ref',
            type: 'SIMPLE',
            inputParameters: {
              testResults: '${run_tests_ref.output}',
            },
          },
        ],
      },
    },
  ],
  outputParameters: {
    success: '${check_benchmarks_ref.output.status}',
    binaryPath: '${compile_firmware_ref.output.binaryPath}',
    testResults: '${run_tests_ref.output}',
    benchmarks: '${run_benchmarks_ref.output}',
    errors: '${analyze_test_failures_ref.output.errors}',
  },
  schemaVersion: 2,
  restartable: true,
  timeoutPolicy: 'ALERT_ONLY',
  timeoutSeconds: 1800, // 30 minutes
};

/**
 * Register pattern compilation workflow with Orkes
 */
export async function registerPatternCompilationWorkflow(client: ConductorClient): Promise<void> {
  try {
    await client.metadataResource.create(patternCompilationWorkflow, true);
    console.log('[Workflow] Registered: k1_pattern_compilation');
  } catch (error) {
    console.error('[Workflow] Failed to register pattern compilation workflow:', error);
    throw error;
  }
}
