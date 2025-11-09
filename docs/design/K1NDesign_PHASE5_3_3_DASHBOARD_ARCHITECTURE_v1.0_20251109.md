# Phase 5.3.3: Dashboard Architecture Design
**Status:** Design Complete (Task 3.3.1)
**Version:** 1.0
**Date:** 2025-11-09
**Team:** Team A (Frontend - Track 1)
**Role:** Frontend Architect
**Timeline:** Day 3 (Design Phase)

---

## Executive Summary

Phase 5.3.3 delivers a comprehensive real-time dashboard for visualizing task execution, error recovery, and dynamic scheduling metrics from Phase 5.3.1 & 5.3.2. The dashboard provides operators with live visibility into system health, enabling rapid response to failures and scheduling anomalies.

**Key Objectives:**
- Visualize error recovery metrics (retry attempts, circuit breaker state, DLQ depth)
- Visualize dynamic scheduling metrics (queue depth, priority distribution, execution timeline)
- Provide real-time updates via WebSocket (refresh: <1s)
- Support operational intervention (pause/resume/skip tasks)
- Export metrics for analytics and reporting

**Architecture:** React-based single-page application with WebSocket for real-time updates and REST API integration

---

## Component Hierarchy

```
Dashboard (Root)
├── Header
│   ├── Title & Version
│   ├── System Status Indicator
│   └── User Menu
│
├── Navigation Sidebar
│   ├── Overview
│   ├── Error Recovery
│   │   ├── Retry Metrics
│   │   ├── Circuit Breakers
│   │   ├── Dead Letter Queue
│   │   └── Task Interventions
│   ├── Scheduling
│   │   ├── Schedule List
│   │   ├── Priority Queue
│   │   ├── Execution Timeline
│   │   └── Resource Utilization
│   └── Settings
│
├── Main Content Area
│   ├── Error Recovery Section
│   │   ├── Retry Analytics Panel
│   │   │   ├── Attempt Distribution Chart (histogram)
│   │   │   ├── Success/Failure Rate Gauge
│   │   │   └── Retry Policy Statistics Table
│   │   │
│   │   ├── Circuit Breaker Panel
│   │   │   ├── State Visualization (CLOSED/OPEN/HALF-OPEN)
│   │   │   ├── Per-Breaker Status List
│   │   │   ├── Failure Rate Gauge
│   │   │   └── Recovery Timeline
│   │   │
│   │   ├── Dead Letter Queue Panel
│   │   │   ├── Queue Depth Gauge
│   │   │   ├── DLQ Entries Table (searchable)
│   │   │   ├── Resubmit Controls
│   │   │   └── DLQ Age Distribution
│   │   │
│   │   └── Task Intervention Panel
│   │       ├── Intervention History
│   │       ├── Quick Action Buttons
│   │       └── State Transition Log
│   │
│   ├── Scheduling Section
│   │   ├── Execution Timeline Gantt Chart
│   │   │   ├── Task Bars (color-coded by schedule)
│   │   │   ├── Time Axis (hours/days)
│   │   │   ├── Resource Usage Overlay
│   │   │   └── Zoom & Pan Controls
│   │   │
│   │   ├── Priority Queue Status Panel
│   │   │   ├── Queue Depth Gauge
│   │   │   ├── Priority Distribution Stacked Bar
│   │   │   ├── Pending Tasks by Priority
│   │   │   └── Execution Order Preview
│   │   │
│   │   ├── Schedule Management Panel
│   │   │   ├── Schedule List (sortable)
│   │   │   ├── Enable/Disable Controls
│   │   │   ├── Next Execution Countdown
│   │   │   └── Statistics (execution count, avg duration)
│   │   │
│   │   └── Resource Utilization Panel
│   │       ├── CPU Usage Gauge
│   │       ├── Memory Usage Gauge
│   │       ├── Concurrent Task Counter
│   │       └── Resource Limit Status
│   │
│   └── Analytics Section
│       ├── Error Trend Chart (line graph, 24h)
│       ├── Task Duration Histogram
│       ├── Schedule Reliability Score
│       └── System Health Summary
│
└── Footer
    ├── Last Update Time
    ├── WebSocket Connection Status
    └── API Version
```

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Phase 5.3.1-5.3.2 Backend                │
│         (Error Recovery & Dynamic Scheduling)               │
└──────────────┬────────────────────────────┬─────────────────┘
               │                            │
        ┌──────▼──────────────┐    ┌────────▼─────────────┐
        │   Metrics Files     │    │  State Files (JSON)  │
        │  (.conductor/       │    │ .conductor/         │
        │   metrics/)         │    │  scheduler/config)  │
        └──────┬──────────────┘    └────────┬─────────────┘
               │                            │
        ┌──────▼────────────────────────────▼──────────┐
        │     REST API Layer (Node.js Express)         │
        │  Endpoints:                                  │
        │  - GET /api/metrics/retry-stats              │
        │  - GET /api/metrics/circuit-breaker          │
        │  - GET /api/queue/dlq                        │
        │  - GET /api/scheduler/schedules              │
        │  - GET /api/scheduler/priority-queue         │
        │  - GET /api/scheduler/resource-usage         │
        │  - POST /api/tasks/{id}/intervention         │
        │  - WS /ws/metrics (WebSocket feed)           │
        └──────┬─────────────────────────────────────┬─┘
               │                                     │
               │ REST (periodic polling)    WebSocket (push)
               │                                     │
        ┌──────▼─────────────────────────────────────▼──┐
        │    React Dashboard Frontend (SPA)             │
        │  - State Management (Redux/Context)           │
        │  - Real-time Update Handlers                  │
        │  - Component Lifecycle Management             │
        └──────┬──────────────────────────────────────┬─┘
               │                                      │
               │ User Interaction (REST POST)         │
               │                                      │
        ┌──────▼──────────────────────────────────────▼──┐
        │      Backend API Controllers                   │
        │  (Handle intervention, enable/disable, etc.)   │
        └──────────────────────────────────────────────┘
```

---

## Real-Time Update Strategy

### WebSocket Feed Design

**Connection URL:** `wss://api.k1node.local/ws/metrics`

**Message Schema:**
```json
{
  "type": "metric_update",
  "timestamp": "2025-11-09T20:37:29+08:00",
  "source": "error_recovery | scheduling | resource_usage",
  "data": {
    // Component-specific payload
  }
}
```

### Update Sources

1. **Error Recovery Updates** (from retry-engine, circuit-breaker, dlq)
   - Frequency: On event (success/failure/state change)
   - Payload: Retry attempt count, breaker state, DLQ entry count
   - Dashboard Impact: Gauges, charts, tables update instantly

2. **Scheduling Updates** (from task-scheduler, priority-queue)
   - Frequency: On queue operation (enqueue/dequeue/complete)
   - Payload: Queue depth, priority distribution, resource usage
   - Dashboard Impact: Gantt chart, queue status, resource gauges update

3. **Resource Utilization Updates**
   - Frequency: Every 2 seconds (background poller)
   - Payload: CPU%, memory%, concurrent task count
   - Dashboard Impact: Utilization gauges update smoothly

4. **System Health Rollup**
   - Frequency: Every 10 seconds
   - Payload: Overall system status (green/yellow/red)
   - Dashboard Impact: Header status indicator updates

---

## Component Specifications

### 1. Retry Analytics Panel

**Purpose:** Visualize retry engine performance and effectiveness

**Subcomponents:**
- **Attempt Distribution Histogram**
  - X-axis: Attempt count (1-5)
  - Y-axis: Frequency
  - Color: Green (success), orange (retry 2-3), red (retry 4+)
  - Data source: `GET /api/metrics/retry-stats`

- **Success/Failure Rate Gauge**
  - Display: Percentage (0-100%)
  - Target: ≥95% success rate after retries
  - Threshold indicators: Green (≥95%), yellow (80-94%), red (<80%)
  - Updates: Real-time via WebSocket

- **Retry Policy Statistics Table**
  - Columns: Policy name, total attempts, avg attempts per task, max attempt
  - Sortable: By any column
  - Filterable: By policy type (standard/aggressive/conservative)

**Update Frequency:** 5 seconds (via WebSocket)

---

### 2. Circuit Breaker Panel

**Purpose:** Monitor service health and circuit breaker state transitions

**Subcomponents:**
- **State Visualization**
  - SVG graphic showing 3 states: CLOSED (green circle), OPEN (red circle), HALF-OPEN (yellow circle)
  - Current state highlighted with pulsing animation
  - State transition timeline on the right

- **Per-Breaker Status List**
  - Table with columns: Breaker ID, current state, failure rate, last state change
  - Rows color-coded by state (green/red/yellow)
  - Click row to see detailed metrics

- **Failure Rate Gauge**
  - Display: Percentage (0-100%)
  - Threshold for OPEN: 50%
  - Smooth gradient fill (green → red)

- **Recovery Timeline**
  - Horizontal timeline showing state transitions over last 24 hours
  - Events: CLOSED→OPEN (red marker), HALF-OPEN→CLOSED (green marker)
  - Tooltip on hover shows timestamp and failure count

**Update Frequency:** 2 seconds (via WebSocket on state change, or 5s rollup)

---

### 3. Dead Letter Queue (DLQ) Panel

**Purpose:** Manage and recover permanently failed tasks

**Subcomponents:**
- **Queue Depth Gauge**
  - Display: Count (0-1000+)
  - Threshold warning: >50 entries (yellow), >100 (red)
  - Sparkline trend (last 24 hours)

- **DLQ Entries Table**
  - Columns: Task ID, error code, timestamp, status, actions
  - Searchable: By task ID or error message
  - Sortable: By timestamp (desc), error code
  - Per-row actions: View details, resubmit, delete

- **Resubmit Controls**
  - Bulk action: Select multiple entries → "Resubmit Selected"
  - Individual action: Click entry → "Resubmit with Parameters"
  - Confirmation dialog with option to modify parameters

- **DLQ Age Distribution**
  - Histogram: Age buckets (0-1h, 1-24h, 1-7d, 7-30d, archived)
  - Y-axis: Count of entries in each bucket
  - Automatic archival indicator for >30 day entries

**Update Frequency:** 10 seconds (via polling, or event-triggered for resubmit)

---

### 4. Task Intervention Panel

**Purpose:** Provide operators with quick task control capabilities

**Subcomponents:**
- **Intervention History Table**
  - Columns: Timestamp, task ID, intervention type (pause/resume/skip/retry), result
  - Rows: Most recent first, 50 per page
  - Expandable rows: Full intervention details and state transition log

- **Quick Action Buttons**
  - Stateful buttons: Show available actions based on task state
  - Pause (red icon) - available for running tasks
  - Resume (blue icon) - available for paused tasks
  - Skip (orange icon) - available for any queued task
  - Retry (green icon) - available for failed tasks
  - Actions trigger modal dialog with confirmation and optional parameters

- **State Transition Log**
  - Vertical timeline showing task state changes over time
  - Events: queued → running → paused → resumed → completed/failed
  - Color-coded by state
  - Click event to see full state object (JSON viewer)

**Update Frequency:** 2 seconds (via polling or event-triggered)

---

### 5. Execution Timeline Gantt Chart

**Purpose:** Visualize task execution schedule and resource allocation over time

**Specifications:**
- **X-axis:** Time (hourly grid lines, labels for each day)
- **Y-axis:** Task/schedule list (grouped by track: Dashboard, API)
- **Task Bars:** Represent scheduled execution time
  - Height: Proportional to estimated CPU usage
  - Color: By schedule type (cron/event), or by state (planned/executing/completed/failed)
  - Hover tooltip: Task ID, priority, resource estimate, expected duration

- **Resource Usage Overlay**
  - Optional background fill: Shows total CPU% and memory% utilization
  - Green zone: Normal operation (<70%)
  - Yellow zone: Elevated load (70-85%)
  - Red zone: Critical load (>85%)

- **Zoom & Pan Controls**
  - Zoom: 4 levels (1 hour, 4 hours, 1 day, 1 week)
  - Pan: Left/right arrow buttons to shift time window
  - Today button: Quick return to current day

- **Interaction:**
  - Click task bar: Show task details panel
  - Drag task bar: Reschedule task (if supported)
  - Hover task bar: Show resource estimate and timeline

**Libraries:** `react-gantt-chart` or custom SVG-based implementation

**Update Frequency:** 2 seconds (real-time task start/completion)

---

### 6. Priority Queue Status Panel

**Purpose:** Show queue depth, priority distribution, and execution order

**Subcomponents:**
- **Queue Depth Gauge**
  - Display: Count (0-50+)
  - Threshold warning: >20 (yellow), >40 (red)
  - Sparkline: Queue size trend (last 1 hour)

- **Priority Distribution Stacked Bar**
  - 10 segments, one per priority level (1-10)
  - Height: Count of tasks at that priority
  - Colors: Priority gradient (red for high 9-10, green for low 1-4)
  - Hover: Show exact count per priority

- **Pending Tasks by Priority**
  - Table sorted by priority (descending)
  - Columns: Priority, task count, total resources, expected wait time
  - Expandable: Show list of task IDs for each priority

- **Execution Order Preview**
  - List of next 10 tasks to execute, in order
  - Each row: Rank, task ID, priority, resource estimate, wait time
  - Highlighting: Next task (green background)

**Update Frequency:** 2 seconds (via WebSocket)

---

### 7. Schedule Management Panel

**Purpose:** Create, edit, monitor, and control schedules

**Subcomponents:**
- **Schedule List (Data Table)**
  - Columns: Schedule ID, type (cron/event), expression, priority, enabled, next execution, execution count
  - Sortable: By any column
  - Filterable: By type, enabled status
  - Pagination: 20 per page

- **Enable/Disable Controls**
  - Toggle button per row (on/off)
  - Bulk action: Select multiple → "Enable/Disable Selected"
  - Confirmation: "Disabling will stop future executions"

- **Next Execution Countdown**
  - For cron schedules: Show "Executes in X minutes"
  - For event schedules: Show "Waiting for trigger"
  - Color changes as execution approaches (green → yellow → red)

- **Statistics (execution count, avg duration)**
  - Expandable detail view per schedule
  - Shows: Total executions, success/failure count, average duration, last execution result

**Update Frequency:** 5 seconds (for countdowns), 10 seconds (for stats)

---

### 8. Resource Utilization Panel

**Purpose:** Monitor system resource constraints and limits

**Subcomponents:**
- **CPU Usage Gauge**
  - Circular gauge: 0-100%
  - Threshold line: 80% (MAX_CPU_PERCENT)
  - Color gradient: Green (0-50%), yellow (50-80%), red (80-100%)
  - Display: Current value, peak (24h), average

- **Memory Usage Gauge**
  - Circular gauge: 0-100%
  - Threshold line: 85% (MAX_MEMORY_PERCENT)
  - Color gradient: Green (0-50%), yellow (50-85%), red (85-100%)
  - Display: Current value, peak (24h), average

- **Concurrent Task Counter**
  - Display: Current count / max (e.g., "3 / 4")
  - Progress bar: Visual indicator of utilization
  - Color: Green (≤2), yellow (3), red (4)

- **Resource Limit Status**
  - Text indicators showing all limits:
    - Max concurrent tasks: 4
    - Max CPU: 80%
    - Max memory: 85%
  - Edit button: Opens configuration panel (admin only)

**Update Frequency:** 2 seconds (via WebSocket)

---

## Real-Time WebSocket Integration

### Frontend WebSocket Handler

```typescript
// Dashboard.tsx
const setupWebSocket = () => {
  const ws = new WebSocket('wss://api.k1node.local/ws/metrics');

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);

    switch (message.source) {
      case 'error_recovery':
        // Update retry, circuit-breaker, dlq panels
        dispatch(updateErrorRecoveryMetrics(message.data));
        break;
      case 'scheduling':
        // Update scheduler, priority-queue panels
        dispatch(updateSchedulingMetrics(message.data));
        break;
      case 'resource_usage':
        // Update resource utilization panel
        dispatch(updateResourceMetrics(message.data));
        break;
    }
  };

  ws.onclose = () => {
    // Fallback to REST polling
    setupPolling();
  };
};
```

### Update Batching

To prevent excessive re-renders:
- Batch WebSocket messages: Collect updates every 100ms
- Dispatch single Redux action with batched data
- React DevTools shows single render per batch

---

## REST API Integration Points

### Endpoints Required (Backend Responsibility)

```
Error Recovery APIs:
  GET /api/metrics/retry-stats          → Retry analytics data
  GET /api/metrics/circuit-breaker       → Circuit breaker state & metrics
  GET /api/queue/dlq                     → DLQ entries list
  POST /api/queue/dlq/{id}/resubmit      → Resubmit DLQ entry
  GET /api/tasks/{id}/intervention-history → Intervention log

Scheduling APIs:
  GET /api/scheduler/schedules           → List all schedules
  GET /api/scheduler/priority-queue      → Queue status
  GET /api/scheduler/resource-usage      → Resource metrics
  POST /api/scheduler/{id}/enable        → Enable schedule
  POST /api/scheduler/{id}/disable       → Disable schedule

Task Intervention APIs:
  POST /api/tasks/{id}/pause             → Pause task
  POST /api/tasks/{id}/resume            → Resume task
  POST /api/tasks/{id}/skip              → Skip task
  POST /api/tasks/{id}/retry             → Retry task

WebSocket:
  WS /ws/metrics                         → Real-time metric feed
```

---

## State Management Architecture

### Redux Store Structure

```typescript
// store.ts
interface DashboardState {
  errorRecovery: {
    retryStats: RetryMetrics;
    circuitBreakers: Map<string, CircuitBreakerState>;
    dlqEntries: DLQEntry[];
    interventionHistory: Intervention[];
  };
  scheduling: {
    schedules: Schedule[];
    priorityQueue: QueueEntry[];
    resourceUsage: ResourceMetrics;
  };
  ui: {
    selectedPanel: string;
    filters: FilterState;
    sortState: SortState;
  };
  connection: {
    websocketConnected: boolean;
    lastUpdate: Date;
  };
}
```

### Actions

- `UPDATE_ERROR_RECOVERY_METRICS(data)`
- `UPDATE_SCHEDULING_METRICS(data)`
- `UPDATE_RESOURCE_METRICS(data)`
- `SET_WEBSOCKET_STATUS(connected: boolean)`
- `CLEAR_DLQ_ENTRY(id: string)`
- `TRIGGER_INTERVENTION(taskId: string, action: string)`

---

## Performance Considerations

### Rendering Optimization

1. **Component Memoization**
   - Use React.memo for all panels
   - Memoize selector functions to prevent re-renders

2. **Chart Libraries**
   - Use `react-chartjs-2` with lazy loading
   - Limit chart data points: Keep last 24 hours only
   - Debounce resize events

3. **Virtual Scrolling**
   - For large tables (DLQ entries, schedule list)
   - Use `react-window` for efficient rendering

4. **WebSocket Message Throttling**
   - Batch updates: 100ms collection window
   - Throttle gauges: Update every 500ms max
   - Defer non-critical updates (charts)

### Data Refresh Strategy

| Component | Refresh Method | Frequency | Fallback |
|-----------|----------------|-----------|----------|
| Retry Stats | WebSocket event | On change | 5s polling |
| Circuit Breaker | WebSocket event | On state change | 2s polling |
| DLQ Entries | REST polling | 10s | Manual refresh |
| Queue Status | WebSocket event | On queue op | 2s polling |
| Resource Gauges | WebSocket periodic | 2s | 5s polling |
| Schedule Stats | REST polling | 5s | 10s polling |

---

## Accessibility & UX

### Color Scheme
- **Status Green:** #27ae60 (success, normal)
- **Status Yellow:** #f39c12 (warning, attention needed)
- **Status Red:** #e74c3c (critical, action required)
- **Neutral:** #34495e (text), #ecf0f1 (background)

### Responsive Design
- Mobile: Single column layout with drawer navigation
- Tablet: 2-column layout
- Desktop: Full multi-panel layout

### Keyboard Navigation
- Tab through all controls
- Enter to activate buttons
- Arrow keys for table navigation

---

## Dependency Summary

### Libraries
- **React 18+:** UI framework
- **Redux Toolkit:** State management
- **react-chartjs-2:** Charts and graphs
- **react-window:** Virtual scrolling for large tables
- **react-icons:** Icon library
- **tailwindcss:** Styling
- **framer-motion:** Animations

### Backend Dependencies
- Phase 5.3.1: Error Recovery metrics API
- Phase 5.3.2: Scheduling metrics API
- Node.js Express: REST & WebSocket server

---

## Next Steps (Day 4 - Task 3.3.2)

1. **React Project Scaffolding**
   - Initialize React project with TypeScript
   - Set up Redux store structure
   - Configure Tailwind CSS

2. **Component Library Creation**
   - Implement all 8 main components
   - Create reusable gauge/chart/table components
   - Wire up state management

3. **API Integration**
   - Connect REST endpoints
   - Implement WebSocket client
   - Add polling fallback

---

## Sign-Off

**Architecture Design Status:** ✅ COMPLETE
**Component Hierarchy:** ✅ DEFINED (8 main panels, 20+ subcomponents)
**Data Flow:** ✅ SPECIFIED (REST + WebSocket integration)
**Real-Time Strategy:** ✅ DESIGNED (WebSocket with polling fallback)
**Performance Plan:** ✅ OPTIMIZED (memoization, virtual scrolling, message batching)

**Ready for React Scaffolding (Task 3.3.2):** ✅ YES

---

**Document Version:** 1.0
**Status:** Architecture Design Complete
**Last Updated:** 2025-11-09
**Team:** Team A (Frontend - Track 1)
**Task:** 3.3.1 (Dashboard Architecture Design)
