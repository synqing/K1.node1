/**
 * UI Redux Slice
 * Manages dashboard UI state (panels, filters, sorting, pagination)
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { FilterState, SortState, PaginationState } from '../../types/dashboard';

interface UIState {
  selectedPanel: string;
  filters: FilterState;
  sortState: SortState;
  pagination: PaginationState;
  expandedRows: Set<string>;
  selectedItems: Set<string>;
  sidebarOpen: boolean;
  modals: Record<string, { isOpen: boolean; data?: any }>;
}

const initialState: UIState = {
  selectedPanel: 'overview',
  filters: {},
  sortState: { field: 'timestamp', direction: 'desc' },
  pagination: { page: 1, limit: 20, total: 0 },
  expandedRows: new Set(),
  selectedItems: new Set(),
  sidebarOpen: true,
  modals: {},
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // Panel actions
    selectPanel: (state, action: PayloadAction<string>) => {
      state.selectedPanel = action.payload;
    },

    // Filter actions
    setFilters: (state, action: PayloadAction<FilterState>) => {
      state.filters = action.payload;
      state.pagination.page = 1; // Reset to first page on filter change
    },

    updateFilter: (
      state,
      action: PayloadAction<{ key: string; value: any }>
    ) => {
      (state.filters as any)[action.payload.key] = action.payload.value;
      state.pagination.page = 1;
    },

    clearFilters: (state) => {
      state.filters = {};
      state.pagination.page = 1;
    },

    // Sort actions
    setSortState: (state, action: PayloadAction<SortState>) => {
      state.sortState = action.payload;
    },

    toggleSort: (state, action: PayloadAction<string>) => {
      if (state.sortState.field === action.payload) {
        state.sortState.direction =
          state.sortState.direction === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortState = { field: action.payload, direction: 'asc' };
      }
    },

    // Pagination actions
    setPagination: (state, action: PayloadAction<PaginationState>) => {
      state.pagination = action.payload;
    },

    goToPage: (state, action: PayloadAction<number>) => {
      state.pagination.page = Math.max(
        1,
        Math.min(
          action.payload,
          Math.ceil(state.pagination.total / state.pagination.limit)
        )
      );
    },

    setPageLimit: (state, action: PayloadAction<number>) => {
      state.pagination.limit = action.payload;
      state.pagination.page = 1;
    },

    setTotalCount: (state, action: PayloadAction<number>) => {
      state.pagination.total = action.payload;
    },

    // Expanded rows actions
    toggleExpandedRow: (state, action: PayloadAction<string>) => {
      if (state.expandedRows.has(action.payload)) {
        state.expandedRows.delete(action.payload);
      } else {
        state.expandedRows.add(action.payload);
      }
    },

    expandRow: (state, action: PayloadAction<string>) => {
      state.expandedRows.add(action.payload);
    },

    collapseRow: (state, action: PayloadAction<string>) => {
      state.expandedRows.delete(action.payload);
    },

    collapseAllRows: (state) => {
      state.expandedRows.clear();
    },

    // Selected items actions
    toggleSelectedItem: (state, action: PayloadAction<string>) => {
      if (state.selectedItems.has(action.payload)) {
        state.selectedItems.delete(action.payload);
      } else {
        state.selectedItems.add(action.payload);
      }
    },

    selectItem: (state, action: PayloadAction<string>) => {
      state.selectedItems.add(action.payload);
    },

    deselectItem: (state, action: PayloadAction<string>) => {
      state.selectedItems.delete(action.payload);
    },

    selectMultiple: (state, action: PayloadAction<string[]>) => {
      action.payload.forEach((item) => state.selectedItems.add(item));
    },

    clearSelectedItems: (state) => {
      state.selectedItems.clear();
    },

    // Sidebar actions
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },

    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },

    // Modal actions
    openModal: (
      state,
      action: PayloadAction<{ modalId: string; data?: any }>
    ) => {
      state.modals[action.payload.modalId] = {
        isOpen: true,
        data: action.payload.data,
      };
    },

    closeModal: (state, action: PayloadAction<string>) => {
      if (state.modals[action.payload]) {
        state.modals[action.payload].isOpen = false;
      }
    },

    closeAllModals: (state) => {
      Object.keys(state.modals).forEach((key) => {
        state.modals[key].isOpen = false;
      });
    },

    resetUI: () => initialState,
  },
});

export const {
  selectPanel,
  setFilters,
  updateFilter,
  clearFilters,
  setSortState,
  toggleSort,
  setPagination,
  goToPage,
  setPageLimit,
  setTotalCount,
  toggleExpandedRow,
  expandRow,
  collapseRow,
  collapseAllRows,
  toggleSelectedItem,
  selectItem,
  deselectItem,
  selectMultiple,
  clearSelectedItems,
  toggleSidebar,
  setSidebarOpen,
  openModal,
  closeModal,
  closeAllModals,
  resetUI,
} = uiSlice.actions;

export default uiSlice.reducer;
