/**
 * Circuit Breaker Types
 * Defines types for circuit breaker configuration and state management
 */

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
  monitoringWindowMs: number;
}

export type CircuitBreakerStatus = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerState {
  id: string;
  serviceName: string;
  state: CircuitBreakerStatus;
  failureCount: number;
  lastFailureAt: Date | null;
  nextRetryAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CircuitBreakerMetrics {
  serviceName: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  failureRate: number;
  state: CircuitBreakerStatus;
  transitionedAt: Date;
}

export interface CircuitBreakerEvent {
  serviceName: string;
  eventType: 'opened' | 'closed' | 'half_open' | 'success' | 'failure';
  timestamp: Date;
  details?: Record<string, unknown>;
}
