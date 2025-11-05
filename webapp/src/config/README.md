Environment Overrides for Real-Time Params

- `VITE_RTP_COALESCE_DELAY_MS`: trailing coalesce delay window (ms). Default: `80`.
- `VITE_RTP_COALESCE_MAX_WAIT_MS`: force-send threshold (ms). Default: `500`.
- `VITE_RTP_COALESCE_LEADING_EDGE`: send immediately on isolated change (`true`/`false`). Default: `true`.
- `VITE_RTP_PERSIST_SAVE_DELAY_MS`: autosave debounce delay (ms). Default: `300`.

Usage

- Vite/Dev: prefix `npm run dev` with env vars, e.g.
  `VITE_RTP_COALESCE_DELAY_MS=120 VITE_RTP_COALESCE_MAX_WAIT_MS=800 VITE_RTP_COALESCE_LEADING_EDGE=false VITE_RTP_PERSIST_SAVE_DELAY_MS=400 npm run dev`
- Node/Jest/CI: set `process.env` for the same keys; the config prefers `import.meta.env` when present and falls back to `process.env`.

Notes

- Values are parsed safely; non-numeric fallbacks resolve to defaults.
- Browser builds inline `import.meta.env`; Jest/CommonJS uses `process.env` via fallback.

