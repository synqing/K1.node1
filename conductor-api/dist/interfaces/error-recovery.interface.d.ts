/**
 * Error Recovery Service Interface
 * Defines service contracts for error recovery functionality
 */
import type { RetryPolicy, RetryAttempt, CircuitBreakerState, CircuitBreakerConfig, DLQEntry, DLQStats, DLQFilter, ServiceResult, Schedule, ExecutionHistory } from '../types/error-recovery.types';
/**
 * Retry Management Service Interface
 */
export interface IRetryService {
    /**
     * Initiate a retry for a failed task
     */
    retryTask(taskId: string, policy: RetryPolicy): Promise<ServiceResult<RetryAttempt>>;
    /**
     * Get all retry attempts for a specific task
     */
    getRetryAttempts(taskId: string): Promise<ServiceResult<RetryAttempt[]>>;
    /**
     * Get a single retry attempt by ID
     */
    getRetryAttempt(attemptId: string): Promise<ServiceResult<RetryAttempt>>;
    /**
     * Cancel all pending retries for a task
     */
    cancelRetry(taskId: string): Promise<ServiceResult<void>>;
    /**
     * Cancel a specific retry attempt
     */
    cancelRetryAttempt(attemptId: string): Promise<ServiceResult<void>>;
    /**
     * Update retry policy for a task
     */
    updateRetryPolicy(taskId: string, policy: Partial<RetryPolicy>): Promise<ServiceResult<void>>;
}
/**
 * Circuit Breaker Service Interface
 */
export interface ICircuitBreakerService {
    /**
     * Record a failure for a service
     */
    recordFailure(serviceName: string, error?: Error): Promise<ServiceResult<CircuitBreakerState>>;
    /**
     * Record a success for a service
     */
    recordSuccess(serviceName: string): Promise<ServiceResult<CircuitBreakerState>>;
    /**
     * Get current circuit breaker state for a service
     */
    getCircuitBreakerState(serviceName: string): Promise<ServiceResult<CircuitBreakerState>>;
    /**
     * Initialize circuit breaker for a service
     */
    initializeCircuitBreaker(serviceName: string, config: CircuitBreakerConfig): Promise<ServiceResult<CircuitBreakerState>>;
    /**
     * Reset circuit breaker to closed state
     */
    resetCircuitBreaker(serviceName: string): Promise<ServiceResult<void>>;
    /**
     * Update circuit breaker configuration
     */
    updateCircuitBreakerConfig(serviceName: string, config: Partial<CircuitBreakerConfig>): Promise<ServiceResult<void>>;
    /**
     * Check if service is available (circuit closed or half-open)
     */
    isServiceAvailable(serviceName: string): Promise<boolean>;
    /**
     * Get all circuit breaker states
     */
    getAllCircuitBreakerStates(): Promise<ServiceResult<CircuitBreakerState[]>>;
}
/**
 * Dead Letter Queue Service Interface
 */
export interface IDLQService {
    /**
     * Add an entry to the dead letter queue
     */
    addToDLQ(taskId: string, taskDefinition: Record<string, unknown>, error: Error): Promise<ServiceResult<DLQEntry>>;
    /**
     * Get DLQ entries with optional filtering and pagination
     */
    getDLQEntries(filter?: DLQFilter, limit?: number, offset?: number): Promise<ServiceResult<DLQEntry[]>>;
    /**
     * Get a specific DLQ entry by ID
     */
    getDLQEntry(dlqId: string): Promise<ServiceResult<DLQEntry>>;
    /**
     * Resubmit a task from the DLQ
     */
    resubmitFromDLQ(dlqId: string, reason: string, newDefinition?: Record<string, unknown>): Promise<ServiceResult<void>>;
    /**
     * Resolve a DLQ entry with notes
     */
    resolveDLQEntry(dlqId: string, notes: string): Promise<ServiceResult<void>>;
    /**
     * Get DLQ statistics
     */
    getDLQStats(): Promise<ServiceResult<DLQStats>>;
    /**
     * Batch resolve DLQ entries
     */
    batchResolveDLQ(dlqIds: string[], notes: string): Promise<ServiceResult<number>>;
    /**
     * Cleanup old DLQ entries
     */
    cleanupDLQ(retentionDays: number): Promise<ServiceResult<{
        deleted: number;
    }>>;
}
/**
 * Scheduler Service Interface
 */
export interface ISchedulerService {
    /**
     * Create a new schedule
     */
    createSchedule(name: string, cronExpression: string, workflowId: string, enabled?: boolean, timezone?: string, description?: string): Promise<ServiceResult<Schedule>>;
    /**
     * Get a schedule by ID
     */
    getSchedule(scheduleId: string): Promise<ServiceResult<Schedule>>;
    /**
     * Get all schedules
     */
    getAllSchedules(enabledOnly?: boolean): Promise<ServiceResult<Schedule[]>>;
    /**
     * Update a schedule
     */
    updateSchedule(scheduleId: string, updates: Partial<Schedule>): Promise<ServiceResult<Schedule>>;
    /**
     * Delete a schedule
     */
    deleteSchedule(scheduleId: string): Promise<ServiceResult<void>>;
    /**
     * Enable/disable a schedule
     */
    setScheduleEnabled(scheduleId: string, enabled: boolean): Promise<ServiceResult<void>>;
    /**
     * Get execution history for a schedule
     */
    getExecutionHistory(scheduleId: string, limit?: number, offset?: number): Promise<ServiceResult<ExecutionHistory[]>>;
    /**
     * Get a specific execution history entry
     */
    getExecutionHistoryEntry(executionId: string): Promise<ServiceResult<ExecutionHistory>>;
    /**
     * Trigger manual execution of a schedule
     */
    triggerScheduleExecution(scheduleId: string): Promise<ServiceResult<ExecutionHistory>>;
    /**
     * Get next scheduled execution time
     */
    getNextExecutionTime(scheduleId: string): Promise<ServiceResult<Date>>;
    /**
     * Cleanup old execution history
     */
    cleanupExecutionHistory(retentionDays: number): Promise<ServiceResult<{
        deleted: number;
    }>>;
}
/**
 * Main Error Recovery Service Interface
 * Aggregates all sub-services
 */
export interface IErrorRecoveryService extends IRetryService, ICircuitBreakerService, IDLQService, ISchedulerService {
    /**
     * Get overall health status
     */
    getHealthStatus(): Promise<ServiceResult<{
        retryService: boolean;
        circuitBreaker: boolean;
        dlq: boolean;
        scheduler: boolean;
    }>>;
    /**
     * Cleanup all retained data older than specified days
     */
    cleanup(retentionDays: number): Promise<ServiceResult<{
        deleted: number;
    }>>;
}
//# sourceMappingURL=error-recovery.interface.d.ts.map