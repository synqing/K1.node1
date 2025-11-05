import { MotionValue, useSpring, useTransform, animate } from 'framer-motion';

export interface MotionConfig {
  stiffness: number;
  damping: number;
  mass: number;
  velocity: number;
  restDelta: number;
  restSpeed: number;
}

export interface MotionPreset {
  name: string;
  config: MotionConfig;
  description: string;
  useCase: string[];
}

export interface PerformanceMetrics {
  frameRate: number;
  animationDuration: number;
  cpuUsage: number;
  memoryUsage: number;
  droppedFrames: number;
}

export interface MotionState {
  isAnimating: boolean;
  currentVelocity: number;
  targetValue: number;
  actualValue: number;
  performanceMetrics: PerformanceMetrics;
  adaptiveConfig: MotionConfig;
}

export class DynamicMotionSystem {
  private motionStates = new Map<string, MotionState>();
  private performanceMonitor?: PerformanceObserver;
  private frameRateMonitor?: number;
  private adaptiveOptimization = true;
  private globalPerformanceMode: 'performance' | 'quality' | 'balanced' = 'balanced';

  // Predefined motion presets
  private presets: Record<string, MotionPreset> = {
    smooth: {
      name: 'Smooth',
      config: { stiffness: 300, damping: 30, mass: 1, velocity: 0, restDelta: 0.01, restSpeed: 0.01 },
      description: 'Smooth, natural motion with gentle easing',
      useCase: ['general', 'glow-controls', 'ambient-effects'],
    },
    snappy: {
      name: 'Snappy',
      config: { stiffness: 500, damping: 25, mass: 0.8, velocity: 0, restDelta: 0.005, restSpeed: 0.005 },
      description: 'Quick, responsive motion for immediate feedback',
      useCase: ['intensity-controls', 'real-time-adjustments'],
    },
    fluid: {
      name: 'Fluid',
      config: { stiffness: 200, damping: 40, mass: 1.2, velocity: 0, restDelta: 0.02, restSpeed: 0.02 },
      description: 'Fluid, organic motion with natural overshoot',
      useCase: ['color-transitions', 'warmth-controls'],
    },
    precise: {
      name: 'Precise',
      config: { stiffness: 400, damping: 35, mass: 0.9, velocity: 0, restDelta: 0.001, restSpeed: 0.001 },
      description: 'Precise motion with minimal overshoot',
      useCase: ['fine-tuning', 'professional-controls'],
    },
    performance: {
      name: 'Performance',
      config: { stiffness: 600, damping: 20, mass: 0.5, velocity: 0, restDelta: 0.1, restSpeed: 0.1 },
      description: 'Optimized for performance with reduced quality',
      useCase: ['low-end-devices', 'battery-saving'],
    },
    accessibility: {
      name: 'Accessibility',
      config: { stiffness: 150, damping: 50, mass: 1.5, velocity: 0, restDelta: 0.05, restSpeed: 0.05 },
      description: 'Reduced motion for accessibility compliance',
      useCase: ['reduced-motion', 'accessibility'],
    },
  };

  constructor() {
    this.initializePerformanceMonitoring();
    this.startFrameRateMonitoring();
  }

  private initializePerformanceMonitoring() {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      this.performanceMonitor = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name.startsWith('motion-')) {
            const motionId = entry.name.replace('motion-', '');
            this.updatePerformanceMetrics(motionId, {
              animationDuration: entry.duration,
            });
          }
        });
      });
      this.performanceMonitor.observe({ entryTypes: ['measure'] });
    }
  }

  private startFrameRateMonitoring() {
    let lastTime = performance.now();
    let frameCount = 0;
    let droppedFrames = 0;

    const monitor = () => {
      const currentTime = performance.now();
      const deltaTime = currentTime - lastTime;
      
      frameCount++;
      
      // Check for dropped frames (assuming 60fps target)
      if (deltaTime > 16.67 * 1.5) {
        droppedFrames++;
      }

      // Update frame rate every second
      if (frameCount >= 60) {
        const fps = 1000 / (deltaTime / frameCount);
        
        // Update all motion states with current frame rate
        this.motionStates.forEach((state, id) => {
          state.performanceMetrics.frameRate = fps;
          state.performanceMetrics.droppedFrames = droppedFrames;
          
          // Adaptive optimization based on performance
          if (this.adaptiveOptimization) {
            this.optimizeMotionConfig(id, state);
          }
        });

        frameCount = 0;
        droppedFrames = 0;
      }

      lastTime = currentTime;
      this.frameRateMonitor = requestAnimationFrame(monitor);
    };

    this.frameRateMonitor = requestAnimationFrame(monitor);
  }

  registerMotion(
    id: string,
    initialValue: number = 0,
    preset: string = 'smooth'
  ): MotionState {
    const presetConfig = this.presets[preset] || this.presets.smooth;
    
    const state: MotionState = {
      isAnimating: false,
      currentVelocity: 0,
      targetValue: initialValue,
      actualValue: initialValue,
      performanceMetrics: {
        frameRate: 60,
        animationDuration: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        droppedFrames: 0,
      },
      adaptiveConfig: { ...presetConfig.config },
    };

    this.motionStates.set(id, state);
    return state;
  }

  createSpringMotion(
    id: string,
    initialValue: number = 0,
    preset: string = 'smooth'
  ): {
    motionValue: MotionValue<number>;
    spring: MotionValue<number>;
    state: MotionState;
  } {
    const state = this.registerMotion(id, initialValue, preset);
    const motionValue = new MotionValue(initialValue);
    
    const spring = useSpring(motionValue, state.adaptiveConfig);

    // Monitor spring changes
    spring.on('change', (value) => {
      state.actualValue = value;
      state.currentVelocity = spring.getVelocity();
    });

    spring.on('animationStart', () => {
      state.isAnimating = true;
      performance.mark(`motion-${id}-start`);
    });

    spring.on('animationComplete', () => {
      state.isAnimating = false;
      performance.mark(`motion-${id}-end`);
      performance.measure(`motion-${id}`, `motion-${id}-start`, `motion-${id}-end`);
    });

    return { motionValue, spring, state };
  }

  updateMotionTarget(id: string, targetValue: number, customConfig?: Partial<MotionConfig>) {
    const state = this.motionStates.get(id);
    if (!state) return;

    state.targetValue = targetValue;

    // Apply custom config if provided
    if (customConfig) {
      Object.assign(state.adaptiveConfig, customConfig);
    }

    // Trigger performance measurement
    performance.mark(`motion-${id}-update-start`);
  }

  applyPreset(id: string, presetName: string) {
    const state = this.motionStates.get(id);
    const preset = this.presets[presetName];
    
    if (!state || !preset) return false;

    state.adaptiveConfig = { ...preset.config };
    return true;
  }

  createCustomPreset(
    name: string,
    config: MotionConfig,
    description: string,
    useCase: string[]
  ) {
    this.presets[name] = {
      name,
      config,
      description,
      useCase,
    };
  }

  private optimizeMotionConfig(id: string, state: MotionState) {
    const { frameRate, droppedFrames } = state.performanceMetrics;
    
    // Performance-based optimization
    if (frameRate < 30 || droppedFrames > 5) {
      // Poor performance - reduce quality
      state.adaptiveConfig.stiffness = Math.min(state.adaptiveConfig.stiffness * 1.2, 800);
      state.adaptiveConfig.damping = Math.max(state.adaptiveConfig.damping * 0.8, 15);
      state.adaptiveConfig.restDelta = Math.max(state.adaptiveConfig.restDelta * 2, 0.1);
    } else if (frameRate > 55 && droppedFrames === 0) {
      // Good performance - can increase quality
      const originalPreset = this.getOriginalPresetForMotion(id);
      if (originalPreset) {
        // Gradually return to original settings
        state.adaptiveConfig.stiffness = this.lerp(
          state.adaptiveConfig.stiffness,
          originalPreset.config.stiffness,
          0.1
        );
        state.adaptiveConfig.damping = this.lerp(
          state.adaptiveConfig.damping,
          originalPreset.config.damping,
          0.1
        );
        state.adaptiveConfig.restDelta = this.lerp(
          state.adaptiveConfig.restDelta,
          originalPreset.config.restDelta,
          0.1
        );
      }
    }

    // Global performance mode adjustments
    switch (this.globalPerformanceMode) {
      case 'performance':
        state.adaptiveConfig.restDelta = Math.max(state.adaptiveConfig.restDelta, 0.05);
        state.adaptiveConfig.restSpeed = Math.max(state.adaptiveConfig.restSpeed, 0.05);
        break;
      case 'quality':
        state.adaptiveConfig.restDelta = Math.min(state.adaptiveConfig.restDelta, 0.005);
        state.adaptiveConfig.restSpeed = Math.min(state.adaptiveConfig.restSpeed, 0.005);
        break;
    }
  }

  private getOriginalPresetForMotion(id: string): MotionPreset | null {
    // In a real implementation, we'd track which preset was originally used
    // For now, return the smooth preset as default
    return this.presets.smooth;
  }

  private lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * factor;
  }

  private updatePerformanceMetrics(id: string, metrics: Partial<PerformanceMetrics>) {
    const state = this.motionStates.get(id);
    if (!state) return;

    Object.assign(state.performanceMetrics, metrics);
  }

  // Batch operations for multiple motions
  batchUpdateTargets(updates: Array<{ id: string; target: number; config?: Partial<MotionConfig> }>) {
    const startTime = performance.now();
    
    updates.forEach(({ id, target, config }) => {
      this.updateMotionTarget(id, target, config);
    });

    const duration = performance.now() - startTime;
    
    // Log batch performance
    if (duration > 16) {
      console.warn(`Batch motion update took ${duration.toFixed(2)}ms - consider optimizing`);
    }
  }

  // Synchronized motion for related controls
  createSynchronizedMotion(
    ids: string[],
    syncMode: 'parallel' | 'sequential' | 'staggered' = 'parallel',
    staggerDelay: number = 50
  ) {
    return {
      updateAll: (targetValue: number, config?: Partial<MotionConfig>) => {
        switch (syncMode) {
          case 'parallel':
            ids.forEach(id => this.updateMotionTarget(id, targetValue, config));
            break;
          case 'sequential':
            ids.forEach((id, index) => {
              setTimeout(() => {
                this.updateMotionTarget(id, targetValue, config);
              }, index * staggerDelay);
            });
            break;
          case 'staggered':
            ids.forEach((id, index) => {
              setTimeout(() => {
                this.updateMotionTarget(id, targetValue, config);
              }, index * staggerDelay);
            });
            break;
        }
      },
      applyPresetToAll: (presetName: string) => {
        ids.forEach(id => this.applyPreset(id, presetName));
      },
    };
  }

  setGlobalPerformanceMode(mode: 'performance' | 'quality' | 'balanced') {
    this.globalPerformanceMode = mode;
    
    // Apply mode to all existing motions
    this.motionStates.forEach((state, id) => {
      this.optimizeMotionConfig(id, state);
    });
  }

  enableAdaptiveOptimization(enabled: boolean) {
    this.adaptiveOptimization = enabled;
  }

  getMotionState(id: string): MotionState | null {
    return this.motionStates.get(id) || null;
  }

  getAllPresets(): Record<string, MotionPreset> {
    return { ...this.presets };
  }

  getPerformanceSummary(): {
    averageFrameRate: number;
    totalDroppedFrames: number;
    activeAnimations: number;
    performanceMode: string;
  } {
    const states = Array.from(this.motionStates.values());
    const activeAnimations = states.filter(s => s.isAnimating).length;
    const averageFrameRate = states.reduce((sum, s) => sum + s.performanceMetrics.frameRate, 0) / states.length || 0;
    const totalDroppedFrames = states.reduce((sum, s) => sum + s.performanceMetrics.droppedFrames, 0);

    return {
      averageFrameRate,
      totalDroppedFrames,
      activeAnimations,
      performanceMode: this.globalPerformanceMode,
    };
  }

  destroy() {
    if (this.frameRateMonitor) {
      cancelAnimationFrame(this.frameRateMonitor);
    }
    this.performanceMonitor?.disconnect();
    this.motionStates.clear();
  }
}

// Global instance
export const dynamicMotionSystem = new DynamicMotionSystem();