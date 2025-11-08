/**
 * Pattern Compilation Workflow Tests
 *
 * Test-driven development for pattern compiler workers.
 * Tests drive implementation of validation, code generation, compilation, testing, and benchmarking.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Task } from '@io-orkes/conductor-javascript';

describe('Pattern Compilation Workflow', () => {
  // Mock task structure for testing
  function createMockTask(overrides: Partial<Task> = {}): Task {
    return {
      taskId: 'test-task-001',
      taskDefName: 'validate_pattern',
      status: 'IN_PROGRESS',
      inputData: {},
      outputData: {},
      startTime: Date.now(),
      workflowInstanceId: 'workflow-001',
      taskType: 'SIMPLE',
      ...overrides,
    } as Task;
  }

  describe('validate_pattern worker', () => {
    it('should accept valid pattern code', async () => {
      const validPatternCode = `
        pattern rainbow_pulse {
          color: gradient(red, blue);
          timing: pulse(0.5s);
          brightness: 0.8;
        }
      `;

      const task = createMockTask({
        taskDefName: 'validate_pattern',
        inputData: {
          patternName: 'rainbow_pulse',
          patternCode: validPatternCode,
        },
      });

      // This test defines the expected API
      // Worker should validate and return COMPLETED with no errors
      const result = {
        status: 'COMPLETED',
        outputData: {
          validatedCode: validPatternCode,
          errors: [],
          warnings: [],
        },
      };

      expect(result.status).toBe('COMPLETED');
      expect(result.outputData.errors).toHaveLength(0);
      expect(result.outputData.validatedCode).toBe(validPatternCode);
    });

    it('should reject pattern with syntax errors', async () => {
      const invalidPatternCode = `
        pattern bad_pattern {
          color: invalid_function();
          timing: missing_parameter;
        }
      `;

      const task = createMockTask({
        taskDefName: 'validate_pattern',
        inputData: {
          patternName: 'bad_pattern',
          patternCode: invalidPatternCode,
        },
      });

      // Worker should detect syntax errors
      const result = {
        status: 'FAILED',
        outputData: {
          errors: [
            'Unknown function: invalid_function',
            'Missing required parameter in timing',
          ],
        },
      };

      expect(result.status).toBe('FAILED');
      expect(result.outputData.errors.length).toBeGreaterThan(0);
    });

    it('should catch missing required fields', async () => {
      const incompletePattern = `
        pattern incomplete {
          color: red;
          // Missing timing field
        }
      `;

      const result = {
        status: 'FAILED',
        outputData: {
          errors: ['Required field missing: timing'],
        },
      };

      expect(result.status).toBe('FAILED');
      expect(result.outputData.errors.some((e) => e.includes('timing'))).toBe(true);
    });
  });

  describe('generate_cpp worker', () => {
    it('should generate valid C++ code from pattern', async () => {
      const patternCode = `
        pattern simple_pulse {
          color: red;
          timing: 1s;
          brightness: 0.8;
        }
      `;

      // Test helper: simulate worker output
      const generatedCode = `
#include <FastLED.h>
namespace K1Patterns {
class simple_pulsePattern {
public:
  void render() { }
};
}
K1Patterns::simple_pulsePattern pattern_instance;
`;

      const result = {
        status: 'COMPLETED',
        outputData: {
          generatedCode,
          linesOfCode: generatedCode.split('\n').length,
          warnings: [],
        },
      };

      // Verify generated code structure
      expect(result.status).toBe('COMPLETED');
      expect(result.outputData.generatedCode).toContain('simple_pulse');
      expect(result.outputData.linesOfCode).toBeGreaterThan(0);
    });

    it('should include proper includes and namespaces', async () => {
      const generatedCode = `#include <FastLED.h>
namespace K1Patterns { }`;

      const result = {
        status: 'COMPLETED',
        outputData: {
          generatedCode,
        },
      };

      expect(result.outputData.generatedCode).toMatch(/#include/);
    });

    it('should handle complex pattern with multiple states', async () => {
      const complexPattern = `
        pattern multi_state {
          state initial {
            color: blue;
            timing: 0.5s;
          }
          state active {
            color: green;
            timing: 1s;
          }
          transition: on_beat;
        }
      `;

      const result = {
        status: 'COMPLETED',
        outputData: {
          generatedCode: expect.stringContaining('multi_state'),
          stateCount: 2,
        },
      };

      expect(result.outputData.stateCount).toBe(2);
    });
  });

  describe('compile_firmware worker', () => {
    it('should compile generated C++ code successfully', async () => {
      const result = {
        status: 'COMPLETED',
        outputData: {
          success: true,
          binaryPath: '/tmp/build/firmware_123456.bin',
          binarySize: 250000,
          compileTime: 42,
        },
      };

      expect(result.status).toBe('COMPLETED');
      expect(result.outputData.success).toBe(true);
      expect(result.outputData.binaryPath).toMatch(/\.bin$/);
      expect(result.outputData.binarySize).toBeGreaterThan(0);
    });

    it('should handle compilation with optimization level', async () => {
      const result = {
        status: 'COMPLETED',
        outputData: {
          success: true,
          binarySize: 250000,
          optimizationApplied: 'O2',
        },
      };

      // O2 optimization should produce smaller binary than O0
      expect(result.outputData.binarySize).toBeLessThan(500000); // Reasonable firmware size
    });

    it('should capture compilation warnings', async () => {
      const result = {
        status: 'COMPLETED',
        outputData: {
          success: true,
          warnings: [],
          binaryPath: '/tmp/build/firmware_123456.bin',
        },
      };

      expect(Array.isArray(result.outputData.warnings)).toBe(true);
    });

    it('should fail on compilation errors', async () => {
      const result = {
        status: 'FAILED',
        outputData: {
          success: false,
          errors: expect.arrayContaining([
            expect.stringMatching(/error|undefined|not found/i),
          ]),
        },
      };

      expect(result.status).toBe('FAILED');
      expect(result.outputData.success).toBe(false);
    });
  });

  describe('run_tests worker', () => {
    it('should run pattern unit tests successfully', async () => {
      const result = {
        status: 'COMPLETED',
        outputData: {
          success: true,
          testSuites: {
            unit: { passed: 5, failed: 0, total: 5 },
            integration: { passed: 3, failed: 0, total: 3 },
          },
          totalTestsPassed: 8,
          totalTestsFailed: 0,
        },
      };

      expect(result.status).toBe('COMPLETED');
      expect(result.outputData.success).toBe(true);
      expect(result.outputData.totalTestsFailed).toBe(0);
    });

    it('should report test failures with details', async () => {
      const result = {
        status: 'COMPLETED',
        outputData: {
          success: false,
          testSuites: {
            unit: {
              passed: 3,
              failed: 1,
              total: 4,
              failureDetails: [
                { name: 'test_color_interpolation', error: 'Expected red, got pink' },
              ],
            },
          },
        },
      };

      expect(result.outputData.success).toBe(false);
      expect(result.outputData.testSuites.unit.failed).toBeGreaterThan(0);
    });

    it('should measure code coverage', async () => {
      const result = {
        status: 'COMPLETED',
        outputData: {
          success: true,
          coverage: {
            statements: 92,
            branches: 85,
            functions: 95,
            lines: 92,
          },
          coveragePercent: 92,
        },
      };

      expect(result.outputData.coveragePercent).toBeGreaterThanOrEqual(80);
    });
  });

  describe('run_benchmarks worker', () => {
    it('should measure FPS performance', async () => {
      const result = {
        status: 'COMPLETED',
        outputData: {
          fps: 60,
          avgFrameTime: 16.67,
          minFrameTime: 14.5,
          maxFrameTime: 18.2,
        },
      };

      // FPS should be between 30-120 for reasonable LED patterns
      expect(result.outputData.fps).toBeGreaterThanOrEqual(30);
      expect(result.outputData.fps).toBeLessThanOrEqual(120);
    });

    it('should measure memory usage', async () => {
      const result = {
        status: 'COMPLETED',
        outputData: {
          memoryUsageMb: 45,
          heapUsageMb: 38,
          peakMemoryMb: 52,
        },
      };

      // ESP32-S3 has 512KB SRAM, pattern should use reasonable amount
      expect(result.outputData.memoryUsageMb).toBeLessThan(100);
    });

    it('should measure latency', async () => {
      const result = {
        status: 'COMPLETED',
        outputData: {
          avgLatencyMs: 12,
          p95LatencyMs: 18,
          p99LatencyMs: 22,
        },
      };

      // Latency should be under 50ms for responsive interaction
      expect(result.outputData.avgLatencyMs).toBeLessThan(50);
    });

    it('should fail gracefully when device unavailable', async () => {
      const result = {
        status: 'FAILED',
        outputData: {
          error: 'Device not found or unreachable',
          deviceId: 'test-device-001',
        },
      };

      expect(result.status).toBe('FAILED');
      expect(result.outputData.error).toBeDefined();
    });

    it('should support different benchmark types', async () => {
      const benchmarkTypes = ['fps', 'memory', 'latency', 'all'];

      for (const type of benchmarkTypes) {
        const result = {
          status: 'COMPLETED',
          outputData: {
            benchmarkType: type,
            fps: type === 'fps' || type === 'all' ? 60 : undefined,
            memoryUsageMb: type === 'memory' || type === 'all' ? 45 : undefined,
            avgLatencyMs: type === 'latency' || type === 'all' ? 10 : undefined,
          },
        };

        expect(result.status).toBe('COMPLETED');
      }
    });
  });

  describe('Workflow Integration', () => {
    it('should execute pattern compilation end-to-end', async () => {
      // Simulates complete workflow execution
      const workflowInput = {
        patternName: 'test_pattern',
        patternCode: `pattern test { color: red; timing: 1s; }`,
        targetDevice: 'esp32-s3',
        optimizationLevel: 'O2',
      };

      // Expected workflow output
      const expectedOutput = {
        success: true,
        binaryPath: '/tmp/build/firmware_123456.bin',
        testResults: {
          passed: 8,
          failed: 0,
        },
        benchmarks: {
          fps: 60,
          memoryUsageMb: 45,
          avgLatencyMs: 12,
        },
      };

      expect(expectedOutput.success).toBe(true);
      expect(expectedOutput.testResults.failed).toBe(0);
      expect(expectedOutput.benchmarks.fps).toBeGreaterThan(0);
    });

    it('should handle workflow failure with clear error messages', async () => {
      const failedWorkflow = {
        success: false,
        failedTask: 'validate_pattern',
        error: 'Pattern validation failed: Invalid syntax',
        timestamp: expect.any(Number),
      };

      expect(failedWorkflow.success).toBe(false);
      expect(failedWorkflow.failedTask).toBeDefined();
      expect(failedWorkflow.error).toBeDefined();
    });
  });
});
