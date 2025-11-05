/**
 * LED Renderer Tests - Canvas2D and WebGL implementations
 *
 * Tests for:
 * - Renderer initialization and cleanup
 * - Canvas2D baseline rendering
 * - WebGL rendering with fallback support
 * - Performance metrics and statistics
 * - Transform operations (zoom, pan, rotation)
 * - Frame rendering and color extraction
 * - Browser compatibility detection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LedPreviewRenderer,
  LedPreviewRendererWebGL,
  createLedRenderer,
  type RendererConfig,
  type RenderStats
} from '../ledRenderer';
import { computePositions, type PositionBuffers } from '../ledPositionMapping';
import { type LedFrame, FRAME_SIZE, FrameType } from '../ledFrameProtocol';

/**
 * Create mock LED frame with test data
 */
function createMockLedFrame(): LedFrame {
  const data = new Uint8Array(FRAME_SIZE);

  // Create gradient pattern for testing
  for (let i = 0; i < 180; i++) {
    const r = Math.floor((i / 180) * 255);
    const g = Math.floor((180 - i) / 180 * 255);
    const b = 128;

    data[i * 3] = r;
    data[i * 3 + 1] = g;
    data[i * 3 + 2] = b;
  }

  return {
    header: {
      version: 1,
      type: FrameType.LED_DATA,
      reserved: 0
    },
    timestamp: performance.now(),
    data
  };
}

/**
 * Canvas2D Renderer Tests
 */
describe('LedPreviewRenderer (Canvas2D)', () => {
  let canvas: HTMLCanvasElement;
  let positions: PositionBuffers;
  let renderer: LedPreviewRenderer;
  let frameProvider: () => LedFrame | null;

  beforeEach(() => {
    // Create canvas element
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    document.body.appendChild(canvas);

    // Create position data
    positions = computePositions({
      ledCount: 180,
      radius: 200,
      centerX: 400,
      centerY: 300
    });

    // Create frame provider
    let lastFrame = createMockLedFrame();
    frameProvider = () => lastFrame;

    // Create renderer
    renderer = new LedPreviewRenderer(canvas, positions, frameProvider);
  });

  afterEach(() => {
    renderer.stop();
    document.body.removeChild(canvas);
  });

  it('should initialize without errors', () => {
    expect(renderer).toBeDefined();
    expect(renderer.getStats()).toBeDefined();
  });

  it('should start and stop rendering', () => {
    renderer.start();
    expect(renderer.getStats().totalFrames).toBe(0); // Initial state

    renderer.stop();
    // Renderer should have stopped
  });

  it('should resize canvas correctly', () => {
    renderer.resize(1024, 768);

    expect(canvas.style.width).toBe('1024px');
    expect(canvas.style.height).toBe('768px');
  });

  it('should handle zoom transformation', () => {
    renderer.setTransform({ zoom: 2 });

    const transform = renderer.getTransform();
    expect(transform.zoom).toBe(2);
  });

  it('should handle pan transformation', () => {
    renderer.setTransform({ panX: 50, panY: 100 });

    const transform = renderer.getTransform();
    expect(transform.panX).toBe(50);
    expect(transform.panY).toBe(100);
  });

  it('should accumulate render statistics', (done) => {
    renderer.start();

    setTimeout(() => {
      const stats = renderer.getStats();
      expect(stats.frameTime).toBeGreaterThanOrEqual(0);
      expect(stats.fps).toBeGreaterThanOrEqual(0);
      expect(stats.ledsRendered).toBeGreaterThan(0);

      renderer.stop();
      done();
    }, 100);
  });

  it('should clear statistics', () => {
    renderer.start();

    setTimeout(() => {
      renderer.clearStats();
      const stats = renderer.getStats();

      expect(stats.fps).toBe(0);
      expect(stats.frameTime).toBe(0);
      expect(stats.totalFrames).toBe(0);

      renderer.stop();
    }, 50);
  });

  it('should handle missing frames gracefully', (done) => {
    let callCount = 0;
    frameProvider = () => {
      callCount++;
      return callCount % 2 === 0 ? null : createMockLedFrame();
    };

    renderer = new LedPreviewRenderer(canvas, positions, frameProvider);
    renderer.start();

    setTimeout(() => {
      const stats = renderer.getStats();
      expect(stats.droppedFrames).toBeGreaterThan(0);

      renderer.stop();
      done();
    }, 100);
  });

  it('should render all LEDs', (done) => {
    renderer.start();

    setTimeout(() => {
      const stats = renderer.getStats();
      expect(stats.ledsRendered).toBe(180);

      renderer.stop();
      done();
    }, 50);
  });

  it('should get performance history', () => {
    renderer.start();

    setTimeout(() => {
      const history = renderer.getPerformanceHistory();

      expect(Array.isArray(history.fpsHistory)).toBe(true);
      expect(Array.isArray(history.frameTimeHistory)).toBe(true);
      expect(history.averageFps).toBeGreaterThanOrEqual(0);
      expect(history.averageFrameTime).toBeGreaterThanOrEqual(0);

      renderer.stop();
    }, 100);
  });

  it('should respect maxFPS setting', (done) => {
    const config: RendererConfig = { maxFPS: 30 };
    const testRenderer = new LedPreviewRenderer(
      canvas,
      positions,
      frameProvider,
      config
    );

    testRenderer.start();

    setTimeout(() => {
      const stats = testRenderer.getStats();
      // FPS should be limited to approximately 30
      expect(stats.fps).toBeLessThanOrEqual(35); // Allow small margin

      testRenderer.stop();
      done();
    }, 500);
  });
});

/**
 * WebGL Renderer Tests
 */
describe('LedPreviewRendererWebGL', () => {
  let canvas: HTMLCanvasElement;
  let positions: PositionBuffers;
  let renderer: LedPreviewRendererWebGL | null = null;
  let frameProvider: () => LedFrame | null;

  beforeEach(() => {
    // Check WebGL support
    const testCanvas = document.createElement('canvas');
    const supported = !!(
      testCanvas.getContext('webgl') ||
      testCanvas.getContext('experimental-webgl')
    );

    if (!supported) {
      console.warn('WebGL not supported in test environment, skipping WebGL tests');
      return;
    }

    // Create canvas element
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    document.body.appendChild(canvas);

    // Create position data
    positions = computePositions({
      ledCount: 180,
      radius: 200,
      centerX: 400,
      centerY: 300
    });

    // Create frame provider
    let lastFrame = createMockLedFrame();
    frameProvider = () => lastFrame;

    // Try to create renderer
    try {
      renderer = new LedPreviewRendererWebGL(canvas, positions, frameProvider);
    } catch (error) {
      console.warn('WebGL initialization failed:', error);
    }
  });

  afterEach(() => {
    if (renderer) {
      renderer.stop();
      renderer.dispose();
    }
    if (canvas && canvas.parentNode) {
      document.body.removeChild(canvas);
    }
  });

  it('should initialize WebGL context', () => {
    if (!renderer) {
      console.warn('Skipping test - WebGL not available');
      return;
    }

    expect(renderer).toBeDefined();
    expect(renderer.getStats()).toBeDefined();
  });

  it('should start and stop WebGL rendering', () => {
    if (!renderer) {
      console.warn('Skipping test - WebGL not available');
      return;
    }

    renderer.start();
    renderer.stop();
  });

  it('should handle WebGL resize', () => {
    if (!renderer) {
      console.warn('Skipping test - WebGL not available');
      return;
    }

    renderer.resize(1024, 768);

    expect(canvas.style.width).toBe('1024px');
    expect(canvas.style.height).toBe('768px');
  });

  it('should support WebGL transforms', () => {
    if (!renderer) {
      console.warn('Skipping test - WebGL not available');
      return;
    }

    renderer.setTransform({ zoom: 1.5, panX: 25, panY: 50 });

    const transform = renderer.getTransform();
    expect(transform.zoom).toBe(1.5);
    expect(transform.panX).toBe(25);
    expect(transform.panY).toBe(50);
  });

  it('should clean up WebGL resources', () => {
    if (!renderer) {
      console.warn('Skipping test - WebGL not available');
      return;
    }

    renderer.dispose();
    // After dispose, renderer should be cleaned up
  });
});

/**
 * Factory Function and Fallback Tests
 */
describe('createLedRenderer factory', () => {
  let canvas: HTMLCanvasElement;
  let positions: PositionBuffers;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    document.body.appendChild(canvas);

    positions = computePositions({
      ledCount: 180,
      radius: 200,
      centerX: 400,
      centerY: 300
    });
  });

  afterEach(() => {
    document.body.removeChild(canvas);
  });

  it('should create Canvas2D renderer by default', () => {
    const renderer = createLedRenderer(
      canvas,
      positions,
      () => null
    );

    expect(renderer).toBeInstanceOf(LedPreviewRenderer);
  });

  it('should attempt WebGL if preferred', () => {
    const renderer = createLedRenderer(
      canvas,
      positions,
      () => null,
      { preferWebGL: true }
    );

    // Should either be WebGL or Canvas2D if WebGL unavailable
    expect(
      renderer instanceof LedPreviewRenderer ||
      renderer instanceof LedPreviewRendererWebGL
    ).toBe(true);
  });

  it('should fall back to Canvas2D on WebGL failure', () => {
    // Force failure by mocking context getter
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    let webglAttempted = false;

    HTMLCanvasElement.prototype.getContext = function(contextId: string) {
      if (contextId === 'webgl') {
        webglAttempted = true;
        return null; // Simulate WebGL failure
      }
      return originalGetContext.call(this, contextId);
    };

    try {
      const renderer = createLedRenderer(
        canvas,
        positions,
        () => null,
        { preferWebGL: true }
      );

      // Should fall back to Canvas2D
      expect(renderer).toBeInstanceOf(LedPreviewRenderer);
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    }
  });

  it('should pass config to renderer', () => {
    const config: RendererConfig = {
      ledRadius: 5,
      backgroundColor: '#111111',
      maxFPS: 60
    };

    const renderer = createLedRenderer(
      canvas,
      positions,
      () => null,
      config
    );

    expect(renderer).toBeDefined();
  });
});

/**
 * Performance Benchmark Tests
 */
describe('Renderer Performance Benchmarks', () => {
  let canvas: HTMLCanvasElement;
  let positions: PositionBuffers;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    document.body.appendChild(canvas);
  });

  afterEach(() => {
    document.body.removeChild(canvas);
  });

  it('should handle 180 LEDs efficiently', (done) => {
    positions = computePositions({ ledCount: 180 });

    let frameCount = 0;
    const renderer = createLedRenderer(
      canvas,
      positions,
      () => {
        frameCount++;
        return frameCount % 10 === 0 ? createMockLedFrame() : null;
      }
    );

    renderer.start();

    setTimeout(() => {
      const stats = renderer.getStats();
      expect(stats.fps).toBeGreaterThan(0);
      expect(stats.ledsRendered).toBeGreaterThan(0);

      renderer.stop();
      done();
    }, 500);
  });

  it('should handle 500 LEDs (stress test)', (done) => {
    positions = computePositions({ ledCount: 500 });

    let frameCount = 0;
    const renderer = createLedRenderer(
      canvas,
      positions,
      () => {
        frameCount++;
        return frameCount % 10 === 0 ? createMockLedFrame() : null;
      }
    );

    renderer.start();

    setTimeout(() => {
      const stats = renderer.getStats();
      expect(stats.fps).toBeGreaterThan(0);

      renderer.stop();
      done();
    }, 500);
  });

  it('should maintain consistent frame times', (done) => {
    positions = computePositions({ ledCount: 180 });

    let frameCount = 0;
    const renderer = createLedRenderer(
      canvas,
      positions,
      () => {
        frameCount++;
        return createMockLedFrame();
      }
    );

    renderer.start();

    setTimeout(() => {
      const history = renderer.getPerformanceHistory();

      // Calculate variance in frame times
      if (history.frameTimeHistory.length > 5) {
        const frameTimes = history.frameTimeHistory;
        const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        const variance = frameTimes.reduce(
          (sum, ft) => sum + Math.pow(ft - avg, 2),
          0
        ) / frameTimes.length;
        const stdDev = Math.sqrt(variance);

        // Standard deviation should be reasonable
        expect(stdDev).toBeLessThan(avg * 2);
      }

      renderer.stop();
      done();
    }, 500);
  });
});

/**
 * Compatibility Tests
 */
describe('Renderer Compatibility', () => {
  it('should detect WebGL support correctly', () => {
    const canvas = document.createElement('canvas');
    const hasWebGL = !!(
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    );

    // Test is just to verify detection works - result varies by environment
    expect(typeof hasWebGL).toBe('boolean');
  });

  it('should work with high DPI displays', (done) => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    document.body.appendChild(canvas);

    const positions = computePositions({ ledCount: 180 });

    // Simulate high DPI
    const config: RendererConfig = {
      pixelRatio: 2
    };

    const renderer = createLedRenderer(
      canvas,
      positions,
      () => createMockLedFrame(),
      config
    );

    renderer.start();

    setTimeout(() => {
      const stats = renderer.getStats();
      expect(stats.totalFrames).toBeGreaterThan(0);

      renderer.stop();
      document.body.removeChild(canvas);
      done();
    }, 100);
  });
});
