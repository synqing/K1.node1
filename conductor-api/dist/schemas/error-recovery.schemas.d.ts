/**
 * Error Recovery Service Zod Schemas
 * Runtime validation schemas for error recovery types
 */
import { z } from 'zod';
export declare const RetryStrategySchema: z.ZodEnum<["exponential", "linear", "fixed"]>;
export declare const RetryPolicySchema: z.ZodEffects<z.ZodObject<{
    maxRetries: z.ZodNumber;
    initialDelayMs: z.ZodNumber;
    maxDelayMs: z.ZodNumber;
    strategy: z.ZodEnum<["exponential", "linear", "fixed"]>;
    backoffMultiplier: z.ZodOptional<z.ZodNumber>;
    retryableErrors: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    nonRetryableErrors: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    strategy: "exponential" | "linear" | "fixed";
    backoffMultiplier?: number | undefined;
    retryableErrors?: string[] | undefined;
    nonRetryableErrors?: string[] | undefined;
}, {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    strategy: "exponential" | "linear" | "fixed";
    backoffMultiplier?: number | undefined;
    retryableErrors?: string[] | undefined;
    nonRetryableErrors?: string[] | undefined;
}>, {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    strategy: "exponential" | "linear" | "fixed";
    backoffMultiplier?: number | undefined;
    retryableErrors?: string[] | undefined;
    nonRetryableErrors?: string[] | undefined;
}, {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    strategy: "exponential" | "linear" | "fixed";
    backoffMultiplier?: number | undefined;
    retryableErrors?: string[] | undefined;
    nonRetryableErrors?: string[] | undefined;
}>;
export declare const RetryAttemptSchema: z.ZodObject<{
    id: z.ZodString;
    taskId: z.ZodString;
    attemptNumber: z.ZodNumber;
    errorMessage: z.ZodString;
    retryAt: z.ZodDate;
    status: z.ZodEnum<["pending", "success", "failed"]>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    status: "success" | "pending" | "failed";
    id: string;
    taskId: string;
    attemptNumber: number;
    errorMessage: string;
    retryAt: Date;
    createdAt: Date;
    updatedAt: Date;
}, {
    status: "success" | "pending" | "failed";
    id: string;
    taskId: string;
    attemptNumber: number;
    errorMessage: string;
    retryAt: Date;
    createdAt: Date;
    updatedAt: Date;
}>;
export declare const RetryConfigurationSchema: z.ZodObject<{
    taskId: z.ZodString;
    policy: z.ZodEffects<z.ZodObject<{
        maxRetries: z.ZodNumber;
        initialDelayMs: z.ZodNumber;
        maxDelayMs: z.ZodNumber;
        strategy: z.ZodEnum<["exponential", "linear", "fixed"]>;
        backoffMultiplier: z.ZodOptional<z.ZodNumber>;
        retryableErrors: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        nonRetryableErrors: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        maxRetries: number;
        initialDelayMs: number;
        maxDelayMs: number;
        strategy: "exponential" | "linear" | "fixed";
        backoffMultiplier?: number | undefined;
        retryableErrors?: string[] | undefined;
        nonRetryableErrors?: string[] | undefined;
    }, {
        maxRetries: number;
        initialDelayMs: number;
        maxDelayMs: number;
        strategy: "exponential" | "linear" | "fixed";
        backoffMultiplier?: number | undefined;
        retryableErrors?: string[] | undefined;
        nonRetryableErrors?: string[] | undefined;
    }>, {
        maxRetries: number;
        initialDelayMs: number;
        maxDelayMs: number;
        strategy: "exponential" | "linear" | "fixed";
        backoffMultiplier?: number | undefined;
        retryableErrors?: string[] | undefined;
        nonRetryableErrors?: string[] | undefined;
    }, {
        maxRetries: number;
        initialDelayMs: number;
        maxDelayMs: number;
        strategy: "exponential" | "linear" | "fixed";
        backoffMultiplier?: number | undefined;
        retryableErrors?: string[] | undefined;
        nonRetryableErrors?: string[] | undefined;
    }>;
    currentAttempt: z.ZodNumber;
    nextRetryAt: z.ZodNullable<z.ZodDate>;
    lastError: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    taskId: string;
    policy: {
        maxRetries: number;
        initialDelayMs: number;
        maxDelayMs: number;
        strategy: "exponential" | "linear" | "fixed";
        backoffMultiplier?: number | undefined;
        retryableErrors?: string[] | undefined;
        nonRetryableErrors?: string[] | undefined;
    };
    currentAttempt: number;
    nextRetryAt: Date | null;
    lastError: string | null;
}, {
    taskId: string;
    policy: {
        maxRetries: number;
        initialDelayMs: number;
        maxDelayMs: number;
        strategy: "exponential" | "linear" | "fixed";
        backoffMultiplier?: number | undefined;
        retryableErrors?: string[] | undefined;
        nonRetryableErrors?: string[] | undefined;
    };
    currentAttempt: number;
    nextRetryAt: Date | null;
    lastError: string | null;
}>;
export declare const CircuitBreakerConfigSchema: z.ZodObject<{
    failureThreshold: z.ZodNumber;
    successThreshold: z.ZodNumber;
    timeoutMs: z.ZodNumber;
    monitoringWindowMs: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    failureThreshold: number;
    successThreshold: number;
    timeoutMs: number;
    monitoringWindowMs: number;
}, {
    failureThreshold: number;
    successThreshold: number;
    timeoutMs: number;
    monitoringWindowMs: number;
}>;
export declare const CircuitBreakerStatusSchema: z.ZodEnum<["closed", "open", "half_open"]>;
export declare const CircuitBreakerStateSchema: z.ZodObject<{
    id: z.ZodString;
    serviceName: z.ZodString;
    state: z.ZodEnum<["closed", "open", "half_open"]>;
    failureCount: z.ZodNumber;
    lastFailureAt: z.ZodNullable<z.ZodDate>;
    nextRetryAt: z.ZodNullable<z.ZodDate>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    nextRetryAt: Date | null;
    serviceName: string;
    state: "closed" | "open" | "half_open";
    failureCount: number;
    lastFailureAt: Date | null;
}, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    nextRetryAt: Date | null;
    serviceName: string;
    state: "closed" | "open" | "half_open";
    failureCount: number;
    lastFailureAt: Date | null;
}>;
export declare const CircuitBreakerMetricsSchema: z.ZodObject<{
    serviceName: z.ZodString;
    totalRequests: z.ZodNumber;
    successfulRequests: z.ZodNumber;
    failedRequests: z.ZodNumber;
    failureRate: z.ZodNumber;
    state: z.ZodEnum<["closed", "open", "half_open"]>;
    transitionedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    serviceName: string;
    state: "closed" | "open" | "half_open";
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    failureRate: number;
    transitionedAt: Date;
}, {
    serviceName: string;
    state: "closed" | "open" | "half_open";
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    failureRate: number;
    transitionedAt: Date;
}>;
export declare const CircuitBreakerEventSchema: z.ZodObject<{
    serviceName: z.ZodString;
    eventType: z.ZodEnum<["opened", "closed", "half_open", "success", "failure"]>;
    timestamp: z.ZodDate;
    details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    serviceName: string;
    eventType: "closed" | "half_open" | "opened" | "success" | "failure";
    timestamp: Date;
    details?: Record<string, unknown> | undefined;
}, {
    serviceName: string;
    eventType: "closed" | "half_open" | "opened" | "success" | "failure";
    timestamp: Date;
    details?: Record<string, unknown> | undefined;
}>;
export declare const ErrorDetailsSchema: z.ZodObject<{
    message: z.ZodString;
    stack: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodDate;
    attempts: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    message: string;
    timestamp: Date;
    attempts: number;
    code?: string | undefined;
    stack?: string | undefined;
}, {
    message: string;
    timestamp: Date;
    attempts: number;
    code?: string | undefined;
    stack?: string | undefined;
}>;
export declare const DLQEntrySchema: z.ZodObject<{
    id: z.ZodString;
    taskId: z.ZodString;
    taskDefinition: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    errorDetails: z.ZodObject<{
        message: z.ZodString;
        stack: z.ZodOptional<z.ZodString>;
        code: z.ZodOptional<z.ZodString>;
        timestamp: z.ZodDate;
        attempts: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        message: string;
        timestamp: Date;
        attempts: number;
        code?: string | undefined;
        stack?: string | undefined;
    }, {
        message: string;
        timestamp: Date;
        attempts: number;
        code?: string | undefined;
        stack?: string | undefined;
    }>;
    retryCount: z.ZodNumber;
    addedAt: z.ZodDate;
    resolvedAt: z.ZodNullable<z.ZodDate>;
    resolutionNotes: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    taskId: string;
    taskDefinition: Record<string, unknown>;
    errorDetails: {
        message: string;
        timestamp: Date;
        attempts: number;
        code?: string | undefined;
        stack?: string | undefined;
    };
    retryCount: number;
    addedAt: Date;
    resolvedAt: Date | null;
    resolutionNotes: string | null;
}, {
    id: string;
    taskId: string;
    taskDefinition: Record<string, unknown>;
    errorDetails: {
        message: string;
        timestamp: Date;
        attempts: number;
        code?: string | undefined;
        stack?: string | undefined;
    };
    retryCount: number;
    addedAt: Date;
    resolvedAt: Date | null;
    resolutionNotes: string | null;
}>;
export declare const DLQResubmitRequestSchema: z.ZodObject<{
    dlqId: z.ZodString;
    modifiedTaskDefinition: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    dlqId: string;
    reason: string;
    modifiedTaskDefinition?: Record<string, unknown> | undefined;
}, {
    dlqId: string;
    reason: string;
    modifiedTaskDefinition?: Record<string, unknown> | undefined;
}>;
export declare const DLQStatsSchema: z.ZodObject<{
    totalEntries: z.ZodNumber;
    unresolvedEntries: z.ZodNumber;
    resolvedEntries: z.ZodNumber;
    oldestEntryAge: z.ZodNumber;
    averageRetryCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    totalEntries: number;
    unresolvedEntries: number;
    resolvedEntries: number;
    oldestEntryAge: number;
    averageRetryCount: number;
}, {
    totalEntries: number;
    unresolvedEntries: number;
    resolvedEntries: number;
    oldestEntryAge: number;
    averageRetryCount: number;
}>;
export declare const DLQFilterSchema: z.ZodObject<{
    taskId: z.ZodOptional<z.ZodString>;
    resolved: z.ZodOptional<z.ZodBoolean>;
    minRetryCount: z.ZodOptional<z.ZodNumber>;
    maxRetryCount: z.ZodOptional<z.ZodNumber>;
    addedAfter: z.ZodOptional<z.ZodDate>;
    addedBefore: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    taskId?: string | undefined;
    resolved?: boolean | undefined;
    minRetryCount?: number | undefined;
    maxRetryCount?: number | undefined;
    addedAfter?: Date | undefined;
    addedBefore?: Date | undefined;
}, {
    taskId?: string | undefined;
    resolved?: boolean | undefined;
    minRetryCount?: number | undefined;
    maxRetryCount?: number | undefined;
    addedAfter?: Date | undefined;
    addedBefore?: Date | undefined;
}>;
export declare const ScheduleFrequencySchema: z.ZodEnum<["hourly", "daily", "weekly", "monthly", "custom"]>;
export declare const ScheduleSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    cronExpression: z.ZodString;
    workflowId: z.ZodString;
    enabled: z.ZodBoolean;
    lastExecutionAt: z.ZodNullable<z.ZodDate>;
    nextExecutionAt: z.ZodDate;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
    timezone: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    name: string;
    cronExpression: string;
    workflowId: string;
    enabled: boolean;
    lastExecutionAt: Date | null;
    nextExecutionAt: Date;
    timezone?: string | undefined;
    description?: string | undefined;
}, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    name: string;
    cronExpression: string;
    workflowId: string;
    enabled: boolean;
    lastExecutionAt: Date | null;
    nextExecutionAt: Date;
    timezone?: string | undefined;
    description?: string | undefined;
}>;
export declare const ExecutionHistorySchema: z.ZodObject<{
    id: z.ZodString;
    scheduleId: z.ZodString;
    startedAt: z.ZodDate;
    completedAt: z.ZodNullable<z.ZodDate>;
    status: z.ZodEnum<["running", "success", "failed"]>;
    errorMessage: z.ZodNullable<z.ZodString>;
    executionTimeMs: z.ZodNumber;
    workflowExecutionId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "success" | "failed" | "running";
    id: string;
    errorMessage: string | null;
    scheduleId: string;
    startedAt: Date;
    completedAt: Date | null;
    executionTimeMs: number;
    workflowExecutionId?: string | undefined;
}, {
    status: "success" | "failed" | "running";
    id: string;
    errorMessage: string | null;
    scheduleId: string;
    startedAt: Date;
    completedAt: Date | null;
    executionTimeMs: number;
    workflowExecutionId?: string | undefined;
}>;
export declare const ServiceResultSchema: <T extends z.ZodTypeAny>(dataSchema: T) => z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodOptional<T>;
    error: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, z.objectUtil.addQuestionMarks<z.baseObjectOutputType<{
    success: z.ZodBoolean;
    data: z.ZodOptional<T>;
    error: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodDate;
}>, any> extends infer T_1 ? { [k in keyof T_1]: T_1[k]; } : never, z.baseObjectInputType<{
    success: z.ZodBoolean;
    data: z.ZodOptional<T>;
    error: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodDate;
}> extends infer T_2 ? { [k_1 in keyof T_2]: T_2[k_1]; } : never>;
export declare const ErrorRecoveryConfigSchema: z.ZodObject<{
    retryPolicy: z.ZodEffects<z.ZodObject<{
        maxRetries: z.ZodNumber;
        initialDelayMs: z.ZodNumber;
        maxDelayMs: z.ZodNumber;
        strategy: z.ZodEnum<["exponential", "linear", "fixed"]>;
        backoffMultiplier: z.ZodOptional<z.ZodNumber>;
        retryableErrors: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        nonRetryableErrors: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        maxRetries: number;
        initialDelayMs: number;
        maxDelayMs: number;
        strategy: "exponential" | "linear" | "fixed";
        backoffMultiplier?: number | undefined;
        retryableErrors?: string[] | undefined;
        nonRetryableErrors?: string[] | undefined;
    }, {
        maxRetries: number;
        initialDelayMs: number;
        maxDelayMs: number;
        strategy: "exponential" | "linear" | "fixed";
        backoffMultiplier?: number | undefined;
        retryableErrors?: string[] | undefined;
        nonRetryableErrors?: string[] | undefined;
    }>, {
        maxRetries: number;
        initialDelayMs: number;
        maxDelayMs: number;
        strategy: "exponential" | "linear" | "fixed";
        backoffMultiplier?: number | undefined;
        retryableErrors?: string[] | undefined;
        nonRetryableErrors?: string[] | undefined;
    }, {
        maxRetries: number;
        initialDelayMs: number;
        maxDelayMs: number;
        strategy: "exponential" | "linear" | "fixed";
        backoffMultiplier?: number | undefined;
        retryableErrors?: string[] | undefined;
        nonRetryableErrors?: string[] | undefined;
    }>;
    circuitBreaker: z.ZodObject<{
        failureThreshold: z.ZodNumber;
        successThreshold: z.ZodNumber;
        timeoutMs: z.ZodNumber;
        monitoringWindowMs: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        failureThreshold: number;
        successThreshold: number;
        timeoutMs: number;
        monitoringWindowMs: number;
    }, {
        failureThreshold: number;
        successThreshold: number;
        timeoutMs: number;
        monitoringWindowMs: number;
    }>;
    dlqRetentionDays: z.ZodNumber;
    cleanupIntervalMs: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    retryPolicy: {
        maxRetries: number;
        initialDelayMs: number;
        maxDelayMs: number;
        strategy: "exponential" | "linear" | "fixed";
        backoffMultiplier?: number | undefined;
        retryableErrors?: string[] | undefined;
        nonRetryableErrors?: string[] | undefined;
    };
    circuitBreaker: {
        failureThreshold: number;
        successThreshold: number;
        timeoutMs: number;
        monitoringWindowMs: number;
    };
    dlqRetentionDays: number;
    cleanupIntervalMs: number;
}, {
    retryPolicy: {
        maxRetries: number;
        initialDelayMs: number;
        maxDelayMs: number;
        strategy: "exponential" | "linear" | "fixed";
        backoffMultiplier?: number | undefined;
        retryableErrors?: string[] | undefined;
        nonRetryableErrors?: string[] | undefined;
    };
    circuitBreaker: {
        failureThreshold: number;
        successThreshold: number;
        timeoutMs: number;
        monitoringWindowMs: number;
    };
    dlqRetentionDays: number;
    cleanupIntervalMs: number;
}>;
//# sourceMappingURL=error-recovery.schemas.d.ts.map