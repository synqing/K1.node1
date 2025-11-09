/**
 * Dead Letter Queue Processor Worker
 * Background worker for monitoring DLQ, processing entries, and cleanup
 * Task T6: Dead Letter Queue Service
 */

import { getDLQService } from '../services/dead-letter-queue';
import { DLQEntry } from '../types/error-recovery.types';

/**
 * Configuration for DLQ processor
 */
interface DLQProcessorConfig {
  pollingIntervalMs: number;
  retentionDays: number;
  maxRetryLimit: number;
  notificationEnabled: boolean;
  archiveAfterDays: number;
}

/**
 * Notification handler for DLQ events
 */
interface NotificationHandler {
  send(entry: DLQEntry, type: 'pending' | 'archived' | 'failed'): Promise<void>;
}

/**
 * Dead Letter Queue Processor Worker
 * Periodically:
 * - Monitors entries with exceeded retries
 * - Moves entries to archive
 * - Sends notifications
 * - Generates reports
 * - Cleans up old entries
 */
export class DLQProcessorWorker {
  private dlqService = getDLQService();
  private config: DLQProcessorConfig;
  private notificationHandler: NotificationHandler | null = null;
  private processingInterval: NodeJS.Timer | null = null;
  private isRunning = false;
  private stats = {
    processedEntries: 0,
    archivedEntries: 0,
    notificationsSent: 0,
    cleanupCycles: 0,
    lastProcessingTime: 0,
  };

  constructor(config: Partial<DLQProcessorConfig> = {}) {
    this.config = {
      pollingIntervalMs: config.pollingIntervalMs || 30000, // 30 seconds
      retentionDays: config.retentionDays || 90,
      maxRetryLimit: config.maxRetryLimit || 5,
      notificationEnabled: config.notificationEnabled !== false,
      archiveAfterDays: config.archiveAfterDays || 30,
    };
  }

  /**
   * Start the DLQ processor worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[DLQ Worker] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[DLQ Worker] Started with polling interval:', this.config.pollingIntervalMs, 'ms');

    // Initial processing
    await this.processDLQ();

    // Set up periodic processing
    this.processingInterval = setInterval(async () => {
      try {
        await this.processDLQ();
      } catch (error) {
        console.error('[DLQ Worker] Processing cycle failed:', error);
      }
    }, this.config.pollingIntervalMs);
  }

  /**
   * Stop the DLQ processor worker
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('[DLQ Worker] Not running');
      return;
    }

    this.isRunning = false;

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    console.log('[DLQ Worker] Stopped');
  }

  /**
   * Set notification handler for DLQ events
   */
  setNotificationHandler(handler: NotificationHandler): void {
    this.notificationHandler = handler;
  }

  /**
   * Main processing cycle
   */
  private async processDLQ(): Promise<void> {
    const startTime = Date.now();

    try {
      // Step 1: Process pending entries with high retry counts
      await this.processHighRetryEntries();

      // Step 2: Archive old entries
      await this.archiveOldEntries();

      // Step 3: Send notifications for unresolved items
      await this.sendNotificationsForUnresolved();

      // Step 4: Cleanup old entries based on retention policy
      await this.cleanupOldEntries();

      // Update stats
      this.stats.lastProcessingTime = Date.now() - startTime;
    } catch (error) {
      console.error('[DLQ Worker] Cycle error:', error);
    }
  }

  /**
   * Process entries that have exceeded retry limit
   */
  private async processHighRetryEntries(): Promise<void> {
    const result = await this.dlqService.getPendingEntries(100);

    if (!result.success || !result.data) {
      return;
    }

    for (const entry of result.data) {
      if (entry.retryCount >= this.config.maxRetryLimit) {
        // Mark as permanently failed
        const resolution = `Auto-archived: Exceeded ${this.config.maxRetryLimit} retry limit`;
        await this.dlqService.resolveDLQEntry(entry.id, resolution);

        this.stats.archivedEntries++;

        // Send notification if enabled
        if (this.notificationHandler && this.config.notificationEnabled) {
          try {
            await this.notificationHandler.send(entry, 'archived');
            this.stats.notificationsSent++;
          } catch (error) {
            console.error('[DLQ Worker] Notification failed for entry', entry.id, error);
          }
        }
      }
    }
  }

  /**
   * Archive entries older than archiveAfterDays
   */
  private async archiveOldEntries(): Promise<void> {
    const result = await this.dlqService.getPendingEntries(100);

    if (!result.success || !result.data) {
      return;
    }

    const cutoffDate = new Date(Date.now() - this.config.archiveAfterDays * 24 * 60 * 60 * 1000);

    for (const entry of result.data) {
      if (entry.addedAt < cutoffDate) {
        const reason = `Auto-archived after ${this.config.archiveAfterDays} days without resolution`;
        await this.dlqService.resolveDLQEntry(entry.id, reason);
        this.stats.archivedEntries++;
      }
    }
  }

  /**
   * Send notifications for unresolved entries
   */
  private async sendNotificationsForUnresolved(): Promise<void> {
    if (!this.notificationHandler || !this.config.notificationEnabled) {
      return;
    }

    const result = await this.dlqService.getPendingEntries(50);

    if (!result.success || !result.data) {
      return;
    }

    for (const entry of result.data) {
      // Only notify for entries added within last 24 hours to avoid spam
      const ageHours = (Date.now() - entry.addedAt.getTime()) / (1000 * 60 * 60);
      if (ageHours < 24) {
        try {
          await this.notificationHandler.send(entry, 'pending');
          this.stats.notificationsSent++;
        } catch (error) {
          console.error('[DLQ Worker] Notification failed for entry', entry.id, error);
        }
      }
    }
  }

  /**
   * Cleanup old entries based on retention policy
   */
  private async cleanupOldEntries(): Promise<void> {
    const result = await this.dlqService.cleanupDLQ(this.config.retentionDays);

    if (result.success && result.data) {
      this.stats.cleanupCycles++;
      if (result.data.deleted > 0) {
        console.log('[DLQ Worker] Cleaned up', result.data.deleted, 'entries older than', this.config.retentionDays, 'days');
      }
    }
  }

  /**
   * Get current worker status and metrics
   */
  getStatus(): {
    isRunning: boolean;
    config: DLQProcessorConfig;
    stats: typeof this.stats;
  } {
    return {
      isRunning: this.isRunning,
      config: this.config,
      stats: { ...this.stats },
    };
  }

  /**
   * Generate a report on DLQ backlog
   */
  async generateBacklogReport(): Promise<{
    timestamp: Date;
    stats: any;
    pendingCount: number;
    failedCount: number;
    highRetryEntries: DLQEntry[];
  }> {
    const statsResult = await this.dlqService.getDLQStats();
    const pendingResult = await this.dlqService.getPendingEntries(10);
    const failedResult = await this.dlqService.getFailedEntries(10);

    const stats = statsResult.data || {
      totalEntries: 0,
      unresolvedEntries: 0,
      resolvedEntries: 0,
      oldestEntryAge: 0,
      averageRetryCount: 0,
    };

    return {
      timestamp: new Date(),
      stats,
      pendingCount: pendingResult.data?.length || 0,
      failedCount: failedResult.data?.length || 0,
      highRetryEntries: failedResult.data || [],
    };
  }

  /**
   * Reset worker statistics
   */
  resetStats(): void {
    this.stats = {
      processedEntries: 0,
      archivedEntries: 0,
      notificationsSent: 0,
      cleanupCycles: 0,
      lastProcessingTime: 0,
    };
  }
}

/**
 * Simple email notification handler
 * In production, integrate with email service (SendGrid, AWS SES, etc.)
 */
export class EmailNotificationHandler implements NotificationHandler {
  constructor(
    private senderEmail: string,
    private recipientEmail: string,
    private smtpClient?: any // Would be actual SMTP client in production
  ) {}

  async send(entry: DLQEntry, type: 'pending' | 'archived' | 'failed'): Promise<void> {
    const subject = this.getSubject(type);
    const message = this.formatMessage(entry, type);

    console.log(
      `[Notification] Email would be sent to ${this.recipientEmail}:\n Subject: ${subject}\n Message: ${message}`
    );

    // In production, would use actual SMTP client:
    // await this.smtpClient.send({ to: this.recipientEmail, subject, text: message });
  }

  private getSubject(type: 'pending' | 'archived' | 'failed'): string {
    const subjects = {
      pending: 'DLQ Alert: Unresolved Task',
      archived: 'DLQ Alert: Task Archived',
      failed: 'DLQ Alert: Task Failed',
    };
    return subjects[type];
  }

  private formatMessage(entry: DLQEntry, type: 'pending' | 'archived' | 'failed'): string {
    return `
Task ID: ${entry.taskId}
DLQ ID: ${entry.id}
Status: ${type}
Retry Count: ${entry.retryCount}
Added: ${entry.addedAt}
Error: ${entry.errorDetails.message}
    `.trim();
  }
}

/**
 * Simple webhook notification handler
 * Sends notifications to external webhooks
 */
export class WebhookNotificationHandler implements NotificationHandler {
  constructor(private webhookUrl: string) {}

  async send(entry: DLQEntry, type: 'pending' | 'archived' | 'failed'): Promise<void> {
    const payload = {
      event: `dlq.${type}`,
      timestamp: new Date().toISOString(),
      entry: {
        id: entry.id,
        taskId: entry.taskId,
        retryCount: entry.retryCount,
        errorMessage: entry.errorDetails.message,
      },
    };

    console.log(`[Notification] Webhook POST to ${this.webhookUrl}:`, payload);

    // In production, would use fetch or axios:
    // await fetch(this.webhookUrl, { method: 'POST', body: JSON.stringify(payload) });
  }
}

/**
 * Global worker instance
 */
let processorWorkerInstance: DLQProcessorWorker | null = null;

/**
 * Get or create DLQ processor worker instance
 */
export function getDLQProcessorWorker(
  config?: Partial<DLQProcessorConfig>
): DLQProcessorWorker {
  if (!processorWorkerInstance) {
    processorWorkerInstance = new DLQProcessorWorker(config);
  }
  return processorWorkerInstance;
}

/**
 * Initialize DLQ processor worker with custom configuration
 */
export function initializeDLQProcessorWorker(
  config: Partial<DLQProcessorConfig>
): DLQProcessorWorker {
  processorWorkerInstance = new DLQProcessorWorker(config);
  return processorWorkerInstance;
}
