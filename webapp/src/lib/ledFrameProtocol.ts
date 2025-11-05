/**
 * LED Frame Protocol and WebSocket Subscription API
 * 
 * Task 7.1: Define WebSocket frame protocol and K1Client subscription API
 * - Fixed-length 540-byte RGB frame (180 LEDs × 3 bytes)
 * - TypeScript types and subscribeLedFrames helper
 * - Binary frame validation, heartbeat/ping handling
 * - Reconnect hooks and error surfacing via events
 */

// LED frame constants
export const LED_COUNT = 180;
export const BYTES_PER_LED = 3; // RGB
export const FRAME_SIZE = LED_COUNT * BYTES_PER_LED; // 540 bytes
export const FRAME_HEADER_SIZE = 4; // Version + type + reserved
export const TOTAL_FRAME_SIZE = FRAME_HEADER_SIZE + FRAME_SIZE; // 544 bytes

// Frame header structure
export interface FrameHeader {
  version: number;    // Protocol version (1 byte)
  type: number;       // Frame type (1 byte)
  reserved: number;   // Reserved for future use (2 bytes)
}

// Frame types
export enum FrameType {
  LED_DATA = 0x01,     // RGB LED data frame
  HEARTBEAT = 0x02,    // Heartbeat/ping frame
  METADATA = 0x03,     // Metadata frame (FPS, etc.)
  ERROR = 0xFF         // Error frame
}

// LED frame data structure
export interface LedFrame {
  header: FrameHeader;
  timestamp: number;   // Client-side timestamp when received
  data: Uint8Array;    // RGB data (540 bytes)
  frameNumber?: number; // Optional frame sequence number
}

// Metadata frame payload
export interface FrameMetadata {
  fps: number;
  frameCount: number;
  droppedFrames: number;
  timestamp: number;
}

// Frame validation result
export interface FrameValidation {
  isValid: boolean;
  error?: string;
  header?: FrameHeader;
}

/**
 * Validate incoming binary frame
 */
export function validateFrame(buffer: ArrayBuffer): FrameValidation {
  if (buffer.byteLength < FRAME_HEADER_SIZE) {
    return {
      isValid: false,
      error: `Frame too small: ${buffer.byteLength} bytes (minimum ${FRAME_HEADER_SIZE})`
    };
  }
  
  const view = new DataView(buffer);
  const header: FrameHeader = {
    version: view.getUint8(0),
    type: view.getUint8(1),
    reserved: view.getUint16(2, false) // Big-endian
  };
  
  // Validate version
  if (header.version !== 1) {
    return {
      isValid: false,
      error: `Unsupported protocol version: ${header.version}`,
      header
    };
  }
  
  // Validate frame type
  if (!Object.values(FrameType).includes(header.type)) {
    return {
      isValid: false,
      error: `Unknown frame type: 0x${header.type.toString(16)}`,
      header
    };
  }
  
  // Validate frame size based on type
  const expectedSize = getExpectedFrameSize(header.type);
  if (buffer.byteLength !== expectedSize) {
    return {
      isValid: false,
      error: `Invalid frame size for type ${header.type}: ${buffer.byteLength} bytes (expected ${expectedSize})`,
      header
    };
  }
  
  return { isValid: true, header };
}

/**
 * Get expected frame size for frame type
 */
function getExpectedFrameSize(frameType: number): number {
  switch (frameType) {
    case FrameType.LED_DATA:
      return TOTAL_FRAME_SIZE;
    case FrameType.HEARTBEAT:
      return FRAME_HEADER_SIZE + 8; // Header + timestamp
    case FrameType.METADATA:
      return FRAME_HEADER_SIZE + 16; // Header + metadata
    case FrameType.ERROR:
      return FRAME_HEADER_SIZE + 4; // Header + error code
    default:
      return FRAME_HEADER_SIZE;
  }
}

/**
 * Parse LED frame from validated buffer
 */
export function parseLedFrame(buffer: ArrayBuffer): LedFrame {
  const validation = validateFrame(buffer);
  if (!validation.isValid) {
    throw new Error(`Invalid frame: ${validation.error}`);
  }
  
  const header = validation.header!;
  const data = new Uint8Array(buffer, FRAME_HEADER_SIZE, FRAME_SIZE);
  
  return {
    header,
    timestamp: performance.now(),
    data: new Uint8Array(data) // Copy to avoid buffer reuse issues
  };
}

/**
 * Parse metadata frame
 */
export function parseMetadataFrame(buffer: ArrayBuffer): FrameMetadata {
  const validation = validateFrame(buffer);
  if (!validation.isValid || validation.header!.type !== FrameType.METADATA) {
    throw new Error('Invalid metadata frame');
  }
  
  const view = new DataView(buffer, FRAME_HEADER_SIZE);
  return {
    fps: view.getFloat32(0, false),
    frameCount: view.getUint32(4, false),
    droppedFrames: view.getUint32(8, false),
    timestamp: view.getUint32(12, false)
  };
}

/**
 * LED frame subscription events
 */
export interface LedFrameEvents {
  frame: (frame: LedFrame) => void;
  metadata: (metadata: FrameMetadata) => void;
  error: (error: Error) => void;
  connected: () => void;
  disconnected: () => void;
  reconnecting: (attempt: number) => void;
}

/**
 * LED frame subscription options
 */
export interface LedFrameSubscriptionOptions {
  url: string;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  frameBufferSize?: number;
}

/**
 * LED frame subscription class
 */
export class LedFrameSubscription {
  private ws: WebSocket | null = null;
  private options: Required<LedFrameSubscriptionOptions>;
  private listeners: Partial<LedFrameEvents> = {};
  private reconnectAttempt = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isConnected = false;
  private frameCount = 0;
  private droppedFrames = 0;
  private lastFrameTime = 0;
  
  constructor(options: LedFrameSubscriptionOptions) {
    this.options = {
      autoReconnect: true,
      reconnectDelay: 1000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 5000,
      frameBufferSize: 3,
      ...options
    };
  }
  
  /**
   * Start subscription
   */
  start(): void {
    this.connect();
  }
  
  /**
   * Stop subscription
   */
  stop(): void {
    this.cleanup();
  }
  
  /**
   * Add event listener
   */
  on<K extends keyof LedFrameEvents>(event: K, listener: LedFrameEvents[K]): void {
    this.listeners[event] = listener;
  }
  
  /**
   * Remove event listener
   */
  off<K extends keyof LedFrameEvents>(event: K): void {
    delete this.listeners[event];
  }
  
  /**
   * Get connection statistics
   */
  getStats() {
    return {
      isConnected: this.isConnected,
      frameCount: this.frameCount,
      droppedFrames: this.droppedFrames,
      reconnectAttempt: this.reconnectAttempt,
      frameRate: this.calculateFrameRate()
    };
  }
  
  private connect(): void {
    try {
      this.ws = new WebSocket(this.options.url);
      this.ws.binaryType = 'arraybuffer';
      
      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempt = 0;
        this.startHeartbeat();
        this.emit('connected');
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
      
      this.ws.onclose = () => {
        this.isConnected = false;
        this.stopHeartbeat();
        this.emit('disconnected');
        
        if (this.options.autoReconnect && this.reconnectAttempt < this.options.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };
      
      this.ws.onerror = (error) => {
        this.emit('error', new Error(`WebSocket error: ${error}`));
      };
      
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error('Connection failed'));
    }
  }
  
  private handleMessage(data: ArrayBuffer): void {
    try {
      const validation = validateFrame(data);
      if (!validation.isValid) {
        this.droppedFrames++;
        this.emit('error', new Error(`Invalid frame: ${validation.error}`));
        return;
      }
      
      const header = validation.header!;
      
      switch (header.type) {
        case FrameType.LED_DATA:
          const frame = parseLedFrame(data);
          frame.frameNumber = this.frameCount++;
          this.lastFrameTime = performance.now();
          this.emit('frame', frame);
          break;
          
        case FrameType.METADATA:
          const metadata = parseMetadataFrame(data);
          this.emit('metadata', metadata);
          break;
          
        case FrameType.HEARTBEAT:
          // Heartbeat received, connection is alive
          break;
          
        case FrameType.ERROR:
          const view = new DataView(data, FRAME_HEADER_SIZE);
          const errorCode = view.getUint32(0, false);
          this.emit('error', new Error(`Device error: ${errorCode}`));
          break;
      }
      
    } catch (error) {
      this.droppedFrames++;
      this.emit('error', error instanceof Error ? error : new Error('Frame processing failed'));
    }
  }
  
  private scheduleReconnect(): void {
    this.reconnectAttempt++;
    this.emit('reconnecting', this.reconnectAttempt);
    
    const delay = this.options.reconnectDelay * Math.pow(2, Math.min(this.reconnectAttempt - 1, 5));
    
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }
  
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // Send heartbeat frame
        const buffer = new ArrayBuffer(FRAME_HEADER_SIZE + 8);
        const view = new DataView(buffer);
        view.setUint8(0, 1); // Version
        view.setUint8(1, FrameType.HEARTBEAT); // Type
        view.setUint16(2, 0, false); // Reserved
        view.setBigUint64(4, BigInt(Date.now()), false); // Timestamp
        
        this.ws.send(buffer);
      }
    }, this.options.heartbeatInterval);
  }
  
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
  
  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
  }
  
  private calculateFrameRate(): number {
    // Simple frame rate calculation based on recent frames
    const now = performance.now();
    const timeSinceLastFrame = now - this.lastFrameTime;
    
    if (timeSinceLastFrame > 1000) {
      return 0; // No recent frames
    }
    
    // This is a simplified calculation
    // In practice, you'd want a rolling average
    return this.frameCount > 0 ? 1000 / timeSinceLastFrame : 0;
  }
  
  private emit<K extends keyof LedFrameEvents>(event: K, ...args: Parameters<LedFrameEvents[K]>): void {
    const listener = this.listeners[event];
    if (listener) {
      (listener as any)(...args);
    }
  }
}

/**
 * Helper function to create LED frame subscription
 */
export function subscribeLedFrames(options: LedFrameSubscriptionOptions): LedFrameSubscription {
  return new LedFrameSubscription(options);
}

/**
 * Convert WebSocket URL from HTTP endpoint
 */
export function buildLedFrameUrl(httpEndpoint: string): string {
  try {
    const url = new URL(httpEndpoint);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${url.host}/ws/led-frames`;
  } catch {
    // Fallback for simple IP addresses
    const wsProtocol = httpEndpoint.startsWith('https') ? 'wss' : 'ws';
    const cleanEndpoint = httpEndpoint.replace(/^https?:\/\//, '');
    return `${wsProtocol}://${cleanEndpoint}/ws/led-frames`;
  }
}