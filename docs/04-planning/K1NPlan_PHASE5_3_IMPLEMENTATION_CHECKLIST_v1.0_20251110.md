# Phase 5.3 Implementation Checklist

**Purpose**: Step-by-step implementation guide for Advanced Features
**Status**: Implementation Ready
**Date**: 2025-11-10
**Owner**: Team A (Architecture & Backend)

---

## **PHASE 5.3.1: DATABASE SETUP**

### **Step 1: Create Database & Schema**
- [ ] Create PostgreSQL database `taskmaster` (or add to existing)
- [ ] Run schema migration: `/docs/04-planning/phase5.3_database_schema.sql`
- [ ] Verify all tables created:
  - [ ] `task_schedules`
  - [ ] `task_executions`
  - [ ] `error_records`
  - [ ] `websocket_sessions`
  - [ ] `audit_log`
  - [ ] `system_state`
- [ ] Verify all indices created
- [ ] Verify triggers created (`update_updated_at`)

### **Step 2: Database Client**
- [ ] Install `pg` package: `npm install pg`
- [ ] Create `/backend/src/db/client.ts`
  - [ ] Export `query()` function
  - [ ] Connection pooling (max 20 connections)
  - [ ] Error handling
  - [ ] Transaction support
- [ ] Test database connection
- [ ] Add environment variables:
  - [ ] `DATABASE_URL`
  - [ ] `DATABASE_POOL_SIZE`

**Validation**:
```bash
# Test connection
psql $DATABASE_URL -c "SELECT * FROM system_state;"

# Verify schema
psql $DATABASE_URL -c "\dt"
```

---

## **PHASE 5.3.2: CONDUCTOR CLIENT**

### **Step 1: Define Conductor API Contract**
- [ ] Document Conductor endpoints:
  - [ ] `POST /api/threads/{threadId}/messages`
  - [ ] `GET /api/threads/{threadId}`
  - [ ] `POST /api/threads/{threadId}/cancel`
- [ ] Define request/response schemas
- [ ] Add to OpenAPI spec (if applicable)

### **Step 2: Implement ConductorClient**
- [ ] Create `/backend/src/clients/conductor/ConductorClient.ts`
- [ ] Implement `executeTask()`
  - [ ] HTTP POST to Conductor
  - [ ] Timeout handling
  - [ ] Error parsing
- [ ] Implement `getThreadStatus()`
- [ ] Implement `cancelThread()`
- [ ] Add retry logic (3 retries with exponential backoff)
- [ ] Add environment variables:
  - [ ] `CONDUCTOR_BASE_URL` (default: `http://localhost:3001`)
  - [ ] `CONDUCTOR_TIMEOUT` (default: 300000ms)

### **Step 3: Unit Tests**
- [ ] Test successful execution
- [ ] Test timeout handling
- [ ] Test Conductor API errors
- [ ] Test retry logic
- [ ] Mock Conductor API responses

**Validation**:
```bash
# Manual test (requires Conductor running)
curl -X POST http://localhost:3001/api/threads/test-123/messages \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "timeout": 5000}'
```

---

## **PHASE 5.3.3: ERROR RECOVERY SERVICE**

### **Step 1: Implement ErrorRecoveryService**
- [ ] Create `/backend/src/services/error-recovery/ErrorRecoveryService.ts`
- [ ] Implement `recordError()`
  - [ ] Insert into `error_records`
  - [ ] Auto-schedule retry for high/critical severity
  - [ ] Broadcast to WebSocket
- [ ] Implement `listErrors()`
  - [ ] Support filters: recoveryStatus, severity, scheduleId
  - [ ] Pagination support
- [ ] Implement `getError()`
- [ ] Implement `retryError()`
  - [ ] Update status to 'retrying'
  - [ ] Re-execute task via ExecutionEngine
  - [ ] Handle success/failure
- [ ] Implement `resolveError()`
- [ ] Implement `ignoreError()`
- [ ] Implement `escalateError()`

### **Step 2: Background Retry Processor**
- [ ] Implement `start()` method
  - [ ] Start 10-second interval loop
  - [ ] Update `system_state.error_recovery_running`
- [ ] Implement `stop()` method
- [ ] Implement `processRetries()`
  - [ ] SELECT errors ready for retry
  - [ ] Call `retryError()` for each
  - [ ] Handle exponential backoff
  - [ ] Escalate after max attempts

### **Step 3: Unit Tests**
- [ ] Test error recording
- [ ] Test retry scheduling
- [ ] Test retry execution
- [ ] Test exponential backoff calculation
- [ ] Test max retries exceeded → escalation
- [ ] Test manual resolution
- [ ] Mock database and ExecutionEngine

**Validation**:
```sql
-- Verify error recorded
SELECT * FROM error_records WHERE execution_id = 123;

-- Verify retry scheduled
SELECT * FROM error_records WHERE recovery_status = 'retry_scheduled';

-- Verify escalation
SELECT * FROM error_records WHERE recovery_status = 'escalated';
```

---

## **PHASE 5.3.4: TASK EXECUTION ENGINE**

### **Step 1: Implement ExecutionEngine**
- [ ] Create `/backend/src/services/execution/ExecutionEngine.ts`
- [ ] Implement `executeTask()`
  - [ ] Insert into `task_executions`
  - [ ] Call `runTask()` asynchronously
  - [ ] Return execution record immediately
- [ ] Implement `runTask()` (private)
  - [ ] Update status to 'running'
  - [ ] Route to task type handler
  - [ ] Update status to 'completed' or 'failed'
  - [ ] Record errors via ErrorRecoveryService
  - [ ] Broadcast to WebSocket

### **Step 2: Task Type Handlers**
- [ ] Implement `executeConductorTask()`
  - [ ] Call ConductorClient.executeTask()
  - [ ] Timeout handling via Promise.race()
  - [ ] Parse result
- [ ] Implement `executeShellCommand()`
  - [ ] Use `child_process.exec()`
  - [ ] Timeout handling
  - [ ] Capture stdout/stderr
- [ ] Implement `executeHttpRequest()`
  - [ ] Use `axios`
  - [ ] Timeout handling
  - [ ] Parse response

### **Step 3: Query Methods**
- [ ] Implement `getExecution()`
- [ ] Implement `getExecutionByUuid()`
- [ ] Implement `listExecutions()`
  - [ ] Support filters: scheduleId, status
  - [ ] Pagination support
- [ ] Implement `cancelExecution()`
  - [ ] Update status to 'cancelled'
  - [ ] Cancel Conductor thread if applicable

### **Step 4: Unit Tests**
- [ ] Test Conductor task execution
- [ ] Test shell command execution
- [ ] Test HTTP request execution
- [ ] Test timeout handling
- [ ] Test error recording
- [ ] Test cancellation
- [ ] Mock ConductorClient, child_process, axios

**Validation**:
```sql
-- Verify execution created
SELECT * FROM task_executions WHERE execution_id = 'uuid-here';

-- Verify status transitions
SELECT id, status, started_at, completed_at FROM task_executions WHERE schedule_id = 1;

-- Verify results stored
SELECT result FROM task_executions WHERE id = 123;
```

---

## **PHASE 5.3.5: DYNAMIC SCHEDULER SERVICE**

### **Step 1: Implement SchedulerService**
- [ ] Create `/backend/src/services/scheduler/SchedulerService.ts`
- [ ] Implement `createSchedule()`
  - [ ] Insert into `task_schedules`
  - [ ] Calculate initial `next_run_at`
  - [ ] Validate cron expressions
- [ ] Implement `getSchedule()`
- [ ] Implement `listSchedules()`
  - [ ] Support filters: enabled
- [ ] Implement `updateSchedule()`
  - [ ] Recalculate `next_run_at` if schedule changed
- [ ] Implement `deleteSchedule()`
- [ ] Implement `triggerNow()`
  - [ ] Call ExecutionEngine.executeTask() immediately

### **Step 2: Scheduler Tick Loop**
- [ ] Implement `start()` method
  - [ ] Start 1-second interval loop
  - [ ] Update `system_state.scheduler_running`
- [ ] Implement `stop()` method
- [ ] Implement `tick()` (private)
  - [ ] SELECT schedules where `next_run_at <= NOW()`
  - [ ] Call `triggerSchedule()` for each
  - [ ] Update `system_state.scheduler_last_tick_at`
- [ ] Implement `triggerSchedule()` (private)
  - [ ] Call ExecutionEngine.executeTask()
  - [ ] Update schedule `last_run_at` and `next_run_at`
  - [ ] Broadcast to WebSocket

### **Step 3: Schedule Calculation**
- [ ] Implement `calculateNextRun()` (private)
  - [ ] Handle `cron` type: use `cron-parser` library
  - [ ] Handle `interval` type: add milliseconds to now
  - [ ] Handle `one_time` type: return null (disable schedule)
- [ ] Install `cron-parser`: `npm install cron-parser`
- [ ] Add cron expression validation

### **Step 4: Unit Tests**
- [ ] Test schedule CRUD operations
- [ ] Test cron calculation
- [ ] Test interval calculation
- [ ] Test one-time schedule
- [ ] Test tick loop
- [ ] Test trigger scheduling
- [ ] Mock database and ExecutionEngine

**Validation**:
```sql
-- Verify schedule created
SELECT * FROM task_schedules WHERE name = 'test-schedule';

-- Verify next_run_at calculated
SELECT name, next_run_at FROM task_schedules WHERE enabled = true;

-- Verify schedule triggered
SELECT last_run_at FROM task_schedules WHERE id = 1;

-- Verify system state updated
SELECT * FROM system_state;
```

---

## **PHASE 5.3.6: WEBSOCKET SERVICE**

### **Step 1: Implement WebSocketService**
- [ ] Create `/backend/src/services/websocket/WebSocketService.ts`
- [ ] Install `ws`: `npm install ws @types/ws`
- [ ] Initialize WebSocket.Server in constructor
- [ ] Implement `handleConnection()` (private)
  - [ ] Create session in database
  - [ ] Store connection in memory
  - [ ] Send 'connected' message
- [ ] Implement `handleMessage()` (private)
  - [ ] Handle 'ping' → update last_ping_at
  - [ ] Handle 'subscribe' → update subscriptions

### **Step 2: Broadcasting Methods**
- [ ] Implement `broadcast()`
  - [ ] Send to all active connections
- [ ] Implement `sendToSession()`
  - [ ] Send to specific session
- [ ] Implement `sendToSubscribers()`
  - [ ] Query sessions with matching subscriptions
  - [ ] Send message to each

### **Step 3: Session Management**
- [ ] Implement `createSession()`
- [ ] Implement `getSession()`
- [ ] Implement `updateSubscriptions()`
- [ ] Implement `closeSession()`
  - [ ] Update database
  - [ ] Remove from memory
- [ ] Implement `cleanupStaleConnections()`
  - [ ] Run periodically (30s interval)
  - [ ] Close connections with last_ping_at > threshold

### **Step 4: Unit Tests**
- [ ] Test connection handling
- [ ] Test message routing
- [ ] Test subscription filtering
- [ ] Test session cleanup
- [ ] Mock WebSocket connections

**Validation**:
```bash
# Test WebSocket connection
npm install -g wscat
wscat -c ws://localhost:3000/ws

# Send ping
> {"type": "ping"}
< {"type": "pong", "timestamp": "..."}

# Subscribe
> {"type": "subscribe", "subscriptions": {"severities": ["high", "critical"]}}
< {"type": "subscribed", "timestamp": "..."}
```

```sql
-- Verify session created
SELECT * FROM websocket_sessions WHERE session_id = 'uuid-here';

-- Verify subscriptions stored
SELECT subscriptions FROM websocket_sessions WHERE session_id = 'uuid-here';
```

---

## **PHASE 5.3.7: API ROUTES**

### **Step 1: Create Express Router**
- [ ] Create `/backend/src/routes/index.ts`
- [ ] Install Express middleware:
  - [ ] `express`: web framework
  - [ ] `express-validator`: request validation
  - [ ] `helmet`: security headers
  - [ ] `cors`: CORS support

### **Step 2: Implement Scheduler Routes**
- [ ] `POST /api/scheduler/schedules`
  - [ ] Validate request body
  - [ ] Call schedulerService.createSchedule()
- [ ] `GET /api/scheduler/schedules`
  - [ ] Parse query params
  - [ ] Call schedulerService.listSchedules()
- [ ] `GET /api/scheduler/schedules/:id`
- [ ] `PUT /api/scheduler/schedules/:id`
- [ ] `DELETE /api/scheduler/schedules/:id`
- [ ] `POST /api/scheduler/schedules/:id/trigger`
- [ ] `POST /api/scheduler/start`
- [ ] `POST /api/scheduler/stop`
- [ ] `GET /api/scheduler/status`

### **Step 3: Implement Execution Routes**
- [ ] `GET /api/execution/executions`
- [ ] `GET /api/execution/executions/:id`
- [ ] `POST /api/execution/executions/:id/cancel`

### **Step 4: Implement Error Routes**
- [ ] `GET /api/errors/errors`
- [ ] `GET /api/errors/errors/:id`
- [ ] `POST /api/errors/errors/:id/retry`
- [ ] `POST /api/errors/errors/:id/resolve`
- [ ] `POST /api/errors/errors/:id/ignore`
- [ ] `POST /api/errors/errors/:id/escalate`
- [ ] `GET /api/errors/status`

### **Step 5: Add Middleware**
- [ ] Error handling middleware
  - [ ] Catch all errors
  - [ ] Log to console
  - [ ] Return 500 with error message
- [ ] Request logging middleware
- [ ] Validation middleware
  - [ ] Validate request bodies
  - [ ] Return 400 on validation errors

### **Step 6: Integration Tests**
- [ ] Test all routes
- [ ] Test validation errors
- [ ] Test error handling
- [ ] Test CORS
- [ ] Use `supertest` library

**Validation**:
```bash
# Test schedule creation
curl -X POST http://localhost:3000/api/scheduler/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-schedule",
    "taskType": "shell_command",
    "taskConfig": {"command": "echo hello"},
    "scheduleType": "interval",
    "scheduleConfig": {"intervalMs": 60000}
  }'

# Test listing schedules
curl http://localhost:3000/api/scheduler/schedules

# Test triggering schedule
curl -X POST http://localhost:3000/api/scheduler/schedules/1/trigger

# Test listing executions
curl http://localhost:3000/api/execution/executions

# Test listing errors
curl http://localhost:3000/api/errors/errors
```

---

## **PHASE 5.3.8: SYSTEM INTEGRATION**

### **Step 1: Application Entry Point**
- [ ] Create `/backend/src/index.ts`
- [ ] Load environment variables
- [ ] Initialize database connection
- [ ] Initialize all services
- [ ] Start services
- [ ] Start Express server
- [ ] Add graceful shutdown handling
  - [ ] Stop services
  - [ ] Close database connections
  - [ ] Exit cleanly

### **Step 2: Environment Configuration**
- [ ] Create `.env.example` file
- [ ] Document all environment variables:
  - [ ] `DATABASE_URL`
  - [ ] `CONDUCTOR_BASE_URL`
  - [ ] `PORT` (default: 3000)
  - [ ] `NODE_ENV` (development/production)
- [ ] Create `.env` file (gitignored)

### **Step 3: Docker Support (Optional)**
- [ ] Create `Dockerfile`
- [ ] Create `docker-compose.yml`
  - [ ] PostgreSQL service
  - [ ] Backend service
  - [ ] Conductor service
- [ ] Add Docker commands to README

### **Step 4: Health Check Endpoint**
- [ ] Add `GET /api/health`
  - [ ] Check database connection
  - [ ] Check service status
  - [ ] Return 200 if healthy, 503 if unhealthy

**Validation**:
```bash
# Start server
npm start

# Check health
curl http://localhost:3000/api/health

# Verify services running
curl http://localhost:3000/api/scheduler/status
curl http://localhost:3000/api/errors/status

# Check logs
tail -f logs/app.log
```

---

## **PHASE 5.3.9: FRONTEND INTEGRATION**

### **Step 1: WebSocket Client**
- [ ] Create `/webapp/src/services/websocket.ts`
- [ ] Implement connection handling
- [ ] Implement reconnection logic
- [ ] Implement subscription management
- [ ] Implement event handlers

### **Step 2: API Client**
- [ ] Create `/webapp/src/services/api.ts`
- [ ] Implement scheduler API methods
- [ ] Implement execution API methods
- [ ] Implement error API methods
- [ ] Add TypeScript types from backend

### **Step 3: Dashboard UI Components**
- [ ] Create `ScheduleList` component
  - [ ] Display all schedules
  - [ ] Enable/disable toggle
  - [ ] Trigger now button
  - [ ] Edit/delete actions
- [ ] Create `ScheduleForm` component
  - [ ] Create/edit schedules
  - [ ] Cron expression builder
  - [ ] Task config editor
- [ ] Create `ExecutionList` component
  - [ ] Display recent executions
  - [ ] Status badges
  - [ ] View details
  - [ ] Cancel running executions
- [ ] Create `ErrorList` component
  - [ ] Display errors
  - [ ] Severity badges
  - [ ] Retry/resolve/ignore actions
  - [ ] View error details

### **Step 4: Real-Time Updates**
- [ ] Subscribe to WebSocket events
- [ ] Update UI when executions start/complete
- [ ] Update UI when errors occur
- [ ] Show toast notifications for important events

**Validation**:
- [ ] Create a schedule via UI
- [ ] Trigger schedule manually
- [ ] View execution in real-time
- [ ] Simulate error and verify error UI
- [ ] Retry error and verify resolution

---

## **PHASE 5.3.10: TESTING & DOCUMENTATION**

### **Step 1: End-to-End Tests**
- [ ] Test complete schedule lifecycle
  - [ ] Create schedule → trigger → view execution
- [ ] Test error recovery
  - [ ] Force failure → verify error recorded → retry → verify resolution
- [ ] Test WebSocket updates
  - [ ] Connect client → trigger execution → verify message received

### **Step 2: Performance Testing**
- [ ] Test with 100+ schedules
- [ ] Test with rapid executions (10/sec)
- [ ] Test WebSocket with 100+ clients
- [ ] Profile database queries
- [ ] Optimize slow queries

### **Step 3: Documentation**
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Architecture diagram
- [ ] Database schema diagram
- [ ] Deployment guide
- [ ] User guide

### **Step 4: Deployment Checklist**
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Services started
- [ ] Health check passing
- [ ] Monitoring/alerting configured
- [ ] Backup strategy in place

---

## **SUMMARY**

**Total Estimated Time**: 40-60 hours

**Critical Path**:
1. Database setup (2 hours)
2. ConductorClient (4 hours)
3. ErrorRecoveryService (8 hours)
4. ExecutionEngine (8 hours)
5. SchedulerService (8 hours)
6. WebSocketService (6 hours)
7. API Routes (6 hours)
8. System Integration (4 hours)
9. Frontend Integration (8 hours)
10. Testing & Docs (6 hours)

**Next Action**: Begin with Phase 5.3.1 (Database Setup)

---

**Status**: Ready for implementation
**Last Updated**: 2025-11-10
