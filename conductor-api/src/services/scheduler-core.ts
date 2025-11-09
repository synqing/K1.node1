/**
 * Scheduler Core Service
 * Manages schedule creation, retrieval, updates, deletion, and execution history
 */

import {
  Schedule,
  ExecutionHistory,
  CreateScheduleRequest,
  UpdateScheduleRequest,
  ScheduleFilterOptions,
  ExecutionHistoryFilterOptions,
  ISchedulerService,
  ScheduleStatus,
} from '../types/scheduler.types.js';
import { getNextExecutionTime, validateCronExpression } from '../utils/cron-parser.js';

/**
 * In-memory database for schedules and execution history
 * In production, this would be replaced with actual database calls
 */
class InMemoryScheduleStore {
  private schedules: Map<string, Schedule> = new Map();
  private executionHistories: Map<string, ExecutionHistory[]> = new Map();

  getSchedule(id: string): Schedule | null {
    return this.schedules.get(id) || null;
  }

  listSchedules(): Schedule[] {
    return Array.from(this.schedules.values());
  }

  saveSchedule(schedule: Schedule): void {
    this.schedules.set(schedule.id, { ...schedule });
  }

  deleteSchedule(id: string): void {
    this.schedules.delete(id);
    this.executionHistories.delete(id);
  }

  getExecutionHistories(scheduleId: string): ExecutionHistory[] {
    return this.executionHistories.get(scheduleId) || [];
  }

  addExecutionHistory(scheduleId: string, history: ExecutionHistory): void {
    const histories = this.executionHistories.get(scheduleId) || [];
    histories.push(history);
    this.executionHistories.set(scheduleId, histories);
  }
}

/**
 * Scheduler Core Service Implementation
 */
export class SchedulerCoreService implements ISchedulerService {
  private store: InMemoryScheduleStore;

  constructor() {
    this.store = new InMemoryScheduleStore();
  }

  /**
   * Create a new schedule
   */
  async createSchedule(request: CreateScheduleRequest): Promise<Schedule> {
    // Validate cron expression
    const cronValidation = validateCronExpression(request.cronExpression);

    if (!cronValidation.valid) {
      throw new Error(`Invalid cron expression: ${cronValidation.error}`);
    }

    // Calculate next execution time
    const nextExecutionTime = getNextExecutionTime(request.cronExpression);

    if (!nextExecutionTime) {
      throw new Error('Unable to calculate next execution time');
    }

    const schedule: Schedule = {
      id: this.generateId(),
      name: request.name,
      description: request.description,
      workflowId: request.workflowId,
      cronExpression: request.cronExpression,
      enabled: request.enabled !== false,
      timezone: request.timezone || 'UTC',
      nextExecutionTime,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: request.metadata,
    };

    this.store.saveSchedule(schedule);

    return schedule;
  }

  /**
   * Get a schedule by ID
   */
  async getSchedule(id: string): Promise<Schedule | null> {
    return this.store.getSchedule(id);
  }

  /**
   * List all schedules with optional filtering
   */
  async listSchedules(filter?: ScheduleFilterOptions): Promise<Schedule[]> {
    let schedules = this.store.listSchedules();

    if (filter?.enabled !== undefined) {
      schedules = schedules.filter((s) => s.enabled === filter.enabled);
    }

    if (filter?.workflowId) {
      schedules = schedules.filter((s) => s.workflowId === filter.workflowId);
    }

    // Apply pagination
    const offset = filter?.offset || 0;
    const limit = filter?.limit || 100;

    return schedules.slice(offset, offset + limit);
  }

  /**
   * Update a schedule
   */
  async updateSchedule(id: string, request: UpdateScheduleRequest): Promise<Schedule> {
    const schedule = this.store.getSchedule(id);

    if (!schedule) {
      throw new Error(`Schedule not found: ${id}`);
    }

    // Validate new cron expression if provided
    if (request.cronExpression && request.cronExpression !== schedule.cronExpression) {
      const cronValidation = validateCronExpression(request.cronExpression);

      if (!cronValidation.valid) {
        throw new Error(`Invalid cron expression: ${cronValidation.error}`);
      }

      schedule.cronExpression = request.cronExpression;
      schedule.nextExecutionTime = getNextExecutionTime(request.cronExpression) || undefined;
    }

    // Update other fields
    if (request.name !== undefined) {
      schedule.name = request.name;
    }

    if (request.description !== undefined) {
      schedule.description = request.description;
    }

    if (request.enabled !== undefined) {
      schedule.enabled = request.enabled;
    }

    if (request.timezone !== undefined) {
      schedule.timezone = request.timezone;
    }

    if (request.metadata !== undefined) {
      schedule.metadata = request.metadata;
    }

    schedule.updatedAt = new Date();

    this.store.saveSchedule(schedule);

    return schedule;
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(id: string): Promise<void> {
    const schedule = this.store.getSchedule(id);

    if (!schedule) {
      throw new Error(`Schedule not found: ${id}`);
    }

    this.store.deleteSchedule(id);
  }

  /**
   * Get execution history for a schedule
   */
  async getExecutionHistory(
    scheduleId: string,
    filter?: ExecutionHistoryFilterOptions
  ): Promise<ExecutionHistory[]> {
    const schedule = this.store.getSchedule(scheduleId);

    if (!schedule) {
      throw new Error(`Schedule not found: ${scheduleId}`);
    }

    let histories = this.store.getExecutionHistories(scheduleId);

    // Apply filters
    if (filter?.status) {
      histories = histories.filter((h) => h.status === filter.status);
    }

    if (filter?.startDate) {
      histories = histories.filter((h) => h.startedAt >= filter.startDate!);
    }

    if (filter?.endDate) {
      histories = histories.filter((h) => h.startedAt <= filter.endDate!);
    }

    // Sort by startedAt descending (newest first)
    histories.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    // Apply pagination
    const offset = filter?.offset || 0;
    const limit = filter?.limit || 100;

    return histories.slice(offset, offset + limit);
  }

  /**
   * Record an execution in history
   */
  async recordExecution(
    scheduleId: string,
    workflowId: string,
    status: ScheduleStatus,
    durationMs: number,
    error?: string,
    result?: Record<string, unknown>
  ): Promise<ExecutionHistory> {
    const schedule = this.store.getSchedule(scheduleId);

    if (!schedule) {
      throw new Error(`Schedule not found: ${scheduleId}`);
    }

    const now = new Date();
    const startedAt = new Date(now.getTime() - durationMs);

    const history: ExecutionHistory = {
      id: this.generateId(),
      scheduleId,
      workflowId,
      status,
      startedAt,
      completedAt: now,
      durationMs,
      error,
      result,
    };

    this.store.addExecutionHistory(scheduleId, history);

    // Update schedule's lastExecutionTime
    schedule.lastExecutionTime = startedAt;

    // Recalculate nextExecutionTime
    if (schedule.enabled) {
      schedule.nextExecutionTime = getNextExecutionTime(
        schedule.cronExpression,
        now
      ) || undefined;
    }

    this.store.saveSchedule(schedule);

    return history;
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Factory function to create scheduler service instance
 */
export function createSchedulerService(): ISchedulerService {
  return new SchedulerCoreService();
}
