/**
 * API Service Layer
 * Handles all HTTP communication with backend APIs
 */

import { ApiResponse, ListResponse } from '../types/dashboard';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v2';
const API_TIMEOUT = 30000; // 30 seconds

// API Error class
export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    public details?: any
  ) {
    super(`API Error: ${code} (${status})`);
    this.name = 'ApiError';
  }
}

// Request wrapper with timeout
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Generic fetch wrapper
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetchWithTimeout(url, options);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        errorData.error?.code || 'UNKNOWN_ERROR',
        response.status,
        errorData.error?.details
      );
    }

    const data = await response.json();
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('NETWORK_ERROR', 0, { originalError: error });
  }
}

// ==================== Error Recovery API ====================

export const errorRecoveryAPI = {
  // Retry metrics
  getRetryStats(interval: '1h' | '24h' | '7d' = '24h') {
    return apiRequest(`/metrics/retry-stats?interval=${interval}`);
  },

  // Circuit breaker
  getCircuitBreakerStatus(breakerId?: string) {
    const query = breakerId ? `?breaker_id=${breakerId}` : '';
    return apiRequest(`/circuit-breaker/status${query}`);
  },

  // Dead Letter Queue
  getDLQEntries(page = 1, limit = 20, status?: 'pending' | 'archived') {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) params.append('status', status);
    return apiRequest<ListResponse<any>>(`/queue/dlq?${params.toString()}`);
  },

  resubmitDLQEntry(dlqId: string, parameters?: Record<string, any>) {
    return apiRequest(`/queue/dlq/${dlqId}/resubmit`, {
      method: 'POST',
      body: JSON.stringify({ parameters }),
    });
  },

  // Task intervention
  pauseTask(taskId: string) {
    return apiRequest(`/tasks/${taskId}/pause`, { method: 'POST' });
  },

  resumeTask(taskId: string) {
    return apiRequest(`/tasks/${taskId}/resume`, { method: 'POST' });
  },

  skipTask(taskId: string, reason?: string) {
    return apiRequest(`/tasks/${taskId}/skip`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  retryTask(taskId: string, parameters?: Record<string, any>) {
    return apiRequest(`/tasks/${taskId}/retry`, {
      method: 'POST',
      body: JSON.stringify({ parameters }),
    });
  },

  getInterventionHistory(taskId: string) {
    return apiRequest(`/tasks/${taskId}/intervention-history`);
  },
};

// ==================== Scheduling API ====================

export const schedulingAPI = {
  // Schedule management
  listSchedules(type?: 'cron' | 'event', enabled?: boolean) {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (enabled !== undefined) params.append('enabled', String(enabled));
    return apiRequest<ListResponse<any>>(`/scheduler/schedules?${params.toString()}`);
  },

  getSchedule(scheduleId: string) {
    return apiRequest(`/scheduler/schedules/${scheduleId}`);
  },

  createSchedule(data: any) {
    return apiRequest('/scheduler/schedules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateSchedule(scheduleId: string, data: Partial<any>) {
    return apiRequest(`/scheduler/schedules/${scheduleId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteSchedule(scheduleId: string) {
    return apiRequest(`/scheduler/schedules/${scheduleId}`, {
      method: 'DELETE',
    });
  },

  // Event triggering
  triggerEvent(event: string, metadata?: Record<string, any>) {
    return apiRequest('/scheduler/trigger', {
      method: 'POST',
      body: JSON.stringify({ event, metadata }),
    });
  },

  // Queue status
  getQueueStatus() {
    return apiRequest('/scheduler/queue');
  },
};

// ==================== WebSocket Service ====================

export interface WebSocketConfig {
  url?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onMessage?: (message: any) => void;
  onError?: (error: Error) => void;
}

export class DashboardWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageQueue: any[] = [];
  private config: Required<WebSocketConfig>;

  constructor(config: WebSocketConfig = {}) {
    this.config = {
      url: config.url || `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/metrics`,
      reconnectInterval: config.reconnectInterval || 3000,
      maxReconnectAttempts: config.maxReconnectAttempts || 5,
      onConnect: config.onConnect || (() => {}),
      onDisconnect: config.onDisconnect || (() => {}),
      onMessage: config.onMessage || (() => {}),
      onError: config.onError || (() => {}),
    };
  }

  connect() {
    try {
      this.ws = new WebSocket(this.config.url);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected');
        this.reconnectAttempts = 0;
        this.config.onConnect();

        // Flush queued messages
        while (this.messageQueue.length > 0) {
          const msg = this.messageQueue.shift();
          this.send(msg);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.config.onMessage(message);
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      };

      this.ws.onerror = (event) => {
        console.error('[WebSocket] Error:', event);
        this.config.onError(new Error('WebSocket error'));
      };

      this.ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        this.config.onDisconnect();
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('[WebSocket] Connection failed:', error);
      this.config.onError(error as Error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`[WebSocket] Attempting to reconnect in ${delay}ms...`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      // Queue message for later
      this.messageQueue.push(data);
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// ==================== Polling Service ====================

export class PollingService {
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  start(
    key: string,
    fn: () => Promise<any>,
    interval: number = 5000
  ) {
    // Clear existing interval if any
    this.stop(key);

    // Initial call
    fn();

    // Set up polling
    const timerId = setInterval(() => {
      fn().catch((error) => {
        console.error(`[Polling] Error in ${key}:`, error);
      });
    }, interval);

    this.intervals.set(key, timerId);
  }

  stop(key: string) {
    const timerId = this.intervals.get(key);
    if (timerId) {
      clearInterval(timerId);
      this.intervals.delete(key);
    }
  }

  stopAll() {
    this.intervals.forEach((timerId) => clearInterval(timerId));
    this.intervals.clear();
  }
}

// ==================== Generic API Client ====================

export class ApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string = API_BASE_URL, timeout: number = API_TIMEOUT) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    return apiRequest<T>(url.replace(API_BASE_URL, ''), options);
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async patch<T>(endpoint: string, body: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// Export singleton instances
export const pollingService = new PollingService();
