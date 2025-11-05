/**
 * Optimistic Pattern Selection Hook
 * 
 * Task 4.3: Add optimistic selection state and in-flight request guard
 * - Manage local state: previousActiveId, activeId, pendingId
 * - Block duplicate requests while pending
 * - Optimistically highlight selection with loading indicator
 * - Ensure re-entrancy guards prevent rapid double activation
 */

import { useState, useCallback, useRef } from 'react';
import { postSelect } from '../lib/api';
import { ConnectionState } from '../lib/types';
import { K1Pattern } from '../lib/patterns';
import { toast } from 'sonner';

interface UseOptimisticPatternSelectionOptions {
  connectionState: ConnectionState;
  selectedPatternId?: string;
  onPatternSelect?: (patternId: string) => void;
  timeout?: number; // Selection timeout in ms (default: 2000)
}

interface OptimisticSelectionState {
  pendingPatternId?: string;
  lastError?: string;
  isSelecting: boolean;
}

export function useOptimisticPatternSelection({
  connectionState,
  selectedPatternId,
  onPatternSelect,
  timeout = 2000
}: UseOptimisticPatternSelectionOptions) {
  const [state, setState] = useState<OptimisticSelectionState>({
    isSelecting: false
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);
  // Synchronous in-flight guard to prevent rapid duplicate activations
  const inFlightRef = useRef<boolean>(false);
  // Track pending pattern id synchronously to compare within rapid events
  const pendingIdRef = useRef<string | undefined>(undefined);
  const previousPatternIdRef = useRef<string | undefined>(selectedPatternId);
  
  // Update previous pattern ID when selection changes externally
  if (selectedPatternId !== previousPatternIdRef.current && !state.isSelecting) {
    previousPatternIdRef.current = selectedPatternId;
  }
  
  /**
   * Select a pattern with optimistic UI updates and error rollback
   */
  const selectPattern = useCallback(async (pattern: K1Pattern) => {
    // Guard against invalid states
    if (!connectionState.connected) {
      toast.error('Device not connected', {
        description: 'Please connect to a device before selecting patterns'
      });
      return;
    }
    
    // Prevent rapid duplicate clicks while selection is in-flight
    if (inFlightRef.current) {
      // If the same pattern is being selected, ignore duplicates
      if (pendingIdRef.current === pattern.id) {
        return;
      }
      // If switching to a different pattern mid-flight, abort previous and proceed
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    } else {
      // If selection is pending but ref hasn't flipped yet, still guard duplicates
      if (state.isSelecting && state.pendingPatternId === pattern.id) {
        return;
      }
    }
    
    // Create new abort controller for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;
    inFlightRef.current = true;
    pendingIdRef.current = pattern.id;
    
    // Store previous state for rollback
    const previousPatternId = selectedPatternId;
    previousPatternIdRef.current = previousPatternId;
    
    // Update state to show pending
    setState({
      pendingPatternId: pattern.id,
      isSelecting: true,
      lastError: undefined
    });
    
    // Optimistic update - immediately update UI
    onPatternSelect?.(pattern.id);
    
    // Show loading toast
    const selectingToast = toast.loading(`Activating ${pattern.name}...`, {
      description: pattern.description
    });
    
    try {
      // Set up timeout as a rejecting promise and race it against the API call.
      let timeoutId: any;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          // Abort current request for consistency, and reject to break out of the await
          controller.abort();
          reject(new Error('Request timed out after 2 seconds'));
        }, timeout);
      });
      
      // Race the API call against the timeout so hanging promises don't block forever
      const result = await Promise.race([
        postSelect(connectionState.deviceIp, {
          id: pattern.id,
          index: pattern.firmwareIndex
        }),
        timeoutPromise
      ]);
      
      // Clear timeout if request completed
      if (timeoutId) clearTimeout(timeoutId);
      
      // Check API result
      if (!result.ok) {
        throw new Error('Pattern selection failed on device');
      }
      
      // Success - update state
      setState({
        isSelecting: false,
        pendingPatternId: undefined,
        lastError: undefined
      });
      inFlightRef.current = false;
      pendingIdRef.current = undefined;
      
      // Show success toast
      toast.success(`${pattern.name} activated`, {
        id: selectingToast,
        description: 'Pattern switched successfully'
      });
      
    } catch (error) {
      // Handle all errors (including timeouts)
        // Rollback optimistic update
        if (previousPatternId !== undefined) {
          onPatternSelect?.(previousPatternId);
        }
        
        const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
        
        // Update state with error
        setState({
          isSelecting: false,
          pendingPatternId: undefined,
          lastError: errorMsg
        });
        inFlightRef.current = false;
        pendingIdRef.current = undefined;
        
        // Show error toast
        toast.error(`Failed to activate ${pattern.name}`, {
          id: selectingToast,
          description: errorMsg
        });
    }
  }, [
    connectionState,
    selectedPatternId,
    onPatternSelect,
    state.pendingPatternId,
    state.isSelecting,
    timeout
  ]);
  
  /**
   * Clear any error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      lastError: undefined
    }));
  }, []);
  
  /**
   * Cancel any pending selection
   */
  const cancelSelection = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Rollback to previous pattern if there was one
    const previousPatternId = previousPatternIdRef.current;
    if (previousPatternId !== undefined) {
      onPatternSelect?.(previousPatternId);
    }
    
    setState({
      isSelecting: false,
      pendingPatternId: undefined,
      lastError: undefined
    });
    
    toast.info('Pattern selection cancelled');
  }, [onPatternSelect]);
  
  /**
   * Check if a specific pattern is currently pending
   */
  const isPatternPending = useCallback((patternId: string) => {
    return state.pendingPatternId === patternId;
  }, [state.pendingPatternId]);
  
  /**
   * Check if any pattern selection is in progress
   */
  const isAnyPatternPending = useCallback(() => {
    return state.isSelecting;
  }, [state.isSelecting]);
  
  return {
    // State
    pendingPatternId: state.pendingPatternId,
    lastError: state.lastError,
    isSelecting: state.isSelecting,
    
    // Actions
    selectPattern,
    clearError,
    cancelSelection,
    
    // Utilities
    isPatternPending,
    isAnyPatternPending
  };
}
