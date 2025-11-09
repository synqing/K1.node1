/**
 * Schedule Executor Worker
 * Background worker that runs every 30 seconds to check and execute scheduled workflows
 */
import { ScheduleStatus, } from '../types/scheduler.types.js';
/**
 * Schedule executor implementation
 */
export class ScheduleExecutor {
    constructor(schedulerService, webhookExecutor) {
        this.schedulerService = schedulerService;
        this.webhookExecutor = webhookExecutor;
        this.isRunningFlag = false;
        this.intervalId = null;
        this.EXECUTION_INTERVAL_MS = 30000; // 30 seconds
        this.totalExecutions = 0;
        this.successfulExecutions = 0;
        this.failedExecutions = 0;
        this.lastExecutionTime = null;
        this.startTime = null;
    }
    /**
     * Start the executor
     */
    async start() {
        if (this.isRunningFlag) {
            console.log('Schedule executor is already running');
            return;
        }
        this.isRunningFlag = true;
        this.startTime = new Date();
        console.log('Starting schedule executor worker (interval: 30s)');
        // Execute immediately on start
        await this.executeSchedules();
        // Set up interval
        this.intervalId = setInterval(async () => {
            try {
                await this.executeSchedules();
            }
            catch (error) {
                console.error('Error in schedule executor interval:', error);
            }
        }, this.EXECUTION_INTERVAL_MS);
    }
    /**
     * Stop the executor
     */
    async stop() {
        if (!this.isRunningFlag) {
            console.log('Schedule executor is not running');
            return;
        }
        this.isRunningFlag = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        console.log('Schedule executor worker stopped');
    }
    /**
     * Check if executor is running
     */
    isRunning() {
        return this.isRunningFlag;
    }
    /**
     * Get executor statistics
     */
    getStats() {
        return {
            isRunning: this.isRunningFlag,
            totalExecutions: this.totalExecutions,
            successfulExecutions: this.successfulExecutions,
            failedExecutions: this.failedExecutions,
            lastExecutionTime: this.lastExecutionTime || undefined,
            uptime: this.startTime ? Date.now() - this.startTime.getTime() : undefined,
        };
    }
    /**
     * Execute all schedules that are due
     */
    async executeSchedules() {
        try {
            const now = new Date();
            // Get all enabled schedules
            const schedules = await this.schedulerService.listSchedules({ enabled: true });
            for (const schedule of schedules) {
                // Check if schedule is due for execution
                if (schedule.nextExecutionTime && schedule.nextExecutionTime <= now) {
                    await this.executeSchedule(schedule.id, schedule.workflowId);
                }
            }
            this.lastExecutionTime = new Date();
        }
        catch (error) {
            console.error('Error executing schedules:', error);
        }
    }
    /**
     * Execute a specific schedule
     */
    async executeSchedule(scheduleId, workflowId) {
        const executionStartTime = Date.now();
        try {
            // Execute the workflow
            if (this.webhookExecutor) {
                await this.webhookExecutor(workflowId);
            }
            else {
                // Default: call workflow endpoint (would be HTTP in production)
                console.log(`Would execute workflow: ${workflowId}`);
            }
            // Record successful execution
            const durationMs = Date.now() - executionStartTime;
            await this.schedulerService.recordExecution(scheduleId, workflowId, ScheduleStatus.SUCCESS, durationMs, undefined, { executedAt: new Date().toISOString() });
            this.totalExecutions++;
            this.successfulExecutions++;
            console.log(`Successfully executed schedule ${scheduleId} (duration: ${durationMs}ms)`);
        }
        catch (error) {
            // Record failed execution
            const durationMs = Date.now() - executionStartTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await this.schedulerService.recordExecution(scheduleId, workflowId, ScheduleStatus.FAILED, durationMs, errorMessage);
            this.totalExecutions++;
            this.failedExecutions++;
            console.error(`Failed to execute schedule ${scheduleId}: ${errorMessage} (duration: ${durationMs}ms)`);
        }
    }
}
/**
 * Factory function to create schedule executor
 */
export function createScheduleExecutor(schedulerService, webhookExecutor) {
    return new ScheduleExecutor(schedulerService, webhookExecutor);
}
//# sourceMappingURL=schedule-executor.js.map