import {
  RTP_COALESCE_DELAY_MS,
  RTP_COALESCE_MAX_WAIT_MS,
  RTP_COALESCE_LEADING_EDGE,
  RTP_PERSIST_SAVE_DELAY_MS,
} from './rtp';
import { getEnvSafe } from '../lib/env';

function render() {
  const el = document.getElementById('env-readout');
  if (!el) return;
  // Prefer safe helper, but ensure Playwright/Vite test sees import.meta.env
  const raw = getEnvSafe() || (import.meta as any)?.env || {};
  const meta = { ...raw } as Record<string, any>;
  if (typeof meta.MODE !== 'string') {
    meta.MODE = meta.DEV ? 'development' : (meta.PROD ? 'production' : 'development');
  }
  const payload = {
    RTP_COALESCE_DELAY_MS,
    RTP_COALESCE_MAX_WAIT_MS,
    RTP_COALESCE_LEADING_EDGE,
    RTP_PERSIST_SAVE_DELAY_MS,
    meta,
  };
  el.textContent = JSON.stringify(payload, null, 2);
}

render();
