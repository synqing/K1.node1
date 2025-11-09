/**
 * Redux Store Configuration
 * Combines all slices and middleware for dashboard state management
 */

import {
  configureStore,
  ThunkAction,
  Action,
  combineReducers,
} from '@reduxjs/toolkit';
import errorRecoveryReducer from './slices/errorRecoverySlice';
import schedulingReducer from './slices/schedulingSlice';
import uiReducer from './slices/uiSlice';
import connectionReducer from './slices/connectionSlice';

// Root reducer combining all slices
const rootReducer = combineReducers({
  errorRecovery: errorRecoveryReducer,
  scheduling: schedulingReducer,
  ui: uiReducer,
  connection: connectionReducer,
});

// Configure store with default middleware
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore Set and Date objects in the state tree
        ignoredActionPaths: ['ui.expandedRows', 'ui.selectedItems'],
        ignoredPaths: ['ui.expandedRows', 'ui.selectedItems', 'connection.lastUpdate'],
      },
    }),
});

// Export types for use in components
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;

export default store;
