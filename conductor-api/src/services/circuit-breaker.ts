/**
 * Circuit Breaker Service
 * Implements the circuit breaker pattern to prevent cascading failures
 */

import type {
  CircuitBreakerConfig,
  CircuitBreakerState,
  CircuitBreakerStatus,
  CircuitBreakerMetrics,
  CircuitBreakerEvent,
} from '../types/circuit-breaker.types.js';

/**
 * Interface for circuit breaker state storage (abstraction)
 * In production, this would interface with actual DB
 */
export interface CircuitBreakerStorage {
  getState(serviceName: string): Promise<CircuitBreakerState | null>;
  setState(state: CircuitBreakerState): Promise<void>;
  getAllStates(): Promise<CircuitBreakerState[]>;
}

/**
 * Circuit Breaker Service
 * Manages service health and prevents calls to failing services
 */
export class CircuitBreaker {
  private storage: CircuitBreakerStorage;
  private config: CircuitBreakerConfig;
  private eventListeners: Array<(event: CircuitBreakerEvent) => void> = [];

  constructor(storage: CircuitBreakerStorage, config: CircuitBreakerConfig) {
    this.storage = storage;
    this.config = config;
  }

  /**
   * Record a successful call for a service
   * @param serviceName - name of the service
   */
  async recordSuccess(serviceName: string): Promise<void> {
    let state = await this.storage.getState(serviceName);

    if (!state) {
      state = this.createInitialState(serviceName, 'closed');
    }

    if (state.state === 'open') {
      // In half-open state, a success closes the circuit
      if (this.isHalfOpen(state)) {
        state.state = 'closed';
        state.failureCount = 0;
        state.lastFailureAt = null;
        state.nextRetryAt = null;
        state.updatedAt = new Date();

        await this.storage.setState(state);
        this.emitEvent({
          serviceName,
          eventType: 'closed',
          timestamp: new Date(),
          details: { reason: 'success_in_half_open' },
        });
      }
    } else if (state.state === 'closed') {
      // Already closed, just update timestamp
      state.updatedAt = new Date();
      await this.storage.setState(state);
    }

    this.emitEvent({
      serviceName,
      eventType: 'success',
      timestamp: new Date(),
    });
  }

  /**
   * Record a failed call for a service
   * @param serviceName - name of the service
   */
  async recordFailure(serviceName: string): Promise<void> {
    let state = await this.storage.getState(serviceName);

    if (!state) {
      state = this.createInitialState(serviceName, 'closed');
    }

    state.failureCount += 1;
    state.lastFailureAt = new Date();
    state.updatedAt = new Date();

    // Check if we should open the circuit
    if (state.state === 'closed' && state.failureCount >= this.config.failureThreshold) {
      state.state = 'open';
      state.nextRetryAt = new Date(Date.now() + this.config.timeoutMs);

      await this.storage.setState(state);
      this.emitEvent({
        serviceName,
        eventType: 'opened',
        timestamp: new Date(),
        details: { failureCount: state.failureCount },
      });
    } else if (state.state === 'half_open') {
      // Failure in half-open state reopens the circuit
      state.state = 'open';
      state.nextRetryAt = new Date(Date.now() + this.config.timeoutMs);

      await this.storage.setState(state);
      this.emitEvent({
        serviceName,
        eventType: 'opened',
        timestamp: new Date(),
        details: { reason: 'failure_in_half_open' },
      });
    } else {
      await this.storage.setState(state);
    }

    this.emitEvent({
      serviceName,
      eventType: 'failure',
      timestamp: new Date(),
      details: { failureCount: state.failureCount },
    });
  }

  /**
   * Check if a service is available
   * @param serviceName - name of the service
   * @returns true if service is available, false if circuit is open
   */
  async isAvailable(serviceName: string): Promise<boolean> {
    const state = await this.storage.getState(serviceName);

    if (!state) {
      return true; // Unknown service is assumed available
    }

    if (state.state === 'closed') {
      return true;
    }

    if (state.state === 'open') {
      if (state.nextRetryAt && new Date() >= state.nextRetryAt) {
        // Timeout expired, transition to half-open
        state.state = 'half_open';
        state.failureCount = 0;
        state.updatedAt = new Date();
        await this.storage.setState(state);

        this.emitEvent({
          serviceName,
          eventType: 'half_open',
          timestamp: new Date(),
          details: { reason: 'timeout_expired' },
        });

        return true;
      }
      return false;
    }

    // Half-open state
    return true;
  }

  /**
   * Get the current state of a service
   * @param serviceName - name of the service
   * @returns circuit breaker state
   */
  async getState(serviceName: string): Promise<CircuitBreakerState | null> {
    return this.storage.getState(serviceName);
  }

  /**
   * Get all circuit breaker states
   * @returns array of all circuit breaker states
   */
  async getAllStates(): Promise<CircuitBreakerState[]> {
    return this.storage.getAllStates();
  }

  /**
   * Reset circuit breaker for a service
   * @param serviceName - name of the service
   */
  async reset(serviceName: string): Promise<void> {
    const state = await this.storage.getState(serviceName);

    if (state) {
      state.state = 'closed';
      state.failureCount = 0;
      state.lastFailureAt = null;
      state.nextRetryAt = null;
      state.updatedAt = new Date();

      await this.storage.setState(state);

      this.emitEvent({
        serviceName,
        eventType: 'closed',
        timestamp: new Date(),
        details: { reason: 'manual_reset' },
      });
    }
  }

  /**
   * Manually open a circuit
   * @param serviceName - name of the service
   */
  async open(serviceName: string): Promise<void> {
    let state = await this.storage.getState(serviceName);

    if (!state) {
      state = this.createInitialState(serviceName, 'open');
    }

    state.state = 'open';
    state.nextRetryAt = new Date(Date.now() + this.config.timeoutMs);
    state.updatedAt = new Date();

    await this.storage.setState(state);

    this.emitEvent({
      serviceName,
      eventType: 'opened',
      timestamp: new Date(),
      details: { reason: 'manual_open' },
    });
  }

  /**
   * Manually close a circuit
   * @param serviceName - name of the service
   */
  async close(serviceName: string): Promise<void> {
    const state = await this.storage.getState(serviceName);

    if (state) {
      state.state = 'closed';
      state.failureCount = 0;
      state.lastFailureAt = null;
      state.nextRetryAt = null;
      state.updatedAt = new Date();

      await this.storage.setState(state);

      this.emitEvent({
        serviceName,
        eventType: 'closed',
        timestamp: new Date(),
        details: { reason: 'manual_close' },
      });
    }
  }

  /**
   * Get metrics for a service
   * @param serviceName - name of the service
   * @returns circuit breaker metrics
   */
  async getMetrics(serviceName: string): Promise<CircuitBreakerMetrics | null> {
    const state = await this.storage.getState(serviceName);

    if (!state) {
      return null;
    }

    const failureRate = state.failureCount > 0 ? state.failureCount : 0;

    return {
      serviceName,
      totalRequests: 0, // Would be tracked separately
      successfulRequests: 0, // Would be tracked separately
      failedRequests: state.failureCount,
      failureRate,
      state: state.state,
      transitionedAt: state.updatedAt,
    };
  }

  /**
   * Subscribe to circuit breaker events
   * @param listener - callback function for events
   */
  onEvent(listener: (event: CircuitBreakerEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * Private helper to create initial circuit breaker state
   */
  private createInitialState(
    serviceName: string,
    state: CircuitBreakerStatus
  ): CircuitBreakerState {
    return {
      id: `cb_${serviceName}_${Date.now()}`,
      serviceName,
      state,
      failureCount: 0,
      lastFailureAt: null,
      nextRetryAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Private helper to check if state is half-open
   */
  private isHalfOpen(state: CircuitBreakerState): boolean {
    return state.state === 'half_open';
  }

  /**
   * Private helper to emit events
   */
  private emitEvent(event: CircuitBreakerEvent): void {
    this.eventListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('Circuit breaker event listener error:', error);
      }
    });
  }
}
