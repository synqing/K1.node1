// Centralized feature flag keys for environment gating
// Use these with isDevEnabled([...]) to avoid typos and keep consistency

export const FLAG_SHOW_DEV_WIDGET = 'VITE_SHOW_DEV_WIDGET';
export const FLAG_ENABLE_DEV_METRICS = 'VITE_ENABLE_DEV_METRICS';
export const FLAG_ENABLE_TIMING_OVERRIDES = 'VITE_ENABLE_TIMING_OVERRIDES';
export const FLAG_SHOW_PREVIEW_LINK = 'VITE_SHOW_PREVIEW_LINK';

// Common combinations
export const DEV_WIDGET_AND_METRICS = [
  FLAG_SHOW_DEV_WIDGET,
  FLAG_ENABLE_DEV_METRICS,
] as const;

