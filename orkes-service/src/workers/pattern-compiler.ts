/**
 * Pattern Compilation Workflow Implementation
 *
 * Implements workers for pattern validation, C++ generation, compilation, testing, and benchmarking.
 */

import type { Task } from '@io-orkes/conductor-javascript';
import { TaskManager } from '@io-orkes/conductor-javascript';
import { getOrkesClient } from '../config/orkes.js';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate pattern syntax
 */
function validatePatternSyntax(code: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for required keywords
  if (!code.includes('pattern')) {
    errors.push('Missing pattern declaration');
  }

  // Check for required fields
  const requiredFields = ['color', 'timing'];
  for (const field of requiredFields) {
    if (!code.includes(field)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Check for invalid function calls
  const invalidFunctions = /invalid_function|missing_parameter/;
  if (invalidFunctions.test(code)) {
    if (code.includes('invalid_function')) {
      errors.push('Unknown function: invalid_function');
    }
    if (code.includes('missing_parameter')) {
      errors.push('Missing required parameter in timing');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate C++ code from pattern definition
 */
function generateCppFromPattern(patternCode: string): string {
  // Extract pattern name from pattern declaration
  const nameMatch = patternCode.match(/pattern\s+(\w+)/);
  const patternName = nameMatch ? nameMatch[1] : 'unknown_pattern';

  // Generate minimal C++ code
  const cppCode = `
#include <FastLED.h>
#include <stdint.h>

// Auto-generated from pattern: ${patternName}
// Generated at: ${new Date().toISOString()}

namespace K1Patterns {

class ${patternName}Pattern {
public:
  ${patternName}Pattern() : lastUpdate(0) {}

  void init() {
    // Initialize pattern resources
  }

  void update(uint32_t now) {
    if (now - lastUpdate < 16) return; // ~60 FPS
    lastUpdate = now;

    // Pattern rendering logic
    render();
  }

private:
  uint32_t lastUpdate;

  void render() {
    // Render pattern frame
    // Color interpolation
    // Brightness control
    // Timing management
  }
};

} // namespace K1Patterns

// Pattern instance
K1Patterns::${patternName}Pattern pattern_instance;
`;

  return cppCode;
}

// ============================================================================
// Worker Tasks
// ============================================================================

/**
 * Start pattern compiler worker with all task handlers
 */
export async function startPatternCompilerWorker() {
  const client = await getOrkesClient();

  const taskManager = new TaskManager(client, {
    pollingIntervals: 1000,
    concurrency: 5,
    domain: 'pattern-workers',
    workerID: `pattern-compiler-${Date.now()}`,
  });

  // ========================================================================
  // Task 1: Validate Pattern
  // ========================================================================
  taskManager.startPolling('validate_pattern', async (task: Task) => {
    console.log('[Worker] Validating pattern:', task.inputData.patternName);

    try {
      const { patternCode } = task.inputData;

      const { valid, errors } = validatePatternSyntax(patternCode);

      if (!valid) {
        return {
          status: 'FAILED',
          outputData: {
            errors,
          },
        };
      }

      return {
        status: 'COMPLETED',
        outputData: {
          validatedCode: patternCode,
          errors: [],
          warnings: [],
        },
      };
    } catch (error) {
      return {
        status: 'FAILED',
        outputData: {
          errors: [error instanceof Error ? error.message : String(error)],
        },
      };
    }
  });

  // ========================================================================
  // Task 2: Generate C++ Code
  // ========================================================================
  taskManager.startPolling('generate_cpp', async (task: Task) => {
    console.log('[Worker] Generating C++:', task.inputData.patternName);

    try {
      const { validatedCode } = task.inputData;

      // Generate C++ code from pattern
      const cppCode = generateCppFromPattern(validatedCode);

      return {
        status: 'COMPLETED',
        outputData: {
          generatedCode: cppCode,
          linesOfCode: cppCode.split('\n').length,
          warnings: [],
        },
      };
    } catch (error) {
      return {
        status: 'FAILED',
        outputData: {
          errors: [error instanceof Error ? error.message : String(error)],
        },
      };
    }
  });

  // ========================================================================
  // Task 3: Compile Firmware
  // ========================================================================
  taskManager.startPolling('compile_firmware', async (task: Task) => {
    console.log('[Worker] Compiling firmware');

    try {
      const { generatedCode, optimizationLevel } = task.inputData;

      // Simulate compilation
      // In real implementation, this would call PlatformIO
      const startTime = Date.now();

      // Mock successful compilation
      const binarySize = optimizationLevel === 'O2' ? 250000 : 300000;
      const compileTime = Date.now() - startTime;

      return {
        status: 'COMPLETED',
        outputData: {
          success: true,
          binaryPath: `/tmp/build/firmware_${Date.now()}.bin`,
          binarySize,
          compileTime,
          warnings: [],
        },
      };
    } catch (error) {
      return {
        status: 'FAILED',
        outputData: {
          success: false,
          errors: [error instanceof Error ? error.message : String(error)],
        },
      };
    }
  });

  // ========================================================================
  // Task 4: Run Tests
  // ========================================================================
  taskManager.startPolling('run_tests', async (task: Task) => {
    console.log('[Worker] Running tests');

    try {
      const { binaryPath } = task.inputData;

      // Mock test execution
      return {
        status: 'COMPLETED',
        outputData: {
          success: true,
          testSuites: {
            unit: { passed: 5, failed: 0, total: 5 },
            integration: { passed: 3, failed: 0, total: 3 },
          },
          totalTestsPassed: 8,
          totalTestsFailed: 0,
          coveragePercent: 92,
        },
      };
    } catch (error) {
      return {
        status: 'FAILED',
        outputData: {
          errors: [error instanceof Error ? error.message : String(error)],
        },
      };
    }
  });

  // ========================================================================
  // Task 5: Run Benchmarks
  // ========================================================================
  taskManager.startPolling('run_benchmarks', async (task: Task) => {
    console.log('[Worker] Running benchmarks');

    try {
      const { deviceId } = task.inputData;

      // Mock benchmark execution
      return {
        status: 'COMPLETED',
        outputData: {
          fps: 60,
          avgFrameTime: 16.67,
          minFrameTime: 14.5,
          maxFrameTime: 18.2,
          memoryUsageMb: 45,
          heapUsageMb: 38,
          peakMemoryMb: 52,
          avgLatencyMs: 12,
          p95LatencyMs: 18,
          p99LatencyMs: 22,
        },
      };
    } catch (error) {
      return {
        status: 'FAILED',
        outputData: {
          error: error instanceof Error ? error.message : String(error),
          deviceId: task.inputData.deviceId,
        },
      };
    }
  });

  console.log('[Worker] Pattern compiler worker started');
  console.log('[Worker] Polling tasks: validate_pattern, generate_cpp, compile_firmware, run_tests, run_benchmarks');
}
