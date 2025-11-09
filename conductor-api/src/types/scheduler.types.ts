/**
 * Scheduler Service - Type Definitions
 * Cron-based scheduling, execution tracking, and history management
 */

/**
 * Schedule status enum
 */
export enum ScheduleStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
}

/**
 * Schedule entity represents a cron-based scheduled workflow
 */
export interface Schedule {
  id: string;
  name: string;
  description?: string;
  workflowId: string;
  cronExpression: string;
  enabled: boolean;
  timezone?: string;
  nextExecutionTime?: Date;
  lastExecutionTime?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Execution history record for a scheduled workflow
 */
export interface ExecutionHistory {
  id: string;
  scheduleId: string;
  workflowId: string;
  status: ScheduleStatus;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  executionId?: string;
  error?: string;
  result?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Cron expression parser result
 */
export interface CronParseResult {
  valid: boolean;
  error?: string;
  nextExecutionTime?: Date;
  previousExecutionTime?: Date;
}

/**
 * Schedule creation request
 */
export interface CreateScheduleRequest {
  name: string;
  description?: string;
  workflowId: string;
  cronExpression: string;
  enabled?: boolean;
  timezone?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Schedule update request
 */
export interface UpdateScheduleRequest {
  name?: string;
  description?: string;
  cronExpression?: string;
  enabled?: boolean;
  timezone?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Schedule filter options
 */
export interface ScheduleFilterOptions {
  enabled?: boolean;
  workflowId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Execution history filter options
 */
export interface ExecutionHistoryFilterOptions {
  scheduleId?: string;
  status?: ScheduleStatus;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Scheduler service interface
 */
export interface ISchedulerService {
  createSchedule(request: CreateScheduleRequest): Promise<Schedule>;
  getSchedule(id: string): Promise<Schedule | null>;
  listSchedules(filter?: ScheduleFilterOptions): Promise<Schedule[]>;
  updateSchedule(id: string, request: UpdateScheduleRequest): Promise<Schedule>;
  deleteSchedule(id: string): Promise<void>;
  getExecutionHistory(
    scheduleId: string,
    filter?: ExecutionHistoryFilterOptions
  ): Promise<ExecutionHistory[]>;
  recordExecution(
    scheduleId: string,
    workflowId: string,
    status: ScheduleStatus,
    durationMs: number,
    error?: string,
    result?: Record<string, unknown>
  ): Promise<ExecutionHistory>;
}

/**
 * Schedule executor interface
 */
export interface IScheduleExecutor {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
  getStats(): ScheduleExecutorStats;
}

/**
 * Schedule executor stats
 */
export interface ScheduleExecutorStats {
  isRunning: boolean;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  lastExecutionTime?: Date;
  uptime?: number;
}
