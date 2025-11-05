import { SliderVisualConfig, SliderState } from '../components/ui/enhanced-slider';

export interface RuntimeModification {
  id: string;
  timestamp: number;
  type: 'visual' | 'behavior' | 'performance';
  config: Partial<SliderVisualConfig> | Partial<SliderBehaviorConfig> | Partial<PerformanceConfig>;
  duration?: number; // Auto-revert after duration (ms)
  condition?: (state: SliderState) => boolean; // Apply only when condition is met
}

export interface SliderBehaviorConfig {
  debounceMs: number;
  adaptiveDebounce: boolean;
  errorRetryCount: number;
  errorRetryDelay: number;
  optimisticUpdates: boolean;
  batchUpdates: boolean;
  priorityLevel: 'low' | 'normal' | 'high' | 'critical';
}

export interface PerformanceConfig {
  enableMetrics: boolean;
  metricsBufferSize: number;
  performanceThresholds: {
    updateLatency: number;
    renderTime: number;
    networkLatency: number;
  };
  adaptiveOptimization: boolean;
  memoryMonitoring: boolean;
}

export interface SliderRuntimeState {
  id: string;
  currentConfig: {
    visual: SliderVisualConfig;
    behavior: SliderBehaviorConfig;
    performance: PerformanceConfig;
  };
  activeModifications: RuntimeModification[];
  performanceHistory: Array<{
    timestamp: number;
    metrics: SliderState['performanceMetrics'];
  }>;
  errorHistory: Array<{
    timestamp: number;
    error: string;
    context: any;
  }>;
  adaptiveState: {
    suggestedDebounce: number;
    networkQuality: 'excellent' | 'good' | 'poor' | 'critical';
    cpuLoad: number;
    memoryPressure: number;
  };
}

export class SliderRuntimeManager {
  private sliders = new Map<string, SliderRuntimeState>();
  private globalConfig: {
    maxConcurrentUpdates: number;
    globalPerformanceMode: 'performance' | 'quality' | 'balanced';
    adaptiveOptimization: boolean;
  } = {
    maxConcurrentUpdates: 5,
    globalPerformanceMode: 'balanced',
    adaptiveOptimization: true,
  };

  private performanceObserver?: PerformanceObserver;
  private memoryMonitor?: NodeJS.Timeout;

  constructor() {
    this.initializePerformanceMonitoring();
  }

  private initializePerformanceMonitoring() {
    // Performance Observer for measuring render times
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name.startsWith('slider-')) {
            const sliderId = entry.name.replace('slider-', '');
            this.updatePerformanceMetrics(sliderId, {
              renderTime: entry.duration,
            });
          }
        });
      });
      this.performanceObserver.observe({ entryTypes: ['measure'] });
    }

    // Memory monitoring
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in (window.performance as any)) {
      this.memoryMonitor = setInterval(() => {
        const memory = (window.performance as any).memory;
        const memoryPressure = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
        
        // Update adaptive state for all sliders
        this.sliders.forEach((state, id) => {
          state.adaptiveState.memoryPressure = memoryPressure;
          this.optimizeSliderPerformance(id);
        });
      }, 5000);
    }
  }

  registerSlider(
    id: string,
    initialConfig: {
      visual?: Partial<SliderVisualConfig>;
      behavior?: Partial<SliderBehaviorConfig>;
      performance?: Partial<PerformanceConfig>;
    } = {}
  ): SliderRuntimeState {
    const defaultVisual: SliderVisualConfig = {
      showPreview: false,
      showGradient: true,
      showRipple: false,
      animationSpeed: 1,
      glowIntensity: 0.6,
      trackStyle: 'default',
      thumbStyle: 'default',
    };

    const defaultBehavior: SliderBehaviorConfig = {
      debounceMs: 350,
      adaptiveDebounce: true,
      errorRetryCount: 3,
      errorRetryDelay: 1000,
      optimisticUpdates: true,
      batchUpdates: false,
      priorityLevel: 'normal',
    };

    const defaultPerformance: PerformanceConfig = {
      enableMetrics: true,
      metricsBufferSize: 100,
      performanceThresholds: {
        updateLatency: 500,
        renderTime: 16,
        networkLatency: 200,
      },
      adaptiveOptimization: true,
      memoryMonitoring: true,
    };

    const state: SliderRuntimeState = {
      id,
      currentConfig: {
        visual: { ...defaultVisual, ...initialConfig.visual },
        behavior: { ...defaultBehavior, ...initialConfig.behavior },
        performance: { ...defaultPerformance, ...initialConfig.performance },
      },
      activeModifications: [],
      performanceHistory: [],
      errorHistory: [],
      adaptiveState: {
        suggestedDebounce: defaultBehavior.debounceMs,
        networkQuality: 'good',
        cpuLoad: 0,
        memoryPressure: 0,
      },
    };

    this.sliders.set(id, state);
    return state;
  }

  applyRuntimeModification(sliderId: string, modification: Omit<RuntimeModification, 'timestamp'>): boolean {
    const state = this.sliders.get(sliderId);
    if (!state) return false;

    const fullModification: RuntimeModification = {
      ...modification,
      timestamp: Date.now(),
    };

    state.activeModifications.push(fullModification);

    // Apply the modification
    this.applyModificationToConfig(state, fullModification);

    // Schedule auto-revert if duration is specified
    if (modification.duration) {
      setTimeout(() => {
        this.revertModification(sliderId, fullModification.id);
      }, modification.duration);
    }

    return true;
  }

  private applyModificationToConfig(state: SliderRuntimeState, modification: RuntimeModification) {
    switch (modification.type) {
      case 'visual':
        Object.assign(state.currentConfig.visual, modification.config);
        break;
      case 'behavior':
        Object.assign(state.currentConfig.behavior, modification.config);
        break;
      case 'performance':
        Object.assign(state.currentConfig.performance, modification.config);
        break;
    }
  }

  revertModification(sliderId: string, modificationId: string): boolean {
    const state = this.sliders.get(sliderId);
    if (!state) return false;

    const modIndex = state.activeModifications.findIndex(m => m.id === modificationId);
    if (modIndex === -1) return false;

    state.activeModifications.splice(modIndex, 1);
    
    // Rebuild config from remaining modifications
    this.rebuildSliderConfig(state);
    return true;
  }

  private rebuildSliderConfig(state: SliderRuntimeState) {
    // Reset to defaults and reapply all active modifications
    const defaultConfig = this.getDefaultConfig();
    state.currentConfig = { ...defaultConfig };

    state.activeModifications.forEach(mod => {
      this.applyModificationToConfig(state, mod);
    });
  }

  updatePerformanceMetrics(sliderId: string, metrics: Partial<NonNullable<SliderState['performanceMetrics']>>) {
    const state = this.sliders.get(sliderId);
    if (!state || !state.currentConfig.performance.enableMetrics) return;

    const timestamp = Date.now();
    const fullMetrics = {
      updateLatency: 0,
      networkLatency: 0,
      renderTime: 0,
      ...metrics,
    };

    state.performanceHistory.push({ timestamp, metrics: fullMetrics });

    // Maintain buffer size
    if (state.performanceHistory.length > state.currentConfig.performance.metricsBufferSize) {
      state.performanceHistory.shift();
    }

    // Check thresholds and trigger optimizations
    this.checkPerformanceThresholds(state, fullMetrics);
    
    if (state.currentConfig.performance.adaptiveOptimization) {
      this.optimizeSliderPerformance(sliderId);
    }
  }

  private checkPerformanceThresholds(state: SliderRuntimeState, metrics: NonNullable<SliderState['performanceMetrics']>) {
    const thresholds = state.currentConfig.performance.performanceThresholds;
    
    if (metrics.updateLatency > thresholds.updateLatency) {
      this.applyRuntimeModification(state.id, {
        id: `auto-debounce-${Date.now()}`,
        type: 'behavior',
        config: { debounceMs: Math.min(state.currentConfig.behavior.debounceMs * 1.5, 1000) },
        duration: 30000, // Auto-revert after 30s
      });
    }

    if (metrics.renderTime > thresholds.renderTime) {
      this.applyRuntimeModification(state.id, {
        id: `auto-performance-${Date.now()}`,
        type: 'visual',
        config: { 
          showRipple: false,
          animationSpeed: 0.5,
          glowIntensity: 0.3,
        },
        duration: 60000, // Auto-revert after 1 minute
      });
    }
  }

  private optimizeSliderPerformance(sliderId: string) {
    const state = this.sliders.get(sliderId);
    if (!state) return;

    const recentMetrics = state.performanceHistory.slice(-10);
    if (recentMetrics.length < 5) return;

    const avgLatency = recentMetrics.reduce((sum, m) => sum + m.metrics.updateLatency, 0) / recentMetrics.length;
    const avgRenderTime = recentMetrics.reduce((sum, m) => sum + m.metrics.renderTime, 0) / recentMetrics.length;

    // Adaptive debounce calculation
    if (state.currentConfig.behavior.adaptiveDebounce) {
      let suggestedDebounce = state.currentConfig.behavior.debounceMs;

      if (avgLatency > 300) {
        suggestedDebounce = Math.min(suggestedDebounce * 1.2, 1000);
      } else if (avgLatency < 100) {
        suggestedDebounce = Math.max(suggestedDebounce * 0.9, 200);
      }

      state.adaptiveState.suggestedDebounce = suggestedDebounce;
    }

    // Network quality assessment
    if (avgLatency < 100) {
      state.adaptiveState.networkQuality = 'excellent';
    } else if (avgLatency < 300) {
      state.adaptiveState.networkQuality = 'good';
    } else if (avgLatency < 800) {
      state.adaptiveState.networkQuality = 'poor';
    } else {
      state.adaptiveState.networkQuality = 'critical';
    }
  }

  getSliderConfig(sliderId: string): SliderRuntimeState['currentConfig'] | null {
    return this.sliders.get(sliderId)?.currentConfig || null;
  }

  getSliderState(sliderId: string): SliderRuntimeState | null {
    return this.sliders.get(sliderId) || null;
  }

  // Preset modifications for common scenarios
  applyPreset(sliderId: string, preset: 'performance' | 'quality' | 'accessibility' | 'debug') {
    const presets = {
      performance: {
        visual: {
          showRipple: false,
          animationSpeed: 0.5,
          glowIntensity: 0.3,
          trackStyle: 'minimal' as const,
        },
        behavior: {
          debounceMs: 500,
          batchUpdates: true,
          optimisticUpdates: false,
        },
      },
      quality: {
        visual: {
          showRipple: true,
          showGradient: true,
          animationSpeed: 1.2,
          glowIntensity: 0.8,
          trackStyle: 'glow' as const,
          thumbStyle: 'glow' as const,
        },
        behavior: {
          debounceMs: 250,
          optimisticUpdates: true,
        },
      },
      accessibility: {
        visual: {
          showRipple: false,
          animationSpeed: 0.3,
          trackStyle: 'default' as const,
          thumbStyle: 'default' as const,
        },
        behavior: {
          debounceMs: 600,
          errorRetryCount: 5,
        },
      },
      debug: {
        performance: {
          enableMetrics: true,
          metricsBufferSize: 200,
        },
        visual: {
          showPreview: true,
        },
      },
    };

    const config = presets[preset];
    Object.entries(config).forEach(([type, typeConfig]) => {
      this.applyRuntimeModification(sliderId, {
        id: `preset-${preset}-${type}-${Date.now()}`,
        type: type as any,
        config: typeConfig,
      });
    });
  }

  private getDefaultConfig() {
    // Return default configuration for rebuilding
    return {
      visual: {
        showPreview: false,
        showGradient: true,
        showRipple: false,
        animationSpeed: 1,
        glowIntensity: 0.6,
        trackStyle: 'default' as const,
        thumbStyle: 'default' as const,
      },
      behavior: {
        debounceMs: 350,
        adaptiveDebounce: true,
        errorRetryCount: 3,
        errorRetryDelay: 1000,
        optimisticUpdates: true,
        batchUpdates: false,
        priorityLevel: 'normal' as const,
      },
      performance: {
        enableMetrics: true,
        metricsBufferSize: 100,
        performanceThresholds: {
          updateLatency: 500,
          renderTime: 16,
          networkLatency: 200,
        },
        adaptiveOptimization: true,
        memoryMonitoring: true,
      },
    };
  }

  destroy() {
    this.performanceObserver?.disconnect();
    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor);
    }
    this.sliders.clear();
  }
}

// Global instance
export const sliderRuntimeManager = new SliderRuntimeManager();