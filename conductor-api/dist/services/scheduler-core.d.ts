/**
 * Scheduler Core Service
 * Manages schedule creation, retrieval, updates, deletion, and execution history
 */
import { Schedule, ExecutionHistory, CreateScheduleRequest, UpdateScheduleRequest, ScheduleFilterOptions, ExecutionHistoryFilterOptions, ISchedulerService, ScheduleStatus } from '../types/scheduler.types.js';
/**
 * Scheduler Core Service Implementation
 */
export declare class SchedulerCoreService implements ISchedulerService {
    private store;
    constructor();
    /**
     * Create a new schedule
     */
    createSchedule(request: CreateScheduleRequest): Promise<Schedule>;
    /**
     * Get a schedule by ID
     */
    getSchedule(id: string): Promise<Schedule | null>;
    /**
     * List all schedules with optional filtering
     */
    listSchedules(filter?: ScheduleFilterOptions): Promise<Schedule[]>;
    /**
     * Update a schedule
     */
    updateSchedule(id: string, request: UpdateScheduleRequest): Promise<Schedule>;
    /**
     * Delete a schedule
     */
    deleteSchedule(id: string): Promise<void>;
    /**
     * Get execution history for a schedule
     */
    getExecutionHistory(scheduleId: string, filter?: ExecutionHistoryFilterOptions): Promise<ExecutionHistory[]>;
    /**
     * Record an execution in history
     */
    recordExecution(scheduleId: string, workflowId: string, status: ScheduleStatus, durationMs: number, error?: string, result?: Record<string, unknown>): Promise<ExecutionHistory>;
    /**
     * Generate a unique ID
     */
    private generateId;
}
/**
 * Factory function to create scheduler service instance
 */
export declare function createSchedulerService(): ISchedulerService;
//# sourceMappingURL=scheduler-core.d.ts.map