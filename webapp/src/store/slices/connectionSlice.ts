/**
 * Connection Redux Slice
 * Manages WebSocket and API connection state
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ConnectionStatus } from '../../types/dashboard';

interface ConnectionState extends ConnectionStatus {}

const initialState: ConnectionState = {
  websocketConnected: false,
  lastUpdate: new Date(),
  lastError: undefined,
};

const connectionSlice = createSlice({
  name: 'connection',
  initialState,
  reducers: {
    setWebSocketConnected: (state, action: PayloadAction<boolean>) => {
      state.websocketConnected = action.payload;
      state.lastUpdate = new Date();
      if (action.payload) {
        state.lastError = undefined;
      }
    },

    setConnectionError: (state, action: PayloadAction<string>) => {
      state.lastError = action.payload;
      state.websocketConnected = false;
      state.lastUpdate = new Date();
    },

    clearConnectionError: (state) => {
      state.lastError = undefined;
    },

    updateLastUpdate: (state) => {
      state.lastUpdate = new Date();
    },

    reset: () => initialState,
  },
});

export const {
  setWebSocketConnected,
  setConnectionError,
  clearConnectionError,
  updateLastUpdate,
  reset,
} = connectionSlice.actions;

export default connectionSlice.reducer;
