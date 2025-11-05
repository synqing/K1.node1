/**
 * Coalesced Parameter Sender Hook
 * 
 * Task 5.3: Implement debounce/coalescing utilities with leading/trailing behavior (~80ms)
 * - useCoalescedParamsSender with pendingRef to store partial updates
 * - Leading edge: send immediately on first change
 * - Trailing edge: coalesce rapid changes and dispatch after ~80ms
 * - RAF throttle + setTimeout for optimal performance
 * - Expose scheduleSend, flush, and teardown to avoid leaks
 */

import { useRef, useCallback, useEffect } from 'react';
import { type UIParams } from '../lib/parameters';

interface CoalescedParamsSenderOptions {
  onSend: (params: Partial<UIParams>) => Promise<void> | void;
  delay?: number; // Trailing delay in ms (default: 80)
  leadingEdge?: boolean; // Send immediately on first change (default: true)
  maxWait?: number; // Maximum wait time before forcing send (default: 500)
}

interface CoalescedParamsSender {
  scheduleSend: (key: keyof UIParams, value: number) => void;
  flush: () => void;
  cancel: () => void;
  isPending: () => boolean;
  getPendingParams: () => Partial<UIParams>;
}

/**
 * Hook for coalescing parameter updates with leading/trailing behavior
 */
export function useCoalescedParams({
  onSend,
  delay = 80,
  leadingEdge = true,
  maxWait = 500
}: CoalescedParamsSenderOptions): CoalescedParamsSender {
  
  const pendingParamsRef = useRef<Partial<UIParams>>({});
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastSendTimeRef = useRef<number>(0);
  const hasPendingRef = useRef<boolean>(false);
  const isFirstChangeRef = useRef<boolean>(true);
  
  /**
   * Send pending parameters and clear state
   */
  const sendPendingParams = useCallback(async () => {
    const paramsToSend = { ...pendingParamsRef.current };
    
    // Clear pending state before sending to avoid race conditions
    pendingParamsRef.current = {};
    hasPendingRef.current = false;
    
    if (Object.keys(paramsToSend).length > 0) {
      lastSendTimeRef.current = performance.now();
      
      try {
        await onSend(paramsToSend);
      } catch (error) {
        console.error('[useCoalescedParams] Send failed:', error);
        // Could implement retry logic here if needed
      }
    }
  }, [onSend]);
  
  /**
   * Cancel any pending sends
   */
  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    
    pendingParamsRef.current = {};
    hasPendingRef.current = false;
  }, []);
  
  /**
   * Flush any pending parameters immediately
   */
  const flush = useCallback(() => {
    // Cancel timers only; preserve pending values for immediate send
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    
    // If there are pending params, send them now via RAF for smoothness
    if (Object.keys(pendingParamsRef.current).length > 0) {
      rafRef.current = requestAnimationFrame(() => {
        sendPendingParams();
      });
    }
  }, [cancel, sendPendingParams]);
  
  /**
   * Schedule a parameter update with coalescing
   */
  const scheduleSend = useCallback((key: keyof UIParams, value: number) => {
    // Update pending parameters
    pendingParamsRef.current[key] = value;
    hasPendingRef.current = true;
    
    const now = performance.now();
    const timeSinceLastSend = now - lastSendTimeRef.current;
    
    // Leading edge: send immediately on the first change
    if (leadingEdge && isFirstChangeRef.current) {
      isFirstChangeRef.current = false;
      
      // Use RAF for smooth leading edge send
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      
      rafRef.current = requestAnimationFrame(() => {
        sendPendingParams();
      });
      
      return;
    }
    
    // Mark that we've had at least one change
    isFirstChangeRef.current = false;
    
    // Cancel existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Check if we've exceeded max wait time
    const shouldForceFlush = timeSinceLastSend > maxWait;
    const actualDelay = shouldForceFlush ? 0 : delay;
    
    // Schedule trailing edge send
    timeoutRef.current = setTimeout(() => {
      // Use RAF to ensure smooth trailing edge send
      rafRef.current = requestAnimationFrame(() => {
        sendPendingParams();
      });
    }, actualDelay);
    
  }, [delay, leadingEdge, maxWait, sendPendingParams]);
  
  /**
   * Check if there are pending parameters
   */
  const isPending = useCallback(() => {
    return hasPendingRef.current;
  }, []);
  
  /**
   * Get current pending parameters (for debugging)
   */
  const getPendingParams = useCallback(() => {
    return { ...pendingParamsRef.current };
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);
  
  // Reset first change flag after a period of inactivity
  useEffect(() => {
    const resetTimeout = setTimeout(() => {
      if (!hasPendingRef.current) {
        isFirstChangeRef.current = true;
      }
    }, maxWait * 2);
    
    return () => clearTimeout(resetTimeout);
  }, [maxWait]);
  
  return {
    scheduleSend,
    flush,
    cancel,
    isPending,
    getPendingParams
  };
}

/**
 * Simpler version for single parameter coalescing
 */
interface SingleParamCoalescerOptions {
  onSend: (value: number) => Promise<void> | void;
  delay?: number;
  leadingEdge?: boolean;
}

export function useCoalescedParam({
  onSend,
  delay = 80,
  leadingEdge = true
}: SingleParamCoalescerOptions) {
  const pendingValueRef = useRef<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastSendTimeRef = useRef<number>(0);
  const isFirstChangeRef = useRef<boolean>(true);
  
  const sendPendingValue = useCallback(async () => {
    const valueToSend = pendingValueRef.current;
    pendingValueRef.current = null;
    
    if (valueToSend !== null) {
      lastSendTimeRef.current = performance.now();
      
      try {
        await onSend(valueToSend);
      } catch (error) {
        console.error('[useCoalescedParam] Send failed:', error);
      }
    }
  }, [onSend]);
  
  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    
    pendingValueRef.current = null;
  }, []);
  
  const flush = useCallback(() => {
    cancel();
    
    if (pendingValueRef.current !== null) {
      rafRef.current = requestAnimationFrame(() => {
        sendPendingValue();
      });
    }
  }, [cancel, sendPendingValue]);
  
  const scheduleSend = useCallback((value: number) => {
    pendingValueRef.current = value;
    
    const now = performance.now();
    const timeSinceLastSend = now - lastSendTimeRef.current;
    
    // Leading edge
    if (leadingEdge && isFirstChangeRef.current && timeSinceLastSend > delay) {
      isFirstChangeRef.current = false;
      
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      
      rafRef.current = requestAnimationFrame(() => {
        sendPendingValue();
      });
      
      return;
    }
    
    isFirstChangeRef.current = false;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      rafRef.current = requestAnimationFrame(() => {
        sendPendingValue();
      });
    }, delay);
    
  }, [delay, leadingEdge, sendPendingValue]);
  
  const isPending = useCallback(() => {
    return pendingValueRef.current !== null;
  }, []);
  
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);
  
  return {
    scheduleSend,
    flush,
    cancel,
    isPending
  };
}

/**
 * Performance monitoring utilities for debugging coalescing behavior
 */
export interface CoalescingStats {
  totalScheduled: number;
  totalSent: number;
  averageCoalescingRatio: number;
  averageSendInterval: number;
  lastSendTime: number;
}

export function useCoalescingStats(): {
  stats: CoalescingStats;
  recordSchedule: () => void;
  recordSend: () => void;
  reset: () => void;
} {
  const statsRef = useRef<CoalescingStats>({
    totalScheduled: 0,
    totalSent: 0,
    averageCoalescingRatio: 0,
    averageSendInterval: 0,
    lastSendTime: 0
  });
  
  const sendTimesRef = useRef<number[]>([]);
  
  const recordSchedule = useCallback(() => {
    statsRef.current.totalScheduled++;
  }, []);
  
  const recordSend = useCallback(() => {
    const now = performance.now();
    statsRef.current.totalSent++;
    
    // Track send intervals
    if (statsRef.current.lastSendTime > 0) {
      const interval = now - statsRef.current.lastSendTime;
      sendTimesRef.current.push(interval);
      
      // Keep only last 100 intervals for average calculation
      if (sendTimesRef.current.length > 100) {
        sendTimesRef.current.shift();
      }
      
      // Calculate average interval
      const sum = sendTimesRef.current.reduce((a, b) => a + b, 0);
      statsRef.current.averageSendInterval = sum / sendTimesRef.current.length;
    }
    
    statsRef.current.lastSendTime = now;
    
    // Calculate coalescing ratio
    if (statsRef.current.totalScheduled > 0) {
      statsRef.current.averageCoalescingRatio = 
        statsRef.current.totalSent / statsRef.current.totalScheduled;
    }
  }, []);
  
  const reset = useCallback(() => {
    statsRef.current = {
      totalScheduled: 0,
      totalSent: 0,
      averageCoalescingRatio: 0,
      averageSendInterval: 0,
      lastSendTime: 0
    };
    sendTimesRef.current = [];
  }, []);
  
  return {
    stats: statsRef.current,
    recordSchedule,
    recordSend,
    reset
  };
}
