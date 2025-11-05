// Small configuration surface for real-time parameter handling
// Defaults match current UX/test expectations, with optional env overrides.

// Read from Vite import.meta.env via safe helper when available (browser build),
// otherwise fall back to Node/Jest using globalThis.process.env safely without Node types.
import { getEnvSafe } from '../lib/env';
type MaybeEnv = Record<string, any> | undefined;
const viteEnv: MaybeEnv = getEnvSafe();
const nodeEnv: MaybeEnv = (globalThis as any)?.process?.env ?? undefined;
const envSrc: MaybeEnv = viteEnv ?? nodeEnv;

const num = (val: any, fallback: number) => {
  const n = Number(val);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};
const bool = (val: any, fallback: boolean) => {
  if (typeof val === 'string') return val === 'true' || val === '1';
  if (typeof val === 'boolean') return val;
  return fallback;
};

export const RTP_COALESCE_DELAY_MS = num(envSrc?.VITE_RTP_COALESCE_DELAY_MS, 80); // trailing delay window
export const RTP_COALESCE_MAX_WAIT_MS = num(envSrc?.VITE_RTP_COALESCE_MAX_WAIT_MS, 500); // force-send threshold
export const RTP_COALESCE_LEADING_EDGE = bool(envSrc?.VITE_RTP_COALESCE_LEADING_EDGE, true); // send on first change when isolated

export const RTP_PERSIST_SAVE_DELAY_MS = num(envSrc?.VITE_RTP_PERSIST_SAVE_DELAY_MS, 300); // autosave debounce delay
