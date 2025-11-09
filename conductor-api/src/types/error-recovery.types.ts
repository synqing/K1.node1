/**
 * Error Recovery Service Types
 * Core types and interfaces for error recovery functionality
 */

import type { RetryPolicy, RetryAttempt, RetryConfiguration } from './retry-policy.types';
import type { CircuitBreakerConfig, CircuitBreakerState, CircuitBreakerStatus } from './circuit-breaker.types';
import type { DLQEntry, DLQResubmitRequest, DLQStats, DLQFilter, ErrorDetails } from './dlq.types';

export type ServiceResultStatus = 'success' | 'error';

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  timestamp: Date;
}

export type ScheduleFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';

export interface Schedule {
  id: string;
  name: string;
  cronExpression: string;
  workflowId: string;
  enabled: boolean;
  lastExecutionAt: Date | null;
  nextExecutionAt: Date;
  createdAt: Date;
  updatedAt: Date;
  timezone?: string;
  description?: string;
}

export interface ExecutionHistory {
  id: string;
  scheduleId: string;
  startedAt: Date;
  completedAt: Date | null;
  status: 'running' | 'success' | 'failed';
  errorMessage: string | null;
  executionTimeMs: number;
  workflowExecutionId?: string;
}

export interface ErrorRecoveryConfig {
  retryPolicy: RetryPolicy;
  circuitBreaker: CircuitBreakerConfig;
  dlqRetentionDays: number;
  cleanupIntervalMs: number;
}

export type {
  RetryPolicy,
  RetryAttempt,
  RetryConfiguration,
  CircuitBreakerConfig,
  CircuitBreakerState,
  CircuitBreakerStatus,
  DLQEntry,
  DLQResubmitRequest,
  DLQStats,
  DLQFilter,
  ErrorDetails,
};
