// Runtime overrides for real-time parameter timing. Persisted in localStorage.
// Provides a hook to read/update overrides and an event to notify listeners.

export type RtpOverrides = {
  coalesceDelayMs?: number;
  coalesceMaxWaitMs?: number;
  leadingEdge?: boolean;
  persistSaveDelayMs?: number;
};

const STORAGE_KEY = 'rtp.overrides';
const UPDATE_EVENT = 'rtp:overrides:update';

function clampNumber(value: any, fallback: number, min = 0, max = 10000) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return Math.round(n);
}

function toBoolean(value: any, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true' || value === '1';
  return fallback;
}

export function readOverrides(): RtpOverrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const out: RtpOverrides = {};
    if ('coalesceDelayMs' in parsed) out.coalesceDelayMs = clampNumber(parsed.coalesceDelayMs, 80);
    if ('coalesceMaxWaitMs' in parsed) out.coalesceMaxWaitMs = clampNumber(parsed.coalesceMaxWaitMs, 500);
    if ('leadingEdge' in parsed) out.leadingEdge = toBoolean(parsed.leadingEdge, true);
    if ('persistSaveDelayMs' in parsed) out.persistSaveDelayMs = clampNumber(parsed.persistSaveDelayMs, 300);
    return out;
  } catch {
    return {};
  }
}

export function writeOverrides(partial: RtpOverrides) {
  try {
    const current = readOverrides();
    const next: RtpOverrides = { ...current, ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: next }));
    return next;
  } catch {
    // ignore
    return partial;
  }
}

export function clearOverrides() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    const empty: RtpOverrides = {};
    dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: empty }));
  } catch {
    // ignore
  }
}

import { useEffect, useState } from 'react';
import {
  RTP_COALESCE_DELAY_MS,
  RTP_COALESCE_MAX_WAIT_MS,
  RTP_COALESCE_LEADING_EDGE,
  RTP_PERSIST_SAVE_DELAY_MS,
} from './rtp';

export function useRtpOverrides(): [RtpOverrides, (next: RtpOverrides) => void, () => void] {
  const [overrides, setOverrides] = useState<RtpOverrides>(() => readOverrides());

  useEffect(() => {
    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent<RtpOverrides>).detail;
      if (detail && typeof detail === 'object') setOverrides(detail);
    };
    addEventListener(UPDATE_EVENT, onUpdate);
    return () => removeEventListener(UPDATE_EVENT, onUpdate);
  }, []);

  const update = (next: RtpOverrides) => {
    const merged = writeOverrides(next);
    setOverrides(merged);
  };

  return [overrides, update, clearOverrides];
}

export function getEffectiveRtpConfig(overrides?: RtpOverrides) {
  const o = overrides ?? readOverrides();
  return {
    coalesceDelayMs: typeof o.coalesceDelayMs === 'number' ? o.coalesceDelayMs : RTP_COALESCE_DELAY_MS,
    coalesceMaxWaitMs: typeof o.coalesceMaxWaitMs === 'number' ? o.coalesceMaxWaitMs : RTP_COALESCE_MAX_WAIT_MS,
    leadingEdge: typeof o.leadingEdge === 'boolean' ? o.leadingEdge : RTP_COALESCE_LEADING_EDGE,
    persistSaveDelayMs: typeof o.persistSaveDelayMs === 'number' ? o.persistSaveDelayMs : RTP_PERSIST_SAVE_DELAY_MS,
  };
}

