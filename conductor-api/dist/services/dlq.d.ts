/**
 * Dead Letter Queue Service
 * Manages failed tasks that exhausted all retry attempts
 */
import type { DLQEntry, DLQStats, DLQFilter, ErrorDetails } from '../types/dlq.types.js';
/**
 * Interface for DLQ storage operations (abstraction)
 * In production, this would interface with actual DB
 */
export interface DLQStorage {
    addEntry(entry: DLQEntry): Promise<DLQEntry>;
    getEntry(id: string): Promise<DLQEntry | null>;
    listEntries(filter?: DLQFilter, limit?: number): Promise<DLQEntry[]>;
    updateEntry(entry: DLQEntry): Promise<void>;
    deleteEntry(id: string): Promise<void>;
    resolveEntry(id: string, notes: string): Promise<void>;
    getStats(): Promise<DLQStats>;
}
/**
 * Dead Letter Queue Service
 * Handles storage and management of failed tasks
 */
export declare class DeadLetterQueue {
    private storage;
    constructor(storage: DLQStorage);
    /**
     * Add a failed task to the DLQ
     * @param taskId - ID of the failed task
     * @param taskDefinition - the task definition/payload
     * @param errorDetails - error information
     * @param retryCount - number of retries attempted
     * @returns the created DLQ entry
     */
    addFailedTask(taskId: string, taskDefinition: Record<string, unknown>, errorDetails: ErrorDetails, retryCount: number): Promise<DLQEntry>;
    /**
     * Get a DLQ entry by ID
     * @param id - DLQ entry ID
     * @returns the DLQ entry or null if not found
     */
    getEntry(id: string): Promise<DLQEntry | null>;
    /**
     * List DLQ entries with optional filtering
     * @param filter - optional filter criteria
     * @param limit - maximum number of entries to return
     * @returns array of DLQ entries
     */
    listEntries(filter?: DLQFilter, limit?: number): Promise<DLQEntry[]>;
    /**
     * Mark a DLQ entry as resolved
     * @param id - DLQ entry ID
     * @param notes - resolution notes
     */
    resolveEntry(id: string, notes: string): Promise<void>;
    /**
     * Resubmit a DLQ entry as a new task
     * @param id - DLQ entry ID
     * @param modifiedDefinition - optional modified task definition
     * @returns the entry as it was resubmitted
     */
    resubmitEntry(id: string, modifiedDefinition?: Record<string, unknown>): Promise<DLQEntry>;
    /**
     * Get DLQ statistics
     * @returns statistics about the DLQ
     */
    getStats(): Promise<DLQStats>;
    /**
     * Get unresolved entries (backlog)
     * @param limit - maximum number to return
     * @returns array of unresolved entries
     */
    getBacklog(limit?: number): Promise<DLQEntry[]>;
    /**
     * Clean up old resolved entries
     * @param retentionDays - keep entries resolved within this many days
     * @returns number of entries deleted
     */
    cleanupResolved(retentionDays?: number): Promise<number>;
    /**
     * Get entries by task ID
     * @param taskId - task ID to search for
     * @returns array of matching entries
     */
    getEntriesByTaskId(taskId: string): Promise<DLQEntry[]>;
    /**
     * Check if a task is in the DLQ
     * @param taskId - task ID to check
     * @returns true if task has unresolved entries in DLQ
     */
    isInDLQ(taskId: string): Promise<boolean>;
}
//# sourceMappingURL=dlq.d.ts.map