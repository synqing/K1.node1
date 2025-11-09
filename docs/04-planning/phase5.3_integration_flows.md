# Phase 5.3 Integration Flow Diagrams

**Purpose**: Visual representation of real system flows
**Status**: Implementation Ready
**Date**: 2025-11-10

---

## **FLOW 1: SCHEDULE CREATION & EXECUTION**

```
┌─────────┐
│ Frontend│
└────┬────┘
     │ POST /api/scheduler/schedules
     │ { name, taskType, taskConfig, scheduleType, scheduleConfig }
     ▼
┌─────────────────┐
│  API Gateway    │
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ SchedulerService│
│ .createSchedule │
└────┬────────────┘
     │
     │ 1. INSERT INTO task_schedules (...)
     │ 2. Calculate next_run_at
     ▼
┌─────────────────┐
│   PostgreSQL    │
└─────────────────┘

[Time passes... scheduler ticks...]

┌─────────────────┐
│ SchedulerService│
│ .tick()         │
└────┬────────────┘
     │
     │ 1. SELECT * FROM task_schedules WHERE next_run_at <= NOW()
     ▼
┌─────────────────┐
│   PostgreSQL    │
└────┬────────────┘
     │
     │ [Schedule found]
     ▼
┌─────────────────┐
│ SchedulerService│
│ .triggerSchedule│
└────┬────────────┘
     │
     │ 1. Call executionEngine.executeTask()
     │ 2. UPDATE task_schedules SET last_run_at, next_run_at
     │ 3. Broadcast 'execution_started' via WebSocket
     ▼
┌─────────────────┐
│ ExecutionEngine │
│ .executeTask()  │
└────┬────────────┘
     │
     │ 1. INSERT INTO task_executions (status='pending')
     │ 2. Call .runTask() asynchronously
     ▼
┌─────────────────┐
│   PostgreSQL    │
└─────────────────┘

[Execution runs...]

┌─────────────────┐
│ ExecutionEngine │
│ .runTask()      │
└────┬────────────┘
     │
     │ 1. UPDATE task_executions SET status='running'
     │ 2. Execute task via Conductor/Shell/HTTP
     │ 3. UPDATE task_executions SET status='completed', result
     │ 4. Broadcast 'execution_completed' via WebSocket
     ▼
┌─────────────────┐
│  WebSocketSvc   │
│ .broadcast()    │
└────┬────────────┘
     │
     │ Send to all connected clients
     ▼
┌─────────┐
│ Frontend│
│ (updates│
│  UI)    │
└─────────┘
```

---

## **FLOW 2: EXECUTION FAILURE & ERROR RECOVERY**

```
┌─────────────────┐
│ ExecutionEngine │
│ .runTask()      │
└────┬────────────┘
     │
     │ [Task execution throws error]
     ▼
┌─────────────────┐
│ ExecutionEngine │
│ catch block     │
└────┬────────────┘
     │
     │ 1. UPDATE task_executions SET status='failed', error
     │ 2. Call errorRecoveryService.recordError()
     │ 3. Broadcast 'execution_failed' via WebSocket
     ▼
┌─────────────────┐
│ErrorRecoveryS vc│
│ .recordError()  │
└────┬────────────┘
     │
     │ 1. INSERT INTO error_records (status='unresolved')
     │ 2. If severity high/critical: call .scheduleRetry()
     ▼
┌─────────────────┐
│   PostgreSQL    │
│ error_records   │
└─────────────────┘

[Time passes... retry processor runs...]

┌─────────────────┐
│ErrorRecoveryS vc│
│.processRetries()│
└────┬────────────┘
     │
     │ 1. SELECT * FROM error_records WHERE next_retry_at <= NOW()
     ▼
┌─────────────────┐
│   PostgreSQL    │
└────┬────────────┘
     │
     │ [Error ready for retry]
     ▼
┌─────────────────┐
│ErrorRecoveryS vc│
│ .retryError()   │
└────┬────────────┘
     │
     │ 1. UPDATE error_records SET status='retrying', attempts++
     │ 2. Get original execution & schedule
     │ 3. Call executionEngine.executeTask() again
     ▼
┌─────────────────┐
│ ExecutionEngine │
│ .executeTask()  │
└────┬────────────┘
     │
     │ [If retry succeeds]
     ▼
┌─────────────────┐
│ErrorRecoveryS vc│
│.resolveError()  │
└────┬────────────┘
     │
     │ UPDATE error_records SET status='resolved', resolved_at
     ▼
┌─────────────────┐
│   PostgreSQL    │
└─────────────────┘

     │ [If retry fails]
     ▼
┌─────────────────┐
│ErrorRecoveryS vc│
│ [Check attempts]│
└────┬────────────┘
     │
     ├─ If attempts < max: UPDATE status='retry_scheduled', next_retry_at
     │                     (exponential backoff)
     │
     └─ If attempts >= max: UPDATE status='escalated'
        (Requires manual intervention)
```

---

## **FLOW 3: WEBSOCKET REAL-TIME UPDATES**

```
┌─────────┐
│ Frontend│
│ connects│
└────┬────┘
     │ WS /ws
     ▼
┌─────────────────┐
│  WebSocketSvc   │
│.handleConnection│
└────┬────────────┘
     │
     │ 1. INSERT INTO websocket_sessions (session_id)
     │ 2. Store connection in memory
     │ 3. Send 'connected' message
     ▼
┌─────────────────┐
│   PostgreSQL    │
└─────────────────┘

┌─────────┐
│ Frontend│
│ sends:  │
│{type:   │
│'subscr- │
│ibe',   │
│subscr-  │
│iptions} │
└────┬────┘
     │
     ▼
┌─────────────────┐
│  WebSocketSvc   │
│.handleMessage() │
└────┬────────────┘
     │
     │ UPDATE websocket_sessions SET subscriptions WHERE session_id
     ▼
┌─────────────────┐
│   PostgreSQL    │
└─────────────────┘

[Event occurs elsewhere...]

┌─────────────────┐
│ ExecutionEngine │
│ or ErrorRecovery│
└────┬────────────┘
     │
     │ Call wsService.broadcast() or .sendToSubscribers()
     ▼
┌─────────────────┐
│  WebSocketSvc   │
│ .broadcast()    │
└────┬────────────┘
     │
     │ 1. SELECT sessions WHERE subscriptions match
     │ 2. Send message to matching sessions
     ▼
┌─────────────────┐
│   PostgreSQL    │
└────┬────────────┘
     │
     │ [Matching sessions found]
     ▼
┌─────────────────┐
│  WebSocketSvc   │
│ .sendToSession()│
└────┬────────────┘
     │
     │ ws.send(JSON.stringify(message))
     ▼
┌─────────┐
│ Frontend│
│ receives│
│ message │
│ updates │
│   UI    │
└─────────┘
```

---

## **FLOW 4: MANUAL ERROR RESOLUTION**

```
┌─────────┐
│ Frontend│
│  User   │
└────┬────┘
     │ View error dashboard
     │ GET /api/errors/errors?recoveryStatus=unresolved
     ▼
┌─────────────────┐
│  API Gateway    │
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ErrorRecoveryS vc│
│ .listErrors()   │
└────┬────────────┘
     │
     │ SELECT * FROM error_records WHERE recovery_status='unresolved'
     ▼
┌─────────────────┐
│   PostgreSQL    │
└────┬────────────┘
     │
     │ [Returns list of errors]
     ▼
┌─────────┐
│ Frontend│
│ displays│
│ errors  │
└────┬────┘
     │
     │ [User chooses action]
     │
     ├─ RETRY: POST /api/errors/errors/:id/retry
     │          └─> errorRecoveryService.retryError()
     │               └─> Re-execute task immediately
     │
     ├─ RESOLVE: POST /api/errors/errors/:id/resolve
     │             └─> errorRecoveryService.resolveError()
     │                  └─> UPDATE status='resolved'
     │
     ├─ IGNORE: POST /api/errors/errors/:id/ignore
     │            └─> errorRecoveryService.ignoreError()
     │                 └─> UPDATE status='ignored'
     │
     └─ ESCALATE: POST /api/errors/errors/:id/escalate
                  └─> errorRecoveryService.escalateError()
                       └─> UPDATE status='escalated'
                            (Triggers alert/notification)
```

---

## **FLOW 5: CONDUCTOR TASK EXECUTION**

```
┌─────────────────┐
│ ExecutionEngine │
│.executeConductor│
│    Task()       │
└────┬────────────┘
     │
     │ POST http://localhost:3001/api/threads/{threadId}/messages
     │ { message, timeout }
     ▼
┌─────────────────┐
│ ConductorClient │
│ .executeTask()  │
└────┬────────────┘
     │
     │ HTTP POST
     ▼
┌─────────────────┐
│     Conductor   │
│   (Subprocess)  │
└────┬────────────┘
     │
     │ [Conductor processes task]
     │ - Creates thread if new
     │ - Sends message to Claude
     │ - Waits for response
     │ - Returns result
     ▼
┌─────────────────┐
│ ConductorClient │
│ receives result │
└────┬────────────┘
     │
     │ Return { threadId, status, result }
     ▼
┌─────────────────┐
│ ExecutionEngine │
│ .runTask()      │
└────┬────────────┘
     │
     │ UPDATE task_executions SET
     │   status='completed',
     │   result=...,
     │   conductor_thread_id=...,
     │   conductor_status=...
     ▼
┌─────────────────┐
│   PostgreSQL    │
└─────────────────┘
```

---

## **FLOW 6: SYSTEM STARTUP & INITIALIZATION**

```
┌─────────────────┐
│  Server Start   │
└────┬────────────┘
     │
     │ 1. Load environment config
     ▼
┌─────────────────┐
│ Database Init   │
└────┬────────────┘
     │
     │ 1. Connect to PostgreSQL
     │ 2. Run migrations (create tables)
     │ 3. Verify schema
     ▼
┌─────────────────┐
│ Service Init    │
└────┬────────────┘
     │
     │ 1. new ConductorClient()
     │ 2. new ErrorRecoveryService()
     │ 3. new ExecutionEngine()
     │ 4. new SchedulerService()
     │ 5. new WebSocketService()
     ▼
┌─────────────────┐
│ Service Startup │
└────┬────────────┘
     │
     │ 1. errorRecoveryService.start()
     │    └─> Start retry processor (10s interval)
     │
     │ 2. schedulerService.start()
     │    └─> Start tick loop (1s interval)
     │
     │ 3. Start Express server
     │    └─> Mount API routes
     │
     │ 4. Start WebSocket server
     │    └─> Listen on /ws
     ▼
┌─────────────────┐
│ Health Check    │
└────┬────────────┘
     │
     │ 1. Verify database connection
     │ 2. Verify services running
     │ 3. Log startup complete
     │ 4. Expose GET /api/health
     ▼
┌─────────────────┐
│  READY          │
└─────────────────┘
```

---

## **FLOW 7: GRACEFUL SHUTDOWN**

```
┌─────────────────┐
│ SIGTERM/SIGINT  │
└────┬────────────┘
     │
     │ Shutdown signal received
     ▼
┌─────────────────┐
│ Graceful Stop   │
└────┬────────────┘
     │
     │ 1. schedulerService.stop()
     │    └─> Clear tick interval
     │    └─> UPDATE system_state SET scheduler_running=false
     │
     │ 2. errorRecoveryService.stop()
     │    └─> Clear retry interval
     │    └─> UPDATE system_state SET error_recovery_running=false
     │
     │ 3. Close WebSocket connections
     │    └─> Send 'server_shutdown' message
     │    └─> UPDATE websocket_sessions SET is_active=false
     │
     │ 4. Stop accepting new API requests
     │    └─> Return 503 Service Unavailable
     │
     │ 5. Wait for in-flight requests to complete
     │    └─> Max 30 seconds
     │
     │ 6. Close database connections
     │
     │ 7. Exit process
     ▼
┌─────────────────┐
│  STOPPED        │
└─────────────────┘
```

---

## **FLOW 8: DATABASE RECOVERY AFTER RESTART**

```
┌─────────────────┐
│  Server Restart │
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ SchedulerService│
│ .start()        │
└────┬────────────┘
     │
     │ SELECT * FROM task_schedules WHERE enabled=true
     ▼
┌─────────────────┐
│   PostgreSQL    │
└────┬────────────┘
     │
     │ [Load all schedules]
     ▼
┌─────────────────┐
│ SchedulerService│
│ [Check schedules]│
└────┬────────────┘
     │
     │ For each schedule:
     │   - If next_run_at is in the past:
     │     → Trigger immediately (catch up)
     │   - If next_run_at is null (one-time already ran):
     │     → Skip
     │   - Otherwise:
     │     → Wait for next_run_at
     ▼
┌─────────────────┐
│ErrorRecoveryS vc│
│ .start()        │
└────┬────────────┘
     │
     │ SELECT * FROM error_records WHERE recovery_status='retry_scheduled'
     ▼
┌─────────────────┐
│   PostgreSQL    │
└────┬────────────┘
     │
     │ [Load pending retries]
     ▼
┌─────────────────┐
│ErrorRecoveryS vc│
│.processRetries()│
└────┬────────────┘
     │
     │ Resume retry processing
     ▼
┌─────────────────┐
│  RECOVERED      │
└─────────────────┘
```

---

## **SUMMARY OF INTEGRATION POINTS**

| **From** | **To** | **Method** | **Purpose** |
|----------|--------|------------|-------------|
| Scheduler | ExecutionEngine | `executeTask()` | Trigger scheduled tasks |
| ExecutionEngine | ConductorClient | `executeTask()` | Run Conductor tasks |
| ExecutionEngine | ErrorRecovery | `recordError()` | Report execution failures |
| ErrorRecovery | ExecutionEngine | `executeTask()` | Retry failed tasks |
| Scheduler | WebSocket | `broadcast()` | Notify execution started |
| ExecutionEngine | WebSocket | `broadcast()` | Notify execution completed/failed |
| ErrorRecovery | WebSocket | `sendToSubscribers()` | Notify error recorded |
| API Gateway | Scheduler | `createSchedule()`, etc. | CRUD operations |
| API Gateway | ExecutionEngine | `listExecutions()`, etc. | Query executions |
| API Gateway | ErrorRecovery | `listErrors()`, `retryError()`, etc. | Error management |
| Frontend | API Gateway | HTTP requests | All user actions |
| Frontend | WebSocket | WS connection | Real-time updates |

---

**Status**: Ready for implementation
**Next Action**: Begin coding services following this flow architecture
