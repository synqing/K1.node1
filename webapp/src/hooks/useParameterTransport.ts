/**
 * Parameter Transport Hook
 * 
 * Task 5.4: Add WS/REST transport bridge for parameter updates with fallback
 * - Route coalesced payloads over WS when available, else REST
 * - Handle connection state, in-flight dedupe, retry/backoff on errors
 * - Map payload from UIParams to firmware format precisely
 * - Emit success/error signals to callers
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { postParams } from '../lib/api';
import { type UIParams, uiToFirmwareParams } from '../lib/parameters';
import { ConnectionState } from '../lib/types';
import { toast } from 'sonner';

interface ParameterTransportOptions {
  connectionState: ConnectionState;
  onSuccess?: (sentParams: Partial<UIParams>, response?: any) => void;
  onError?: (error: Error, sentParams: Partial<UIParams>) => void;
  retryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
}

interface ParameterTransportResult {
  sendParameters: (params: Partial<UIParams>) => Promise<void>;
  isTransporting: boolean;
  lastError: string | null;
  clearError: () => void;
  getTransportStats: () => TransportStats;
}

interface TransportStats {
  totalSent: number;
  totalErrors: number;
  successRate: number;
  averageLatency: number;
  wsUsageRate: number;
  restUsageRate: number;
  lastSendTime: number;
  lastStatusCode?: number;
  consecutiveFailures: number;
  backoffMs: number;
  backingOff: boolean;
}

/**
 * Hook for managing parameter transport with WS/REST fallback
 */
export function useParameterTransport({
  connectionState,
  onSuccess,
  onError,
  retryAttempts = 2,
  retryDelay = 1000,
  timeout = 5000
}: ParameterTransportOptions): ParameterTransportResult {
  
  const [isTransporting, setIsTransporting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  
  // Transport statistics
  const statsRef = useRef<TransportStats>({
    totalSent: 0,
    totalErrors: 0,
    successRate: 1.0,
    averageLatency: 0,
    wsUsageRate: 0,
    restUsageRate: 1.0,
    lastSendTime: 0,
    lastStatusCode: undefined,
    consecutiveFailures: 0,
    backoffMs: 0,
    backingOff: false
  });
  
  const latencyHistoryRef = useRef<number[]>([]);
  const inFlightRequestsRef = useRef(new Set<string>());
  const baseRetryDelayRef = useRef<number>(retryDelay);
  
  /**
   * Generate a unique key for deduplication
   */
  const generateRequestKey = useCallback((params: Partial<UIParams>): string => {
    const sortedKeys = Object.keys(params).sort();
    return sortedKeys.map(key => `${key}:${params[key as keyof UIParams]}`).join('|');
  }, []);
  
  /**
   * Update transport statistics
   */
  const updateStats = useCallback((success: boolean, latency: number, transport: 'ws' | 'rest', statusCode?: number) => {
    const stats = statsRef.current;
    
    stats.totalSent++;
    if (!success) {
      stats.totalErrors++;
      stats.consecutiveFailures = Math.min(stats.consecutiveFailures + 1, 1000);
    } else {
      stats.consecutiveFailures = 0;
    }
    
    stats.successRate = (stats.totalSent - stats.totalErrors) / stats.totalSent;
    stats.lastSendTime = Date.now();
    stats.lastStatusCode = statusCode;
    
    // Update latency average
    latencyHistoryRef.current.push(latency);
    if (latencyHistoryRef.current.length > 50) {
      latencyHistoryRef.current.shift();
    }
    
    const avgLatency = latencyHistoryRef.current.reduce((sum, lat) => sum + lat, 0) / latencyHistoryRef.current.length;
    stats.averageLatency = avgLatency;
    
    // Update transport usage rates
    const wsCount = transport === 'ws' ? 1 : 0;
    const restCount = transport === 'rest' ? 1 : 0;
    
    stats.wsUsageRate = ((stats.wsUsageRate * (stats.totalSent - 1)) + wsCount) / stats.totalSent;
    stats.restUsageRate = ((stats.restUsageRate * (stats.totalSent - 1)) + restCount) / stats.totalSent;
  }, []);
  
  /**
   * Check if WebSocket is available and connected
   * TODO: Implement actual WebSocket detection when WS transport is available
   */
  const isWebSocketAvailable = useCallback((): boolean => {
    // For now, always return false to use REST transport
    // This will be updated when WebSocket transport is implemented
    return false;
  }, []);
  
  /**
   * Send parameters via WebSocket
   * TODO: Implement actual WebSocket transport
   */
  const sendViaWebSocket = useCallback(async (firmwareParams: Record<string, number>): Promise<any> => {
    // Placeholder for WebSocket implementation
    throw new Error('WebSocket transport not yet implemented');
  }, []);
  
  /**
   * Send parameters via REST API
   */
  const sendViaREST = useCallback(async (firmwareParams: Record<string, number>): Promise<any> => {
    if (!connectionState.connected || !connectionState.deviceIp) {
      throw new Error('Device not connected');
    }
    
    try {
      const result = await postParams(connectionState.deviceIp, firmwareParams);
      if (!result.ok) {
        throw new Error('REST API request failed');
      }
      return result.data;
    } catch (err: any) {
      const msg = String(err?.message || err);
      // Extract status code if present in message like "Request failed: 429"
      const match = msg.match(/Request failed:\s*(\d{3})/);
      const statusCode = match ? parseInt(match[1], 10) : undefined;
      const e = new Error(statusCode === 429 ? 'Rate limited (429)' : msg);
      (e as any).statusCode = statusCode;
      throw e;
    }
  }, [connectionState]);
  
  /**
   * Send parameters with retry logic
   */
  const sendWithRetry = useCallback(async (
    params: Partial<UIParams>,
    attempt: number = 1
  ): Promise<void> => {
    const startTime = performance.now();
    const firmwareParams = uiToFirmwareParams(params);
    
    try {
      let response: any;
      let transport: 'ws' | 'rest';
      
      // Try WebSocket first if available
      if (isWebSocketAvailable()) {
        try {
          response = await sendViaWebSocket(firmwareParams);
          transport = 'ws';
        } catch (wsError) {
          console.warn('[ParameterTransport] WebSocket failed, falling back to REST:', wsError);
          response = await sendViaREST(firmwareParams);
          transport = 'rest';
        }
      } else {
        response = await sendViaREST(firmwareParams);
        transport = 'rest';
      }
      
      const latency = performance.now() - startTime;
      updateStats(true, latency, transport);
      
      setLastError(null);
      onSuccess?.(params, response);
      
    } catch (error) {
      const latency = performance.now() - startTime;
      const statusCode = (error as any)?.statusCode;
      updateStats(false, latency, 'rest', statusCode);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown transport error';
      
      // Compute adaptive backoff with jitter
      const isRateLimited = statusCode === 429 || /429/.test(errorMessage);
      const baseDelay = baseRetryDelayRef.current;
      const exponent = isRateLimited ? 2 + attempt : 1 + attempt * 0.5;
      let delay = Math.min(4000, Math.round(baseDelay * Math.pow(1.6, exponent)));
      // Add jitter up to 25%
      delay += Math.round(delay * (Math.random() * 0.25));
      statsRef.current.backoffMs = delay;
      statsRef.current.backingOff = true;

      // Retry logic
      if (attempt < retryAttempts) {
        console.warn(`[ParameterTransport] Attempt ${attempt} failed (${statusCode ?? 'unknown'}), backoff ${delay}ms:`, errorMessage);
        await new Promise(resolve => setTimeout(resolve, delay));
        statsRef.current.backingOff = false;
        return sendWithRetry(params, attempt + 1);
      }
      
      // Final failure
      setLastError(errorMessage);
      onError?.(error instanceof Error ? error : new Error(errorMessage), params);
      
      throw error;
    }
  }, [
    isWebSocketAvailable,
    sendViaWebSocket,
    sendViaREST,
    updateStats,
    onSuccess,
    onError,
    retryAttempts,
    retryDelay
  ]);
  
  /**
   * Main parameter sending function with deduplication
   */
  const sendParameters = useCallback(async (params: Partial<UIParams>): Promise<void> => {
    if (!connectionState.connected) {
      const error = new Error('Cannot send parameters: device not connected');
      setLastError(error.message);
      onError?.(error, params);
      return;
    }
    
    if (Object.keys(params).length === 0) {
      return; // Nothing to send
    }
    
    // Generate request key for deduplication
    const requestKey = generateRequestKey(params);
    
    // Check for duplicate in-flight requests
    if (inFlightRequestsRef.current.has(requestKey)) {
      console.debug('[ParameterTransport] Skipping duplicate request:', requestKey);
      return;
    }
    
    // Mark request as in-flight
    inFlightRequestsRef.current.add(requestKey);
    setIsTransporting(true);
    
    try {
      // Add timeout wrapper
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Parameter send timeout')), timeout);
      });
      
      await Promise.race([
        sendWithRetry(params),
        timeoutPromise
      ]);
      
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      setLastError(msg);
      onError?.(err instanceof Error ? err : new Error(msg), params);
    } finally {
      // Clean up in-flight tracking
      inFlightRequestsRef.current.delete(requestKey);
      setIsTransporting(inFlightRequestsRef.current.size > 0);
    }
  }, [
    connectionState.connected,
    generateRequestKey,
    sendWithRetry,
    timeout,
    onError
  ]);
  
  /**
   * Clear last error
   */
  const clearError = useCallback(() => {
    setLastError(null);
  }, []);
  
  /**
   * Get current transport statistics
   */
  const getTransportStats = useCallback((): TransportStats => {
    return { ...statsRef.current };
  }, []);
  
  // Clear in-flight requests when connection state changes
  useEffect(() => {
    if (!connectionState.connected) {
      inFlightRequestsRef.current.clear();
      setIsTransporting(false);
    }
  }, [connectionState.connected]);
  
  return {
    sendParameters,
    isTransporting,
    lastError,
    clearError,
    getTransportStats
  };
}

/**
 * Simplified transport hook for single parameter updates
 */
export function useSimpleParameterTransport(connectionState: ConnectionState) {
  const transport = useParameterTransport({
    connectionState,
    onSuccess: (params) => {
      console.debug('[SimpleParameterTransport] Success:', params);
    },
    onError: (error, params) => {
      console.error('[SimpleParameterTransport] Error:', error.message, params);
      toast.error('Parameter update failed', {
        description: error.message
      });
    }
  });
  
  return transport;
}

/**
 * Transport hook with toast notifications
 */
export function useParameterTransportWithToasts(connectionState: ConnectionState) {
  const transport = useParameterTransport({
    connectionState,
    onSuccess: (params, response) => {
      const paramNames = Object.keys(params).join(', ');
      toast.success('Parameters updated', {
        description: `Updated: ${paramNames}`
      });
    },
    onError: (error, params) => {
      const paramNames = Object.keys(params).join(', ');
      toast.error('Parameter update failed', {
        description: `Failed to update: ${paramNames} - ${error.message}`
      });
    }
  });
  
  return transport;
}
