/**
 * Phase 5.3 Service Interfaces
 * Purpose: Real TypeScript interfaces for all services
 * Status: Implementation Ready
 * Date: 2025-11-10
 */

// ============================================================================
// SHARED TYPES
// ============================================================================

export type TaskType = 'conductor_task' | 'shell_command' | 'http_request';
export type ScheduleType = 'cron' | 'interval' | 'one_time';
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'cancelled';
export type ErrorType = 'execution_failure' | 'timeout' | 'conductor_error' | 'system_error';
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type RecoveryStatus = 'unresolved' | 'retry_scheduled' | 'retrying' | 'resolved' | 'ignored' | 'escalated';

export interface ConductorTaskConfig {
  threadId?: string; // Existing thread or create new
  message: string; // Message to send to Conductor
  timeout?: number; // Timeout in ms
}

export interface ShellCommandConfig {
  command: string;
  args?: string[];
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
}

export interface HttpRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

export type TaskConfig = ConductorTaskConfig | ShellCommandConfig | HttpRequestConfig;

export interface CronScheduleConfig {
  cron: string; // Cron expression
  timezone?: string;
}

export interface IntervalScheduleConfig {
  intervalMs: number;
}

export interface OneTimeScheduleConfig {
  executeAt: Date; // ISO timestamp
}

export type ScheduleConfig = CronScheduleConfig | IntervalScheduleConfig | OneTimeScheduleConfig;

// ============================================================================
// 1. DYNAMIC SCHEDULER SERVICE
// ============================================================================

export interface TaskSchedule {
  id: number;
  name: string;
  description?: string;
  taskType: TaskType;
  taskConfig: TaskConfig;
  scheduleType: ScheduleType;
  scheduleConfig: ScheduleConfig;
  enabled: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface CreateScheduleRequest {
  name: string;
  description?: string;
  taskType: TaskType;
  taskConfig: TaskConfig;
  scheduleType: ScheduleType;
  scheduleConfig: ScheduleConfig;
  enabled?: boolean;
}

export interface UpdateScheduleRequest {
  name?: string;
  description?: string;
  taskConfig?: TaskConfig;
  scheduleConfig?: ScheduleConfig;
  enabled?: boolean;
}

export interface ISchedulerService {
  // CRUD operations
  createSchedule(req: CreateScheduleRequest): Promise<TaskSchedule>;
  getSchedule(id: number): Promise<TaskSchedule | null>;
  listSchedules(filters?: { enabled?: boolean }): Promise<TaskSchedule[]>;
  updateSchedule(id: number, updates: UpdateScheduleRequest): Promise<TaskSchedule>;
  deleteSchedule(id: number): Promise<void>;

  // Scheduler lifecycle
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;

  // Manual trigger
  triggerNow(scheduleId: number): Promise<number>; // Returns execution_id
}

// ============================================================================
// 2. TASK EXECUTION ENGINE
// ============================================================================

export interface TaskExecution {
  id: number;
  scheduleId: number;
  executionId: string; // UUID
  status: ExecutionStatus;
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  result?: any;
  error?: any;
  conductorThreadId?: string;
  conductorStatus?: string;
  createdAt: Date;
}

export interface ExecuteTaskRequest {
  scheduleId: number;
  taskType: TaskType;
  taskConfig: TaskConfig;
  scheduledAt?: Date;
}

export interface ExecutionResult {
  success: boolean;
  result?: any;
  error?: any;
  durationMs: number;
  conductorThreadId?: string;
  conductorStatus?: string;
}

export interface IExecutionEngine {
  // Execute task
  executeTask(req: ExecuteTaskRequest): Promise<TaskExecution>;

  // Query executions
  getExecution(id: number): Promise<TaskExecution | null>;
  getExecutionByUuid(executionId: string): Promise<TaskExecution | null>;
  listExecutions(filters?: {
    scheduleId?: number;
    status?: ExecutionStatus;
    limit?: number;
    offset?: number;
  }): Promise<TaskExecution[]>;

  // Cancel running execution
  cancelExecution(id: number): Promise<void>;

  // Internal: track execution state
  updateExecutionStatus(id: number, status: ExecutionStatus, data?: Partial<TaskExecution>): Promise<void>;
}

// ============================================================================
// 3. ERROR RECOVERY SERVICE
// ============================================================================

export interface ErrorRecord {
  id: number;
  errorType: ErrorType;
  severity: Severity;
  executionId?: number;
  scheduleId?: number;
  message: string;
  stackTrace?: string;
  errorData?: any;
  recoveryStatus: RecoveryStatus;
  recoveryAttempts: number;
  maxRetryAttempts: number;
  nextRetryAt?: Date;
  resolvedAt?: Date;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecordErrorRequest {
  errorType: ErrorType;
  severity: Severity;
  executionId?: number;
  scheduleId?: number;
  message: string;
  stackTrace?: string;
  errorData?: any;
  maxRetryAttempts?: number;
}

export interface ResolveErrorRequest {
  resolutionNotes: string;
}

export interface IErrorRecoveryService {
  // Record errors
  recordError(req: RecordErrorRequest): Promise<ErrorRecord>;

  // Query errors
  getError(id: number): Promise<ErrorRecord | null>;
  listErrors(filters?: {
    recoveryStatus?: RecoveryStatus;
    severity?: Severity;
    scheduleId?: number;
    limit?: number;
    offset?: number;
  }): Promise<ErrorRecord[]>;

  // Manual actions
  retryError(id: number): Promise<void>;
  resolveError(id: number, req: ResolveErrorRequest): Promise<void>;
  ignoreError(id: number): Promise<void>;
  escalateError(id: number): Promise<void>;

  // Service lifecycle
  start(): Promise<void>; // Start background retry processor
  stop(): Promise<void>;
  isRunning(): boolean;
}

// ============================================================================
// 4. WEBSOCKET SERVICE
// ============================================================================

export interface WebSocketSession {
  id: number;
  sessionId: string; // UUID
  connectedAt: Date;
  lastPingAt: Date;
  disconnectedAt?: Date;
  subscriptions?: {
    scheduleIds?: number[];
    severities?: Severity[];
  };
  clientInfo?: any;
  isActive: boolean;
}

export interface WebSocketMessage {
  type: 'execution_started' | 'execution_completed' | 'execution_failed' | 'error_recorded' | 'schedule_updated';
  payload: any;
  timestamp: Date;
}

export interface IWebSocketService {
  // Session management
  createSession(clientInfo?: any): Promise<WebSocketSession>;
  getSession(sessionId: string): Promise<WebSocketSession | null>;
  updateSubscriptions(sessionId: string, subscriptions: WebSocketSession['subscriptions']): Promise<void>;
  closeSession(sessionId: string): Promise<void>;

  // Broadcasting
  broadcast(message: WebSocketMessage): Promise<void>;
  sendToSession(sessionId: string, message: WebSocketMessage): Promise<void>;
  sendToSubscribers(filter: { scheduleId?: number; severity?: Severity }, message: WebSocketMessage): Promise<void>;

  // Cleanup
  cleanupStaleConnections(staleThresholdMs: number): Promise<void>;
}

// ============================================================================
// 5. CONDUCTOR INTEGRATION
// ============================================================================

export interface ConductorClient {
  // Execute task via Conductor
  executeTask(config: ConductorTaskConfig): Promise<{
    threadId: string;
    status: string;
    result?: any;
    error?: any;
  }>;

  // Query thread status
  getThreadStatus(threadId: string): Promise<{
    status: string;
    messages?: any[];
    result?: any;
    error?: any;
  }>;

  // Cancel thread
  cancelThread(threadId: string): Promise<void>;
}

// ============================================================================
// 6. API ROUTES (Express)
// ============================================================================

export interface ApiRoutes {
  // Scheduler routes
  'POST /api/scheduler/schedules': {
    request: CreateScheduleRequest;
    response: TaskSchedule;
  };
  'GET /api/scheduler/schedules': {
    query: { enabled?: boolean };
    response: TaskSchedule[];
  };
  'GET /api/scheduler/schedules/:id': {
    params: { id: number };
    response: TaskSchedule;
  };
  'PUT /api/scheduler/schedules/:id': {
    params: { id: number };
    request: UpdateScheduleRequest;
    response: TaskSchedule;
  };
  'DELETE /api/scheduler/schedules/:id': {
    params: { id: number };
    response: { success: boolean };
  };
  'POST /api/scheduler/schedules/:id/trigger': {
    params: { id: number };
    response: { executionId: number };
  };
  'POST /api/scheduler/start': {
    response: { success: boolean };
  };
  'POST /api/scheduler/stop': {
    response: { success: boolean };
  };
  'GET /api/scheduler/status': {
    response: { running: boolean; lastTick?: Date };
  };

  // Execution routes
  'GET /api/execution/executions': {
    query: { scheduleId?: number; status?: ExecutionStatus; limit?: number; offset?: number };
    response: TaskExecution[];
  };
  'GET /api/execution/executions/:id': {
    params: { id: number };
    response: TaskExecution;
  };
  'POST /api/execution/executions/:id/cancel': {
    params: { id: number };
    response: { success: boolean };
  };

  // Error routes
  'GET /api/errors/errors': {
    query: { recoveryStatus?: RecoveryStatus; severity?: Severity; scheduleId?: number; limit?: number; offset?: number };
    response: ErrorRecord[];
  };
  'GET /api/errors/errors/:id': {
    params: { id: number };
    response: ErrorRecord;
  };
  'POST /api/errors/errors/:id/retry': {
    params: { id: number };
    response: { success: boolean };
  };
  'POST /api/errors/errors/:id/resolve': {
    params: { id: number };
    request: ResolveErrorRequest;
    response: { success: boolean };
  };
  'POST /api/errors/errors/:id/ignore': {
    params: { id: number };
    response: { success: boolean };
  };
  'POST /api/errors/errors/:id/escalate': {
    params: { id: number };
    response: { success: boolean };
  };
  'GET /api/errors/status': {
    response: { running: boolean; lastRun?: Date };
  };

  // WebSocket endpoint
  'WS /ws': {
    // WebSocket handshake, then bidirectional messages
  };
}

// ============================================================================
// 7. SERVICE DEPENDENCIES
// ============================================================================

export interface ServiceDependencies {
  scheduler: {
    requires: ['database', 'executionEngine'];
    providesTo: ['api', 'websocket'];
  };
  executionEngine: {
    requires: ['database', 'conductorClient', 'errorRecovery'];
    providesTo: ['scheduler', 'api'];
  };
  errorRecovery: {
    requires: ['database', 'executionEngine'];
    providesTo: ['executionEngine', 'websocket', 'api'];
  };
  websocket: {
    requires: ['database'];
    providesTo: ['frontend'];
  };
}
