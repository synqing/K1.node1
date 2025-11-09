/**
 * Dead Letter Queue Service
 * Manages failed tasks that exhausted all retry attempts
 */
/**
 * Dead Letter Queue Service
 * Handles storage and management of failed tasks
 */
export class DeadLetterQueue {
    constructor(storage) {
        this.storage = storage;
    }
    /**
     * Add a failed task to the DLQ
     * @param taskId - ID of the failed task
     * @param taskDefinition - the task definition/payload
     * @param errorDetails - error information
     * @param retryCount - number of retries attempted
     * @returns the created DLQ entry
     */
    async addFailedTask(taskId, taskDefinition, errorDetails, retryCount) {
        const entry = {
            id: `dlq_${taskId}_${Date.now()}`,
            taskId,
            taskDefinition,
            errorDetails,
            retryCount,
            addedAt: new Date(),
            resolvedAt: null,
            resolutionNotes: null,
        };
        return this.storage.addEntry(entry);
    }
    /**
     * Get a DLQ entry by ID
     * @param id - DLQ entry ID
     * @returns the DLQ entry or null if not found
     */
    async getEntry(id) {
        return this.storage.getEntry(id);
    }
    /**
     * List DLQ entries with optional filtering
     * @param filter - optional filter criteria
     * @param limit - maximum number of entries to return
     * @returns array of DLQ entries
     */
    async listEntries(filter, limit) {
        return this.storage.listEntries(filter, limit);
    }
    /**
     * Mark a DLQ entry as resolved
     * @param id - DLQ entry ID
     * @param notes - resolution notes
     */
    async resolveEntry(id, notes) {
        const entry = await this.storage.getEntry(id);
        if (!entry) {
            throw new Error(`DLQ entry not found: ${id}`);
        }
        entry.resolvedAt = new Date();
        entry.resolutionNotes = notes;
        await this.storage.updateEntry(entry);
    }
    /**
     * Resubmit a DLQ entry as a new task
     * @param id - DLQ entry ID
     * @param modifiedDefinition - optional modified task definition
     * @returns the entry as it was resubmitted
     */
    async resubmitEntry(id, modifiedDefinition) {
        const entry = await this.storage.getEntry(id);
        if (!entry) {
            throw new Error(`DLQ entry not found: ${id}`);
        }
        // Update task definition if provided
        if (modifiedDefinition) {
            entry.taskDefinition = modifiedDefinition;
        }
        // Reset retry count for resubmission
        entry.retryCount = 0;
        await this.storage.updateEntry(entry);
        return entry;
    }
    /**
     * Get DLQ statistics
     * @returns statistics about the DLQ
     */
    async getStats() {
        return this.storage.getStats();
    }
    /**
     * Get unresolved entries (backlog)
     * @param limit - maximum number to return
     * @returns array of unresolved entries
     */
    async getBacklog(limit = 100) {
        return this.storage.listEntries({ resolved: false }, limit);
    }
    /**
     * Clean up old resolved entries
     * @param retentionDays - keep entries resolved within this many days
     * @returns number of entries deleted
     */
    async cleanupResolved(retentionDays = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
        const entries = await this.storage.listEntries({
            resolved: true,
            addedBefore: cutoffDate,
        });
        let deletedCount = 0;
        for (const entry of entries) {
            if (entry.resolvedAt && entry.resolvedAt < cutoffDate) {
                await this.storage.deleteEntry(entry.id);
                deletedCount += 1;
            }
        }
        return deletedCount;
    }
    /**
     * Get entries by task ID
     * @param taskId - task ID to search for
     * @returns array of matching entries
     */
    async getEntriesByTaskId(taskId) {
        return this.storage.listEntries({ taskId });
    }
    /**
     * Check if a task is in the DLQ
     * @param taskId - task ID to check
     * @returns true if task has unresolved entries in DLQ
     */
    async isInDLQ(taskId) {
        const entries = await this.storage.listEntries({ taskId, resolved: false });
        return entries.length > 0;
    }
}
//# sourceMappingURL=dlq.js.map