/**
 * Real-Time Parameter Controls Component
 * 
 * Task 5.6: Provider/store binding to wire sliders, coalescer, persistence, and transport
 * - Integrate UI with coalesced sending pipeline and persistence
 * - Wire ParamSlider onChange to update UI immediately and scheduleSend
 * - Wire onCommit to persist values
 * - Ensure single source of truth with minimal re-renders
 * - Target: <100ms first send, smooth 60fps during drags
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { RotateCcw, Save, AlertCircle, Zap, Activity } from 'lucide-react';
import { ParamSlider } from './ParamSlider';
import { 
  type UIParams, 
  PARAM_ORDER, 
  PARAM_METADATA, 
  DEFAULT_PARAMS,
  areParamsEqual 
} from '../../lib/parameters';
import { useParameterPersistence } from '../../hooks/useParameterPersistence';
import { useCoalescedParams } from '../../hooks/useCoalescedParams';
import { useParameterTransport } from '../../hooks/useParameterTransport';
import { ConnectionState } from '../../lib/types';
import { toast } from 'sonner';

interface RealTimeParameterControlsProps {
  connectionState: ConnectionState;
  patternId: string;
  className?: string;
  showAdvanced?: boolean;
}

/**
 * Performance monitoring component
 */
function PerformanceMonitor({ 
  isTransporting, 
  coalescingStats, 
  transportStats 
}: {
  isTransporting: boolean;
  coalescingStats: any;
  transportStats: any;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-[var(--prism-text-secondary)]">
      {/* Transport status */}
      <div className="flex items-center gap-1">
        {isTransporting ? (
          <Activity className="w-3 h-3 animate-pulse text-[var(--prism-info)]" />
        ) : (
          <Zap className="w-3 h-3" />
        )}
        <span>
          {Math.round(transportStats.averageLatency)}ms
        </span>
      </div>
      
      {/* Success rate */}
      <Badge 
        variant={transportStats.successRate > 0.95 ? "default" : "destructive"}
        className="text-[10px] px-1 py-0"
      >
        {Math.round(transportStats.successRate * 100)}%
      </Badge>
      
      {/* Backoff indicator (rate limit/network slow-down) */}
      {transportStats.backingOff && (
        <Badge variant="outline" className="text-[10px] px-1 py-0">
          Backoff {transportStats.backoffMs}ms
        </Badge>
      )}

      {/* Coalescing ratio */}
      <span className="text-[10px]">
        {coalescingStats.totalSent}/{coalescingStats.totalScheduled}
      </span>
    </div>
  );
}

/**
 * Main real-time parameter controls component
 */
export function RealTimeParameterControls({
  connectionState,
  patternId,
  className = '',
  showAdvanced = false
}: RealTimeParameterControlsProps) {
  
  // Parameter persistence (per-pattern localStorage)
  const persistence = useParameterPersistence({
    patternId,
    autoSave: true,
    saveDelay: 300 // Save 300ms after last change
  });
  
  // Parameter transport (WS/REST with fallback)
  const transport = useParameterTransport({
    connectionState,
    onSuccess: (sentParams, response) => {
      console.debug('[RealTimeParams] Transport success:', sentParams);
    },
    onError: (error, sentParams) => {
      console.error('[RealTimeParams] Transport error:', error.message, sentParams);
      toast.error('Parameter update failed', {
        description: `${error.message} - Check device connection`
      });
    },
    retryAttempts: 2,
    retryDelay: 1000,
    timeout: 5000
  });
  
  // Coalesced parameter sender (leading + trailing edge)
  const coalescer = useCoalescedParams({
    onSend: transport.sendParameters,
    // Tests expect ~80ms coalescing window and ≤2 calls per 500ms
    delay: 80,
    leadingEdge: true,
    maxWait: 500
  });
  
  // Performance tracking
  const [performanceStats, setPerformanceStats] = useState({
    coalescing: { totalScheduled: 0, totalSent: 0 },
    transport: transport.getTransportStats()
  });
  
  const performanceUpdateRef = useRef<NodeJS.Timeout>();
  
  // Update performance stats periodically and immediately on mount
  useEffect(() => {
    const updateStats = () => {
      setPerformanceStats({
        coalescing: {
          totalScheduled: 0, // Would come from coalescer stats
          totalSent: 0
        },
        transport: transport.getTransportStats()
      });
    };
    
    // Immediate update for tests that assert UI without waiting
    updateStats();
    performanceUpdateRef.current = setInterval(updateStats, 100);
    
    return () => {
      if (performanceUpdateRef.current) {
        clearInterval(performanceUpdateRef.current);
      }
    };
  }, [transport]);
  
  /**
   * Handle parameter changes (during drag/input)
   * This fires on every slider movement for immediate UI feedback
   */
  const handleParameterChange = useCallback((key: string, value: number) => {
    const paramKey = key as keyof UIParams;
    
    // Update UI immediately (optimistic update)
    persistence.updateParam(paramKey, value);
    
    // Schedule coalesced send (leading edge will send immediately on first change)
    coalescer.scheduleSend(paramKey, value);
    
  }, [persistence, coalescer]);
  
  /**
   * Handle parameter commit (end of drag/input)
   * This fires when user finishes interacting with a slider
   */
  const handleParameterCommit = useCallback((key: string, value: number) => {
    const paramKey = key as keyof UIParams;
    
    // Ensure final value is set
    persistence.updateParam(paramKey, value);
    
    // Flush any pending coalesced updates immediately
    coalescer.flush();
    
    console.debug(`[RealTimeParams] Committed ${key}: ${value}`);
  }, [persistence, coalescer]);
  
  /**
   * Reset all parameters to defaults
   */
  const handleResetAll = useCallback(() => {
    persistence.resetToDefaults();
    
    // Cancel any pending coalesced updates and send defaults once
    coalescer.cancel();
    transport.sendParameters(DEFAULT_PARAMS);
    
    toast.success('Parameters reset to defaults');
  }, [persistence, coalescer, transport]);
  
  /**
   * Manual save (flush pending changes)
   */
  const handleManualSave = useCallback(() => {
    persistence.saveParams();
    coalescer.flush();
    
    toast.success('Parameters saved');
  }, [persistence, coalescer]);
  
  /**
   * Clear transport errors
   */
  const handleClearError = useCallback(() => {
    transport.clearError();
  }, [transport]);
  
  const isConnected = connectionState.connected;
  const hasUnsavedChanges = persistence.hasUnsavedChanges;
  const isAtDefaults = persistence.isAtDefaults;
  const isTransporting = transport.isTransporting || coalescer.isPending();
  
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--prism-text-primary)]">
            Real-Time Parameters
          </h2>
          <p className="text-sm text-[var(--prism-text-secondary)]">
            Pattern: {patternId} • ≤100ms response time
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Performance monitor */}
          {showAdvanced && (
            <PerformanceMonitor
              isTransporting={isTransporting}
              coalescingStats={performanceStats.coalescing}
              transportStats={performanceStats.transport}
            />
          )}
          
          {/* Connection status */}
          <div className={`w-2 h-2 rounded-full ${
            isConnected 
              ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' 
              : 'bg-red-500'
          }`} />
        </div>
      </div>
      
      {/* Transport error display */}
      {transport.lastError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span className="font-medium">Transport Error</span>
            </div>
            <Button
              onClick={handleClearError}
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-800 h-6 px-2"
            >
              Dismiss
            </Button>
          </div>
          <p className="text-xs text-red-600 mt-1">
            {typeof transport.lastError === 'string'
              ? transport.lastError
              : (transport.lastError as any)?.message ?? String(transport.lastError)}
          </p>
        </div>
      )}
      
      {/* Parameter sliders */}
      <div className="space-y-4">
        {PARAM_ORDER.map(paramKey => (
          <ParamSlider
            key={paramKey}
            metadata={PARAM_METADATA[paramKey]}
            value={persistence.params[paramKey]}
            onChange={handleParameterChange}
            onCommit={handleParameterCommit}
            disabled={!isConnected}
            showReset={true}
            className="bg-[var(--prism-bg-surface)] border border-[var(--prism-bg-elevated)] rounded-lg p-4"
          />
        ))}
      </div>
      
      {/* Control buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-[var(--prism-bg-elevated)]">
        <div className="flex items-center gap-2">
          {/* Reset all button */}
          <Button
            onClick={handleResetAll}
            variant="outline"
            size="sm"
            disabled={!isConnected || isAtDefaults}
            className="text-xs"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Reset All
          </Button>
          
          {/* Manual save button */}
          <Button
            onClick={handleManualSave}
            variant="outline"
            size="sm"
            disabled={!hasUnsavedChanges}
            className="text-xs"
          >
            <Save className="w-3 h-3 mr-1" />
            Save
          </Button>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-[var(--prism-text-secondary)]">
          {/* Status indicators */}
          {hasUnsavedChanges && (
            <Badge variant="outline" className="text-[10px]">
              Unsaved
            </Badge>
          )}
          
          {isAtDefaults && (
            <Badge variant="secondary" className="text-[10px]">
              Defaults
            </Badge>
          )}
          
          {isTransporting && (
            <Badge variant="default" className="text-[10px]">
              Sending...
            </Badge>
          )}
          
          {!isConnected && (
            <Badge variant="destructive" className="text-[10px]">
              Disconnected
            </Badge>
          )}
        </div>
      </div>
      
      {/* Advanced debug info */}
      {showAdvanced && (
        <details className="text-xs text-[var(--prism-text-secondary)]">
          <summary className="cursor-pointer hover:text-[var(--prism-text-primary)]">
            Debug Info
          </summary>
          <div className="mt-2 p-2 bg-[var(--prism-bg-canvas)] rounded text-[10px] font-mono">
            <div>Pattern: {patternId}</div>
            <div>Connected: {isConnected ? 'Yes' : 'No'}</div>
            <div>Transporting: {isTransporting ? 'Yes' : 'No'}</div>
            <div>Unsaved: {hasUnsavedChanges ? 'Yes' : 'No'}</div>
            <div>At Defaults: {isAtDefaults ? 'Yes' : 'No'}</div>
            <div>Pending: {coalescer.isPending() ? 'Yes' : 'No'}</div>
            <div>Transport Stats: {JSON.stringify(performanceStats.transport, null, 2)}</div>
          </div>
        </details>
      )}
    </div>
  );
}
