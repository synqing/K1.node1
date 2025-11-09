/**
 * Circuit Breaker Service
 * Implements the circuit breaker pattern to prevent cascading failures
 */
import type { CircuitBreakerConfig, CircuitBreakerState, CircuitBreakerMetrics, CircuitBreakerEvent } from '../types/circuit-breaker.types.js';
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
export declare class CircuitBreaker {
    private storage;
    private config;
    private eventListeners;
    constructor(storage: CircuitBreakerStorage, config: CircuitBreakerConfig);
    /**
     * Record a successful call for a service
     * @param serviceName - name of the service
     */
    recordSuccess(serviceName: string): Promise<void>;
    /**
     * Record a failed call for a service
     * @param serviceName - name of the service
     */
    recordFailure(serviceName: string): Promise<void>;
    /**
     * Check if a service is available
     * @param serviceName - name of the service
     * @returns true if service is available, false if circuit is open
     */
    isAvailable(serviceName: string): Promise<boolean>;
    /**
     * Get the current state of a service
     * @param serviceName - name of the service
     * @returns circuit breaker state
     */
    getState(serviceName: string): Promise<CircuitBreakerState | null>;
    /**
     * Get all circuit breaker states
     * @returns array of all circuit breaker states
     */
    getAllStates(): Promise<CircuitBreakerState[]>;
    /**
     * Reset circuit breaker for a service
     * @param serviceName - name of the service
     */
    reset(serviceName: string): Promise<void>;
    /**
     * Manually open a circuit
     * @param serviceName - name of the service
     */
    open(serviceName: string): Promise<void>;
    /**
     * Manually close a circuit
     * @param serviceName - name of the service
     */
    close(serviceName: string): Promise<void>;
    /**
     * Get metrics for a service
     * @param serviceName - name of the service
     * @returns circuit breaker metrics
     */
    getMetrics(serviceName: string): Promise<CircuitBreakerMetrics | null>;
    /**
     * Subscribe to circuit breaker events
     * @param listener - callback function for events
     */
    onEvent(listener: (event: CircuitBreakerEvent) => void): void;
    /**
     * Private helper to create initial circuit breaker state
     */
    private createInitialState;
    /**
     * Private helper to check if state is half-open
     */
    private isHalfOpen;
    /**
     * Private helper to emit events
     */
    private emitEvent;
}
//# sourceMappingURL=circuit-breaker.d.ts.map