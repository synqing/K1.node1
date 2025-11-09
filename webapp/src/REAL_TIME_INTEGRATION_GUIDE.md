# Task 19: Real-time Update Integration Guide

## Overview

Task 19 integrates WebSocket real-time updates into the React UI for live dashboard, Gantt chart, and analytics updates.

## Architecture

### Three-Layer Integration

1. **WebSocket Hook** (`useWebSocket.ts`)
   - Low-level WebSocket connection management
   - Event subscription/distribution
   - Automatic reconnection with exponential backoff
   - Message deduplication
   - Heartbeat/ping-pong

2. **Sync Service** (`real-time-sync.ts`)
   - Event distribution to components
   - Queue management during disconnect
   - Replay on reconnect
   - Debouncing of rapid updates
   - Data validation

3. **Dashboard Hooks** (`useRealtimeDashboard.ts`)
   - High-level integration for T16, T17, T18
   - Redux fallback when offline
   - Simplified API for components

## Usage Examples

### Basic Component Integration

#### Dashboard (T16) - Status Cards

```typescript
import { useRealtimeDashboard } from '../hooks/useRealtimeDashboard';

export const DashboardCards = () => {
  const { queueStatus, isLive, lastUpdate } = useRealtimeDashboard();

  return (
    <div>
      <div className={isLive ? 'live-badge' : 'offline-badge'}>
        {isLive ? 'Live' : 'Offline'}
        {lastUpdate && ` (updated ${lastUpdate.toLocaleTimeString()})`}
      </div>

      <StatusCard
        title="Queue Status"
        queued={queueStatus?.queued || 0}
        executing={queueStatus?.executing || 0}
        completed={queueStatus?.completed || 0}
      />
    </div>
  );
};
```

#### Gantt Chart (T17) - Live Task Updates

```typescript
import { useRealtimeSchedules } from '../hooks/useRealtimeDashboard';

export const GanttChartWithRealtime = () => {
  const { schedules, isLive } = useRealtimeSchedules();

  return (
    <div>
      <ConnectionStatus isLive={isLive} />
      <GanttChart schedules={schedules} />
    </div>
  );
};
```

#### Analytics (T18) - Live Metrics

```typescript
import { useRealtimeMetrics } from '../hooks/useRealtimeDashboard';

export const AnalyticsWithRealtime = () => {
  const { retryMetrics, circuitBreakers, isLive } = useRealtimeMetrics();

  return (
    <div>
      <LiveIndicator isLive={isLive} />
      <RetryAnalyticsPanel retryMetrics={retryMetrics} />
      <CircuitBreakerPanel circuitBreakers={circuitBreakers} />
    </div>
  );
};
```

## WebSocket Event Types

### Error Recovery Events

- **error-recovery:retry-started** - Retry operation initiated
  ```json
  { "taskId": "task-123", "attemptNumber": 2 }
  ```

- **error-recovery:retry-completed** - Retry operation finished
  ```json
  { "taskId": "task-123", "success": true, "metrics": {...} }
  ```

### Scheduler Events

- **scheduler:schedule-executed** - Schedule triggered
  ```json
  { "schedules": [...], "executedAt": "2025-11-10T..." }
  ```

- **scheduler:execution-completed** - Execution finished
  ```json
  { "queueStatus": {...}, "completedAt": "2025-11-10T..." }
  ```

### Webhook Events

- **webhook:webhook-delivered** - Webhook sent successfully
  ```json
  { "webhookId": "wh-123", "deliveredAt": "2025-11-10T..." }
  ```

- **webhook:webhook-failed** - Webhook delivery failed
  ```json
  { "webhookId": "wh-123", "error": "Connection timeout" }
  ```

### Metrics Events

- **metrics:metrics-updated** - Metrics batch update
  ```json
  {
    "retryMetrics": {...},
    "circuitBreakers": [...],
    "resourceMetrics": {...}
  }
  ```

## Features

### 1. Automatic Reconnection

WebSocket automatically reconnects on network errors with exponential backoff:
- Initial delay: 1s
- Subsequent delays: 2s, 4s, 8s, 16s, ...
- Max attempts: 10
- After max attempts, falls back to Redux polling

### 2. Event Deduplication

Messages with the same `messageId` are skipped within a 5-second window, preventing duplicate processing.

### 3. Event Queue During Disconnect

When disconnected, events are queued (max 1000 events). When reconnected, queued events are replayed.

### 4. Debouncing Rapid Updates

Rapid metric updates are debounced (100ms default) to avoid excessive re-renders:

```typescript
// In sync service
await syncService.distributeEventDebounced(event, 'metrics-debounce');
```

### 5. Redux Fallback

When WebSocket is disconnected, components fall back to Redux state:

```typescript
// Uses WebSocket data first, falls back to Redux
const finalSchedules = schedules.length > 0 ? schedules : reduxSchedules;
```

### 6. Connection Status Indicator

```typescript
import { useWebSocketStatus } from '../hooks/useWebSocket';

export const ConnectionIndicator = () => {
  const isConnected = useWebSocketStatus();

  return (
    <div className={isConnected ? 'connected' : 'disconnected'}>
      {isConnected ? 'Live' : 'Offline'}
    </div>
  );
};
```

## Integration Steps

### 1. Initialize Sync Service

In your app root component:

```typescript
import { initializeRealTimeSync } from '../services/real-time-sync';
import { useAppStore } from '../store';

export const App = () => {
  const store = useAppStore();

  useEffect(() => {
    initializeRealTimeSync(store);
  }, [store]);

  return <div>{/* ... */}</div>;
};
```

### 2. Use in Components

```typescript
export const MyComponent = () => {
  const { data, isLive } = useRealtimeDashboard();

  return (
    <div>
      <StatusBadge isLive={isLive} />
      <Content data={data} />
    </div>
  );
};
```

### 3. Handle Connection States

```typescript
export const ComponentWithStates = () => {
  const { data, isLive, lastUpdate } = useRealtimeDashboard();

  if (!isLive) {
    return <OfflineIndicator>Using cached data (last update: {lastUpdate})</OfflineIndicator>;
  }

  return <LiveContent data={data} />;
};
```

## Performance Considerations

### 1. Selective Subscriptions

Subscribe only to needed event types:

```typescript
// Good - specific events
const { data } = useWebSocket(['scheduler:schedule-executed', 'metrics:metrics-updated']);

// Avoid - all events
const { data } = useWebSocket(['*']); // Not supported
```

### 2. Component Optimization

Use React.memo for dashboard cards:

```typescript
export const StatusCard = React.memo(({ status }) => {
  return <div>{status}</div>;
});
```

### 3. Debounce Configuration

Adjust debounce interval based on needs:

```typescript
// In real-time-sync.ts, adjust debounceInterval
private debounceInterval: number = 100; // milliseconds
```

## Error Handling

### Network Errors

Handled automatically with reconnection:

```typescript
const { error, isConnected } = useWebSocket('metrics:metrics-updated');

if (error && !isConnected) {
  return <ErrorBoundary error={error} />;
}
```

### Invalid Events

Invalid events are logged but don't break the flow:

```typescript
// In real-time-sync.ts
private isValidEvent(event: any): boolean {
  return (
    event &&
    typeof event === 'object' &&
    typeof event.type === 'string' &&
    typeof event.timestamp === 'string' &&
    event.data !== undefined
  );
}
```

### Handler Errors

Handler errors don't affect other handlers:

```typescript
// Errors are caught and logged, other handlers continue
try {
  await handler(event.data, event);
} catch (error) {
  console.log(`Error in event handler:`, error);
}
```

## Testing

### Unit Tests

Tests are in:
- `src/hooks/__tests__/useWebSocket.test.ts`
- `src/services/__tests__/real-time-sync.test.ts`

Run tests:

```bash
npm test -- useWebSocket.test.ts
npm test -- real-time-sync.test.ts
```

### Integration Testing

Test with real WebSocket server or mock:

```typescript
beforeEach(() => {
  global.WebSocket = jest.fn(() => mockWebSocket) as any;
});
```

## Debugging

Enable debug logging:

```typescript
// In component
const { data } = useWebSocket('metrics:metrics-updated', { debug: true });

// Or in sync service
const syncService = getRealTimeSync();
syncService.setDebug(true);
```

Console output:

```
[WebSocketManager] Connecting to WebSocket: ws://localhost:3000/ws
[WebSocketManager] WebSocket connected
[RealTimeSyncService] Event queued (1/1000)
[RealTimeSyncService] Replaying 1 queued events
```

## Future Enhancements

1. **Compression** - Compress event payloads for bandwidth efficiency
2. **Encryption** - Add TLS/SSL for secure WebSocket connections
3. **Custom Serialization** - Support MessagePack or Protocol Buffers
4. **Circuit Breaker** - Prevent reconnection storms
5. **Metrics** - Track event throughput, latency, queue depth
6. **Persistence** - Store events to IndexedDB during disconnect

## References

- WebSocket spec: https://tools.ietf.org/html/rfc6455
- React hooks: https://react.dev/reference/react/hooks
- Task 13 WebSocket service: `webapp/src/services/websocket.ts`
- Task 16 Dashboard: `webapp/src/components/DashboardLayout.tsx`
- Task 17 Gantt Chart: `webapp/src/components/GanttChart.tsx`
- Task 18 Analytics: `webapp/src/components/AnalyticsDashboard.tsx`
