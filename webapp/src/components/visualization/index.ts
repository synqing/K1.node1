/**
 * LED Visualization Components Export Barrel
 * 
 * Task 7.7: Export all LED visualization components and utilities
 * - Main components for easy importing
 * - Type exports for TypeScript consumers
 * - Utility functions and hooks
 * - Configuration presets
 */

// Main components
export { 
  LedVisualization,
  LedVisualizationSimple,
  LedVisualizationMock,
  type LedVisualizationProps,
  type LedVisualizationConfig
} from './LedVisualization';

export {
  LedVisualizationControls,
  useCanvasInteractions,
  type ViewportConfig
} from './LedVisualizationControls';

// Core library exports
export {
  // Frame protocol
  subscribeLedFrames,
  buildLedFrameUrl,
  validateFrame,
  parseLedFrame,
  parseMetadataFrame,
  LedFrameSubscription,
  type LedFrame,
  type FrameMetadata,
  type LedFrameEvents,
  type LedFrameSubscriptionOptions,
  FrameType,
  LED_COUNT,
  FRAME_SIZE
} from '../../lib/ledFrameProtocol';

export {
  // Frame queue
  FrameQueue,
  AdaptiveFrameQueue,
  createFrameQueue,
  benchmarkFrameQueue,
  type FrameQueueConfig,
  type FrameQueueStats
} from '../../lib/frameQueue';

export {
  // Renderer
  LedPreviewRenderer,
  createLedRenderer,
  type RendererConfig,
  type ViewTransform,
  type RenderStats
} from '../../lib/ledRenderer';

export {
  // Position mapping
  computePositions,
  calculateMirrorIndex,
  indexMirror,
  indexToPos,
  posToIndex,
  getLedPosition,
  getAllLedPositions,
  calculateBoundingBox,
  transformPositions,
  validateMirrorSymmetry,
  createStandardConfigurations,
  benchmarkPositionMapping,
  type LedPosition,
  type PositionMappingConfig,
  type PositionBuffers,
  DEFAULT_RADIUS,
  DEFAULT_CENTER_X,
  DEFAULT_CENTER_Y,
  MIRROR_AXIS_INDEX
} from '../../lib/ledPositionMapping';

// Configuration presets
export const LED_VISUALIZATION_PRESETS = {
  // High performance preset
  highPerformance: {
    targetFPS: 120,
    enableWebGL: true,
    queueCapacity: 2,
    enableAdaptiveQueue: true,
    ledRadius: 2,
    showStats: true
  } as LedVisualizationConfig,
  
  // Balanced preset (default)
  balanced: {
    targetFPS: 60,
    enableWebGL: false,
    queueCapacity: 3,
    enableAdaptiveQueue: true,
    ledRadius: 3,
    showStats: true
  } as LedVisualizationConfig,
  
  // Low power preset
  lowPower: {
    targetFPS: 30,
    enableWebGL: false,
    queueCapacity: 2,
    enableAdaptiveQueue: false,
    ledRadius: 4,
    showStats: false
  } as LedVisualizationConfig,
  
  // Development preset with mock data
  development: {
    enableMockMode: true,
    targetFPS: 60,
    showControls: true,
    showStats: true,
    ledRadius: 3
  } as LedVisualizationConfig,
  
  // Embedded preset (minimal UI)
  embedded: {
    showControls: false,
    showStats: false,
    targetFPS: 30,
    ledRadius: 2,
    autoConnect: true
  } as LedVisualizationConfig
};

// Utility functions
export const LED_VISUALIZATION_UTILS = {
  /**
   * Create WebSocket URL from device IP
   */
  createWebSocketUrl: (deviceIp: string, port: number = 8080): string => {
    return `ws://${deviceIp}:${port}`;
  },
  
  /**
   * Validate device endpoint format
   */
  validateEndpoint: (endpoint: string): boolean => {
    try {
      new URL(endpoint);
      return true;
    } catch {
      // Try as IP:port format
      const ipPortRegex = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/;
      return ipPortRegex.test(endpoint);
    }
  },
  
  /**
   * Calculate optimal frame queue size based on FPS
   */
  calculateOptimalQueueSize: (targetFPS: number): number => {
    // Rule of thumb: 2-3 frames buffer for smooth playback
    if (targetFPS >= 120) return 2;
    if (targetFPS >= 60) return 3;
    if (targetFPS >= 30) return 4;
    return 5;
  },
  
  /**
   * Get recommended LED radius based on LED count and canvas size
   */
  getRecommendedLedRadius: (ledCount: number, canvasWidth: number): number => {
    const circumference = Math.PI * 2 * (canvasWidth * 0.3); // Assume 30% of width as radius
    const ledSpacing = circumference / ledCount;
    return Math.max(1, Math.min(8, ledSpacing * 0.3));
  },
  
  /**
   * Create color from RGB values
   */
  createColor: (r: number, g: number, b: number): string => {
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  },
  
  /**
   * Convert color to hex
   */
  colorToHex: (r: number, g: number, b: number): string => {
    const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
};

// Error classes
export class LedVisualizationError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'LedVisualizationError';
  }
}

export class ConnectionError extends LedVisualizationError {
  constructor(message: string, public endpoint?: string) {
    super(message, 'CONNECTION_ERROR');
    this.name = 'ConnectionError';
  }
}

export class RenderError extends LedVisualizationError {
  constructor(message: string, public context?: string) {
    super(message, 'RENDER_ERROR');
    this.name = 'RenderError';
  }
}

// Version info
export const LED_VISUALIZATION_VERSION = '1.0.0';
export const SUPPORTED_PROTOCOL_VERSION = 1;

// Feature detection
export const LED_VISUALIZATION_FEATURES = {
  webgl: (() => {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch {
      return false;
    }
  })(),
  
  webSocket: typeof WebSocket !== 'undefined',
  
  performanceNow: typeof performance !== 'undefined' && typeof performance.now === 'function',
  
  resizeObserver: typeof ResizeObserver !== 'undefined',
  
  requestAnimationFrame: typeof requestAnimationFrame !== 'undefined'
};