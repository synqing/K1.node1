import { SliderRuntimeManager } from './slider-runtime-manager';
import { DynamicMotionSystem } from './motion-system';
import { RealTimeAdjustmentSystem } from './real-time-adjustment-system';

export interface TestCase {
  id: string;
  name: string;
  description: string;
  category: 'visual' | 'performance' | 'functionality' | 'integration';
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeout: number;
  setup?: () => Promise<void>;
  execute: () => Promise<TestResult>;
  cleanup?: () => Promise<void>;
  dependencies?: string[];
}

export interface TestResult {
  success: boolean;
  duration: number;
  error?: string;
  metrics?: Record<string, number>;
  warnings?: string[];
  details?: any;
}

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  tests: TestCase[];
  beforeAll?: () => Promise<void>;
  afterAll?: () => Promise<void>;
}

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  validate: (context: any) => Promise<ValidationResult>;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export interface ValidationResult {
  valid: boolean;
  message: string;
  details?: any;
  suggestions?: string[];
}

export class RuntimeTestingSystem {
  private testSuites = new Map<string, TestSuite>();
  private validationRules = new Map<string, ValidationRule>();
  private testResults = new Map<string, TestResult>();
  private isRunning = false;
  private currentTest?: string;

  constructor(
    private sliderManager: SliderRuntimeManager,
    private motionSystem: DynamicMotionSystem,
    private adjustmentSystem?: RealTimeAdjustmentSystem
  ) {
    this.initializeDefaultTests();
    this.initializeValidationRules();
  }

  private initializeDefaultTests() {
    // Visual consistency tests
    const visualTests: TestCase[] = [
      {
        id: 'slider-visual-consistency',
        name: 'Slider Visual Consistency',
        description: 'Verify all sliders maintain consistent visual appearance across different states',
        category: 'visual',
        priority: 'high',
        timeout: 5000,
        execute: async () => {
          const startTime = performance.now();
          const sliderIds = ['global-brightness', 'global-background', 'global-softness', 'global-warmth'];
          const inconsistencies: string[] = [];

          for (const id of sliderIds) {
            const config = this.sliderManager.getSliderConfig(id);
            if (!config) {
              inconsistencies.push(`Missing config for slider: ${id}`);
              continue;
            }

            // Check visual config consistency
            if (!config.visual.trackStyle) {
              inconsistencies.push(`Missing trackStyle for slider: ${id}`);
            }
            if (typeof config.visual.glowIntensity !== 'number') {
              inconsistencies.push(`Invalid glowIntensity for slider: ${id}`);
            }
          }

          return {
            success: inconsistencies.length === 0,
            duration: performance.now() - startTime,
            error: inconsistencies.length > 0 ? inconsistencies.join(', ') : undefined,
            details: { checkedSliders: sliderIds.length, inconsistencies },
          };
        },
      },
      {
        id: 'motion-smoothness',
        name: 'Motion Smoothness Test',
        description: 'Verify motion animations are smooth and performant',
        category: 'visual',
        priority: 'medium',
        timeout: 10000,
        execute: async () => {
          const startTime = performance.now();
          const testMotion = this.motionSystem.createSpringMotion('test-motion', 0, 'smooth');
          
          // Test motion from 0 to 100
          this.motionSystem.updateMotionTarget('test-motion', 100);
          
          // Wait for animation to complete
          await new Promise(resolve => {
            const checkComplete = () => {
              const state = this.motionSystem.getMotionState('test-motion');
              if (state && !state.isAnimating) {
                resolve(void 0);
              } else {
                setTimeout(checkComplete, 16);
              }
            };
            checkComplete();
          });

          const state = this.motionSystem.getMotionState('test-motion');
          const duration = performance.now() - startTime;

          return {
            success: state !== null && Math.abs(state.actualValue - 100) < 1,
            duration,
            metrics: {
              finalValue: state?.actualValue || 0,
              frameRate: state?.performanceMetrics.frameRate || 0,
              droppedFrames: state?.performanceMetrics.droppedFrames || 0,
            },
          };
        },
      },
    ];

    // Performance tests
    const performanceTests: TestCase[] = [
      {
        id: 'slider-update-latency',
        name: 'Slider Update Latency',
        description: 'Measure latency of slider value updates',
        category: 'performance',
        priority: 'high',
        timeout: 5000,
        execute: async () => {
          const startTime = performance.now();
          const latencies: number[] = [];

          // Test multiple rapid updates
          for (let i = 0; i < 10; i++) {
            const updateStart = performance.now();
            
            if (this.adjustmentSystem) {
              await this.adjustmentSystem.adjustParameter('brightness', Math.random(), {
                timeout: 1000,
              });
            }
            
            latencies.push(performance.now() - updateStart);
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
          const maxLatency = Math.max(...latencies);

          return {
            success: avgLatency < 500 && maxLatency < 1000,
            duration: performance.now() - startTime,
            metrics: {
              averageLatency: avgLatency,
              maxLatency,
              minLatency: Math.min(...latencies),
            },
            warnings: avgLatency > 300 ? ['Average latency is high'] : undefined,
          };
        },
      },
      {
        id: 'memory-usage-stability',
        name: 'Memory Usage Stability',
        description: 'Verify memory usage remains stable during extended operation',
        category: 'performance',
        priority: 'medium',
        timeout: 15000,
        execute: async () => {
          const startTime = performance.now();
          const initialMemory = this.getMemoryUsage();
          
          // Simulate extended usage
          for (let i = 0; i < 50; i++) {
            // Create and destroy motion instances
            const motionId = `test-motion-${i}`;
            this.motionSystem.registerMotion(motionId, Math.random() * 100);
            this.motionSystem.updateMotionTarget(motionId, Math.random() * 100);
            
            // Apply runtime modifications
            this.sliderManager.applyRuntimeModification('global-brightness', {
              id: `test-mod-${i}`,
              type: 'visual',
              config: { glowIntensity: Math.random() },
              duration: 100,
            });
            
            await new Promise(resolve => setTimeout(resolve, 50));
          }

          const finalMemory = this.getMemoryUsage();
          const memoryIncrease = finalMemory - initialMemory;

          return {
            success: memoryIncrease < 10, // Less than 10MB increase
            duration: performance.now() - startTime,
            metrics: {
              initialMemory,
              finalMemory,
              memoryIncrease,
            },
            warnings: memoryIncrease > 5 ? ['Memory usage increased significantly'] : undefined,
          };
        },
      },
    ];

    // Functionality tests
    const functionalityTests: TestCase[] = [
      {
        id: 'runtime-modification-application',
        name: 'Runtime Modification Application',
        description: 'Verify runtime modifications are applied correctly',
        category: 'functionality',
        priority: 'critical',
        timeout: 3000,
        execute: async () => {
          const startTime = performance.now();
          const sliderId = 'global-brightness';
          
          // Get initial config
          const initialConfig = this.sliderManager.getSliderConfig(sliderId);
          const initialGlow = initialConfig?.visual.glowIntensity || 0;

          // Apply modification
          const modificationId = 'test-glow-modification';
          const newGlowIntensity = 0.9;
          
          const applied = this.sliderManager.applyRuntimeModification(sliderId, {
            id: modificationId,
            type: 'visual',
            config: { glowIntensity: newGlowIntensity },
          });

          if (!applied) {
            return {
              success: false,
              duration: performance.now() - startTime,
              error: 'Failed to apply runtime modification',
            };
          }

          // Verify modification was applied
          const modifiedConfig = this.sliderManager.getSliderConfig(sliderId);
          const actualGlow = modifiedConfig?.visual.glowIntensity || 0;

          // Revert modification
          this.sliderManager.revertModification(sliderId, modificationId);
          
          // Verify reversion
          const revertedConfig = this.sliderManager.getSliderConfig(sliderId);
          const revertedGlow = revertedConfig?.visual.glowIntensity || 0;

          return {
            success: 
              Math.abs(actualGlow - newGlowIntensity) < 0.01 &&
              Math.abs(revertedGlow - initialGlow) < 0.01,
            duration: performance.now() - startTime,
            metrics: {
              initialGlow,
              modifiedGlow: actualGlow,
              revertedGlow,
            },
          };
        },
      },
      {
        id: 'error-recovery',
        name: 'Error Recovery Test',
        description: 'Verify system recovers gracefully from errors',
        category: 'functionality',
        priority: 'high',
        timeout: 5000,
        execute: async () => {
          const startTime = performance.now();
          const errors: string[] = [];
          let recoverySuccessful = false;

          try {
            // Simulate network error
            if (this.adjustmentSystem) {
              await this.adjustmentSystem.adjustParameter('brightness', 0.5, {
                timeout: 1, // Very short timeout to force error
                maxRetries: 1,
                onError: (error) => {
                  errors.push(error.message);
                },
              });
            }

            // Wait a bit for recovery mechanisms
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Try again with normal timeout
            if (this.adjustmentSystem) {
              await this.adjustmentSystem.adjustParameter('brightness', 0.5, {
                timeout: 3000,
                onSuccess: () => {
                  recoverySuccessful = true;
                },
              });
            }
          } catch (error) {
            errors.push((error as Error).message);
          }

          return {
            success: errors.length > 0 && recoverySuccessful,
            duration: performance.now() - startTime,
            details: {
              errorsEncountered: errors.length,
              recoverySuccessful,
              errors,
            },
          };
        },
      },
    ];

    // Register test suites
    this.registerTestSuite({
      id: 'visual-tests',
      name: 'Visual Tests',
      description: 'Tests for visual consistency and appearance',
      tests: visualTests,
    });

    this.registerTestSuite({
      id: 'performance-tests',
      name: 'Performance Tests',
      description: 'Tests for performance and resource usage',
      tests: performanceTests,
    });

    this.registerTestSuite({
      id: 'functionality-tests',
      name: 'Functionality Tests',
      description: 'Tests for core functionality and error handling',
      tests: functionalityTests,
    });
  }

  private initializeValidationRules() {
    const rules: ValidationRule[] = [
      {
        id: 'slider-config-completeness',
        name: 'Slider Configuration Completeness',
        description: 'Validates that all sliders have complete configuration',
        severity: 'error',
        validate: async (context: { sliderIds: string[] }) => {
          const incomplete: string[] = [];
          
          for (const id of context.sliderIds) {
            const config = this.sliderManager.getSliderConfig(id);
            if (!config) {
              incomplete.push(`${id}: missing config`);
              continue;
            }

            if (!config.visual.trackStyle) {
              incomplete.push(`${id}: missing trackStyle`);
            }
            if (typeof config.visual.glowIntensity !== 'number') {
              incomplete.push(`${id}: invalid glowIntensity`);
            }
            if (!config.behavior.debounceMs) {
              incomplete.push(`${id}: missing debounceMs`);
            }
          }

          return {
            valid: incomplete.length === 0,
            message: incomplete.length === 0 
              ? 'All slider configurations are complete'
              : `Incomplete configurations found: ${incomplete.join(', ')}`,
            details: { incomplete },
            suggestions: incomplete.length > 0 
              ? ['Ensure all sliders are properly registered with complete configurations']
              : undefined,
          };
        },
      },
      {
        id: 'performance-thresholds',
        name: 'Performance Thresholds',
        description: 'Validates that performance metrics are within acceptable ranges',
        severity: 'warning',
        validate: async (context: { metrics: Record<string, number> }) => {
          const violations: string[] = [];
          const { metrics } = context;

          if (metrics.averageLatency > 500) {
            violations.push(`High average latency: ${metrics.averageLatency}ms`);
          }
          if (metrics.frameRate < 30) {
            violations.push(`Low frame rate: ${metrics.frameRate}fps`);
          }
          if (metrics.memoryUsage > 100) {
            violations.push(`High memory usage: ${metrics.memoryUsage}MB`);
          }

          return {
            valid: violations.length === 0,
            message: violations.length === 0
              ? 'All performance metrics are within acceptable ranges'
              : `Performance issues detected: ${violations.join(', ')}`,
            details: { violations, metrics },
            suggestions: violations.length > 0
              ? [
                  'Consider reducing animation complexity',
                  'Enable performance mode for low-end devices',
                  'Optimize debounce settings',
                ]
              : undefined,
          };
        },
      },
    ];

    rules.forEach(rule => this.validationRules.set(rule.id, rule));
  }

  registerTestSuite(suite: TestSuite) {
    this.testSuites.set(suite.id, suite);
  }

  registerValidationRule(rule: ValidationRule) {
    this.validationRules.set(rule.id, rule);
  }

  async runTestSuite(suiteId: string): Promise<Map<string, TestResult>> {
    const suite = this.testSuites.get(suiteId);
    if (!suite) {
      throw new Error(`Test suite not found: ${suiteId}`);
    }

    if (this.isRunning) {
      throw new Error('Tests are already running');
    }

    this.isRunning = true;
    const results = new Map<string, TestResult>();

    try {
      // Run beforeAll hook
      if (suite.beforeAll) {
        await suite.beforeAll();
      }

      // Sort tests by priority
      const sortedTests = suite.tests.sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      // Run tests
      for (const test of sortedTests) {
        this.currentTest = test.id;
        
        try {
          // Setup
          if (test.setup) {
            await test.setup();
          }

          // Execute with timeout
          const result = await this.executeWithTimeout(test.execute, test.timeout);
          results.set(test.id, result);
          this.testResults.set(test.id, result);

          // Cleanup
          if (test.cleanup) {
            await test.cleanup();
          }
        } catch (error) {
          const result: TestResult = {
            success: false,
            duration: 0,
            error: (error as Error).message,
          };
          results.set(test.id, result);
          this.testResults.set(test.id, result);
        }
      }

      // Run afterAll hook
      if (suite.afterAll) {
        await suite.afterAll();
      }
    } finally {
      this.isRunning = false;
      this.currentTest = undefined;
    }

    return results;
  }

  async runAllTests(): Promise<Map<string, Map<string, TestResult>>> {
    const allResults = new Map<string, Map<string, TestResult>>();
    
    for (const [suiteId] of this.testSuites) {
      try {
        const results = await this.runTestSuite(suiteId);
        allResults.set(suiteId, results);
      } catch (error) {
        console.error(`Failed to run test suite ${suiteId}:`, error);
      }
    }

    return allResults;
  }

  async validateSystem(context: any = {}): Promise<Map<string, ValidationResult>> {
    const results = new Map<string, ValidationResult>();

    for (const [ruleId, rule] of this.validationRules) {
      try {
        const result = await rule.validate(context);
        results.set(ruleId, result);
      } catch (error) {
        results.set(ruleId, {
          valid: false,
          message: `Validation failed: ${(error as Error).message}`,
        });
      }
    }

    return results;
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Test timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private getMemoryUsage(): number {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in (window.performance as any)) {
      return (window.performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    return 0;
  }

  getTestResults(): Map<string, TestResult> {
    return new Map(this.testResults);
  }

  getTestSuites(): Map<string, TestSuite> {
    return new Map(this.testSuites);
  }

  isTestRunning(): boolean {
    return this.isRunning;
  }

  getCurrentTest(): string | undefined {
    return this.currentTest;
  }

  generateReport(): {
    summary: {
      totalTests: number;
      passed: number;
      failed: number;
      successRate: number;
    };
    details: Array<{
      testId: string;
      success: boolean;
      duration: number;
      error?: string;
    }>;
  } {
    const results = Array.from(this.testResults.values());
    const passed = results.filter(r => r.success).length;
    const failed = results.length - passed;

    return {
      summary: {
        totalTests: results.length,
        passed,
        failed,
        successRate: results.length > 0 ? (passed / results.length) * 100 : 0,
      },
      details: Array.from(this.testResults.entries()).map(([testId, result]) => ({
        testId,
        success: result.success,
        duration: result.duration,
        error: result.error,
      })),
    };
  }
}

// Factory function
export function createRuntimeTestingSystem(
  sliderManager: SliderRuntimeManager,
  motionSystem: DynamicMotionSystem,
  adjustmentSystem?: RealTimeAdjustmentSystem
): RuntimeTestingSystem {
  return new RuntimeTestingSystem(sliderManager, motionSystem, adjustmentSystem);
}