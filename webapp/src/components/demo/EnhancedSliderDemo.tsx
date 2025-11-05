import React, { useEffect, useState, useCallback } from 'react';
import { EnhancedGlowControls } from '../control/EnhancedGlowControls';
import { GlobalSettings } from '../control/GlobalSettings';
import { sliderRuntimeManager } from '../../lib/slider-runtime-manager';
import { dynamicMotionSystem } from '../../lib/motion-system';
import { createAdjustmentSystem } from '../../lib/real-time-adjustment-system';
import { createRuntimeTestingSystem } from '../../lib/runtime-testing-system';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Progress } from '../ui/progress';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Settings, 
  Activity, 
  CheckCircle, 
  AlertCircle,
  Zap,
  Gauge,
  Eye,
  Cpu
} from 'lucide-react';

interface PerformanceMetrics {
  frameRate: number;
  memoryUsage: number;
  averageLatency: number;
  successRate: number;
  activeAnimations: number;
}

interface TestResults {
  visual: { passed: number; total: number };
  performance: { passed: number; total: number };
  functionality: { passed: number; total: number };
}

export function EnhancedSliderDemo() {
  const [isRunning, setIsRunning] = useState(false);
  const [performanceMode, setPerformanceMode] = useState<'performance' | 'quality' | 'balanced'>('balanced');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    frameRate: 60,
    memoryUsage: 0,
    averageLatency: 0,
    successRate: 100,
    activeAnimations: 0,
  });
  const [testResults, setTestResults] = useState<TestResults>({
    visual: { passed: 0, total: 0 },
    performance: { passed: 0, total: 0 },
    functionality: { passed: 0, total: 0 },
  });
  const [isTestingRunning, setIsTestingRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>('');

  // Initialize systems
  const [adjustmentSystem] = useState(() => createAdjustmentSystem('192.168.1.100'));
  const [testingSystem] = useState(() => 
    createRuntimeTestingSystem(sliderRuntimeManager, dynamicMotionSystem, adjustmentSystem)
  );

  // Performance monitoring
  useEffect(() => {
    const interval = setInterval(() => {
      const motionSummary = dynamicMotionSystem.getPerformanceSummary();
      const adjustmentState = adjustmentSystem.getSystemState();
      
      setMetrics({
        frameRate: motionSummary.averageFrameRate,
        memoryUsage: getMemoryUsage(),
        averageLatency: 0, // Would be calculated from adjustment system
        successRate: 100, // Would be calculated from adjustment system
        activeAnimations: motionSummary.activeAnimations,
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [adjustmentSystem]);

  const getMemoryUsage = (): number => {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in (window.performance as any)) {
      return (window.performance as any).memory.usedJSHeapSize / 1024 / 1024;
    }
    return 0;
  };

  const handleParameterChange = useCallback((key: string, value: number) => {
    console.log(`Parameter changed: ${key} = ${value}`);
    // In a real implementation, this would send to the device
  }, []);

  const runPerformanceTest = useCallback(async () => {
    setIsTestingRunning(true);
    setCurrentTest('Running performance tests...');

    try {
      // Run all test suites
      const results = await testingSystem.runAllTests();
      
      // Process results
      const newTestResults: TestResults = {
        visual: { passed: 0, total: 0 },
        performance: { passed: 0, total: 0 },
        functionality: { passed: 0, total: 0 },
      };

      results.forEach((suiteResults, suiteId) => {
        const category = suiteId.includes('visual') ? 'visual' : 
                        suiteId.includes('performance') ? 'performance' : 'functionality';
        
        suiteResults.forEach((result) => {
          newTestResults[category].total++;
          if (result.success) {
            newTestResults[category].passed++;
          }
        });
      });

      setTestResults(newTestResults);
      setCurrentTest('Tests completed');
    } catch (error) {
      console.error('Test execution failed:', error);
      setCurrentTest('Tests failed');
    } finally {
      setIsTestingRunning(false);
    }
  }, [testingSystem]);

  const applyStressTest = useCallback(() => {
    setIsRunning(true);
    
    // Apply rapid modifications to test performance
    const stressInterval = setInterval(() => {
      // Random runtime modifications
      const sliders = ['global-brightness', 'global-background', 'global-softness', 'global-warmth'];
      const randomSlider = sliders[Math.floor(Math.random() * sliders.length)];
      
      sliderRuntimeManager.applyRuntimeModification(randomSlider, {
        id: `stress-${Date.now()}`,
        type: 'visual',
        config: {
          glowIntensity: Math.random(),
          animationSpeed: 0.5 + Math.random(),
        },
        duration: 1000,
      });

      // Random motion updates
      dynamicMotionSystem.updateMotionTarget(`stress-motion-${Math.random()}`, Math.random() * 100);
    }, 100);

    // Stop after 10 seconds
    setTimeout(() => {
      clearInterval(stressInterval);
      setIsRunning(false);
    }, 10000);
  }, []);

  const resetSystems = useCallback(() => {
    // Reset all runtime modifications
    ['global-brightness', 'global-background', 'global-softness', 'global-warmth'].forEach(id => {
      const state = sliderRuntimeManager.getSliderState(id);
      if (state) {
        state.activeModifications.forEach(mod => {
          sliderRuntimeManager.revertModification(id, mod.id);
        });
      }
    });

    // Reset performance mode
    dynamicMotionSystem.setGlobalPerformanceMode('balanced');
    setPerformanceMode('balanced');
  }, []);

  const getPerformanceColor = (value: number, threshold: { good: number; warning: number }) => {
    if (value >= threshold.good) return 'text-green-500';
    if (value >= threshold.warning) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getTestResultColor = (passed: number, total: number) => {
    if (total === 0) return 'text-gray-500';
    const rate = passed / total;
    if (rate >= 0.9) return 'text-green-500';
    if (rate >= 0.7) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="w-6 h-6 text-[var(--prism-gold)]" />
          <h1 className="text-xl font-semibold text-[var(--prism-text-primary)]">
            Enhanced Slider Architecture Demo
          </h1>
          <Badge variant="outline" className="text-xs">
            Runtime Modifications
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <Settings className="w-4 h-4 mr-1" />
            Advanced
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={resetSystems}
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Reset
          </Button>
        </div>
      </div>

      {/* Performance Metrics */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-[var(--prism-text-primary)]">
            Real-time Performance Metrics
          </h3>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[var(--prism-gold)]" />
            <span className="text-xs text-[var(--prism-text-secondary)]">
              {isRunning ? 'Stress Testing' : 'Monitoring'}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className={`text-lg font-mono ${getPerformanceColor(metrics.frameRate, { good: 50, warning: 30 })}`}>
              {Math.round(metrics.frameRate)}
            </div>
            <div className="text-xs text-[var(--prism-text-secondary)]">FPS</div>
          </div>
          <div className="text-center">
            <div className={`text-lg font-mono ${getPerformanceColor(100 - metrics.memoryUsage, { good: 80, warning: 60 })}`}>
              {Math.round(metrics.memoryUsage)}
            </div>
            <div className="text-xs text-[var(--prism-text-secondary)]">MB</div>
          </div>
          <div className="text-center">
            <div className={`text-lg font-mono ${getPerformanceColor(1000 - metrics.averageLatency, { good: 800, warning: 500 })}`}>
              {Math.round(metrics.averageLatency)}
            </div>
            <div className="text-xs text-[var(--prism-text-secondary)]">ms</div>
          </div>
          <div className="text-center">
            <div className={`text-lg font-mono ${getPerformanceColor(metrics.successRate, { good: 95, warning: 80 })}`}>
              {Math.round(metrics.successRate)}
            </div>
            <div className="text-xs text-[var(--prism-text-secondary)]">%</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-mono text-[var(--prism-text-primary)]">
              {metrics.activeAnimations}
            </div>
            <div className="text-xs text-[var(--prism-text-secondary)]">Active</div>
          </div>
        </div>
      </Card>

      {/* Test Results */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-[var(--prism-text-primary)]">
            Automated Test Results
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={runPerformanceTest}
            disabled={isTestingRunning}
          >
            {isTestingRunning ? (
              <>
                <Gauge className="w-4 h-4 mr-1 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-1" />
                Run Tests
              </>
            )}
          </Button>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-[var(--prism-bg-elevated)]/30 rounded">
            <div className={`text-lg font-mono ${getTestResultColor(testResults.visual.passed, testResults.visual.total)}`}>
              {testResults.visual.passed}/{testResults.visual.total}
            </div>
            <div className="text-xs text-[var(--prism-text-secondary)]">Visual Tests</div>
          </div>
          <div className="text-center p-3 bg-[var(--prism-bg-elevated)]/30 rounded">
            <div className={`text-lg font-mono ${getTestResultColor(testResults.performance.passed, testResults.performance.total)}`}>
              {testResults.performance.passed}/{testResults.performance.total}
            </div>
            <div className="text-xs text-[var(--prism-text-secondary)]">Performance Tests</div>
          </div>
          <div className="text-center p-3 bg-[var(--prism-bg-elevated)]/30 rounded">
            <div className={`text-lg font-mono ${getTestResultColor(testResults.functionality.passed, testResults.functionality.total)}`}>
              {testResults.functionality.passed}/{testResults.functionality.total}
            </div>
            <div className="text-xs text-[var(--prism-text-secondary)]">Functionality Tests</div>
          </div>
        </div>
        
        {currentTest && (
          <div className="mt-3 text-xs text-[var(--prism-text-secondary)]">
            {currentTest}
          </div>
        )}
      </Card>

      {/* Performance Mode Controls */}
      <Card className="p-4">
        <h3 className="text-sm font-medium text-[var(--prism-text-primary)] mb-3">
          Performance Mode
        </h3>
        <div className="flex gap-2">
          {(['performance', 'balanced', 'quality'] as const).map((mode) => (
            <Button
              key={mode}
              variant={performanceMode === mode ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setPerformanceMode(mode);
                dynamicMotionSystem.setGlobalPerformanceMode(mode);
                // Apply preset to all sliders
                ['global-brightness', 'global-background', 'global-softness', 'global-warmth'].forEach(id => {
                  sliderRuntimeManager.applyPreset(id, mode);
                });
              }}
            >
              {mode === 'performance' && <Cpu className="w-4 h-4 mr-1" />}
              {mode === 'balanced' && <Gauge className="w-4 h-4 mr-1" />}
              {mode === 'quality' && <Eye className="w-4 h-4 mr-1" />}
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </Button>
          ))}
        </div>
      </Card>

      {/* Stress Testing */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-[var(--prism-text-primary)]">
            Stress Testing
          </h3>
          <Button
            variant={isRunning ? 'destructive' : 'default'}
            size="sm"
            onClick={isRunning ? () => setIsRunning(false) : applyStressTest}
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4 mr-1" />
                Stop Test
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-1" />
                Start Stress Test
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-[var(--prism-text-secondary)]">
          Applies rapid runtime modifications to test system stability and performance under load.
        </p>
      </Card>

      {/* Demo Components */}
      <Tabs defaultValue="global" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="global">Global Settings</TabsTrigger>
          <TabsTrigger value="glow">Glow Controls</TabsTrigger>
        </TabsList>
        
        <TabsContent value="global" className="space-y-4">
          <GlobalSettings
            onSettingChange={handleParameterChange}
            deviceIp="192.168.1.100"
            performanceMode={performanceMode}
            showAdvancedControls={showAdvanced}
          />
        </TabsContent>
        
        <TabsContent value="glow" className="space-y-4">
          <EnhancedGlowControls
            onParameterChange={handleParameterChange}
            effectName="Demo Effect"
            performanceMode={performanceMode}
            showAdvancedControls={showAdvanced}
          />
        </TabsContent>
      </Tabs>

      {/* Advanced Debug Info */}
      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="p-4">
              <h3 className="text-sm font-medium text-[var(--prism-text-primary)] mb-3">
                Debug Information
              </h3>
              <div className="space-y-2 text-xs font-mono">
                <div>Runtime Manager: {sliderRuntimeManager ? 'Active' : 'Inactive'}</div>
                <div>Motion System: {dynamicMotionSystem ? 'Active' : 'Inactive'}</div>
                <div>Adjustment System: {adjustmentSystem ? 'Active' : 'Inactive'}</div>
                <div>Testing System: {testingSystem ? 'Active' : 'Inactive'}</div>
                <div>Performance Mode: {performanceMode}</div>
                <div>Memory Usage: {Math.round(metrics.memoryUsage * 100) / 100} MB</div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}