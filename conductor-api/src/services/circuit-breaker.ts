/**
 * Circuit Breaker Service
 * Implements the circuit breaker pattern with three states: CLOSED, OPEN, HALF_OPEN
 * Manages failure/success counts, state transitions, and event emissions
 */

import { EventEmitter } from 'events';
import type {
  CircuitBreakerConfig,
  CircuitBreakerState,
  CircuitBreakerStatus,
  CircuitBreakerEvent,
  CircuitBreakerMetrics,
} from '../types/circuit-breaker.types';
import type { ICircuitBreakerService } from '../interfaces/error-recovery.interface';
import type { ServiceResult } from '../types/error-recovery.types';

interface CircuitBreakerInternal {
  state: CircuitBreakerStatus;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  lastFailureAt: Date | null;
  lastSuccessAt: Date | null;
  lastStateChangeAt: Date;
  nextRetryAt: Date | null;
  config: CircuitBreakerConfig;
}

/**
 * Circuit Breaker Service Implementation
 * In-memory state storage (can be migrated to DB in production)
 */
export class CircuitBreakerService extends EventEmitter implements ICircuitBreakerService {
  private breakers: Map<string, CircuitBreakerInternal> = new Map();
  private defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    successThreshold: 2,
    timeoutMs: 60000, // 1 minute
    monitoringWindowMs: 300000, // 5 minutes
  };

  constructor(defaultConfig?: Partial<CircuitBreakerConfig>) {
    super();
    if (defaultConfig) {
      this.defaultConfig = { ...this.defaultConfig, ...defaultConfig };
    }
  }

  /**
   * Initialize a new circuit breaker for a service
   */
  async initializeCircuitBreaker(
    serviceName: string,
    config: CircuitBreakerConfig
  ): Promise<ServiceResult<CircuitBreakerState>> {
    try {
      if (this.breakers.has(serviceName)) {
        return {
          success: false,
          error: `Circuit breaker for service "${serviceName}" already exists`,
        };
      }

      const breaker: CircuitBreakerInternal = {
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        lastFailureAt: null,
        lastSuccessAt: null,
        lastStateChangeAt: new Date(),
        nextRetryAt: null,
        config,
      };

      this.breakers.set(serviceName, breaker);
      this.emitEvent(serviceName, 'closed', { initialized: true });

      return {
        success: true,
        data: this.buildState(serviceName, breaker),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Record a failure for a service
   */
  async recordFailure(serviceName: string, error?: Error): Promise<ServiceResult<CircuitBreakerState>> {
    try {
      let breaker = this.breakers.get(serviceName);

      // Auto-initialize if not exists
      if (!breaker) {
        await this.initializeCircuitBreaker(serviceName, this.defaultConfig);
        breaker = this.breakers.get(serviceName)!;
      }

      breaker.failureCount += 1;
      breaker.failedRequests += 1;
      breaker.totalRequests += 1;
      breaker.lastFailureAt = new Date();

      this.emitEvent(serviceName, 'failure', { error: error?.message });

      // Transition to OPEN if threshold reached
      if (breaker.state === 'closed' && breaker.failureCount >= breaker.config.failureThreshold) {
        this.transitionToOpen(serviceName, breaker);
      }

      // From HALF_OPEN to OPEN on any failure
      if (breaker.state === 'half_open') {
        this.transitionToOpen(serviceName, breaker);
      }

      return {
        success: true,
        data: this.buildState(serviceName, breaker),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Record a success for a service
   */
  async recordSuccess(serviceName: string): Promise<ServiceResult<CircuitBreakerState>> {
    try {
      let breaker = this.breakers.get(serviceName);

      // Auto-initialize if not exists
      if (!breaker) {
        await this.initializeCircuitBreaker(serviceName, this.defaultConfig);
        breaker = this.breakers.get(serviceName)!;
      }

      breaker.successfulRequests += 1;
      breaker.totalRequests += 1;
      breaker.lastSuccessAt = new Date();

      this.emitEvent(serviceName, 'success');

      // Only track success count in HALF_OPEN state
      if (breaker.state === 'half_open') {
        breaker.successCount += 1;

        // Transition to CLOSED if threshold reached
        if (breaker.successCount >= breaker.config.successThreshold) {
          this.transitionToClosed(serviceName, breaker);
        }
      }

      // In CLOSED state, reset failure count on success
      if (breaker.state === 'closed') {
        breaker.failureCount = 0;
      }

      return {
        success: true,
        data: this.buildState(serviceName, breaker),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get current circuit breaker state
   */
  async getCircuitBreakerState(serviceName: string): Promise<ServiceResult<CircuitBreakerState>> {
    try {
      const breaker = this.breakers.get(serviceName);

      if (!breaker) {
        return {
          success: false,
          error: `Circuit breaker for service "${serviceName}" not found`,
        };
      }

      // Check if we should transition from OPEN to HALF_OPEN
      if (breaker.state === 'open' && breaker.nextRetryAt && new Date() >= breaker.nextRetryAt) {
        this.transitionToHalfOpen(serviceName, breaker);
      }

      return {
        success: true,
        data: this.buildState(serviceName, breaker),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if service is available (not open)
   */
  async isServiceAvailable(serviceName: string): Promise<boolean> {
    try {
      const result = await this.getCircuitBreakerState(serviceName);
      if (!result.success || !result.data) {
        return false;
      }
      return result.data.state !== 'open';
    } catch {
      return false;
    }
  }

  /**
   * Reset circuit breaker to closed state
   */
  async resetCircuitBreaker(serviceName: string): Promise<ServiceResult<void>> {
    try {
      const breaker = this.breakers.get(serviceName);

      if (!breaker) {
        return {
          success: false,
          error: `Circuit breaker for service "${serviceName}" not found`,
        };
      }

      this.transitionToClosed(serviceName, breaker);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update circuit breaker configuration
   */
  async updateCircuitBreakerConfig(
    serviceName: string,
    config: Partial<CircuitBreakerConfig>
  ): Promise<ServiceResult<void>> {
    try {
      const breaker = this.breakers.get(serviceName);

      if (!breaker) {
        return {
          success: false,
          error: `Circuit breaker for service "${serviceName}" not found`,
        };
      }

      breaker.config = { ...breaker.config, ...config };

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get all circuit breaker states
   */
  async getAllCircuitBreakerStates(): Promise<ServiceResult<CircuitBreakerState[]>> {
    try {
      const states: CircuitBreakerState[] = [];

      for (const [serviceName, breaker] of this.breakers.entries()) {
        // Check for OPEN to HALF_OPEN transitions
        if (breaker.state === 'open' && breaker.nextRetryAt && new Date() >= breaker.nextRetryAt) {
          this.transitionToHalfOpen(serviceName, breaker);
        }

        states.push(this.buildState(serviceName, breaker));
      }

      return {
        success: true,
        data: states,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get metrics for a circuit breaker
   */
  getMetrics(serviceName: string): CircuitBreakerMetrics | null {
    const breaker = this.breakers.get(serviceName);

    if (!breaker) {
      return null;
    }

    const failureRate =
      breaker.totalRequests > 0 ? breaker.failedRequests / breaker.totalRequests : 0;

    return {
      serviceName,
      totalRequests: breaker.totalRequests,
      successfulRequests: breaker.successfulRequests,
      failedRequests: breaker.failedRequests,
      failureRate,
      state: breaker.state,
      transitionedAt: breaker.lastStateChangeAt,
    };
  }

  /**
   * Get metrics for all circuit breakers
   */
  getAllMetrics(): CircuitBreakerMetrics[] {
    const metrics: CircuitBreakerMetrics[] = [];

    for (const serviceName of this.breakers.keys()) {
      const m = this.getMetrics(serviceName);
      if (m) {
        metrics.push(m);
      }
    }

    return metrics;
  }

  /**
   * Internal: Transition to OPEN state
   */
  private transitionToOpen(serviceName: string, breaker: CircuitBreakerInternal): void {
    breaker.state = 'open';
    breaker.successCount = 0;
    breaker.lastStateChangeAt = new Date();
    breaker.nextRetryAt = new Date(Date.now() + breaker.config.timeoutMs);

    this.emitEvent(serviceName, 'opened', {
      failureCount: breaker.failureCount,
      nextRetryAt: breaker.nextRetryAt,
    });
  }

  /**
   * Internal: Transition to HALF_OPEN state
   */
  private transitionToHalfOpen(serviceName: string, breaker: CircuitBreakerInternal): void {
    breaker.state = 'half_open';
    breaker.failureCount = 0;
    breaker.successCount = 0;
    breaker.lastStateChangeAt = new Date();
    breaker.nextRetryAt = null;

    this.emitEvent(serviceName, 'half_open', {
      recoveryAttempt: true,
    });
  }

  /**
   * Internal: Transition to CLOSED state
   */
  private transitionToClosed(serviceName: string, breaker: CircuitBreakerInternal): void {
    breaker.state = 'closed';
    breaker.failureCount = 0;
    breaker.successCount = 0;
    breaker.lastStateChangeAt = new Date();
    breaker.nextRetryAt = null;

    this.emitEvent(serviceName, 'closed', {
      recovered: true,
    });
  }

  /**
   * Internal: Build CircuitBreakerState from internal representation
   */
  private buildState(serviceName: string, breaker: CircuitBreakerInternal): CircuitBreakerState {
    return {
      id: serviceName,
      serviceName,
      state: breaker.state,
      failureCount: breaker.failureCount,
      lastFailureAt: breaker.lastFailureAt,
      nextRetryAt: breaker.nextRetryAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Internal: Emit circuit breaker event
   */
  private emitEvent(
    serviceName: string,
    eventType: CircuitBreakerEvent['eventType'],
    details?: Record<string, unknown>
  ): void {
    const event: CircuitBreakerEvent = {
      serviceName,
      eventType,
      timestamp: new Date(),
      details,
    };

    this.emit('event', event);
    this.emit(eventType, event);
  }
}
