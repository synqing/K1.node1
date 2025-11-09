# Phase 5.3 Implementation Architecture

**Purpose**: Real, buildable architecture for Advanced Features
**Status**: Implementation Ready
**Date**: 2025-11-10
**Owner**: Team A (Architecture & Backend)

---

## **SERVICE IMPLEMENTATION DETAILS**

### **1. DYNAMIC SCHEDULER SERVICE**

#### **Purpose**
- Load schedules from database on startup
- Tick every second, check if any schedule needs execution
- Trigger ExecutionEngine when schedule fires
- Update `next_run_at` after triggering

#### **Core Logic**
```typescript
class SchedulerService implements ISchedulerService {
  private running = false;
  private tickInterval?: NodeJS.Timeout;

  async start() {
    this.running = true;
    await this.updateSystemState({ scheduler_running: true, scheduler_started_at: new Date() });

    // Tick every second
    this.tickInterval = setInterval(() => this.tick(), 1000);
  }

  async stop() {
    this.running = false;
    if (this.tickInterval) clearInterval(this.tickInterval);
    await this.updateSystemState({ scheduler_running: false });
  }

  private async tick() {
    const now = new Date();

    // Find schedules that need to run
    const dueSchedules = await db.query(`
      SELECT * FROM task_schedules
      WHERE enabled = true
        AND next_run_at <= $1
      ORDER BY next_run_at ASC
    `, [now]);

    for (const schedule of dueSchedules.rows) {
      // Trigger execution (non-blocking)
      this.triggerSchedule(schedule).catch(err => {
        console.error(`Failed to trigger schedule ${schedule.id}:`, err);
      });
    }

    await this.updateSystemState({ scheduler_last_tick_at: now });
  }

  private async triggerSchedule(schedule: TaskSchedule) {
    // Create execution record
    const execution = await executionEngine.executeTask({
      scheduleId: schedule.id,
      taskType: schedule.task_type,
      taskConfig: schedule.task_config,
      scheduledAt: new Date()
    });

    // Calculate next run time
    const nextRun = this.calculateNextRun(schedule.schedule_type, schedule.schedule_config);

    // Update schedule
    await db.query(`
      UPDATE task_schedules
      SET last_run_at = $1, next_run_at = $2
      WHERE id = $3
    `, [new Date(), nextRun, schedule.id]);

    // Notify WebSocket clients
    await wsService.broadcast({
      type: 'execution_started',
      payload: { executionId: execution.id, scheduleId: schedule.id },
      timestamp: new Date()
    });
  }

  private calculateNextRun(type: ScheduleType, config: ScheduleConfig): Date | null {
    switch (type) {
      case 'cron':
        return cronParser.parseExpression(config.cron).next().toDate();
      case 'interval':
        return new Date(Date.now() + config.intervalMs);
      case 'one_time':
        return null; // Disable after running
      default:
        throw new Error(`Unknown schedule type: ${type}`);
    }
  }
}
```

#### **Database Operations**
- Read: `SELECT * FROM task_schedules WHERE enabled = true AND next_run_at <= NOW()`
- Update: `UPDATE task_schedules SET last_run_at = ?, next_run_at = ? WHERE id = ?`
- System state: `UPDATE system_state SET scheduler_last_tick_at = ?`

#### **Dependencies**
- **Requires**: PostgreSQL, ExecutionEngine, WebSocketService
- **Provides**: Schedule management API

---

### **2. TASK EXECUTION ENGINE**

#### **Purpose**
- Receive execution requests from Scheduler or API
- Execute tasks via Conductor, shell, or HTTP
- Track execution state in database
- Report results/errors to WebSocket and ErrorRecovery

#### **Core Logic**
```typescript
class ExecutionEngine implements IExecutionEngine {
  async executeTask(req: ExecuteTaskRequest): Promise<TaskExecution> {
    const executionId = uuidv4();

    // Create execution record
    const execution = await db.query(`
      INSERT INTO task_executions (schedule_id, execution_id, status, scheduled_at)
      VALUES ($1, $2, 'pending', $3)
      RETURNING *
    `, [req.scheduleId, executionId, req.scheduledAt || new Date()]);

    const execId = execution.rows[0].id;

    // Execute task asynchronously
    this.runTask(execId, req.taskType, req.taskConfig).catch(err => {
      console.error(`Execution ${execId} failed:`, err);
    });

    return execution.rows[0];
  }

  private async runTask(execId: number, taskType: TaskType, config: TaskConfig) {
    const startTime = Date.now();

    try {
      // Update to running
      await this.updateExecutionStatus(execId, 'running', { started_at: new Date() });

      let result: ExecutionResult;

      switch (taskType) {
        case 'conductor_task':
          result = await this.executeConductorTask(config as ConductorTaskConfig);
          break;
        case 'shell_command':
          result = await this.executeShellCommand(config as ShellCommandConfig);
          break;
        case 'http_request':
          result = await this.executeHttpRequest(config as HttpRequestConfig);
          break;
        default:
          throw new Error(`Unknown task type: ${taskType}`);
      }

      const durationMs = Date.now() - startTime;

      // Update to completed
      await this.updateExecutionStatus(execId, 'completed', {
        completed_at: new Date(),
        duration_ms: durationMs,
        result: result.result,
        conductor_thread_id: result.conductorThreadId,
        conductor_status: result.conductorStatus
      });

      // Notify WebSocket
      await wsService.broadcast({
        type: 'execution_completed',
        payload: { executionId: execId, result },
        timestamp: new Date()
      });

    } catch (error) {
      const durationMs = Date.now() - startTime;

      // Update to failed
      await this.updateExecutionStatus(execId, 'failed', {
        completed_at: new Date(),
        duration_ms: durationMs,
        error: { message: error.message, stack: error.stack }
      });

      // Record error
      await errorRecoveryService.recordError({
        errorType: 'execution_failure',
        severity: 'high',
        executionId: execId,
        message: error.message,
        stackTrace: error.stack,
        errorData: { taskType, config }
      });

      // Notify WebSocket
      await wsService.broadcast({
        type: 'execution_failed',
        payload: { executionId: execId, error: error.message },
        timestamp: new Date()
      });
    }
  }

  private async executeConductorTask(config: ConductorTaskConfig): Promise<ExecutionResult> {
    const startTime = Date.now();
    const timeout = config.timeout || 300000; // 5 minutes default

    try {
      const result = await Promise.race([
        conductorClient.executeTask(config),
        this.timeoutPromise(timeout)
      ]);

      return {
        success: true,
        result: result.result,
        durationMs: Date.now() - startTime,
        conductorThreadId: result.threadId,
        conductorStatus: result.status
      };
    } catch (error) {
      if (error.message === 'TIMEOUT') {
        throw new Error(`Conductor task timed out after ${timeout}ms`);
      }
      throw error;
    }
  }

  private async executeShellCommand(config: ShellCommandConfig): Promise<ExecutionResult> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const startTime = Date.now();
    const timeout = config.timeout || 60000; // 1 minute default

    try {
      const result = await Promise.race([
        execAsync(config.command, {
          cwd: config.cwd,
          env: { ...process.env, ...config.env }
        }),
        this.timeoutPromise(timeout)
      ]);

      return {
        success: true,
        result: { stdout: result.stdout, stderr: result.stderr },
        durationMs: Date.now() - startTime
      };
    } catch (error) {
      if (error.message === 'TIMEOUT') {
        throw new Error(`Shell command timed out after ${timeout}ms`);
      }
      throw error;
    }
  }

  private async executeHttpRequest(config: HttpRequestConfig): Promise<ExecutionResult> {
    const axios = require('axios');

    const startTime = Date.now();
    const timeout = config.timeout || 30000; // 30 seconds default

    try {
      const response = await axios({
        method: config.method,
        url: config.url,
        headers: config.headers,
        data: config.body,
        timeout
      });

      return {
        success: true,
        result: { status: response.status, data: response.data },
        durationMs: Date.now() - startTime
      };
    } catch (error) {
      throw new Error(`HTTP ${config.method} ${config.url} failed: ${error.message}`);
    }
  }

  private timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT')), ms);
    });
  }
}
```

#### **Database Operations**
- Insert: `INSERT INTO task_executions (schedule_id, execution_id, status, scheduled_at) VALUES (...)`
- Update: `UPDATE task_executions SET status = ?, started_at = ?, completed_at = ?, duration_ms = ?, result = ?, error = ? WHERE id = ?`
- Read: `SELECT * FROM task_executions WHERE id = ? / execution_id = ?`

#### **Dependencies**
- **Requires**: PostgreSQL, ConductorClient, ErrorRecoveryService, WebSocketService
- **Provides**: Task execution API

---

### **3. ERROR RECOVERY SERVICE**

#### **Purpose**
- Receive error reports from ExecutionEngine
- Store errors in database with recovery state
- Background process to retry failed executions
- Provide API for manual error resolution

#### **Core Logic**
```typescript
class ErrorRecoveryService implements IErrorRecoveryService {
  private running = false;
  private retryInterval?: NodeJS.Timeout;

  async start() {
    this.running = true;
    await this.updateSystemState({ error_recovery_running: true });

    // Retry processor runs every 10 seconds
    this.retryInterval = setInterval(() => this.processRetries(), 10000);
  }

  async stop() {
    this.running = false;
    if (this.retryInterval) clearInterval(this.retryInterval);
    await this.updateSystemState({ error_recovery_running: false });
  }

  async recordError(req: RecordErrorRequest): Promise<ErrorRecord> {
    // Insert error record
    const result = await db.query(`
      INSERT INTO error_records (
        error_type, severity, execution_id, schedule_id,
        message, stack_trace, error_data, max_retry_attempts
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      req.errorType,
      req.severity,
      req.executionId,
      req.scheduleId,
      req.message,
      req.stackTrace,
      req.errorData,
      req.maxRetryAttempts || 3
    ]);

    const error = result.rows[0];

    // Schedule first retry if severity is high/critical
    if (req.severity === 'high' || req.severity === 'critical') {
      await this.scheduleRetry(error.id);
    }

    // Notify WebSocket
    await wsService.sendToSubscribers(
      { severity: req.severity },
      {
        type: 'error_recorded',
        payload: { errorId: error.id, severity: req.severity },
        timestamp: new Date()
      }
    );

    return error;
  }

  private async processRetries() {
    const now = new Date();

    // Find errors ready for retry
    const errors = await db.query(`
      SELECT * FROM error_records
      WHERE recovery_status = 'retry_scheduled'
        AND next_retry_at <= $1
      ORDER BY next_retry_at ASC
      LIMIT 10
    `, [now]);

    for (const error of errors.rows) {
      this.retryError(error.id).catch(err => {
        console.error(`Failed to retry error ${error.id}:`, err);
      });
    }

    await this.updateSystemState({ error_recovery_last_run_at: now });
  }

  async retryError(errorId: number): Promise<void> {
    const error = await this.getError(errorId);
    if (!error) throw new Error(`Error ${errorId} not found`);

    // Update status to retrying
    await db.query(`
      UPDATE error_records
      SET recovery_status = 'retrying', recovery_attempts = recovery_attempts + 1
      WHERE id = $1
    `, [errorId]);

    try {
      // Get original execution
      const execution = await db.query(`
        SELECT * FROM task_executions WHERE id = $1
      `, [error.executionId]);

      if (!execution.rows.length) {
        throw new Error('Original execution not found');
      }

      const exec = execution.rows[0];

      // Get schedule for task config
      const schedule = await db.query(`
        SELECT * FROM task_schedules WHERE id = $1
      `, [exec.schedule_id]);

      if (!schedule.rows.length) {
        throw new Error('Schedule not found');
      }

      const sched = schedule.rows[0];

      // Re-execute task
      await executionEngine.executeTask({
        scheduleId: sched.id,
        taskType: sched.task_type,
        taskConfig: sched.task_config,
        scheduledAt: new Date()
      });

      // Mark as resolved if retry succeeded
      await this.resolveError(errorId, {
        resolutionNotes: `Automatically resolved after retry attempt ${error.recoveryAttempts + 1}`
      });

    } catch (retryError) {
      // Check if max retries exceeded
      if (error.recoveryAttempts + 1 >= error.maxRetryAttempts) {
        await db.query(`
          UPDATE error_records
          SET recovery_status = 'escalated'
          WHERE id = $1
        `, [errorId]);
      } else {
        // Schedule next retry (exponential backoff)
        const nextRetry = new Date(Date.now() + Math.pow(2, error.recoveryAttempts + 1) * 60000);
        await db.query(`
          UPDATE error_records
          SET recovery_status = 'retry_scheduled', next_retry_at = $1
          WHERE id = $2
        `, [nextRetry, errorId]);
      }
    }
  }

  async resolveError(errorId: number, req: ResolveErrorRequest): Promise<void> {
    await db.query(`
      UPDATE error_records
      SET recovery_status = 'resolved', resolved_at = NOW(), resolution_notes = $1
      WHERE id = $2
    `, [req.resolutionNotes, errorId]);
  }

  private async scheduleRetry(errorId: number) {
    // Schedule first retry after 1 minute
    const nextRetry = new Date(Date.now() + 60000);
    await db.query(`
      UPDATE error_records
      SET recovery_status = 'retry_scheduled', next_retry_at = $1
      WHERE id = $2
    `, [nextRetry, errorId]);
  }
}
```

#### **Database Operations**
- Insert: `INSERT INTO error_records (...) VALUES (...)`
- Update: `UPDATE error_records SET recovery_status = ?, recovery_attempts = ?, next_retry_at = ?, resolved_at = ? WHERE id = ?`
- Read: `SELECT * FROM error_records WHERE recovery_status = ? AND next_retry_at <= ?`

#### **Dependencies**
- **Requires**: PostgreSQL, ExecutionEngine, WebSocketService
- **Provides**: Error tracking and recovery API

---

### **4. WEBSOCKET SERVICE**

#### **Purpose**
- Manage WebSocket connections
- Track client subscriptions
- Broadcast real-time events
- Filter messages based on subscriptions

#### **Core Logic**
```typescript
class WebSocketService implements IWebSocketService {
  private wss: WebSocket.Server;
  private connections = new Map<string, WebSocket>();

  constructor(server: http.Server) {
    this.wss = new WebSocket.Server({ server, path: '/ws' });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Cleanup stale connections every 30 seconds
    setInterval(() => this.cleanupStaleConnections(60000), 30000);
  }

  private async handleConnection(ws: WebSocket, req: http.IncomingMessage) {
    const sessionId = uuidv4();

    // Create session in database
    const session = await this.createSession({
      userAgent: req.headers['user-agent'],
      ip: req.socket.remoteAddress
    });

    this.connections.set(session.sessionId, ws);

    // Handle messages
    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        await this.handleMessage(session.sessionId, msg);
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    // Handle close
    ws.on('close', async () => {
      await this.closeSession(session.sessionId);
      this.connections.delete(session.sessionId);
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      sessionId: session.sessionId,
      timestamp: new Date()
    }));
  }

  private async handleMessage(sessionId: string, msg: any) {
    switch (msg.type) {
      case 'ping':
        await this.updatePing(sessionId);
        this.sendToSession(sessionId, { type: 'pong', timestamp: new Date() });
        break;

      case 'subscribe':
        await this.updateSubscriptions(sessionId, msg.subscriptions);
        this.sendToSession(sessionId, { type: 'subscribed', timestamp: new Date() });
        break;

      default:
        console.warn(`Unknown message type: ${msg.type}`);
    }
  }

  async broadcast(message: WebSocketMessage): Promise<void> {
    const payload = JSON.stringify(message);

    for (const [sessionId, ws] of this.connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  async sendToSession(sessionId: string, message: WebSocketMessage): Promise<void> {
    const ws = this.connections.get(sessionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  async sendToSubscribers(
    filter: { scheduleId?: number; severity?: Severity },
    message: WebSocketMessage
  ): Promise<void> {
    // Get matching sessions
    const sessions = await db.query(`
      SELECT session_id, subscriptions FROM websocket_sessions
      WHERE is_active = true
    `);

    for (const session of sessions.rows) {
      const subs = session.subscriptions || {};

      // Check if session is subscribed
      const matchesSchedule = !filter.scheduleId ||
        (subs.scheduleIds && subs.scheduleIds.includes(filter.scheduleId));

      const matchesSeverity = !filter.severity ||
        (subs.severities && subs.severities.includes(filter.severity));

      if (matchesSchedule && matchesSeverity) {
        await this.sendToSession(session.session_id, message);
      }
    }
  }

  async createSession(clientInfo?: any): Promise<WebSocketSession> {
    const sessionId = uuidv4();

    const result = await db.query(`
      INSERT INTO websocket_sessions (session_id, client_info)
      VALUES ($1, $2)
      RETURNING *
    `, [sessionId, clientInfo]);

    return result.rows[0];
  }

  async closeSession(sessionId: string): Promise<void> {
    await db.query(`
      UPDATE websocket_sessions
      SET is_active = false, disconnected_at = NOW()
      WHERE session_id = $1
    `, [sessionId]);
  }

  async cleanupStaleConnections(staleThresholdMs: number): Promise<void> {
    const cutoff = new Date(Date.now() - staleThresholdMs);

    await db.query(`
      UPDATE websocket_sessions
      SET is_active = false, disconnected_at = NOW()
      WHERE is_active = true
        AND last_ping_at < $1
    `, [cutoff]);
  }

  private async updatePing(sessionId: string): Promise<void> {
    await db.query(`
      UPDATE websocket_sessions
      SET last_ping_at = NOW()
      WHERE session_id = $1
    `, [sessionId]);
  }
}
```

#### **Database Operations**
- Insert: `INSERT INTO websocket_sessions (session_id, client_info) VALUES (...)`
- Update: `UPDATE websocket_sessions SET last_ping_at = ?, is_active = ?, disconnected_at = ? WHERE session_id = ?`
- Read: `SELECT * FROM websocket_sessions WHERE is_active = true`

#### **Dependencies**
- **Requires**: PostgreSQL, WebSocket library
- **Provides**: Real-time messaging to frontend

---

### **5. CONDUCTOR CLIENT**

#### **Purpose**
- Wrap Claude Conductor subprocess
- Execute tasks via Conductor API
- Track thread status
- Handle Conductor-specific errors

#### **Core Logic**
```typescript
class ConductorClient {
  private baseUrl = 'http://localhost:3001'; // Conductor API endpoint

  async executeTask(config: ConductorTaskConfig): Promise<{
    threadId: string;
    status: string;
    result?: any;
    error?: any;
  }> {
    const axios = require('axios');

    try {
      // Create or use existing thread
      const threadId = config.threadId || uuidv4();

      // Send message to Conductor
      const response = await axios.post(`${this.baseUrl}/api/threads/${threadId}/messages`, {
        message: config.message,
        timeout: config.timeout || 300000
      });

      return {
        threadId,
        status: response.data.status,
        result: response.data.result,
        error: response.data.error
      };

    } catch (error) {
      throw new Error(`Conductor execution failed: ${error.message}`);
    }
  }

  async getThreadStatus(threadId: string): Promise<{
    status: string;
    messages?: any[];
    result?: any;
    error?: any;
  }> {
    const axios = require('axios');

    try {
      const response = await axios.get(`${this.baseUrl}/api/threads/${threadId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get thread status: ${error.message}`);
    }
  }

  async cancelThread(threadId: string): Promise<void> {
    const axios = require('axios');

    try {
      await axios.post(`${this.baseUrl}/api/threads/${threadId}/cancel`);
    } catch (error) {
      throw new Error(`Failed to cancel thread: ${error.message}`);
    }
  }
}
```

#### **Dependencies**
- **Requires**: Conductor subprocess running on port 3001
- **Provides**: Conductor task execution API

---

## **API ROUTES (Express)**

### **Router Setup**
```typescript
import express from 'express';

const app = express();

// Scheduler routes
app.post('/api/scheduler/schedules', async (req, res) => {
  const schedule = await schedulerService.createSchedule(req.body);
  res.json(schedule);
});

app.get('/api/scheduler/schedules', async (req, res) => {
  const schedules = await schedulerService.listSchedules({
    enabled: req.query.enabled === 'true'
  });
  res.json(schedules);
});

app.get('/api/scheduler/schedules/:id', async (req, res) => {
  const schedule = await schedulerService.getSchedule(Number(req.params.id));
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
  res.json(schedule);
});

app.put('/api/scheduler/schedules/:id', async (req, res) => {
  const schedule = await schedulerService.updateSchedule(Number(req.params.id), req.body);
  res.json(schedule);
});

app.delete('/api/scheduler/schedules/:id', async (req, res) => {
  await schedulerService.deleteSchedule(Number(req.params.id));
  res.json({ success: true });
});

app.post('/api/scheduler/schedules/:id/trigger', async (req, res) => {
  const executionId = await schedulerService.triggerNow(Number(req.params.id));
  res.json({ executionId });
});

app.post('/api/scheduler/start', async (req, res) => {
  await schedulerService.start();
  res.json({ success: true });
});

app.post('/api/scheduler/stop', async (req, res) => {
  await schedulerService.stop();
  res.json({ success: true });
});

// Execution routes
app.get('/api/execution/executions', async (req, res) => {
  const executions = await executionEngine.listExecutions({
    scheduleId: req.query.scheduleId ? Number(req.query.scheduleId) : undefined,
    status: req.query.status as ExecutionStatus,
    limit: req.query.limit ? Number(req.query.limit) : 50,
    offset: req.query.offset ? Number(req.query.offset) : 0
  });
  res.json(executions);
});

app.get('/api/execution/executions/:id', async (req, res) => {
  const execution = await executionEngine.getExecution(Number(req.params.id));
  if (!execution) return res.status(404).json({ error: 'Execution not found' });
  res.json(execution);
});

app.post('/api/execution/executions/:id/cancel', async (req, res) => {
  await executionEngine.cancelExecution(Number(req.params.id));
  res.json({ success: true });
});

// Error routes
app.get('/api/errors/errors', async (req, res) => {
  const errors = await errorRecoveryService.listErrors({
    recoveryStatus: req.query.recoveryStatus as RecoveryStatus,
    severity: req.query.severity as Severity,
    scheduleId: req.query.scheduleId ? Number(req.query.scheduleId) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : 50,
    offset: req.query.offset ? Number(req.query.offset) : 0
  });
  res.json(errors);
});

app.get('/api/errors/errors/:id', async (req, res) => {
  const error = await errorRecoveryService.getError(Number(req.params.id));
  if (!error) return res.status(404).json({ error: 'Error not found' });
  res.json(error);
});

app.post('/api/errors/errors/:id/retry', async (req, res) => {
  await errorRecoveryService.retryError(Number(req.params.id));
  res.json({ success: true });
});

app.post('/api/errors/errors/:id/resolve', async (req, res) => {
  await errorRecoveryService.resolveError(Number(req.params.id), req.body);
  res.json({ success: true });
});

app.post('/api/errors/errors/:id/ignore', async (req, res) => {
  await errorRecoveryService.ignoreError(Number(req.params.id));
  res.json({ success: true });
});

app.post('/api/errors/errors/:id/escalate', async (req, res) => {
  await errorRecoveryService.escalateError(Number(req.params.id));
  res.json({ success: true });
});
```

---

## **STARTUP SEQUENCE**

1. **Database Initialization**
   - Run schema migrations
   - Verify tables exist
   - Create indices

2. **Service Initialization**
   - Initialize ConductorClient
   - Initialize ErrorRecoveryService
   - Initialize ExecutionEngine
   - Initialize SchedulerService
   - Initialize WebSocketService

3. **Service Startup**
   - Start ErrorRecoveryService (background retry processor)
   - Start SchedulerService (tick loop)
   - Start API server
   - Start WebSocket server

4. **Health Check**
   - Verify all services running
   - Log startup completion
   - Expose `/api/health` endpoint

---

## **FAILURE SCENARIOS**

### **1. Database Connection Lost**
- **Detection**: PostgreSQL connection error
- **Response**:
  - Stop scheduler tick loop
  - Return 503 on API requests
  - Attempt reconnection every 5 seconds
  - Resume services when reconnected

### **2. Conductor Subprocess Crashed**
- **Detection**: HTTP request to Conductor fails
- **Response**:
  - Mark execution as failed with `conductor_error`
  - Record error in error_records
  - Attempt to restart Conductor subprocess
  - Retry failed tasks after restart

### **3. Execution Timeout**
- **Detection**: Task execution exceeds timeout threshold
- **Response**:
  - Mark execution as `timeout`
  - Record error with severity `high`
  - Schedule retry if configured
  - Cancel Conductor thread if applicable

### **4. WebSocket Connection Lost**
- **Detection**: Client ping timeout
- **Response**:
  - Mark session as inactive
  - Clean up connection from memory
  - Client auto-reconnects

### **5. Scheduler Tick Failure**
- **Detection**: Exception in tick() method
- **Response**:
  - Log error
  - Continue to next tick
  - Do not stop scheduler
  - Alert if repeated failures

---

## **DEPENDENCIES GRAPH**

```
┌─────────────────┐
│   PostgreSQL    │
└────────┬────────┘
         │
         ├─────────────────────────────────────┐
         │                                     │
         ▼                                     ▼
┌─────────────────┐                  ┌─────────────────┐
│ ConductorClient │                  │  WebSocketSvc   │
└────────┬────────┘                  └────────┬────────┘
         │                                     │
         ▼                                     │
┌─────────────────┐                            │
│ ExecutionEngine │◄───────────────────────────┘
└────────┬────────┘
         │
         ├─────────────────┐
         │                 │
         ▼                 ▼
┌─────────────────┐  ┌─────────────────┐
│ ErrorRecovery   │  │ SchedulerSvc    │
└─────────────────┘  └─────────────────┘
```

**Initialization Order**:
1. PostgreSQL connection
2. ConductorClient
3. ErrorRecoveryService
4. ExecutionEngine
5. SchedulerService
6. WebSocketService
7. API Gateway

---

## **NEXT STEPS**

1. **Create repository structure**
   - `backend/src/services/scheduler/`
   - `backend/src/services/execution/`
   - `backend/src/services/error-recovery/`
   - `backend/src/services/websocket/`
   - `backend/src/clients/conductor/`
   - `backend/src/routes/`

2. **Implement database layer**
   - Run schema migration
   - Create database client wrapper
   - Add connection pooling

3. **Implement services sequentially**
   - Start with ConductorClient (smallest)
   - Then ErrorRecoveryService
   - Then ExecutionEngine
   - Then SchedulerService
   - Finally WebSocketService

4. **Implement API routes**
   - Create Express router
   - Add validation middleware
   - Add error handling middleware

5. **Add tests**
   - Unit tests for each service
   - Integration tests for API routes
   - End-to-end tests for complete flows

6. **Create frontend integration**
   - WebSocket client
   - API client
   - Dashboard UI components

---

## **QUESTIONS TO RESOLVE**

1. **Conductor API Contract**: What is the actual Conductor API? Need to define exact endpoints.
2. **Authentication**: Should API routes require authentication? If yes, what mechanism?
3. **Rate Limiting**: Should scheduler have rate limits to prevent overload?
4. **Persistence**: Should in-flight executions survive server restarts?
5. **Monitoring**: What metrics should be exposed (Prometheus, etc.)?

---

**Status**: Ready for implementation
**Next Action**: Create repository structure and begin database setup
