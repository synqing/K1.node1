/**
 * Schedule Executor Worker
 * Background worker that runs every 30 seconds to check and execute scheduled workflows
 */
import { IScheduleExecutor, ISchedulerService, ScheduleExecutorStats } from '../types/scheduler.types.js';
/**
 * Schedule executor implementation
 */
export declare class ScheduleExecutor implements IScheduleExecutor {
    private schedulerService;
    private webhookExecutor?;
    private isRunningFlag;
    private intervalId;
    private readonly EXECUTION_INTERVAL_MS;
    private totalExecutions;
    private successfulExecutions;
    private failedExecutions;
    private lastExecutionTime;
    private startTime;
    constructor(schedulerService: ISchedulerService, webhookExecutor?: ((workflowId: string) => Promise<void>) | undefined);
    /**
     * Start the executor
     */
    start(): Promise<void>;
    /**
     * Stop the executor
     */
    stop(): Promise<void>;
    /**
     * Check if executor is running
     */
    isRunning(): boolean;
    /**
     * Get executor statistics
     */
    getStats(): ScheduleExecutorStats;
    /**
     * Execute all schedules that are due
     */
    private executeSchedules;
    /**
     * Execute a specific schedule
     */
    private executeSchedule;
}
/**
 * Factory function to create schedule executor
 */
export declare function createScheduleExecutor(schedulerService: ISchedulerService, webhookExecutor?: (workflowId: string) => Promise<void>): IScheduleExecutor;
//# sourceMappingURL=schedule-executor.d.ts.map