/**
 * Dead Letter Queue Service
 * Manages failed tasks that exceed retry limits
 * Handles DLQ entries, resubmission, resolution, and cleanup
 * Task T6: Dead Letter Queue Service
 */

import {
  DLQEntry,
  DLQStats,
  DLQFilter,
  ErrorDetails,
  ServiceResult,
} from '../types/error-recovery.types';

/**
 * Database-like interface for DLQ persistence
 * In production, this would connect to PostgreSQL with JSONB support
 */
interface IDLQDatabase {
  addEntry(entry: Omit<DLQEntry, 'id'>): Promise<DLQEntry>;
  getEntry(dlqId: string): Promise<DLQEntry | null>;
  getEntries(filter?: DLQFilter, limit?: number, offset?: number): Promise<DLQEntry[]>;
  updateEntry(dlqId: string, updates: Partial<DLQEntry>): Promise<DLQEntry>;
  deleteEntry(dlqId: string): Promise<boolean>;
  countEntries(filter?: DLQFilter): Promise<number>;
  cleanupOldEntries(retentionDays: number): Promise<number>;
  getByStatus(status: 'pending' | 'resolved' | 'failed', limit?: number): Promise<DLQEntry[]>;
}

/**
 * In-memory database implementation for testing/demo
 * Replace with actual database driver in production
 */
class InMemoryDLQDatabase implements IDLQDatabase {
  private entries: Map<string, DLQEntry> = new Map();

  async addEntry(entry: Omit<DLQEntry, 'id'>): Promise<DLQEntry> {
    const id = `dlq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const dlqEntry: DLQEntry = { ...entry, id };
    this.entries.set(id, dlqEntry);
    return dlqEntry;
  }

  async getEntry(dlqId: string): Promise<DLQEntry | null> {
    return this.entries.get(dlqId) || null;
  }

  async getEntries(filter?: DLQFilter, limit = 10, offset = 0): Promise<DLQEntry[]> {
    let result = Array.from(this.entries.values());

    // Apply filters
    if (filter?.taskId) {
      result = result.filter(e => e.taskId === filter.taskId);
    }
    if (filter?.resolved !== undefined) {
      result = result.filter(e => (e.resolvedAt !== null) === filter.resolved);
    }
    if (filter?.minRetryCount !== undefined) {
      result = result.filter(e => e.retryCount >= filter.minRetryCount!);
    }
    if (filter?.maxRetryCount !== undefined) {
      result = result.filter(e => e.retryCount <= filter.maxRetryCount!);
    }
    if (filter?.addedAfter) {
      result = result.filter(e => e.addedAt >= filter.addedAfter!);
    }
    if (filter?.addedBefore) {
      result = result.filter(e => e.addedAt <= filter.addedBefore!);
    }

    // Sort by added_at descending (newest first)
    result.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());

    // Apply pagination
    return result.slice(offset, offset + limit);
  }

  async updateEntry(dlqId: string, updates: Partial<DLQEntry>): Promise<DLQEntry> {
    const entry = this.entries.get(dlqId);
    if (!entry) throw new Error(`DLQ entry ${dlqId} not found`);

    const updated = { ...entry, ...updates };
    this.entries.set(dlqId, updated);
    return updated;
  }

  async deleteEntry(dlqId: string): Promise<boolean> {
    return this.entries.delete(dlqId);
  }

  async countEntries(filter?: DLQFilter): Promise<number> {
    const entries = await this.getEntries(filter, 10000, 0);
    return entries.length;
  }

  async cleanupOldEntries(retentionDays: number): Promise<number> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    let deleted = 0;

    const idsToDelete: string[] = [];
    for (const [id, entry] of Array.from(this.entries.entries())) {
      // Only delete resolved entries older than retention period
      if (entry.resolvedAt && entry.resolvedAt < cutoffDate) {
        idsToDelete.push(id);
      }
    }

    for (const id of idsToDelete) {
      this.entries.delete(id);
      deleted++;
    }

    return deleted;
  }

  async getByStatus(status: 'pending' | 'resolved' | 'failed', limit = 10): Promise<DLQEntry[]> {
    const result = Array.from(this.entries.values()).filter(entry => {
      if (status === 'pending') return entry.resolvedAt === null;
      if (status === 'resolved') return entry.resolvedAt !== null && entry.retryCount === 0;
      if (status === 'failed') return entry.resolvedAt === null && entry.retryCount > 0;
      return false;
    });

    result.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());
    return result.slice(0, limit);
  }
}

/**
 * Dead Letter Queue Service
 * Manages entries for tasks that have exceeded retry limits
 */
export class DeadLetterQueueService {
  private db: IDLQDatabase;
  private maxRetries = 5;
  private notificationCallbacks: Array<(entry: DLQEntry) => Promise<void>> = [];

  constructor(database?: IDLQDatabase) {
    this.db = database || new InMemoryDLQDatabase();
  }

  /**
   * Add an entry to the dead letter queue
   */
  async addToDLQ(
    taskId: string,
    taskDefinition: Record<string, unknown>,
    error: Error,
    retryCount = 0
  ): Promise<ServiceResult<DLQEntry>> {
    try {
      const errorDetails: ErrorDetails = {
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
        timestamp: new Date(),
        attempts: retryCount + 1,
      };

      const entry = await this.db.addEntry({
        taskId,
        taskDefinition,
        errorDetails,
        retryCount,
        addedAt: new Date(),
        resolvedAt: null,
        resolutionNotes: null,
      });

      return {
        success: true,
        data: entry,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to add DLQ entry: ${error}`,
        code: 'DLQ_ADD_ERROR',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get DLQ entries with optional filtering and pagination
   */
  async getDLQEntries(
    filter?: DLQFilter,
    limit = 10,
    offset = 0
  ): Promise<ServiceResult<DLQEntry[]>> {
    try {
      const entries = await this.db.getEntries(filter, limit, offset);
      return {
        success: true,
        data: entries,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to retrieve DLQ entries: ${error}`,
        code: 'DLQ_RETRIEVE_ERROR',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get a specific DLQ entry by ID
   */
  async getDLQEntry(dlqId: string): Promise<ServiceResult<DLQEntry>> {
    try {
      const entry = await this.db.getEntry(dlqId);
      if (!entry) {
        return {
          success: false,
          error: `DLQ entry not found: ${dlqId}`,
          code: 'DLQ_NOT_FOUND',
          timestamp: new Date(),
        };
      }
      return {
        success: true,
        data: entry,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to retrieve DLQ entry: ${error}`,
        code: 'DLQ_RETRIEVE_ERROR',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Resubmit a task from the DLQ
   */
  async resubmitFromDLQ(
    dlqId: string,
    reason: string,
    newDefinition?: Record<string, unknown>
  ): Promise<ServiceResult<void>> {
    try {
      const entry = await this.db.getEntry(dlqId);
      if (!entry) {
        return {
          success: false,
          error: `DLQ entry not found: ${dlqId}`,
          code: 'DLQ_NOT_FOUND',
          timestamp: new Date(),
        };
      }

      // Update task definition if provided
      const updatedDefinition = newDefinition || entry.taskDefinition;

      // Reset retry count and update entry
      await this.db.updateEntry(dlqId, {
        ...entry,
        taskDefinition: updatedDefinition,
        retryCount: 0,
        resolutionNotes: `Resubmitted: ${reason}`,
      });

      return {
        success: true,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to resubmit DLQ entry: ${error}`,
        code: 'DLQ_RESUBMIT_ERROR',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Resolve a DLQ entry with notes
   */
  async resolveDLQEntry(dlqId: string, notes: string): Promise<ServiceResult<void>> {
    try {
      const entry = await this.db.getEntry(dlqId);
      if (!entry) {
        return {
          success: false,
          error: `DLQ entry not found: ${dlqId}`,
          code: 'DLQ_NOT_FOUND',
          timestamp: new Date(),
        };
      }

      await this.db.updateEntry(dlqId, {
        ...entry,
        resolvedAt: new Date(),
        resolutionNotes: notes,
      });

      return {
        success: true,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to resolve DLQ entry: ${error}`,
        code: 'DLQ_RESOLVE_ERROR',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get DLQ statistics
   */
  async getDLQStats(): Promise<ServiceResult<DLQStats>> {
    try {
      const totalEntries = await this.db.countEntries();
      const unresolvedEntries = await this.db.countEntries({ resolved: false });
      const resolvedEntries = totalEntries - unresolvedEntries;

      const allEntries = await this.db.getEntries(undefined, 10000, 0);
      let oldestEntryAge = 0;
      let totalRetries = 0;

      if (allEntries.length > 0) {
        const oldestEntry = allEntries[allEntries.length - 1];
        oldestEntryAge = Date.now() - oldestEntry.addedAt.getTime();
        totalRetries = allEntries.reduce((sum, e) => sum + e.retryCount, 0);
      }

      const stats: DLQStats = {
        totalEntries,
        unresolvedEntries,
        resolvedEntries,
        oldestEntryAge,
        averageRetryCount: allEntries.length > 0 ? totalRetries / allEntries.length : 0,
      };

      return {
        success: true,
        data: stats,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to retrieve DLQ statistics: ${error}`,
        code: 'DLQ_STATS_ERROR',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Batch resolve DLQ entries
   */
  async batchResolveDLQ(dlqIds: string[], notes: string): Promise<ServiceResult<number>> {
    try {
      let resolvedCount = 0;

      for (const dlqId of dlqIds) {
        const entry = await this.db.getEntry(dlqId);
        if (entry) {
          await this.db.updateEntry(dlqId, {
            ...entry,
            resolvedAt: new Date(),
            resolutionNotes: notes,
          });
          resolvedCount++;
        }
      }

      return {
        success: true,
        data: resolvedCount,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to batch resolve DLQ entries: ${error}`,
        code: 'DLQ_BATCH_ERROR',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Cleanup old DLQ entries based on retention policy
   */
  async cleanupDLQ(retentionDays: number): Promise<ServiceResult<{ deleted: number }>> {
    try {
      const deleted = await this.db.cleanupOldEntries(retentionDays);
      return {
        success: true,
        data: { deleted },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to cleanup DLQ entries: ${error}`,
        code: 'DLQ_CLEANUP_ERROR',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Register a callback for DLQ notifications
   */
  onEntryAdded(callback: (entry: DLQEntry) => Promise<void>): void {
    this.notificationCallbacks.push(callback);
  }

  /**
   * Trigger all registered notification callbacks
   */
  async notifyCallbacks(entry: DLQEntry): Promise<void> {
    for (const callback of this.notificationCallbacks) {
      try {
        await callback(entry);
      } catch (error) {
        console.error('[DLQ] Notification callback failed:', error);
      }
    }
  }

  /**
   * Get pending entries (unresolved)
   */
  async getPendingEntries(limit?: number): Promise<ServiceResult<DLQEntry[]>> {
    try {
      const entries = await this.db.getByStatus('pending', limit);
      return {
        success: true,
        data: entries,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to retrieve pending entries: ${error}`,
        code: 'DLQ_PENDING_ERROR',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get failed entries (high retry count)
   */
  async getFailedEntries(limit?: number): Promise<ServiceResult<DLQEntry[]>> {
    try {
      const entries = await this.db.getByStatus('failed', limit);
      return {
        success: true,
        data: entries,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to retrieve failed entries: ${error}`,
        code: 'DLQ_FAILED_ERROR',
        timestamp: new Date(),
      };
    }
  }
}

// Singleton instance
let dlqServiceInstance: DeadLetterQueueService | null = null;

/**
 * Get or create DLQ service instance
 */
export function getDLQService(): DeadLetterQueueService {
  if (!dlqServiceInstance) {
    dlqServiceInstance = new DeadLetterQueueService();
  }
  return dlqServiceInstance;
}

/**
 * Initialize DLQ service with custom database
 */
export function initializeDLQService(database: IDLQDatabase): DeadLetterQueueService {
  dlqServiceInstance = new DeadLetterQueueService(database);
  return dlqServiceInstance;
}
