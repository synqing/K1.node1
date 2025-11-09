/**
 * Batch Operations API Routes (T12)
 * Endpoints for bulk error recovery, schedule execution, and DLQ management
 *
 * Endpoints:
 * - POST /v2/batch/errors/retry - Batch retry error tasks
 * - POST /v2/batch/errors/resolve - Batch resolve error tasks
 * - POST /v2/batch/schedules/execute - Batch execute schedules
 * - POST /v2/batch/dlq/resolve - Batch resolve DLQ entries
 */
import { Router, Request, Response, NextFunction } from 'express';
/**
 * Batch operation configuration constants
 */
declare const BATCH_CONFIG: {
    MAX_ITEMS_PER_BATCH: number;
    REQUEST_TIMEOUT_MS: number;
    MAX_CONCURRENT_OPERATIONS: number;
};
/**
 * Batch item result type
 */
interface BatchItemResult {
    id: string;
    status: 'success' | 'failed' | 'partial';
    retryId?: string;
    error?: string;
    message?: string;
}
/**
 * Batch response type
 */
interface BatchResponse {
    batchId: string;
    operation: string;
    totalItems: number;
    successCount: number;
    failureCount: number;
    results: BatchItemResult[];
    timestamp: string;
}
/**
 * Batch Retry Errors Endpoint
 * POST /v2/batch/errors/retry
 *
 * Retry multiple failed tasks with configurable retry policies
 */
declare const batchRetryErrors: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Batch Resolve Errors Endpoint
 * POST /v2/batch/errors/resolve
 *
 * Resolve multiple failed tasks with a reason
 */
declare const batchResolveErrors: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Batch Execute Schedules Endpoint
 * POST /v2/batch/schedules/execute
 *
 * Execute multiple schedules immediately
 */
declare const batchExecuteSchedules: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Batch Resolve DLQ Endpoint
 * POST /v2/batch/dlq/resolve
 *
 * Resolve multiple DLQ entries (Dead Letter Queue)
 */
declare const batchResolveDLQ: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Create and configure batch operations router
 */
export declare function createBatchRouter(): Router;
/**
 * Export individual handlers for testing
 */
export { batchRetryErrors, batchResolveErrors, batchExecuteSchedules, batchResolveDLQ };
/**
 * Export batch configuration
 */
export { BATCH_CONFIG };
/**
 * Export types
 */
export type { BatchResponse, BatchItemResult };
//# sourceMappingURL=batch.d.ts.map