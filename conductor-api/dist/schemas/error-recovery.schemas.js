/**
 * Error Recovery Service Zod Schemas
 * Runtime validation schemas for error recovery types
 */
import { z } from 'zod';
// Retry Policy Schemas
export const RetryStrategySchema = z.enum(['exponential', 'linear', 'fixed']);
export const RetryPolicySchema = z.object({
    maxRetries: z.number().int().min(1).max(10),
    initialDelayMs: z.number().int().min(100).max(60000),
    maxDelayMs: z.number().int().min(1000).max(300000),
    strategy: RetryStrategySchema,
    backoffMultiplier: z.number().min(1).max(10).optional(),
    retryableErrors: z.array(z.string()).optional(),
    nonRetryableErrors: z.array(z.string()).optional(),
}).refine((data) => data.maxDelayMs >= data.initialDelayMs, {
    message: 'maxDelayMs must be >= initialDelayMs',
    path: ['maxDelayMs'],
});
export const RetryAttemptSchema = z.object({
    id: z.string().uuid(),
    taskId: z.string(),
    attemptNumber: z.number().int().min(1),
    errorMessage: z.string(),
    retryAt: z.coerce.date(),
    status: z.enum(['pending', 'success', 'failed']),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
});
export const RetryConfigurationSchema = z.object({
    taskId: z.string(),
    policy: RetryPolicySchema,
    currentAttempt: z.number().int().min(0),
    nextRetryAt: z.coerce.date().nullable(),
    lastError: z.string().nullable(),
});
// Circuit Breaker Schemas
export const CircuitBreakerConfigSchema = z.object({
    failureThreshold: z.number().int().min(1).max(100),
    successThreshold: z.number().int().min(1).max(10),
    timeoutMs: z.number().int().min(1000).max(600000),
    monitoringWindowMs: z.number().int().min(60000).max(3600000),
});
export const CircuitBreakerStatusSchema = z.enum(['closed', 'open', 'half_open']);
export const CircuitBreakerStateSchema = z.object({
    id: z.string().uuid(),
    serviceName: z.string().min(1),
    state: CircuitBreakerStatusSchema,
    failureCount: z.number().int().min(0),
    lastFailureAt: z.coerce.date().nullable(),
    nextRetryAt: z.coerce.date().nullable(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
});
export const CircuitBreakerMetricsSchema = z.object({
    serviceName: z.string().min(1),
    totalRequests: z.number().int().min(0),
    successfulRequests: z.number().int().min(0),
    failedRequests: z.number().int().min(0),
    failureRate: z.number().min(0).max(1),
    state: CircuitBreakerStatusSchema,
    transitionedAt: z.coerce.date(),
});
export const CircuitBreakerEventSchema = z.object({
    serviceName: z.string().min(1),
    eventType: z.enum(['opened', 'closed', 'half_open', 'success', 'failure']),
    timestamp: z.coerce.date(),
    details: z.record(z.unknown()).optional(),
});
// DLQ Schemas
export const ErrorDetailsSchema = z.object({
    message: z.string(),
    stack: z.string().optional(),
    code: z.string().optional(),
    timestamp: z.coerce.date(),
    attempts: z.number().int().min(0),
});
export const DLQEntrySchema = z.object({
    id: z.string().uuid(),
    taskId: z.string(),
    taskDefinition: z.record(z.unknown()),
    errorDetails: ErrorDetailsSchema,
    retryCount: z.number().int().min(0),
    addedAt: z.coerce.date(),
    resolvedAt: z.coerce.date().nullable(),
    resolutionNotes: z.string().nullable(),
});
export const DLQResubmitRequestSchema = z.object({
    dlqId: z.string().uuid(),
    modifiedTaskDefinition: z.record(z.unknown()).optional(),
    reason: z.string().min(1).max(500),
});
export const DLQStatsSchema = z.object({
    totalEntries: z.number().int().min(0),
    unresolvedEntries: z.number().int().min(0),
    resolvedEntries: z.number().int().min(0),
    oldestEntryAge: z.number().int().min(0),
    averageRetryCount: z.number().min(0),
});
export const DLQFilterSchema = z.object({
    taskId: z.string().optional(),
    resolved: z.boolean().optional(),
    minRetryCount: z.number().int().min(0).optional(),
    maxRetryCount: z.number().int().min(0).optional(),
    addedAfter: z.coerce.date().optional(),
    addedBefore: z.coerce.date().optional(),
});
// Schedule Schemas
export const ScheduleFrequencySchema = z.enum(['hourly', 'daily', 'weekly', 'monthly', 'custom']);
export const ScheduleSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(255),
    cronExpression: z.string(),
    workflowId: z.string().min(1),
    enabled: z.boolean(),
    lastExecutionAt: z.coerce.date().nullable(),
    nextExecutionAt: z.coerce.date(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    timezone: z.string().optional(),
    description: z.string().max(1000).optional(),
});
export const ExecutionHistorySchema = z.object({
    id: z.string().uuid(),
    scheduleId: z.string().uuid(),
    startedAt: z.coerce.date(),
    completedAt: z.coerce.date().nullable(),
    status: z.enum(['running', 'success', 'failed']),
    errorMessage: z.string().nullable(),
    executionTimeMs: z.number().int().min(0),
    workflowExecutionId: z.string().optional(),
});
// Service Result Schemas
export const ServiceResultSchema = (dataSchema) => z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
    code: z.string().optional(),
    timestamp: z.coerce.date(),
});
// Error Recovery Config Schema
export const ErrorRecoveryConfigSchema = z.object({
    retryPolicy: RetryPolicySchema,
    circuitBreaker: CircuitBreakerConfigSchema,
    dlqRetentionDays: z.number().int().min(1).max(365),
    cleanupIntervalMs: z.number().int().min(60000).max(3600000),
});
//# sourceMappingURL=error-recovery.schemas.js.map