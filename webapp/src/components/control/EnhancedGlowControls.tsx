import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { EnhancedSlider, SliderVisualConfig } from '../ui/enhanced-slider';
import { sliderRuntimeManager } from '../../lib/slider-runtime-manager';
import { Settings, Zap, Eye, Gauge, Palette, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface GlowParameter {
  id: string;
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  description: string;
  firmwareKey: string;
  category: 'intensity' | 'diffusion' | 'motion' | 'color';
  visualPreview?: (value: number) => React.ReactNode;
  dynamicRange?: { min: number; max: number };
}

interface EnhancedGlowControlsProps {
  onParameterChange: (key: string, value: number) => void;
  initialValues?: Record<string, number>;
  disabled?: boolean;
  effectName?: string;
  performanceMode?: 'performance' | 'quality' | 'balanced';
  showAdvancedControls?: boolean;
}

export function EnhancedGlowControls({
  onParameterChange,
  initialValues = {},
  disabled = false,
  effectName = 'Unknown',
  performanceMode = 'balanced',
  showAdvancedControls = false,
}: EnhancedGlowControlsProps) {
  const [parameters] = useState<GlowParameter[]>([
    {
      id: 'glow-strength',
      name: 'Glow Strength',
      value: initialValues.background ?? 20,
      min: 0,
      max: 100,
      step: 1,
      unit: '%',
      description: 'Controls the intensity of the ambient background glow',
      firmwareKey: 'background',
      category: 'intensity',
      visualPreview: (value) => (
        <div className="flex items-center gap-2">
          <div 
            className="w-8 h-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
            style={{ opacity: value / 100 }}
          />
          <span className="text-xs">Ambient intensity</span>
        </div>
      ),
    },
    {
      id: 'glow-softness',
      name: 'Glow Softness',
      value: initialValues.softness ?? 40,
      min: 0,
      max: 100,
      step: 1,
      unit: '%',
      description: 'Adjusts the diffusion and trail persistence of the glow effect',
      firmwareKey: 'softness',
      category: 'diffusion',
      visualPreview: (value) => (
        <div className="flex items-center gap-2">
          <div className="relative w-8 h-4">
            <div className="absolute inset-0 bg-blue-400 rounded-full" />
            <div 
              className="absolute inset-0 bg-blue-400 rounded-full blur-sm"
              style={{ opacity: value / 100 }}
            />
          </div>
          <span className="text-xs">Trail diffusion</span>
        </div>
      ),
    },
    {
      id: 'glow-speed',
      name: 'Motion Speed',
      value: initialValues.speed ?? 50,
      min: 0,
      max: 100,
      step: 1,
      unit: '%',
      description: 'Controls the speed of glow animations and transitions',
      firmwareKey: 'speed',
      category: 'motion',
      dynamicRange: { min: 10, max: 200 }, // Allow extended range for special effects
    },
    {
      id: 'glow-warmth',
      name: 'Color Warmth',
      value: initialValues.warmth ?? 50,
      min: 0,
      max: 100,
      step: 1,
      unit: '%',
      description: 'Shifts the glow color temperature from cool to warm',
      firmwareKey: 'warmth',
      category: 'color',
      visualPreview: (value) => (
        <div className="flex items-center gap-2">
          <div 
            className="w-8 h-4 rounded-full"
            style={{
              background: `linear-gradient(to right, 
                hsl(200, 80%, 60%) 0%, 
                hsl(${180 + (value / 100) * 60}, 80%, 60%) 100%)`
            }}
          />
          <span className="text-xs">{value < 30 ? 'Cool' : value > 70 ? 'Warm' : 'Neutral'}</span>
        </div>
      ),
    },
  ]);

  const [runtimeSettings, setRuntimeSettings] = useState({
    adaptivePerformance: true,
    visualFeedback: true,
    realTimePreview: false,
    debugMode: false,
  });

  const [performanceMetrics, setPerformanceMetrics] = useState<Record<string, any>>({});

  // Initialize runtime manager for each parameter
  useEffect(() => {
    parameters.forEach(param => {
      const visualConfig: SliderVisualConfig = {
        showPreview: runtimeSettings.realTimePreview && !!param.visualPreview,
        showGradient: runtimeSettings.visualFeedback,
        showRipple: runtimeSettings.visualFeedback && performanceMode !== 'performance',
        animationSpeed: performanceMode === 'performance' ? 0.5 : performanceMode === 'quality' ? 1.2 : 1,
        glowIntensity: param.category === 'intensity' ? 0.8 : 0.6,
        trackStyle: param.category === 'intensity' ? 'glow' : 'default',
        thumbStyle: runtimeSettings.visualFeedback ? 'reactive' : 'default',
      };

      sliderRuntimeManager.registerSlider(param.id, {
        visual: visualConfig,
        behavior: {
          debounceMs: param.category === 'motion' ? 250 : 375, // Faster for motion controls
          adaptiveDebounce: runtimeSettings.adaptivePerformance,
          optimisticUpdates: true,
          priorityLevel: param.category === 'intensity' ? 'high' : 'normal',
        },
        performance: {
          enableMetrics: runtimeSettings.debugMode,
          adaptiveOptimization: runtimeSettings.adaptivePerformance,
        },
      });
    });

    return () => {
      parameters.forEach(param => {
        // Cleanup would happen in a real implementation
      });
    };
  }, [parameters, runtimeSettings, performanceMode]);

  // Apply performance presets based on mode
  useEffect(() => {
    parameters.forEach(param => {
      sliderRuntimeManager.applyPreset(param.id, performanceMode);
    });
  }, [performanceMode, parameters]);

  const handleParameterChange = useCallback(async (param: GlowParameter, value: number) => {
    // Apply runtime modifications based on context
    if (param.category === 'intensity' && value > 80) {
      // High intensity - apply glow effects
      sliderRuntimeManager.applyRuntimeModification(param.id, {
        id: 'high-intensity-glow',
        type: 'visual',
        config: {
          glowIntensity: 1.0,
          showRipple: true,
          trackStyle: 'neon',
        },
        duration: 5000,
      });
    }

    if (param.category === 'motion' && value > 90) {
      // High speed - optimize for performance
      sliderRuntimeManager.applyRuntimeModification(param.id, {
        id: 'high-speed-optimization',
        type: 'behavior',
        config: {
          debounceMs: 150,
          batchUpdates: true,
        },
        duration: 10000,
      });
    }

    // Convert to firmware value and send
    const firmwareValue = value / 100;
    onParameterChange(param.firmwareKey, firmwareValue);
  }, [onParameterChange]);

  const handleRuntimeSettingChange = (setting: keyof typeof runtimeSettings, value: boolean) => {
    setRuntimeSettings(prev => ({ ...prev, [setting]: value }));
    
    // Apply changes to all sliders
    parameters.forEach(param => {
      if (setting === 'visualFeedback') {
        sliderRuntimeManager.applyRuntimeModification(param.id, {
          id: `visual-feedback-${Date.now()}`,
          type: 'visual',
          config: {
            showGradient: value,
            showRipple: value && performanceMode !== 'performance',
            thumbStyle: value ? 'reactive' : 'default',
          },
        });
      }
      
      if (setting === 'realTimePreview') {
        sliderRuntimeManager.applyRuntimeModification(param.id, {
          id: `preview-${Date.now()}`,
          type: 'visual',
          config: {
            showPreview: value && !!param.visualPreview,
          },
        });
      }
    });
  };

  const getCategoryIcon = (category: GlowParameter['category']) => {
    switch (category) {
      case 'intensity': return <Zap className="w-4 h-4" />;
      case 'diffusion': return <Sparkles className="w-4 h-4" />;
      case 'motion': return <Gauge className="w-4 h-4" />;
      case 'color': return <Palette className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (category: GlowParameter['category']) => {
    switch (category) {
      case 'intensity': return 'text-yellow-500';
      case 'diffusion': return 'text-blue-500';
      case 'motion': return 'text-green-500';
      case 'color': return 'text-purple-500';
    }
  };

  const groupedParameters = useMemo(() => {
    return parameters.reduce((groups, param) => {
      if (!groups[param.category]) {
        groups[param.category] = [];
      }
      groups[param.category].push(param);
      return groups;
    }, {} as Record<string, GlowParameter[]>);
  }, [parameters]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-[var(--prism-gold)]" />
          <h3 className="text-sm font-medium text-[var(--prism-text-primary)]">
            Enhanced Glow Controls
          </h3>
          <Badge variant="outline" className="text-xs">
            {effectName}
          </Badge>
        </div>
        
        {showAdvancedControls && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRuntimeSettings(prev => ({ ...prev, debugMode: !prev.debugMode }))}
          >
            <Settings className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Runtime Settings */}
      <AnimatePresence>
        {showAdvancedControls && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 p-3 bg-[var(--prism-bg-elevated)]/50 rounded border"
          >
            <h4 className="text-xs font-medium text-[var(--prism-text-secondary)]">Runtime Settings</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="adaptive-performance" className="text-xs">Adaptive Performance</Label>
                <Switch
                  id="adaptive-performance"
                  checked={runtimeSettings.adaptivePerformance}
                  onCheckedChange={(checked) => handleRuntimeSettingChange('adaptivePerformance', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="visual-feedback" className="text-xs">Visual Feedback</Label>
                <Switch
                  id="visual-feedback"
                  checked={runtimeSettings.visualFeedback}
                  onCheckedChange={(checked) => handleRuntimeSettingChange('visualFeedback', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="real-time-preview" className="text-xs">Real-time Preview</Label>
                <Switch
                  id="real-time-preview"
                  checked={runtimeSettings.realTimePreview}
                  onCheckedChange={(checked) => handleRuntimeSettingChange('realTimePreview', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="debug-mode" className="text-xs">Debug Mode</Label>
                <Switch
                  id="debug-mode"
                  checked={runtimeSettings.debugMode}
                  onCheckedChange={(checked) => handleRuntimeSettingChange('debugMode', checked)}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Parameter Groups */}
      {Object.entries(groupedParameters).map(([category, params]) => (
        <div key={category} className="space-y-4">
          <div className="flex items-center gap-2">
            <span className={getCategoryColor(category as GlowParameter['category'])}>
              {getCategoryIcon(category as GlowParameter['category'])}
            </span>
            <h4 className="text-xs font-medium text-[var(--prism-text-secondary)] uppercase tracking-wide">
              {category}
            </h4>
          </div>
          
          <div className="space-y-4">
            {params.map((param) => (
              <TooltipProvider key={param.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <EnhancedSlider
                        value={param.value}
                        min={param.min}
                        max={param.max}
                        step={param.step}
                        disabled={disabled}
                        label={param.name}
                        unit={param.unit}
                        description={param.description}
                        dynamicRange={param.dynamicRange}
                        adaptiveStep={true}
                        contextualHelp={true}
                        previewRenderer={param.visualPreview}
                        onValueChange={(value) => {
                          // Update local state
                          param.value = value;
                        }}
                        onValueCommit={async (value) => {
                          await handleParameterChange(param, value);
                        }}
                        realTimeValidation={(value) => {
                          if (param.category === 'motion' && value > 95) {
                            return 'Very high speeds may impact performance';
                          }
                          if (param.category === 'intensity' && value < 5) {
                            return 'Very low intensity may not be visible';
                          }
                          return null;
                        }}
                        performanceMonitor={(metrics) => {
                          setPerformanceMetrics(prev => ({
                            ...prev,
                            [param.id]: metrics,
                          }));
                        }}
                        visualConfig={sliderRuntimeManager.getSliderConfig(param.id)?.visual}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="max-w-xs">
                      <p className="text-sm">{param.description}</p>
                      {runtimeSettings.debugMode && performanceMetrics[param.id] && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Latency: {Math.round(performanceMetrics[param.id].updateLatency)}ms
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>
      ))}

      {/* Performance Summary */}
      <AnimatePresence>
        {runtimeSettings.debugMode && Object.keys(performanceMetrics).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="p-3 bg-[var(--prism-bg-elevated)]/30 rounded border text-xs"
          >
            <h4 className="font-medium text-[var(--prism-text-secondary)] mb-2">Performance Summary</h4>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(performanceMetrics).map(([paramId, metrics]) => {
                const param = parameters.find(p => p.id === paramId);
                return (
                  <div key={paramId} className="flex justify-between">
                    <span>{param?.name}:</span>
                    <span className="font-mono">{Math.round(metrics.updateLatency)}ms</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}