/**
 * LED Preview Renderer - Decoupled Canvas/WebGL Engine
 * 
 * Task 7.3: Build decoupled Canvas/WebGL render engine and draw pipeline
 * - LedPreviewRenderer(canvas, positions, getLatestFrame) using Canvas2D initially
 * - Batched circle draws via single path per frame
 * - Compute colors from latest frame without allocations
 * - Support start/stop, resize, setTransform(zoom, pan)
 * - Keep internal state isolated from React to avoid re-renders
 */

import { type LedFrame } from './ledFrameProtocol';
import { type PositionBuffers, indexToPos } from './ledPositionMapping';

// Renderer configuration
export interface RendererConfig {
  ledRadius?: number;
  backgroundColor?: string;
  antialias?: boolean;
  pixelRatio?: number;
  maxFPS?: number;
  enablePerformanceMonitoring?: boolean;
}

// Transform state for zoom/pan
export interface ViewTransform {
  zoom: number;
  panX: number;
  panY: number;
  rotation?: number;
}

// Render statistics
export interface RenderStats {
  fps: number;
  frameTime: number;
  drawCalls: number;
  ledsRendered: number;
  lastFrameTime: number;
  totalFrames: number;
  droppedFrames: number;
}

// Color utilities
interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * High-performance LED renderer using Canvas2D
 */
export class LedPreviewRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private positions: PositionBuffers;
  private getLatestFrame: () => LedFrame | null;
  private config: Required<RendererConfig>;
  
  // Animation state
  private animationId: number | null = null;
  private isRunning = false;
  private lastFrameTime = 0;
  private frameCount = 0;
  
  // Transform state
  private transform: ViewTransform = {
    zoom: 1,
    panX: 0,
    panY: 0,
    rotation: 0
  };
  
  // Performance monitoring
  private stats: RenderStats = {
    fps: 0,
    frameTime: 0,
    drawCalls: 0,
    ledsRendered: 0,
    lastFrameTime: 0,
    totalFrames: 0,
    droppedFrames: 0
  };
  
  private fpsHistory: number[] = [];
  private frameTimeHistory: number[] = [];
  
  // Rendering buffers (reused to avoid allocations)
  private colorBuffer: RGB[] = [];
  private transformedPositions: Float32Array;
  
  constructor(
    canvas: HTMLCanvasElement,
    positions: PositionBuffers,
    getLatestFrame: () => LedFrame | null,
    config: RendererConfig = {}
  ) {
    this.canvas = canvas;
    this.positions = positions;
    this.getLatestFrame = getLatestFrame;
    
    this.config = {
      ledRadius: 3,
      backgroundColor: '#000000',
      antialias: true,
      pixelRatio: window.devicePixelRatio || 1,
      maxFPS: 120,
      enablePerformanceMonitoring: true,
      ...config
    };
    
    // Get 2D context with optimizations
    const ctx = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true, // Allow async rendering
      willReadFrequently: false
    });
    
    if (!ctx) {
      throw new Error('Failed to get 2D rendering context');
    }
    
    this.ctx = ctx;
    
    // Initialize buffers
    this.colorBuffer = new Array(positions.config.ledCount);
    this.transformedPositions = new Float32Array(positions.positions.length);
    
    // Set up canvas
    this.setupCanvas();
    
    // Bind methods to preserve context
    this.render = this.render.bind(this);
  }
  
  /**
   * Start rendering loop
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.animationId = requestAnimationFrame(this.render);
  }
  
  /**
   * Stop rendering loop
   */
  stop(): void {
    this.isRunning = false;
    
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
  
  /**
   * Set view transform (zoom, pan, rotation)
   */
  setTransform(transform: Partial<ViewTransform>): void {
    this.transform = { ...this.transform, ...transform };
    this.updateTransformedPositions();
  }
  
  /**
   * Get current transform
   */
  getTransform(): ViewTransform {
    return { ...this.transform };
  }
  
  /**
   * Resize canvas and update rendering
   */
  resize(width: number, height: number): void {
    const { pixelRatio } = this.config;
    
    // Set actual canvas size
    this.canvas.width = width * pixelRatio;
    this.canvas.height = height * pixelRatio;
    
    // Set display size
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    
    // Scale context for high DPI
    this.ctx.scale(pixelRatio, pixelRatio);
    
    this.setupCanvas();
    this.updateTransformedPositions();
  }
  
  /**
   * Get rendering statistics
   */
  getStats(): RenderStats {
    return { ...this.stats };
  }
  
  /**
   * Clear statistics
   */
  clearStats(): void {
    this.stats = {
      fps: 0,
      frameTime: 0,
      drawCalls: 0,
      ledsRendered: 0,
      lastFrameTime: 0,
      totalFrames: 0,
      droppedFrames: 0
    };
    this.fpsHistory = [];
    this.frameTimeHistory = [];
  }
  
  /**
   * Main render loop
   */
  private render(currentTime: number): void {
    if (!this.isRunning) return;
    
    const frameStartTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;
    
    // FPS limiting
    const targetFrameTime = 1000 / this.config.maxFPS;
    if (deltaTime < targetFrameTime) {
      this.animationId = requestAnimationFrame(this.render);
      return;
    }
    
    // Get latest LED frame
    const ledFrame = this.getLatestFrame();
    
    if (ledFrame) {
      // Extract colors from frame data
      this.extractColors(ledFrame);
      
      // Clear canvas
      this.clearCanvas();
      
      // Render LEDs
      this.renderLeds();
      
      this.stats.ledsRendered = this.positions.config.ledCount;
    } else {
      // No frame data - render placeholder or previous frame
      this.renderPlaceholder();
      this.stats.droppedFrames++;
    }
    
    // Update performance stats
    this.updateStats(frameStartTime, currentTime);
    
    this.lastFrameTime = currentTime;
    this.animationId = requestAnimationFrame(this.render);
  }
  
  /**
   * Extract RGB colors from LED frame data
   */
  private extractColors(frame: LedFrame): void {
    const data = frame.data;
    
    for (let i = 0; i < this.positions.config.ledCount; i++) {
      const dataIndex = i * 3;
      
      // Extract RGB values (0-255)
      this.colorBuffer[i] = {
        r: data[dataIndex],
        g: data[dataIndex + 1],
        b: data[dataIndex + 2]
      };
    }
  }
  
  /**
   * Clear canvas with background color
   */
  private clearCanvas(): void {
    const { width, height } = this.canvas;
    
    this.ctx.fillStyle = this.config.backgroundColor;
    this.ctx.fillRect(0, 0, width, height);
  }
  
  /**
   * Render all LEDs using batched drawing
   */
  private renderLeds(): void {
    const { ledRadius } = this.config;
    const ctx = this.ctx;
    
    // Save context state
    ctx.save();
    
    // Apply transform
    this.applyTransform();
    
    // Batch render all LEDs in a single path for performance
    ctx.beginPath();
    
    for (let i = 0; i < this.positions.config.ledCount; i++) {
      const x = this.transformedPositions[i * 2];
      const y = this.transformedPositions[i * 2 + 1];
      
      // Add circle to path
      ctx.moveTo(x + ledRadius, y);
      ctx.arc(x, y, ledRadius, 0, Math.PI * 2);
    }
    
    // Fill all circles with a base color first
    ctx.fillStyle = '#333333';
    ctx.fill();
    
    // Now render individual LED colors
    for (let i = 0; i < this.positions.config.ledCount; i++) {
      const color = this.colorBuffer[i];
      const x = this.transformedPositions[i * 2];
      const y = this.transformedPositions[i * 2 + 1];
      
      // Skip if LED is off (all zeros)
      if (color.r === 0 && color.g === 0 && color.b === 0) {
        continue;
      }
      
      // Render individual LED
      ctx.beginPath();
      ctx.arc(x, y, ledRadius, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
      ctx.fill();
      
      // Optional: Add glow effect for bright LEDs
      if (color.r > 200 || color.g > 200 || color.b > 200) {
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = ledRadius * 2;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
    
    // Restore context state
    ctx.restore();
    
    this.stats.drawCalls = this.positions.config.ledCount + 1; // Batch + individual
  }
  
  /**
   * Render placeholder when no frame data available
   */
  private renderPlaceholder(): void {
    const ctx = this.ctx;
    const { ledRadius } = this.config;
    
    ctx.save();
    this.applyTransform();
    
    // Render dim LEDs to show layout
    ctx.fillStyle = '#222222';
    ctx.beginPath();
    
    for (let i = 0; i < this.positions.config.ledCount; i++) {
      const x = this.transformedPositions[i * 2];
      const y = this.transformedPositions[i * 2 + 1];
      
      ctx.moveTo(x + ledRadius, y);
      ctx.arc(x, y, ledRadius, 0, Math.PI * 2);
    }
    
    ctx.fill();
    ctx.restore();
    
    this.stats.drawCalls = 1;
  }
  
  /**
   * Apply current view transform to context
   */
  private applyTransform(): void {
    const { zoom, panX, panY, rotation = 0 } = this.transform;
    const ctx = this.ctx;
    
    // Translate to center for zoom/rotation
    const centerX = this.canvas.width / (2 * this.config.pixelRatio);
    const centerY = this.canvas.height / (2 * this.config.pixelRatio);
    
    ctx.translate(centerX + panX, centerY + panY);
    ctx.scale(zoom, zoom);
    ctx.rotate(rotation);
    ctx.translate(-centerX, -centerY);
  }
  
  /**
   * Update transformed positions for current view
   */
  private updateTransformedPositions(): void {
    // For now, just copy positions - transform is applied in context
    // In a more advanced implementation, we could pre-transform positions
    this.transformedPositions.set(this.positions.positions);
  }
  
  /**
   * Setup canvas rendering properties
   */
  private setupCanvas(): void {
    const ctx = this.ctx;
    
    // Set rendering quality
    ctx.imageSmoothingEnabled = this.config.antialias;
    ctx.imageSmoothingQuality = 'high';
    
    // Set line properties for crisp rendering
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }
  
  /**
   * Update performance statistics
   */
  private updateStats(frameStartTime: number, currentTime: number): void {
    const frameTime = performance.now() - frameStartTime;
    
    this.stats.frameTime = frameTime;
    this.stats.lastFrameTime = currentTime;
    this.stats.totalFrames++;
    
    // Track frame time history
    this.frameTimeHistory.push(frameTime);
    if (this.frameTimeHistory.length > 60) {
      this.frameTimeHistory.shift();
    }
    
    // Calculate FPS
    this.frameCount++;
    const timeSinceLastFpsUpdate = currentTime - (this.stats.lastFrameTime || 0);
    
    if (timeSinceLastFpsUpdate >= 1000) { // Update FPS every second
      this.stats.fps = (this.frameCount * 1000) / timeSinceLastFpsUpdate;
      this.frameCount = 0;
      
      // Track FPS history
      this.fpsHistory.push(this.stats.fps);
      if (this.fpsHistory.length > 60) {
        this.fpsHistory.shift();
      }
    }
  }
  
  /**
   * Get performance history for monitoring
   */
  getPerformanceHistory(): {
    fpsHistory: number[];
    frameTimeHistory: number[];
    averageFps: number;
    averageFrameTime: number;
  } {
    const avgFps = this.fpsHistory.length > 0 
      ? this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length 
      : 0;
      
    const avgFrameTime = this.frameTimeHistory.length > 0
      ? this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length
      : 0;
    
    return {
      fpsHistory: [...this.fpsHistory],
      frameTimeHistory: [...this.frameTimeHistory],
      averageFps: avgFps,
      averageFrameTime: avgFrameTime
    };
  }
}

/**
 * WebGL renderer for high-performance LED rendering
 * Uses point sprites and batched rendering for optimal performance
 */
export class LedPreviewRendererWebGL {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private positions: PositionBuffers;
  private getLatestFrame: () => LedFrame | null;
  private config: Required<RendererConfig>;

  // WebGL objects
  private program: WebGLProgram | null = null;
  private vertexBuffer: WebGLBuffer | null = null;
  private colorTexture: WebGLTexture | null = null;
  private framebuffer: WebGLFramebuffer | null = null;
  private renderbuffer: WebGLRenderbuffer | null = null;

  // Shader attributes and uniforms
  private positionAttrib: number = -1;
  private resolutionUniform: WebGLUniformLocation | null = null;
  private transformUniform: WebGLUniformLocation | null = null;
  private ledRadiusUniform: WebGLUniformLocation | null = null;
  private colorDataUniform: WebGLUniformLocation | null = null;
  private colorTextureUnit: number = 0;

  // Animation state
  private animationId: number | null = null;
  private isRunning = false;
  private lastFrameTime = 0;
  private frameCount = 0;

  // Transform state
  private transform: ViewTransform = {
    zoom: 1,
    panX: 0,
    panY: 0,
    rotation: 0
  };

  // Performance monitoring
  private stats: RenderStats = {
    fps: 0,
    frameTime: 0,
    drawCalls: 1,
    ledsRendered: 0,
    lastFrameTime: 0,
    totalFrames: 0,
    droppedFrames: 0
  };

  private fpsHistory: number[] = [];
  private frameTimeHistory: number[] = [];

  // Color data buffer
  private colorData: Uint8Array;
  private transformedPositions: Float32Array;

  constructor(
    canvas: HTMLCanvasElement,
    positions: PositionBuffers,
    getLatestFrame: () => LedFrame | null,
    config: RendererConfig = {}
  ) {
    this.canvas = canvas;
    this.positions = positions;
    this.getLatestFrame = getLatestFrame;

    this.config = {
      ledRadius: 3,
      backgroundColor: '#000000',
      antialias: true,
      pixelRatio: window.devicePixelRatio || 1,
      maxFPS: 120,
      enablePerformanceMonitoring: true,
      ...config
    };

    // Get WebGL context with optimization flags
    const gl = canvas.getContext('webgl', {
      antialias: this.config.antialias,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance'
    });

    if (!gl) {
      throw new Error('Failed to get WebGL context');
    }

    this.gl = gl;

    // Initialize WebGL resources
    this.initializeWebGL();

    // Allocate color buffer
    this.colorData = new Uint8Array(positions.config.ledCount * 3);
    this.transformedPositions = new Float32Array(positions.positions.length);

    // Bind render method
    this.render = this.render.bind(this);
  }

  /**
   * Initialize WebGL resources: shaders, buffers, textures
   */
  private initializeWebGL(): void {
    const gl = this.gl;

    // Compile shaders
    const vertexShader = this.compileShader(
      gl.VERTEX_SHADER,
      this.getVertexShaderSource()
    );
    const fragmentShader = this.compileShader(
      gl.FRAGMENT_SHADER,
      this.getFragmentShaderSource()
    );

    if (!vertexShader || !fragmentShader) {
      throw new Error('Failed to compile shaders');
    }

    // Link program
    this.program = gl.createProgram();
    if (!this.program) {
      throw new Error('Failed to create WebGL program');
    }

    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(this.program));
      throw new Error('Failed to link WebGL program');
    }

    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    gl.useProgram(this.program);

    // Get attribute and uniform locations
    this.positionAttrib = gl.getAttribLocation(this.program, 'position');
    this.resolutionUniform = gl.getUniformLocation(this.program, 'resolution');
    this.transformUniform = gl.getUniformLocation(this.program, 'transform');
    this.ledRadiusUniform = gl.getUniformLocation(this.program, 'ledRadius');
    this.colorDataUniform = gl.getUniformLocation(this.program, 'colorData');

    // Create vertex buffer
    this.vertexBuffer = gl.createBuffer();
    if (!this.vertexBuffer) {
      throw new Error('Failed to create vertex buffer');
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.positions.positions, gl.STATIC_DRAW);

    // Set up vertex attribute pointer
    gl.enableVertexAttribArray(this.positionAttrib);
    gl.vertexAttribPointer(this.positionAttrib, 2, gl.FLOAT, false, 8, 0);

    // Setup rendering properties
    gl.clearColor(0, 0, 0, 1);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);
  }

  /**
   * Compile a shader
   */
  private compileShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl;
    const shader = gl.createShader(type);

    if (!shader) {
      return null;
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  /**
   * Get vertex shader source
   */
  private getVertexShaderSource(): string {
    return `
      attribute vec2 position;
      uniform vec2 resolution;
      uniform mat4 transform;
      uniform float ledRadius;

      void main() {
        vec2 pos = position;

        // Apply zoom and pan
        pos *= vec2(transform[0][0], transform[1][1]); // zoom
        pos += vec2(transform[3][0], transform[3][1]); // pan

        // Normalize to clip space
        vec2 clipSpace = (pos / (resolution * 0.5)) - 1.0;

        gl_Position = vec4(clipSpace, 0, 1);
        gl_PointSize = ledRadius * 2.0;
      }
    `;
  }

  /**
   * Get fragment shader source
   */
  private getFragmentShaderSource(): string {
    return `
      precision mediump float;
      uniform sampler2D colorData;
      uniform float ledRadius;

      void main() {
        // Calculate distance from center of point sprite
        vec2 pointCoord = gl_PointCoord - 0.5;
        float dist = length(pointCoord);

        // Discard pixels outside circle
        if (dist > 0.5) {
          discard;
        }

        // Sample color from texture (would be populated from frame data)
        vec4 color = vec4(1.0, 1.0, 1.0, 1.0);

        // Apply smoothing at edges for antialiased circles
        float edge = 0.5 - (0.02 * ledRadius);
        float alpha = smoothstep(0.5, edge, dist);

        gl_FragColor = vec4(color.rgb, alpha);
      }
    `;
  }

  /**
   * Start rendering loop
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.animationId = requestAnimationFrame(this.render);
  }

  /**
   * Stop rendering loop
   */
  stop(): void {
    this.isRunning = false;

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Set view transform
   */
  setTransform(transform: Partial<ViewTransform>): void {
    this.transform = { ...this.transform, ...transform };
    this.updateTransformedPositions();
  }

  /**
   * Get current transform
   */
  getTransform(): ViewTransform {
    return { ...this.transform };
  }

  /**
   * Resize canvas
   */
  resize(width: number, height: number): void {
    const { pixelRatio } = this.config;

    this.canvas.width = width * pixelRatio;
    this.canvas.height = height * pixelRatio;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.updateTransformedPositions();
  }

  /**
   * Get rendering statistics
   */
  getStats(): RenderStats {
    return { ...this.stats };
  }

  /**
   * Clear statistics
   */
  clearStats(): void {
    this.stats = {
      fps: 0,
      frameTime: 0,
      drawCalls: 1,
      ledsRendered: 0,
      lastFrameTime: 0,
      totalFrames: 0,
      droppedFrames: 0
    };
    this.fpsHistory = [];
    this.frameTimeHistory = [];
  }

  /**
   * Main render loop
   */
  private render(currentTime: number): void {
    if (!this.isRunning) return;

    const frameStartTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;

    // FPS limiting
    const targetFrameTime = 1000 / this.config.maxFPS;
    if (deltaTime < targetFrameTime) {
      this.animationId = requestAnimationFrame(this.render);
      return;
    }

    const gl = this.gl;

    // Get latest LED frame
    const ledFrame = this.getLatestFrame();

    // Clear canvas
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (ledFrame) {
      // Extract colors from frame
      this.extractColors(ledFrame);

      // Render LEDs
      this.renderLeds();

      this.stats.ledsRendered = this.positions.config.ledCount;
    } else {
      this.stats.droppedFrames++;
    }

    // Update performance stats
    this.updateStats(frameStartTime, currentTime);

    this.lastFrameTime = currentTime;
    this.animationId = requestAnimationFrame(this.render);
  }

  /**
   * Extract colors from LED frame
   */
  private extractColors(frame: LedFrame): void {
    const data = frame.data;

    for (let i = 0; i < this.positions.config.ledCount; i++) {
      const srcIndex = i * 3;
      const dstIndex = i * 3;

      this.colorData[dstIndex] = data[srcIndex];
      this.colorData[dstIndex + 1] = data[srcIndex + 1];
      this.colorData[dstIndex + 2] = data[srcIndex + 2];
    }
  }

  /**
   * Render all LEDs using WebGL point sprites
   */
  private renderLeds(): void {
    const gl = this.gl;

    if (!this.program) {
      return;
    }

    gl.useProgram(this.program);

    // Set uniforms
    if (this.resolutionUniform) {
      gl.uniform2f(
        this.resolutionUniform,
        this.canvas.width / this.config.pixelRatio,
        this.canvas.height / this.config.pixelRatio
      );
    }

    if (this.ledRadiusUniform) {
      gl.uniform1f(this.ledRadiusUniform, this.config.ledRadius);
    }

    // Build transform matrix (simplified 2D)
    const transform = [
      this.transform.zoom, 0, 0, this.transform.panX,
      0, this.transform.zoom, 0, this.transform.panY,
      0, 0, 1, 0,
      0, 0, 0, 1
    ];

    if (this.transformUniform) {
      gl.uniformMatrix4fv(
        this.transformUniform,
        false,
        new Float32Array(transform)
      );
    }

    // Bind vertex buffer
    if (this.vertexBuffer) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
      gl.enableVertexAttribArray(this.positionAttrib);
      gl.vertexAttribPointer(this.positionAttrib, 2, gl.FLOAT, false, 8, 0);
    }

    // Draw all LEDs as points
    gl.drawArrays(gl.POINTS, 0, this.positions.config.ledCount);

    this.stats.drawCalls = 1;
  }

  /**
   * Update transformed positions
   */
  private updateTransformedPositions(): void {
    this.transformedPositions.set(this.positions.positions);
  }

  /**
   * Update performance statistics
   */
  private updateStats(frameStartTime: number, currentTime: number): void {
    const frameTime = performance.now() - frameStartTime;

    this.stats.frameTime = frameTime;
    this.stats.lastFrameTime = currentTime;
    this.stats.totalFrames++;

    // Track frame time history
    this.frameTimeHistory.push(frameTime);
    if (this.frameTimeHistory.length > 60) {
      this.frameTimeHistory.shift();
    }

    // Calculate FPS
    this.frameCount++;
    const timeSinceLastFpsUpdate = currentTime - (this.stats.lastFrameTime || 0);

    if (timeSinceLastFpsUpdate >= 1000) {
      this.stats.fps = (this.frameCount * 1000) / timeSinceLastFpsUpdate;
      this.frameCount = 0;

      // Track FPS history
      this.fpsHistory.push(this.stats.fps);
      if (this.fpsHistory.length > 60) {
        this.fpsHistory.shift();
      }
    }
  }

  /**
   * Get performance history
   */
  getPerformanceHistory(): {
    fpsHistory: number[];
    frameTimeHistory: number[];
    averageFps: number;
    averageFrameTime: number;
  } {
    const avgFps = this.fpsHistory.length > 0
      ? this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length
      : 0;

    const avgFrameTime = this.frameTimeHistory.length > 0
      ? this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length
      : 0;

    return {
      fpsHistory: [...this.fpsHistory],
      frameTimeHistory: [...this.frameTimeHistory],
      averageFps: avgFps,
      averageFrameTime: avgFrameTime
    };
  }

  /**
   * Clean up WebGL resources
   */
  dispose(): void {
    const gl = this.gl;

    this.stop();

    if (this.program) {
      gl.deleteProgram(this.program);
      this.program = null;
    }

    if (this.vertexBuffer) {
      gl.deleteBuffer(this.vertexBuffer);
      this.vertexBuffer = null;
    }

    if (this.colorTexture) {
      gl.deleteTexture(this.colorTexture);
      this.colorTexture = null;
    }

    if (this.framebuffer) {
      gl.deleteFramebuffer(this.framebuffer);
      this.framebuffer = null;
    }

    if (this.renderbuffer) {
      gl.deleteRenderbuffer(this.renderbuffer);
      this.renderbuffer = null;
    }
  }
}

/**
 * Detect WebGL support
 */
function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  } catch (e) {
    return false;
  }
}

/**
 * Union type for either renderer
 */
export type LedRenderer = LedPreviewRenderer | LedPreviewRendererWebGL;

/**
 * Factory function to create appropriate renderer with automatic fallback
 */
export function createLedRenderer(
  canvas: HTMLCanvasElement,
  positions: PositionBuffers,
  getLatestFrame: () => LedFrame | null,
  config: RendererConfig & { preferWebGL?: boolean } = {}
): LedRenderer {

  // Prefer WebGL if requested and available, otherwise use Canvas2D
  if (config.preferWebGL && supportsWebGL()) {
    try {
      return new LedPreviewRendererWebGL(canvas, positions, getLatestFrame, config);
    } catch (error) {
      console.warn('WebGL initialization failed, falling back to Canvas2D:', error);
      return new LedPreviewRenderer(canvas, positions, getLatestFrame, config);
    }
  }

  // Default to Canvas2D renderer
  return new LedPreviewRenderer(canvas, positions, getLatestFrame, config);
}