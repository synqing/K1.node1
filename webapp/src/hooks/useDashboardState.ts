/**
 * Custom Hook: useDashboardState
 * Manages dashboard UI state including filters, pagination, and selections
 *
 * Responsibilities:
 * - Track dashboard UI state (selected panels, filters, pagination)
 * - Provide state setters for updates
 * - Handle state persistence (optional)
 * - Provide utility functions for common operations
 */

import { useState, useCallback, useEffect } from 'react';
import { DashboardState, FilterState, SortState, PaginationState } from '../types/dashboard';

/**
 * Initial dashboard state
 */
const getInitialState = (): DashboardState => ({
  errorRecovery: {
    retryStats: null,
    circuitBreakers: new Map(),
    dlqEntries: [],
    interventionHistory: [],
    taskStates: new Map(),
  },
  scheduling: {
    schedules: [],
    priorityQueue: null,
    resourceUsage: null,
    resourceLimits: {
      max_concurrent_tasks: 100,
      max_cpu_percent: 90,
      max_memory_percent: 85,
    },
  },
  ui: {
    selectedPanel: 'error-recovery',
    filters: {},
    sortState: {
      field: 'created_at',
      direction: 'desc',
    },
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
    },
    expandedRows: new Set(),
    selectedItems: new Set(),
  },
  connection: {
    websocketConnected: false,
    lastUpdate: new Date(),
  },
  loading: {
    errorRecovery: false,
    scheduling: false,
  },
  errors: {
    errorRecovery: null,
    scheduling: null,
  },
});

/**
 * useDashboardState - Custom hook for dashboard state management
 *
 * Usage:
 * ```tsx
 * const dashboardState = useDashboardState();
 * dashboardState.selectPanel('error-recovery');
 * dashboardState.setFilters({ status: 'pending' });
 * dashboardState.goToPage(2);
 * ```
 */
export const useDashboardState = () => {
  const [state, setInternalState] = useState<DashboardState>(getInitialState());

  // Restore state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dashboard-state');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Only restore UI state, not data state
        setInternalState((prev) => ({
          ...prev,
          ui: {
            ...prev.ui,
            selectedPanel: parsed.ui?.selectedPanel || prev.ui.selectedPanel,
            filters: parsed.ui?.filters || prev.ui.filters,
            sortState: parsed.ui?.sortState || prev.ui.sortState,
            pagination: parsed.ui?.pagination || prev.ui.pagination,
          },
        }));
      }
    } catch (error) {
      console.debug('Failed to restore dashboard state from localStorage', error);
    }
  }, []);

  // Generic state setter
  const setState = useCallback((newState: Partial<DashboardState> | ((prev: DashboardState) => DashboardState)) => {
    setInternalState((prev) => {
      const updated = typeof newState === 'function' ? newState(prev) : { ...prev, ...newState };
      // Persist UI state to localStorage
      try {
        localStorage.setItem(
          'dashboard-state',
          JSON.stringify({
            ui: updated.ui,
          })
        );
      } catch (error) {
        console.debug('Failed to persist dashboard state to localStorage', error);
      }
      return updated;
    });
  }, []);

  // Panel selection
  const selectPanel = useCallback((panelId: string) => {
    setState((prev) => ({
      ...prev,
      ui: {
        ...prev.ui,
        selectedPanel: panelId,
      },
    }));
  }, [setState]);

  // Filter management
  const setFilters = useCallback((filters: FilterState) => {
    setState((prev) => ({
      ...prev,
      ui: {
        ...prev.ui,
        filters,
        pagination: {
          ...prev.ui.pagination,
          page: 1, // Reset to first page when filters change
        },
      },
    }));
  }, [setState]);

  const updateFilter = useCallback((key: keyof FilterState, value: any) => {
    setState((prev) => ({
      ...prev,
      ui: {
        ...prev.ui,
        filters: {
          ...prev.ui.filters,
          [key]: value,
        },
        pagination: {
          ...prev.ui.pagination,
          page: 1,
        },
      },
    }));
  }, [setState]);

  const clearFilters = useCallback(() => {
    setState((prev) => ({
      ...prev,
      ui: {
        ...prev.ui,
        filters: {},
        pagination: {
          ...prev.ui.pagination,
          page: 1,
        },
      },
    }));
  }, [setState]);

  // Sorting
  const setSortState = useCallback((sortState: SortState) => {
    setState((prev) => ({
      ...prev,
      ui: {
        ...prev.ui,
        sortState,
      },
    }));
  }, [setState]);

  const toggleSort = useCallback((field: string) => {
    setState((prev) => {
      const { sortState } = prev.ui;
      const newDirection =
        sortState.field === field && sortState.direction === 'asc' ? 'desc' : 'asc';
      return {
        ...prev,
        ui: {
          ...prev.ui,
          sortState: {
            field,
            direction: newDirection,
          },
        },
      };
    });
  }, [setState]);

  // Pagination
  const setPagination = useCallback((pagination: Partial<PaginationState>) => {
    setState((prev) => ({
      ...prev,
      ui: {
        ...prev.ui,
        pagination: {
          ...prev.ui.pagination,
          ...pagination,
        },
      },
    }));
  }, [setState]);

  const goToPage = useCallback((page: number) => {
    setState((prev) => ({
      ...prev,
      ui: {
        ...prev.ui,
        pagination: {
          ...prev.ui.pagination,
          page: Math.max(1, page),
        },
      },
    }));
  }, [setState]);

  const setPageSize = useCallback((limit: number) => {
    setState((prev) => ({
      ...prev,
      ui: {
        ...prev.ui,
        pagination: {
          ...prev.ui.pagination,
          page: 1,
          limit,
        },
      },
    }));
  }, [setState]);

  // Row expansion
  const toggleRowExpanded = useCallback((rowId: string) => {
    setState((prev) => {
      const expandedRows = new Set(prev.ui.expandedRows);
      if (expandedRows.has(rowId)) {
        expandedRows.delete(rowId);
      } else {
        expandedRows.add(rowId);
      }
      return {
        ...prev,
        ui: {
          ...prev.ui,
          expandedRows,
        },
      };
    });
  }, [setState]);

  const isRowExpanded = useCallback((rowId: string) => {
    return state.ui.expandedRows.has(rowId);
  }, [state.ui.expandedRows]);

  // Item selection
  const toggleItemSelected = useCallback((itemId: string) => {
    setState((prev) => {
      const selectedItems = new Set(prev.ui.selectedItems);
      if (selectedItems.has(itemId)) {
        selectedItems.delete(itemId);
      } else {
        selectedItems.add(itemId);
      }
      return {
        ...prev,
        ui: {
          ...prev.ui,
          selectedItems,
        },
      };
    });
  }, [setState]);

  const selectAllItems = useCallback((itemIds: string[]) => {
    setState((prev) => ({
      ...prev,
      ui: {
        ...prev.ui,
        selectedItems: new Set(itemIds),
      },
    }));
  }, [setState]);

  const clearSelectedItems = useCallback(() => {
    setState((prev) => ({
      ...prev,
      ui: {
        ...prev.ui,
        selectedItems: new Set(),
      },
    }));
  }, [setState]);

  const isItemSelected = useCallback((itemId: string) => {
    return state.ui.selectedItems.has(itemId);
  }, [state.ui.selectedItems]);

  return {
    // State
    state,
    setState,

    // Panel selection
    selectPanel,
    selectedPanel: state.ui.selectedPanel,

    // Filters
    filters: state.ui.filters,
    setFilters,
    updateFilter,
    clearFilters,

    // Sorting
    sortState: state.ui.sortState,
    setSortState,
    toggleSort,

    // Pagination
    pagination: state.ui.pagination,
    setPagination,
    goToPage,
    setPageSize,

    // Row expansion
    toggleRowExpanded,
    isRowExpanded,

    // Item selection
    toggleItemSelected,
    selectAllItems,
    clearSelectedItems,
    isItemSelected,
    selectedItemsCount: state.ui.selectedItems.size,
  };
};

export default useDashboardState;
