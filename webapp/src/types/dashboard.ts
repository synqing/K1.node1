/**
 * Dashboard Types & Interfaces
 * Comprehensive type definitions for Phase 5.3.3 Dashboard
 */

// ==================== Error Recovery Types ====================

export interface RetryMetrics {
  total_attempts: number;
  successful_retries: number;
  failed_permanently: number;
  success_rate: number;
  average_attempts: number;
  by_policy: {
    standard: PolicyMetrics;
    aggressive: PolicyMetrics;
    conservative: PolicyMetrics;
  };
  timeseries: TimeSeriesPoint[];
}

export interface PolicyMetrics {
  count: number;
  success_rate: number;
  average_attempts: number;
}

export interface CircuitBreakerState {
  breaker_id: string;
  state: 'CLOSED' | 'OPEN' | 'HALF-OPEN';
  failure_rate: number;
  failure_count: number;
  success_count: number;
  last_state_change: string;
  timeout_remaining_ms: number;
}

export interface DLQEntry {
  dlq_id: string;
  task_id: string;
  timestamp: string;
  error_code: number;
  error_message: string;
  status: 'pending' | 'archived' | 'resubmitted';
  original_parameters?: Record<string, any>;
  last_resubmit_attempt?: string;
  manual_intervention_required: boolean;
}

export interface Intervention {
  timestamp: string;
  task_id: string;
  action: 'pause' | 'resume' | 'skip' | 'retry';
  reason?: string;
  result: 'success' | 'failed';
  performed_by: string;
}

export interface TaskState {
  task_id: string;
  state: 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'skipped';
  paused_at?: string;
  resumed_at?: string;
  history: Intervention[];
}

// ==================== Scheduling Types ====================

export interface Schedule {
  task_id: string;
  task_name: string;
  schedule_type: 'cron' | 'event';
  schedule_expr: string;
  priority: number; // 1-10
  enabled: boolean;
  created_at: string;
  last_executed?: string;
  next_execution?: string;
  execution_count: number;
  failure_count: number;
  average_duration_ms: number;
  circuit_breaker: string;
  retry_policy: string;
}

export interface QueueEntry {
  task_id: string;
  priority: number;
  enqueued_at: string;
  estimated_cpu_percent: number;
  estimated_memory_percent: number;
  status: 'queued' | 'executing' | 'completed';
  attempt: number;
}

export interface QueueStatus {
  timestamp: string;
  queued: number;
  executing: number;
  completed: number;
  pending_tasks: QueueEntry[];
}

export interface ResourceMetrics {
  concurrent_tasks: number;
  total_cpu_percent: number;
  total_memory_percent: number;
  active_tasks: string[];
  pending_queue_size: number;
  last_update: string;
}

export interface ResourceLimits {
  max_concurrent_tasks: number;
  max_cpu_percent: number;
  max_memory_percent: number;
}

// ==================== UI State Types ====================

export interface FilterState {
  status?: string;
  priority?: number;
  timeRange?: '1h' | '24h' | '7d';
  searchQuery?: string;
}

export interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

export interface PaginationState {
  page: number;
  limit: number;
  total: number;
}

// ==================== WebSocket Types ====================

export interface WebSocketMessage {
  type:
    | 'metric_update'
    | 'status_change'
    | 'alert'
    | 'connection'
    | 'error';
  timestamp: string;
  source:
    | 'error_recovery'
    | 'scheduling'
    | 'resource_usage'
    | 'system_health';
  data: Record<string, any>;
}

export interface ConnectionStatus {
  websocketConnected: boolean;
  lastUpdate: Date;
  lastError?: string;
}

// ==================== Dashboard State ====================

export interface DashboardState {
  errorRecovery: {
    retryStats: RetryMetrics | null;
    circuitBreakers: Map<string, CircuitBreakerState>;
    dlqEntries: DLQEntry[];
    interventionHistory: Intervention[];
    taskStates: Map<string, TaskState>;
  };
  scheduling: {
    schedules: Schedule[];
    priorityQueue: QueueStatus | null;
    resourceUsage: ResourceMetrics | null;
    resourceLimits: ResourceLimits;
  };
  ui: {
    selectedPanel: string;
    filters: FilterState;
    sortState: SortState;
    pagination: PaginationState;
    expandedRows: Set<string>;
    selectedItems: Set<string>;
  };
  connection: ConnectionStatus;
  loading: {
    [key: string]: boolean;
  };
  errors: {
    [key: string]: string | null;
  };
}

// ==================== API Response Types ====================

export interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Array<{
      field: string;
      message: string;
      suggestion?: string;
    }>;
  };
  timestamp: string;
}

export interface ListResponse<T> {
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
  items: T[];
}

// ==================== Component Props Types ====================

export interface GaugeProps {
  value: number;
  max?: number;
  min?: number;
  unit?: string;
  threshold?: number;
  label: string;
  size?: 'small' | 'medium' | 'large';
}

export interface ChartDataPoint {
  timestamp: string;
  value: number;
  [key: string]: any;
}

export interface TableColumn<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  render?: (value: any, row: T) => React.ReactNode;
}

export interface TableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  onRowClick?: (row: T) => void;
  searchable?: boolean;
  sortable?: boolean;
  pagination?: boolean;
  virtualScroll?: boolean;
}

// ==================== Panel-Specific Types ====================

export interface RetryAnalyticsData {
  stats: RetryMetrics;
  selectedPolicy?: string;
  timeRange: '1h' | '24h' | '7d';
}

export interface CircuitBreakerPanelData {
  breakers: CircuitBreakerState[];
  selectedBreaker?: string;
}

export interface DLQPanelData {
  entries: DLQEntry[];
  pagination: PaginationState;
  filters: {
    status?: 'pending' | 'archived';
    taskId?: string;
  };
  selectedEntry?: DLQEntry;
}

export interface ExecutionTimelineData {
  schedules: Schedule[];
  resourceOverlay: boolean;
  zoomLevel: '1h' | '4h' | '1d' | '1w';
  timeWindow: {
    start: Date;
    end: Date;
  };
}

// ==================== Utility Types ====================

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export interface ModalState {
  isOpen: boolean;
  title?: string;
  data?: any;
}
