/**
 * Circuit Breaker Service
 * Implements the circuit breaker pattern with three states: CLOSED, OPEN, HALF_OPEN
 * Manages failure/success counts, state transitions, and event emissions
 */
import { EventEmitter } from 'events';
import type { CircuitBreakerConfig, CircuitBreakerState, CircuitBreakerMetrics } from '../types/circuit-breaker.types';
import type { ICircuitBreakerService } from '../interfaces/error-recovery.interface';
import type { ServiceResult } from '../types/error-recovery.types';
/**
 * Circuit Breaker Service Implementation
 * In-memory state storage (can be migrated to DB in production)
 */
export declare class CircuitBreakerService extends EventEmitter implements ICircuitBreakerService {
    private breakers;
    private defaultConfig;
    constructor(defaultConfig?: Partial<CircuitBreakerConfig>);
    /**
     * Initialize a new circuit breaker for a service
     */
    initializeCircuitBreaker(serviceName: string, config: CircuitBreakerConfig): Promise<ServiceResult<CircuitBreakerState>>;
    /**
     * Record a failure for a service
     */
    recordFailure(serviceName: string, error?: Error): Promise<ServiceResult<CircuitBreakerState>>;
    /**
     * Record a success for a service
     */
    recordSuccess(serviceName: string): Promise<ServiceResult<CircuitBreakerState>>;
    /**
     * Get current circuit breaker state
     */
    getCircuitBreakerState(serviceName: string): Promise<ServiceResult<CircuitBreakerState>>;
    /**
     * Check if service is available (not open)
     */
    isServiceAvailable(serviceName: string): Promise<boolean>;
    /**
     * Reset circuit breaker to closed state
     */
    resetCircuitBreaker(serviceName: string): Promise<ServiceResult<void>>;
    /**
     * Update circuit breaker configuration
     */
    updateCircuitBreakerConfig(serviceName: string, config: Partial<CircuitBreakerConfig>): Promise<ServiceResult<void>>;
    /**
     * Get all circuit breaker states
     */
    getAllCircuitBreakerStates(): Promise<ServiceResult<CircuitBreakerState[]>>;
    /**
     * Get metrics for a circuit breaker
     */
    getMetrics(serviceName: string): CircuitBreakerMetrics | null;
    /**
     * Get metrics for all circuit breakers
     */
    getAllMetrics(): CircuitBreakerMetrics[];
    /**
     * Internal: Transition to OPEN state
     */
    private transitionToOpen;
    /**
     * Internal: Transition to HALF_OPEN state
     */
    private transitionToHalfOpen;
    /**
     * Internal: Transition to CLOSED state
     */
    private transitionToClosed;
    /**
     * Internal: Build CircuitBreakerState from internal representation
     */
    private buildState;
    /**
     * Internal: Emit circuit breaker event
     */
    private emitEvent;
}
//# sourceMappingURL=circuit-breaker.d.ts.map