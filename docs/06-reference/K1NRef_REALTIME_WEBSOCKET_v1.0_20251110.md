---
title: Realtime WebSocket Protocol
author: team
date: 2025-11-10
status: active
intent: Describe realtime telemetry over WebSocket and client guidance
---

# Realtime WebSocket Protocol

- Endpoint: `ws://DEVICE/ws` (or `wss://` if served over HTTPS)
- Discovery: mDNS advertises service `ws.tcp` with `path=/ws` and `protocol=K1RealtimeData`.
- Enable & cadence: governed by `/api/realtime/config` (`enabled`, `interval_ms`, persisted to NVS `realtime_ws`).

## Behavior
- Server broadcasts messages to all connected clients when enabled.
- Interval respects Wi‑Fi link options; a floor may apply depending on channel/HT20 settings.
- Clients should be robust to minor payload evolutions; message content mirrors realtime telemetry used by the UI.

## Client Guidance
- Reconnect on `onclose`/`onerror` with exponential backoff.
- Prefer WebSocket for continuous telemetry; fall back to REST polling for liveness.
- Avoid sending large client messages; future bidirectional control may be introduced with simple text frames.

## Example (browser)
```js
const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
const ws = new WebSocket(url);
ws.onmessage = (evt) => {
  const msg = JSON.parse(evt.data);
  // Handle realtime telemetry
};
ws.onclose = () => {
  // Fall back or try reconnect
};
```

