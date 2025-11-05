import { FirmwareParams, postParams } from './api';

export interface AdjustmentRequest {
  id: string;
  timestamp: number;
  parameter: keyof FirmwareParams;
  value: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
  retryCount: number;
  maxRetries: number;
  timeout: number;
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
  onRetry?: (attempt: number) => void;
}

export interface AdjustmentResult {
  success: boolean;
  confirmed: boolean;
  latency: number;
  error?: string;
  clamped?: boolean;
  originalValue?: number;
  finalValue?: number;
}

export interface SystemState {
  isOnline: boolean;
  deviceIp: string;
  lastSuccessfulUpdate: number;
  consecutiveFailures: number;
  networkQuality: 'excellent' | 'good' | 'poor' | 'critical';
  adaptiveSettings: {
    debounceMs: number;
    timeoutMs: number;
    maxRetries: number;
    batchSize: number;
  };
}

export interface ErrorRecoveryStrategy {
  name: string;
  condition: (error: Error, context: AdjustmentRequest) => boolean;
  action: (error: Error, context: AdjustmentRequest) => Promise<boolean>;
  description: string;
}

export class RealTimeAdjustmentSystem {
  private deviceIp: string = '';
  private requestQueue: AdjustmentRequest[] = [];
  private pendingRequests = new Map<string, AdjustmentRequest>();
  private systemState: SystemState;
  private isProcessing = false;
  private processingInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  
  // Error recovery strategies
  private recoveryStrategies: ErrorRecoveryStrategy[] = [
    {
      name: 'Rate Limit Recovery',
      condition: (error) => error.message.includes('429') || error.message.includes('rate'),
      action: async (error, context) => {
        // Exponential backoff for rate limiting
        const delay = Math.min(1000 * Math.pow(2, context.retryCount), 10000);
        await this.delay(delay);
        return true;
      },
      description: 'Handles rate limiting with exponential backoff',
    },
    {
      name: 'Network Error Recovery',
      condition: (error) => error.message.includes('fetch') || error.message.includes('network'),
      action: async (error, context) => {
        // Check connectivity and adjust timeout
        const isOnline = await this.checkConnectivity();
        if (!isOnline) {
          this.systemState.isOnline = false;
          return false;
        }
        
        // Increase timeout for next attempt
        context.timeout = Math.min(context.timeout * 1.5, 10000);
        return true;
      },
      description: 'Handles network connectivity issues',
    },
    {
      name: 'Device Busy Recovery',
      condition: (error) => error.message.includes('busy') || error.message.includes('503'),
      action: async (error, context) => {
        // Device is busy, wait and reduce batch size
        await this.delay(500);
        this.systemState.adaptiveSettings.batchSize = Math.max(1, this.systemState.adaptiveSettings.batchSize - 1);
        return true;
      },
      description: 'Handles device busy states',
    },
    {
      name: 'Parameter Validation Recovery',
      condition: (error) => error.message.includes('400') || error.message.includes('invalid'),
      action: async (error, context) => {
        // Parameter validation failed - don't retry
        console.warn(`Parameter validation failed for ${context.parameter}:`, error.message);
        return false;
      },
      description: 'Handles parameter validation errors',
    },
  ];

  constructor(deviceIp: string) {
    this.deviceIp = deviceIp;
    this.systemState = {
      isOnline: true,
      deviceIp,
      lastSuccessfulUpdate: Date.now(),
      consecutiveFailures: 0,
      networkQuality: 'good',
      adaptiveSettings: {
        debounceMs: 350,
        timeoutMs: 5000,
        maxRetries: 3,
        batchSize: 5,
      },
    };

    this.startProcessing();
    this.startHealthCheck();
  }

  private startProcessing() {
    this.processingInterval = setInterval(() => {
      if (!this.isProcessing && this.requestQueue.length > 0) {
        this.processQueue();
      }
    }, 50); // Check every 50ms
  }

  private startHealthCheck() {
    this.healthCheckInterval = setInterval(async () => {
      const isOnline = await this.checkConnectivity();
      this.systemState.isOnline = isOnline;
      
      if (!isOnline) {
        this.systemState.consecutiveFailures++;
        this.adaptToNetworkConditions();
      } else if (this.systemState.consecutiveFailures > 0) {
        // Recovery detected
        this.systemState.consecutiveFailures = 0;
        this.resetAdaptiveSettings();
      }
    }, 10000); // Check every 10 seconds
  }

  async adjustParameter(
    parameter: keyof FirmwareParams,
    value: number,
    options: {
      priority?: AdjustmentRequest['priority'];
      timeout?: number;
      maxRetries?: number;
      onSuccess?: (result: AdjustmentResult) => void;
      onError?: (error: Error) => void;
      onRetry?: (attempt: number) => void;
    } = {}
  ): Promise<string> {
    const request: AdjustmentRequest = {
      id: `${parameter}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      parameter,
      value,
      priority: options.priority || 'normal',
      retryCount: 0,
      maxRetries: options.maxRetries || this.systemState.adaptiveSettings.maxRetries,
      timeout: options.timeout || this.systemState.adaptiveSettings.timeoutMs,
      onSuccess: options.onSuccess,
      onError: options.onError,
      onRetry: options.onRetry,
    };

    // Add to queue with priority sorting
    this.addToQueue(request);
    
    return request.id;
  }

  private addToQueue(request: AdjustmentRequest) {
    // Remove any existing requests for the same parameter to avoid conflicts
    this.requestQueue = this.requestQueue.filter(r => r.parameter !== request.parameter);
    
    // Insert based on priority
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    const insertIndex = this.requestQueue.findIndex(
      r => priorityOrder[r.priority] > priorityOrder[request.priority]
    );
    
    if (insertIndex === -1) {
      this.requestQueue.push(request);
    } else {
      this.requestQueue.splice(insertIndex, 0, request);
    }
  }

  private async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0 || !this.systemState.isOnline) {
      return;
    }

    this.isProcessing = true;

    try {
      // Process requests in batches
      const batchSize = Math.min(this.systemState.adaptiveSettings.batchSize, this.requestQueue.length);
      const batch = this.requestQueue.splice(0, batchSize);

      if (batch.length === 1) {
        // Single request
        await this.processSingleRequest(batch[0]);
      } else {
        // Batch request
        await this.processBatchRequest(batch);
      }
    } catch (error) {
      console.error('Queue processing error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processSingleRequest(request: AdjustmentRequest): Promise<void> {
    const startTime = performance.now();
    
    try {
      this.pendingRequests.set(request.id, request);
      
      const params: Partial<FirmwareParams> = {
        [request.parameter]: request.value,
      };

      const result = await this.executeWithTimeout(
        () => postParams(this.deviceIp, params),
        request.timeout
      );

      const latency = performance.now() - startTime;
      
      const adjustmentResult: AdjustmentResult = {
        success: true,
        confirmed: result.confirmed,
        latency,
        originalValue: request.value,
        finalValue: result.data?.[request.parameter] as number,
        clamped: result.data?.[request.parameter] !== request.value,
      };

      this.handleSuccess(request, adjustmentResult);
      
    } catch (error) {
      await this.handleError(request, error as Error);
    } finally {
      this.pendingRequests.delete(request.id);
    }
  }

  private async processBatchRequest(requests: AdjustmentRequest[]): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Combine all parameters into a single request
      const params: Partial<FirmwareParams> = {};
      requests.forEach(req => {
        params[req.parameter] = req.value;
        this.pendingRequests.set(req.id, req);
      });

      const result = await this.executeWithTimeout(
        () => postParams(this.deviceIp, params),
        Math.max(...requests.map(r => r.timeout))
      );

      const latency = performance.now() - startTime;

      // Handle success for all requests in batch
      requests.forEach(request => {
        const adjustmentResult: AdjustmentResult = {
          success: true,
          confirmed: result.confirmed,
          latency,
          originalValue: request.value,
          finalValue: result.data?.[request.parameter] as number,
          clamped: result.data?.[request.parameter] !== request.value,
        };

        this.handleSuccess(request, adjustmentResult);
      });

    } catch (error) {
      // Handle error for all requests in batch
      for (const request of requests) {
        await this.handleError(request, error as Error);
      }
    } finally {
      requests.forEach(req => this.pendingRequests.delete(req.id));
    }
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private handleSuccess(request: AdjustmentRequest, result: AdjustmentResult) {
    this.systemState.lastSuccessfulUpdate = Date.now();
    this.systemState.consecutiveFailures = 0;
    
    // Update network quality based on latency
    if (result.latency < 100) {
      this.systemState.networkQuality = 'excellent';
    } else if (result.latency < 300) {
      this.systemState.networkQuality = 'good';
    } else if (result.latency < 800) {
      this.systemState.networkQuality = 'poor';
    } else {
      this.systemState.networkQuality = 'critical';
    }

    request.onSuccess?.(result);
  }

  private async handleError(request: AdjustmentRequest, error: Error): Promise<void> {
    this.systemState.consecutiveFailures++;
    
    // Try recovery strategies
    let canRetry = false;
    for (const strategy of this.recoveryStrategies) {
      if (strategy.condition(error, request)) {
        try {
          canRetry = await strategy.action(error, request);
          break;
        } catch (recoveryError) {
          console.warn(`Recovery strategy '${strategy.name}' failed:`, recoveryError);
        }
      }
    }

    // Retry if possible
    if (canRetry && request.retryCount < request.maxRetries) {
      request.retryCount++;
      request.onRetry?.(request.retryCount);
      
      // Add back to queue with exponential backoff
      setTimeout(() => {
        this.addToQueue(request);
      }, Math.min(1000 * Math.pow(2, request.retryCount), 5000));
      
      return;
    }

    // Final failure
    request.onError?.(error);
    this.adaptToNetworkConditions();
  }

  private adaptToNetworkConditions() {
    const { consecutiveFailures, networkQuality } = this.systemState;
    
    // Adjust settings based on network conditions
    if (consecutiveFailures > 3 || networkQuality === 'critical') {
      this.systemState.adaptiveSettings.debounceMs = Math.min(
        this.systemState.adaptiveSettings.debounceMs * 1.5,
        2000
      );
      this.systemState.adaptiveSettings.timeoutMs = Math.min(
        this.systemState.adaptiveSettings.timeoutMs * 1.2,
        15000
      );
      this.systemState.adaptiveSettings.batchSize = Math.max(
        this.systemState.adaptiveSettings.batchSize - 1,
        1
      );
    } else if (networkQuality === 'poor') {
      this.systemState.adaptiveSettings.debounceMs = Math.min(
        this.systemState.adaptiveSettings.debounceMs * 1.2,
        1000
      );
      this.systemState.adaptiveSettings.timeoutMs = Math.min(
        this.systemState.adaptiveSettings.timeoutMs * 1.1,
        10000
      );
    }
  }

  private resetAdaptiveSettings() {
    this.systemState.adaptiveSettings = {
      debounceMs: 350,
      timeoutMs: 5000,
      maxRetries: 3,
      batchSize: 5,
    };
  }

  private async checkConnectivity(): Promise<boolean> {
    try {
      const response = await fetch(`http://${this.deviceIp}/api/test-connection`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public API methods
  cancelRequest(requestId: string): boolean {
    // Remove from queue
    const queueIndex = this.requestQueue.findIndex(r => r.id === requestId);
    if (queueIndex !== -1) {
      this.requestQueue.splice(queueIndex, 1);
      return true;
    }

    // Cannot cancel pending requests
    return false;
  }

  getSystemState(): SystemState {
    return { ...this.systemState };
  }

  getQueueStatus(): {
    queueLength: number;
    pendingRequests: number;
    isProcessing: boolean;
    nextRequestEta: number;
  } {
    const nextRequestEta = this.requestQueue.length > 0 && !this.isProcessing 
      ? this.systemState.adaptiveSettings.debounceMs 
      : 0;

    return {
      queueLength: this.requestQueue.length,
      pendingRequests: this.pendingRequests.size,
      isProcessing: this.isProcessing,
      nextRequestEta,
    };
  }

  updateDeviceIp(newIp: string) {
    this.deviceIp = newIp;
    this.systemState.deviceIp = newIp;
    this.systemState.isOnline = true;
    this.systemState.consecutiveFailures = 0;
  }

  // Batch operations
  async adjustMultipleParameters(
    parameters: Array<{ key: keyof FirmwareParams; value: number }>,
    options: {
      priority?: AdjustmentRequest['priority'];
      onSuccess?: (results: AdjustmentResult[]) => void;
      onError?: (error: Error) => void;
    } = {}
  ): Promise<string[]> {
    const requestIds: string[] = [];
    
    for (const { key, value } of parameters) {
      const id = await this.adjustParameter(key, value, {
        priority: options.priority,
        onSuccess: options.onSuccess ? (result) => options.onSuccess?.([result]) : undefined,
        onError: options.onError,
      });
      requestIds.push(id);
    }

    return requestIds;
  }

  destroy() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.requestQueue.length = 0;
    this.pendingRequests.clear();
  }
}

// Factory function for creating adjustment systems
export function createAdjustmentSystem(deviceIp: string): RealTimeAdjustmentSystem {
  return new RealTimeAdjustmentSystem(deviceIp);
}