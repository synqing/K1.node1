/**
 * Main LED Visualization Component
 * 
 * Task 7.6: Integrate all LED visualization components into cohesive system
 * - Combine WebSocket subscription, frame queue, renderer, and controls
 * - Handle connection lifecycle and error states gracefully
 * - Provide unified API for parent components
 * - Support both live streaming and mock data modes
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  Play, 
  Pause,
  Settings,
  Activity,
  Loader2
} from 'lucide-react';

// Import our LED visualization modules
import { 
  LedFrameSubscription, 
  subscribeLedFrames, 
  buildLedFrameUrl,
  type LedFrame,
  type FrameMetadata 
} from '../../lib/ledFrameProtocol';
import { FrameQueue, createFrameQueue } from '../../lib/frameQueue';
import { 
  LedPreviewRenderer, 
  createLedRenderer,
  type ViewTransform,
  type RenderStats 
} from '../../lib/ledRenderer';
import { 
  computePositions, 
  type PositionBuffers,
  type PositionMappingConfig 
} from '../../lib/ledPositionMapping';
import { 
  LedVisualizationControls,
  useCanvasInteractions 
} from './LedVisualizationControls';

// Component configuration
export interface LedVisualizationConfig {
  // Connection settings
  deviceEndpoint?: string;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  
  // Rendering settings
  ledRadius?: number;
  backgroundColor?: string;
  targetFPS?: number;
  enableWebGL?: boolean;
  
  // Position mapping
  positionConfig?: PositionMappingConfig;
  
  // Frame queue settings
  queueCapacity?: number;
  enableAdaptiveQueue?: boolean;
  
  // UI settings
  showControls?: boolean;
  showStats?: boolean;
  enableMockMode?: boolean;
}

// Component props
export interface LedVisualizationProps {
  config?: LedVisualizationConfig;
  className?: string;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: Error) => void;
  onStatsUpdate?: (stats: RenderStats & { connection: any; queue: any }) => void;
}

// Connection states
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error' | 'mock';

// Default configuration
const DEFAULT_CONFIG: Required<LedVisualizationConfig> = {
  deviceEndpoint: 'ws://192.168.1.100:8080',
  autoConnect: true,
  reconnectAttempts: 5,
  ledRadius: 3,
  backgroundColor: '#000000',
  targetFPS: 60,
  enableWebGL: false,
  positionConfig: {},
  queueCapacity: 3,
  enableAdaptiveQueue: true,
  showControls: true,
  showStats: true,
  enableMockMode: false
};

/**
 * Mock data generator for testing
 */
function createMockFrameGenerator(): () => LedFrame | null {
  let frameId = 0;
  let lastTime = 0;
  
  return () => {
    const now = performance.now();
    if (now - lastTime < 16.67) return null; // ~60 FPS
    
    lastTime = now;
    frameId++;
    
    // Generate rainbow wave pattern
    const data = new Uint8Array(540); // 180 LEDs × 3 bytes
    const time = now * 0.001; // Convert to seconds
    
    for (let i = 0; i < 180; i++) {
      const phase = (i / 180) * Math.PI * 2 + time;
      const intensity = (Math.sin(phase) + 1) * 0.5;
      
      // Rainbow colors
      const hue = (i / 180 + time * 0.1) % 1;
      const rgb = hslToRgb(hue, 1, intensity * 0.5);
      
      data[i * 3] = rgb.r;
      data[i * 3 + 1] = rgb.g;
      data[i * 3 + 2] = rgb.b;
    }
    
    return {
      header: { version: 1, type: 1, reserved: 0 },
      timestamp: now,
      data,
      frameNumber: frameId
    };
  };
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h * 6) % 2 - 1));
  const m = l - c / 2;
  
  let r = 0, g = 0, b = 0;
  
  if (0 <= h && h < 1/6) {
    r = c; g = x; b = 0;
  } else if (1/6 <= h && h < 2/6) {
    r = x; g = c; b = 0;
  } else if (2/6 <= h && h < 3/6) {
    r = 0; g = c; b = x;
  } else if (3/6 <= h && h < 4/6) {
    r = 0; g = x; b = c;
  } else if (4/6 <= h && h < 5/6) {
    r = x; g = 0; b = c;
  } else if (5/6 <= h && h < 1) {
    r = c; g = 0; b = x;
  }
  
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

/**
 * Main LED Visualization Component
 */
export function LedVisualization({
  config: userConfig = {},
  className = '',
  onConnectionChange,
  onError,
  onStatsUpdate
}: LedVisualizationProps) {
  
  const config = useMemo(() => ({ ...DEFAULT_CONFIG, ...userConfig }), [userConfig]);
  
  // Refs for core components
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const subscriptionRef = useRef<LedFrameSubscription | null>(null);
  const frameQueueRef = useRef<FrameQueue | null>(null);
  const rendererRef = useRef<LedPreviewRenderer | null>(null);
  const positionBuffersRef = useRef<PositionBuffers | null>(null);
  const mockGeneratorRef = useRef<(() => LedFrame | null) | null>(null);
  
  // Component state
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [transform, setTransform] = useState<ViewTransform>({
    zoom: 1,
    panX: 0,
    panY: 0,
    rotation: 0
  });
  const [renderStats, setRenderStats] = useState<RenderStats>({
    fps: 0,
    frameTime: 0,
    drawCalls: 0,
    ledsRendered: 0,
    lastFrameTime: 0,
    totalFrames: 0,
    droppedFrames: 0
  });
  const [connectionStats, setConnectionStats] = useState({
    isConnected: false,
    frameCount: 0,
    droppedFrames: 0,
    reconnectAttempt: 0,
    frameRate: 0
  });
  const [queueStats, setQueueStats] = useState({
    received: 0,
    rendered: 0,
    dropped: 0,
    currentSize: 0,
    capacity: 0,
    dropRate: 0,
    bufferPoolSize: 0,
    memoryUsage: 0
  });
  
  // Canvas interactions
  const { isDragging } = useCanvasInteractions(
    canvasRef,
    transform,
    setTransform
  );
  
  /**
   * Initialize LED position mapping
   */
  const initializePositions = useCallback(() => {
    positionBuffersRef.current = computePositions(config.positionConfig);
  }, [config.positionConfig]);
  
  /**
   * Initialize frame queue
   */
  const initializeFrameQueue = useCallback(() => {
    frameQueueRef.current = createFrameQueue({
      capacity: config.queueCapacity,
      adaptive: config.enableAdaptiveQueue
    });
  }, [config.queueCapacity, config.enableAdaptiveQueue]);
  
  /**
   * Initialize renderer
   */
  const initializeRenderer = useCallback(() => {
    const canvas = canvasRef.current;
    const positions = positionBuffersRef.current;
    const frameQueue = frameQueueRef.current;
    
    if (!canvas || !positions || !frameQueue) return;
    
    const getLatestFrame = () => {
      if (!isPlaying) return null;
      
      if (config.enableMockMode) {
        if (!mockGeneratorRef.current) {
          mockGeneratorRef.current = createMockFrameGenerator();
        }
        return mockGeneratorRef.current();
      }
      
      return frameQueue.popLatest();
    };
    
    rendererRef.current = createLedRenderer(
      canvas,
      positions,
      getLatestFrame,
      {
        ledRadius: config.ledRadius,
        backgroundColor: config.backgroundColor,
        maxFPS: config.targetFPS,
        preferWebGL: config.enableWebGL
      }
    );
    
    // Set initial transform
    rendererRef.current.setTransform(transform);
    
    // Start rendering
    rendererRef.current.start();
    
  }, [config, transform, isPlaying]);
  
  /**
   * Initialize WebSocket subscription
   */
  const initializeSubscription = useCallback(() => {
    if (config.enableMockMode) {
      setConnectionState('mock');
      return;
    }
    
    const frameQueue = frameQueueRef.current;
    if (!frameQueue) return;
    
    const wsUrl = buildLedFrameUrl(config.deviceEndpoint);
    
    subscriptionRef.current = subscribeLedFrames({
      url: wsUrl,
      autoReconnect: true,
      maxReconnectAttempts: config.reconnectAttempts
    });
    
    const subscription = subscriptionRef.current;
    
    // Set up event handlers
    subscription.on('connected', () => {
      setConnectionState('connected');
      setError(null);
      onConnectionChange?.(true);
    });
    
    subscription.on('disconnected', () => {
      setConnectionState('disconnected');
      onConnectionChange?.(false);
    });
    
    subscription.on('reconnecting', (attempt) => {
      setConnectionState('connecting');
      setConnectionStats(prev => ({ ...prev, reconnectAttempt: attempt }));
    });
    
    subscription.on('frame', (frame) => {
      if (isPlaying && frameQueue) {
        frameQueue.push(frame);
      }
    });
    
    subscription.on('metadata', (metadata: FrameMetadata) => {
      setConnectionStats(prev => ({
        ...prev,
        frameCount: metadata.frameCount,
        droppedFrames: metadata.droppedFrames,
        frameRate: metadata.fps
      }));
    });
    
    subscription.on('error', (error) => {
      setConnectionState('error');
      setError(error.message);
      onError?.(error);
    });
    
    // Start subscription
    subscription.start();
    
  }, [config, isPlaying, onConnectionChange, onError]);
  
  /**
   * Handle play/pause
   */
  const handlePlayPause = useCallback((playing: boolean) => {
    setIsPlaying(playing);
    
    const renderer = rendererRef.current;
    if (!renderer) return;
    
    if (playing) {
      renderer.start();
    } else {
      renderer.stop();
    }
  }, []);
  
  /**
   * Handle transform changes
   */
  const handleTransformChange = useCallback((newTransform: Partial<ViewTransform>) => {
    const updatedTransform = { ...transform, ...newTransform };
    setTransform(updatedTransform);
    
    const renderer = rendererRef.current;
    if (renderer) {
      renderer.setTransform(updatedTransform);
    }
  }, [transform]);
  
  /**
   * Handle reset
   */
  const handleReset = useCallback(() => {
    const resetTransform: ViewTransform = {
      zoom: 1,
      panX: 0,
      panY: 0,
      rotation: 0
    };
    
    setTransform(resetTransform);
    
    const renderer = rendererRef.current;
    if (renderer) {
      renderer.setTransform(resetTransform);
      renderer.clearStats();
    }
    
    const frameQueue = frameQueueRef.current;
    if (frameQueue) {
      frameQueue.clear();
      frameQueue.resetStats();
    }
  }, []);
  
  /**
   * Handle canvas resize
   */
  const handleCanvasResize = useCallback(() => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    
    if (!canvas || !renderer) return;
    
    const rect = canvas.getBoundingClientRect();
    renderer.resize(rect.width, rect.height);
  }, []);
  
  /**
   * Update statistics
   */
  const updateStats = useCallback(() => {
    const renderer = rendererRef.current;
    const frameQueue = frameQueueRef.current;
    const subscription = subscriptionRef.current;
    
    if (renderer) {
      setRenderStats(renderer.getStats());
    }
    
    if (frameQueue) {
      setQueueStats(frameQueue.getStats());
    }
    
    if (subscription) {
      setConnectionStats(subscription.getStats());
    }
    
    // Notify parent component
    if (onStatsUpdate) {
      onStatsUpdate({
        ...renderStats,
        connection: connectionStats,
        queue: queueStats
      });
    }
  }, [renderStats, connectionStats, queueStats, onStatsUpdate]);
  
  // Initialize components on mount
  useEffect(() => {
    initializePositions();
    initializeFrameQueue();
  }, [initializePositions, initializeFrameQueue]);
  
  // Initialize renderer when canvas is ready
  useEffect(() => {
    if (canvasRef.current && positionBuffersRef.current && frameQueueRef.current) {
      initializeRenderer();
    }
  }, [initializeRenderer]);
  
  // Initialize subscription when renderer is ready
  useEffect(() => {
    if (rendererRef.current && config.autoConnect) {
      initializeSubscription();
    }
  }, [initializeSubscription, config.autoConnect]);
  
  // Set up resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const resizeObserver = new ResizeObserver(handleCanvasResize);
    resizeObserver.observe(canvas);
    
    return () => resizeObserver.disconnect();
  }, [handleCanvasResize]);
  
  // Set up stats update interval
  useEffect(() => {
    const interval = setInterval(updateStats, 1000); // Update every second
    return () => clearInterval(interval);
  }, [updateStats]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      subscriptionRef.current?.stop();
      rendererRef.current?.stop();
      frameQueueRef.current?.clear();
    };
  }, []);
  
  // Connection status indicator
  const getConnectionStatus = () => {
    switch (connectionState) {
      case 'connected':
        return { icon: Wifi, color: 'text-green-500', label: 'Connected' };
      case 'connecting':
        return { icon: Loader2, color: 'text-yellow-500', label: 'Connecting...' };
      case 'mock':
        return { icon: Activity, color: 'text-blue-500', label: 'Mock Data' };
      case 'error':
        return { icon: AlertTriangle, color: 'text-red-500', label: 'Error' };
      default:
        return { icon: WifiOff, color: 'text-gray-500', label: 'Disconnected' };
    }
  };
  
  const connectionStatus = getConnectionStatus();
  const ConnectionIcon = connectionStatus.icon;
  
  return (
    <Card className={`w-full ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            LED Visualization
          </CardTitle>
          
          <div className="flex items-center gap-3">
            {/* Connection status */}
            <div className="flex items-center gap-2">
              <ConnectionIcon 
                className={`w-4 h-4 ${connectionStatus.color} ${connectionState === 'connecting' ? 'animate-spin' : ''}`} 
              />
              <span className={`text-sm ${connectionStatus.color}`}>
                {connectionStatus.label}
              </span>
            </div>
            
            {/* Performance stats */}
            {config.showStats && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline" className="text-xs">
                  {Math.round(renderStats.fps)} FPS
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {queueStats.currentSize}/{queueStats.capacity} queued
                </Badge>
              </div>
            )}
          </div>
        </div>
        
        {/* Error display */}
        {error && (
          <Alert variant="destructive" className="mt-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardHeader>
      
      <CardContent className="p-0">
        {/* Canvas container */}
        <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '2/1' }}>
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{
              cursor: isDragging ? 'grabbing' : 'grab'
            }}
          />
          
          {/* Overlay controls */}
          {config.showControls && (
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <LedVisualizationControls
                isPlaying={isPlaying}
                onPlayPause={handlePlayPause}
                transform={transform}
                onTransformChange={handleTransformChange}
                onReset={handleReset}
                stats={{
                  fps: renderStats.fps,
                  frameTime: renderStats.frameTime,
                  droppedFrames: queueStats.dropped
                }}
              />
            </div>
          )}
          
          {/* Loading overlay */}
          {connectionState === 'connecting' && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="flex items-center gap-2 text-white">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Connecting to device...</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Simplified LED visualization for embedding
 */
export function LedVisualizationSimple({
  deviceEndpoint,
  className = ''
}: {
  deviceEndpoint?: string;
  className?: string;
}) {
  return (
    <LedVisualization
      config={{
        deviceEndpoint,
        showControls: false,
        showStats: false,
        autoConnect: true
      }}
      className={className}
    />
  );
}

/**
 * LED visualization with mock data for development
 */
export function LedVisualizationMock({
  className = ''
}: {
  className?: string;
}) {
  return (
    <LedVisualization
      config={{
        enableMockMode: true,
        showControls: true,
        showStats: true
      }}
      className={className}
    />
  );
}