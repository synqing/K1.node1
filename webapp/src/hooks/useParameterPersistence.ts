/**
 * Parameter Persistence Hook
 * 
 * Task 5.5: Per-pattern persistence and Reset to defaults via localStorage
 * - usePatternParamsPersistence keyed as k1:params:{patternId}
 * - Load saved values or DEFAULT_PARAMS on pattern switch
 * - Save on commit/end of drag with debouncing
 * - Reset to restore defaults for current pattern
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { type UIParams, DEFAULT_PARAMS, createSafeParams, areParamsEqual } from '../lib/parameters';

interface ParameterPersistenceOptions {
  patternId: string;
  autoSave?: boolean;
  saveDelay?: number; // Debounce delay for auto-save (default: 500ms)
}

interface ParameterPersistence {
  params: UIParams;
  setParams: (params: UIParams) => void;
  updateParam: (key: keyof UIParams, value: number) => void;
  resetToDefaults: () => void;
  resetParam: (key: keyof UIParams) => void;
  saveParams: () => void;
  loadParams: () => void;
  hasUnsavedChanges: boolean;
  isAtDefaults: boolean;
  getParamDefault: (key: keyof UIParams) => number;
}

// Storage key prefix for parameter persistence
const STORAGE_PREFIX = 'k1:params:';

/**
 * Generate storage key for a pattern
 */
function getStorageKey(patternId: string): string {
  return `${STORAGE_PREFIX}${patternId}`;
}

/**
 * Load parameters from localStorage for a pattern
 */
function loadParamsFromStorage(patternId: string): UIParams {
  try {
    const key = getStorageKey(patternId);
    const stored = localStorage.getItem(key);
    
    if (!stored) {
      return { ...DEFAULT_PARAMS };
    }
    
    const parsed = JSON.parse(stored);
    return createSafeParams(parsed);
    
  } catch (error) {
    console.warn(`[ParameterPersistence] Failed to load params for pattern ${patternId}:`, error);
    return { ...DEFAULT_PARAMS };
  }
}

/**
 * Save parameters to localStorage for a pattern
 */
function saveParamsToStorage(patternId: string, params: UIParams): void {
  try {
    const key = getStorageKey(patternId);
    const serialized = JSON.stringify(params);
    localStorage.setItem(key, serialized);
    
  } catch (error) {
    console.error(`[ParameterPersistence] Failed to save params for pattern ${patternId}:`, error);
  }
}

/**
 * Check if parameters exist in storage for a pattern
 */
function hasStoredParams(patternId: string): boolean {
  try {
    const key = getStorageKey(patternId);
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

/**
 * Clear stored parameters for a pattern
 */
function clearStoredParams(patternId: string): void {
  try {
    const key = getStorageKey(patternId);
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`[ParameterPersistence] Failed to clear params for pattern ${patternId}:`, error);
  }
}

/**
 * Hook for managing per-pattern parameter persistence
 */
export function useParameterPersistence({
  patternId,
  autoSave = true,
  saveDelay = 500
}: ParameterPersistenceOptions): ParameterPersistence {
  
  const [params, setParamsState] = useState<UIParams>(() => loadParamsFromStorage(patternId));
  const [lastSavedParams, setLastSavedParams] = useState<UIParams>(params);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentPatternIdRef = useRef(patternId);
  
  /**
   * Save parameters to storage with debouncing
   */
  const saveParams = useCallback(() => {
    saveParamsToStorage(patternId, params);
    setLastSavedParams({ ...params });
  }, [patternId, params]);
  
  /**
   * Debounced save function
   */
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveParams();
    }, saveDelay);
  }, [saveParams, saveDelay]);
  
  /**
   * Load parameters from storage
   */
  const loadParams = useCallback(() => {
    const loadedParams = loadParamsFromStorage(patternId);
    setParamsState(loadedParams);
    setLastSavedParams(loadedParams);
  }, [patternId]);
  
  /**
   * Set parameters with optional auto-save
   */
  const setParams = useCallback((newParams: UIParams) => {
    const safeParams = createSafeParams(newParams);
    setParamsState(safeParams);
    
    if (autoSave) {
      debouncedSave();
    }
  }, [autoSave, debouncedSave]);
  
  /**
   * Update a single parameter
   */
  const updateParam = useCallback((key: keyof UIParams, value: number) => {
    setParamsState(prevParams => {
      const newParams = { ...prevParams, [key]: value };
      
      if (autoSave) {
        // Schedule save after state update
        setTimeout(() => debouncedSave(), 0);
      }
      
      return newParams;
    });
  }, [autoSave, debouncedSave]);
  
  /**
   * Reset all parameters to defaults
   */
  const resetToDefaults = useCallback(() => {
    const defaultParams = { ...DEFAULT_PARAMS };
    setParamsState(defaultParams);
    
    if (autoSave) {
      saveParamsToStorage(patternId, defaultParams);
      setLastSavedParams(defaultParams);
    }
  }, [patternId, autoSave]);
  
  /**
   * Reset a single parameter to its default value
   */
  const resetParam = useCallback((key: keyof UIParams) => {
    const defaultValue = DEFAULT_PARAMS[key];
    updateParam(key, defaultValue);
  }, [updateParam]);
  
  /**
   * Get default value for a parameter
   */
  const getParamDefault = useCallback((key: keyof UIParams): number => {
    return DEFAULT_PARAMS[key];
  }, []);
  
  // Check if there are unsaved changes
  const hasUnsavedChanges = !areParamsEqual(params, lastSavedParams);
  
  // Check if all parameters are at default values
  const isAtDefaults = areParamsEqual(params, DEFAULT_PARAMS);
  
  // Handle pattern changes - load new pattern's parameters
  useEffect(() => {
    if (patternId !== currentPatternIdRef.current) {
      // Save current pattern's parameters before switching
      if (currentPatternIdRef.current && hasUnsavedChanges) {
        saveParamsToStorage(currentPatternIdRef.current, params);
      }
      
      // Load new pattern's parameters
      currentPatternIdRef.current = patternId;
      loadParams();
    }
  }, [patternId, params, hasUnsavedChanges, loadParams]);
  
  // Auto-save on unmount if there are unsaved changes
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      if (hasUnsavedChanges && autoSave) {
        saveParamsToStorage(patternId, params);
      }
    };
  }, [patternId, params, hasUnsavedChanges, autoSave]);
  
  return {
    params,
    setParams,
    updateParam,
    resetToDefaults,
    resetParam,
    saveParams,
    loadParams,
    hasUnsavedChanges,
    isAtDefaults,
    getParamDefault
  };
}

/**
 * Hook for managing global parameter operations across all patterns
 */
export function useGlobalParameterPersistence() {
  /**
   * Get all stored pattern IDs
   */
  const getStoredPatternIds = useCallback((): string[] => {
    try {
      const keys = Object.keys(localStorage);
      return keys
        .filter(key => key.startsWith(STORAGE_PREFIX))
        .map(key => key.substring(STORAGE_PREFIX.length));
    } catch {
      return [];
    }
  }, []);
  
  /**
   * Clear all stored parameters
   */
  const clearAllStoredParams = useCallback(() => {
    const patternIds = getStoredPatternIds();
    patternIds.forEach(patternId => {
      clearStoredParams(patternId);
    });
  }, [getStoredPatternIds]);
  
  /**
   * Export all parameters as JSON
   */
  const exportAllParams = useCallback(() => {
    const patternIds = getStoredPatternIds();
    const exported: Record<string, UIParams> = {};
    
    patternIds.forEach(patternId => {
      exported[patternId] = loadParamsFromStorage(patternId);
    });
    
    return exported;
  }, [getStoredPatternIds]);
  
  /**
   * Import parameters from JSON
   */
  const importAllParams = useCallback((data: Record<string, UIParams>) => {
    Object.entries(data).forEach(([patternId, params]) => {
      const safeParams = createSafeParams(params);
      saveParamsToStorage(patternId, safeParams);
    });
  }, []);
  
  /**
   * Reset all patterns to defaults
   */
  const resetAllToDefaults = useCallback(() => {
    const patternIds = getStoredPatternIds();
    patternIds.forEach(patternId => {
      saveParamsToStorage(patternId, DEFAULT_PARAMS);
    });
  }, [getStoredPatternIds]);
  
  /**
   * Get storage usage statistics
   */
  const getStorageStats = useCallback(() => {
    const patternIds = getStoredPatternIds();
    let totalSize = 0;
    
    patternIds.forEach(patternId => {
      try {
        const key = getStorageKey(patternId);
        const value = localStorage.getItem(key);
        if (value) {
          totalSize += key.length + value.length;
        }
      } catch {}
    });
    
    return {
      patternCount: patternIds.length,
      totalSizeBytes: totalSize,
      totalSizeKB: Math.round(totalSize / 1024 * 100) / 100,
      patternIds
    };
  }, [getStoredPatternIds]);
  
  return {
    getStoredPatternIds,
    clearAllStoredParams,
    exportAllParams,
    importAllParams,
    resetAllToDefaults,
    getStorageStats,
    hasStoredParams,
    loadParamsFromStorage,
    saveParamsToStorage,
    clearStoredParams
  };
}