/**
 * LED Visualization Controls
 * 
 * Task 7.5: Add zoom, pan, and pause/resume controls on the canvas
 * - Wheel-to-zoom around cursor, drag-to-pan interactions
 * - Clamped exponential zoom with focus at cursor
 * - Pan via pointer capture with inertia disabled
 * - pause()/resume() that halts consumption but keeps UI responsive
 * - Persist last viewport in localStorage
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Move, 
  Maximize2,
  Settings,
  Activity
} from 'lucide-react';
import { type ViewTransform } from '../../lib/ledRenderer';

// Zoom/pan configuration
interface ViewportConfig {
  minZoom: number;
  maxZoom: number;
  zoomStep: number;
  panSensitivity: number;
  wheelSensitivity: number;
  enableInertia: boolean;
  persistViewport: boolean;
}

// Viewport controls props
interface LedVisualizationControlsProps {
  isPlaying: boolean;
  onPlayPause: (playing: boolean) => void;
  transform: ViewTransform;
  onTransformChange: (transform: Partial<ViewTransform>) => void;
  onReset: () => void;
  stats?: {
    fps: number;
    frameTime: number;
    droppedFrames: number;
  };
  className?: string;
}

// Default viewport configuration
const DEFAULT_VIEWPORT_CONFIG: ViewportConfig = {
  minZoom: 0.1,
  maxZoom: 10.0,
  zoomStep: 0.1,
  panSensitivity: 1.0,
  wheelSensitivity: 0.001,
  enableInertia: false, // Disabled as specified
  persistViewport: true
};

// Viewport persistence key
const VIEWPORT_STORAGE_KEY = 'k1:ledVisualization:viewport';

/**
 * Load viewport from localStorage
 */
function loadViewport(): Partial<ViewTransform> {
  try {
    const stored = localStorage.getItem(VIEWPORT_STORAGE_KEY);
    if (!stored) return {};
    
    const parsed = JSON.parse(stored);
    return {
      zoom: typeof parsed.zoom === 'number' ? parsed.zoom : 1,
      panX: typeof parsed.panX === 'number' ? parsed.panX : 0,
      panY: typeof parsed.panY === 'number' ? parsed.panY : 0,
      rotation: typeof parsed.rotation === 'number' ? parsed.rotation : 0
    };
  } catch {
    return {};
  }
}

/**
 * Save viewport to localStorage
 */
function saveViewport(transform: ViewTransform): void {
  try {
    localStorage.setItem(VIEWPORT_STORAGE_KEY, JSON.stringify(transform));
  } catch (error) {
    console.warn('[LedVisualizationControls] Failed to save viewport:', error);
  }
}

/**
 * LED visualization controls component
 */
export function LedVisualizationControls({
  isPlaying,
  onPlayPause,
  transform,
  onTransformChange,
  onReset,
  stats,
  className = ''
}: LedVisualizationControlsProps) {
  
  const [config] = useState<ViewportConfig>(DEFAULT_VIEWPORT_CONFIG);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  
  const controlsRef = useRef<HTMLDivElement>(null);
  
  /**
   * Handle zoom in
   */
  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(config.maxZoom, transform.zoom + config.zoomStep);
    onTransformChange({ zoom: newZoom });
    
    if (config.persistViewport) {
      saveViewport({ ...transform, zoom: newZoom });
    }
  }, [transform, onTransformChange, config]);
  
  /**
   * Handle zoom out
   */
  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(config.minZoom, transform.zoom - config.zoomStep);
    onTransformChange({ zoom: newZoom });
    
    if (config.persistViewport) {
      saveViewport({ ...transform, zoom: newZoom });
    }
  }, [transform, onTransformChange, config]);
  
  /**
   * Handle zoom to fit
   */
  const handleZoomToFit = useCallback(() => {
    const resetTransform: ViewTransform = {
      zoom: 1,
      panX: 0,
      panY: 0,
      rotation: 0
    };
    
    onTransformChange(resetTransform);
    
    if (config.persistViewport) {
      saveViewport(resetTransform);
    }
  }, [onTransformChange, config]);
  
  /**
   * Handle mouse wheel zoom
   */
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Calculate zoom factor
    const zoomDelta = -e.deltaY * config.wheelSensitivity;
    const newZoom = Math.max(config.minZoom, Math.min(config.maxZoom, transform.zoom + zoomDelta));
    
    if (newZoom !== transform.zoom) {
      // Zoom towards cursor position
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Calculate pan adjustment to zoom towards cursor
      const zoomRatio = newZoom / transform.zoom;
      const panAdjustX = (mouseX - centerX) * (1 - zoomRatio);
      const panAdjustY = (mouseY - centerY) * (1 - zoomRatio);
      
      const newTransform = {
        zoom: newZoom,
        panX: transform.panX + panAdjustX,
        panY: transform.panY + panAdjustY
      };
      
      onTransformChange(newTransform);
      
      if (config.persistViewport) {
        saveViewport({ ...transform, ...newTransform });
      }
    }
  }, [transform, onTransformChange, config]);
  
  /**
   * Handle mouse down for pan start
   */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left mouse button
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      panX: transform.panX,
      panY: transform.panY
    });
    
    // Capture pointer for smooth dragging
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [transform]);
  
  /**
   * Handle mouse move for panning
   */
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return;
    
    const deltaX = (e.clientX - dragStart.x) * config.panSensitivity;
    const deltaY = (e.clientY - dragStart.y) * config.panSensitivity;
    
    const newTransform = {
      panX: dragStart.panX + deltaX,
      panY: dragStart.panY + deltaY
    };
    
    onTransformChange(newTransform);
  }, [isDragging, dragStart, onTransformChange, config]);
  
  /**
   * Handle mouse up for pan end
   */
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    
    setIsDragging(false);
    setDragStart(null);
    
    // Release pointer capture
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    // Save final viewport
    if (config.persistViewport) {
      saveViewport(transform);
    }
  }, [isDragging, transform, config]);
  
  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target !== document.body) return; // Only when not in input
    
    switch (e.key) {
      case ' ':
        e.preventDefault();
        onPlayPause(!isPlaying);
        break;
      case 'r':
      case 'R':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          onReset();
        }
        break;
      case '=':
      case '+':
        e.preventDefault();
        handleZoomIn();
        break;
      case '-':
      case '_':
        e.preventDefault();
        handleZoomOut();
        break;
      case '0':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleZoomToFit();
        }
        break;
    }
  }, [isPlaying, onPlayPause, onReset, handleZoomIn, handleZoomOut, handleZoomToFit]);
  
  // Set up keyboard event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
  
  // Load saved viewport on mount
  useEffect(() => {
    if (config.persistViewport) {
      const savedViewport = loadViewport();
      if (Object.keys(savedViewport).length > 0) {
        onTransformChange(savedViewport);
      }
    }
  }, [onTransformChange, config.persistViewport]);
  
  return (
    <div className={`flex items-center justify-between p-3 bg-[var(--prism-bg-surface)] border border-[var(--prism-bg-elevated)] rounded-lg ${className}`}>
      {/* Playback controls */}
      <div className="flex items-center gap-2">
        <Button
          onClick={() => onPlayPause(!isPlaying)}
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          title={isPlaying ? 'Pause visualization' : 'Resume visualization'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </Button>
        
        <Button
          onClick={onReset}
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          title="Reset view (Ctrl+R)"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Zoom controls */}
      <div className="flex items-center gap-2">
        <Button
          onClick={handleZoomOut}
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={transform.zoom <= config.minZoom}
          title="Zoom out (-)"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        
        <Badge variant="outline" className="text-xs font-mono px-2">
          {Math.round(transform.zoom * 100)}%
        </Badge>
        
        <Button
          onClick={handleZoomIn}
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={transform.zoom >= config.maxZoom}
          title="Zoom in (+)"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        
        <Button
          onClick={handleZoomToFit}
          variant="outline"
          size="sm"
          className="h-8 px-2"
          title="Zoom to fit (Ctrl+0)"
        >
          <Maximize2 className="w-3 h-3 mr-1" />
          Fit
        </Button>
      </div>
      
      {/* Pan indicator */}
      <div className="flex items-center gap-2">
        {(Math.abs(transform.panX) > 1 || Math.abs(transform.panY) > 1) && (
          <div className="flex items-center gap-1 text-xs text-[var(--prism-text-secondary)]">
            <Move className="w-3 h-3" />
            <span className="font-mono">
              {Math.round(transform.panX)}, {Math.round(transform.panY)}
            </span>
          </div>
        )}
        
        {isDragging && (
          <Badge variant="default" className="text-xs">
            Panning...
          </Badge>
        )}
      </div>
      
      {/* Performance stats */}
      {stats && (
        <div className="flex items-center gap-2 text-xs text-[var(--prism-text-secondary)]">
          <Activity className="w-3 h-3" />
          <span className="font-mono">
            {Math.round(stats.fps)} FPS
          </span>
          <span className="font-mono">
            {Math.round(stats.frameTime)}ms
          </span>
          {stats.droppedFrames > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              {stats.droppedFrames} dropped
            </Badge>
          )}
        </div>
      )}
      
      {/* Keyboard shortcuts help */}
      <details className="relative">
        <summary className="cursor-pointer">
          <Settings className="w-4 h-4 text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)]" />
        </summary>
        <div className="absolute right-0 top-8 z-10 p-3 bg-[var(--prism-bg-elevated)] border border-[var(--prism-bg-canvas)] rounded-lg shadow-lg text-xs space-y-1 min-w-48">
          <div className="font-medium text-[var(--prism-text-primary)] mb-2">Keyboard Shortcuts</div>
          <div><kbd className="bg-[var(--prism-bg-canvas)] px-1 rounded">Space</kbd> Play/Pause</div>
          <div><kbd className="bg-[var(--prism-bg-canvas)] px-1 rounded">+/-</kbd> Zoom In/Out</div>
          <div><kbd className="bg-[var(--prism-bg-canvas)] px-1 rounded">Ctrl+0</kbd> Zoom to Fit</div>
          <div><kbd className="bg-[var(--prism-bg-canvas)] px-1 rounded">Ctrl+R</kbd> Reset View</div>
          <div><kbd className="bg-[var(--prism-bg-canvas)] px-1 rounded">Drag</kbd> Pan View</div>
          <div><kbd className="bg-[var(--prism-bg-canvas)] px-1 rounded">Wheel</kbd> Zoom at Cursor</div>
        </div>
      </details>
    </div>
  );
}

/**
 * Canvas interaction handler hook
 */
export function useCanvasInteractions(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  transform: ViewTransform,
  onTransformChange: (transform: Partial<ViewTransform>) => void,
  config: ViewportConfig = DEFAULT_VIEWPORT_CONFIG
) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  
  /**
   * Handle wheel events for zooming
   */
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Calculate zoom factor
    const zoomDelta = -e.deltaY * config.wheelSensitivity;
    const newZoom = Math.max(config.minZoom, Math.min(config.maxZoom, transform.zoom + zoomDelta));
    
    if (newZoom !== transform.zoom) {
      // Zoom towards cursor position
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Calculate pan adjustment to zoom towards cursor
      const zoomRatio = newZoom / transform.zoom;
      const panAdjustX = (mouseX - centerX) * (1 - zoomRatio);
      const panAdjustY = (mouseY - centerY) * (1 - zoomRatio);
      
      const newTransform = {
        zoom: newZoom,
        panX: transform.panX + panAdjustX,
        panY: transform.panY + panAdjustY
      };
      
      onTransformChange(newTransform);
      
      if (config.persistViewport) {
        saveViewport({ ...transform, ...newTransform });
      }
    }
  }, [transform, onTransformChange, config, canvasRef]);
  
  /**
   * Handle pointer down for pan start
   */
  const handlePointerDown = useCallback((e: PointerEvent) => {
    if (e.button !== 0) return; // Only left mouse button
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      panX: transform.panX,
      panY: transform.panY
    });
    
    // Capture pointer for smooth dragging
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [transform]);
  
  /**
   * Handle pointer move for panning
   */
  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging || !dragStart) return;
    
    const deltaX = (e.clientX - dragStart.x) * config.panSensitivity;
    const deltaY = (e.clientY - dragStart.y) * config.panSensitivity;
    
    const newTransform = {
      panX: dragStart.panX + deltaX,
      panY: dragStart.panY + deltaY
    };
    
    onTransformChange(newTransform);
  }, [isDragging, dragStart, onTransformChange, config]);
  
  /**
   * Handle pointer up for pan end
   */
  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (!isDragging) return;
    
    setIsDragging(false);
    setDragStart(null);
    
    // Release pointer capture
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    // Save final viewport
    if (config.persistViewport) {
      saveViewport(transform);
    }
  }, [isDragging, transform, config]);
  
  // Set up canvas event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Add event listeners
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    
    // Set cursor style
    canvas.style.cursor = isDragging ? 'grabbing' : 'grab';
    
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
    };
  }, [canvasRef, handleWheel, handlePointerDown, handlePointerMove, handlePointerUp, isDragging]);
  
  return {
    isDragging,
    config
  };
}