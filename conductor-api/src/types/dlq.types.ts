/**
 * Dead Letter Queue Types
 * Defines types for dead letter queue entries and management
 */

export interface ErrorDetails {
  message: string;
  stack?: string;
  code?: string;
  timestamp: Date;
  attempts: number;
}

export interface DLQEntry {
  id: string;
  taskId: string;
  taskDefinition: Record<string, unknown>;
  errorDetails: ErrorDetails;
  retryCount: number;
  addedAt: Date;
  resolvedAt: Date | null;
  resolutionNotes: string | null;
}

export interface DLQResubmitRequest {
  dlqId: string;
  modifiedTaskDefinition?: Record<string, unknown>;
  reason: string;
}

export interface DLQStats {
  totalEntries: number;
  unresolvedEntries: number;
  resolvedEntries: number;
  oldestEntryAge: number;
  averageRetryCount: number;
}

export interface DLQFilter {
  taskId?: string;
  resolved?: boolean;
  minRetryCount?: number;
  maxRetryCount?: number;
  addedAfter?: Date;
  addedBefore?: Date;
}
