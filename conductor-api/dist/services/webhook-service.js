/**
 * Webhook Service
 * Manages webhook registration, event delivery, signature verification,
 * and retry logic with exponential backoff
 */
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { WebhookDeliveryStatus, } from '../types/webhook.types.js';
/**
 * Default retry policy for webhooks
 */
const DEFAULT_RETRY_POLICY = {
    maxRetries: 5,
    initialDelayMs: 1000,
    maxDelayMs: 300000, // 5 minutes
    backoffMultiplier: 2,
};
/**
 * Webhook Service
 * Handles webhook registration, event delivery, and retry management
 */
export class WebhookService extends EventEmitter {
    constructor(database, httpClient) {
        super();
        this.deliveryQueue = [];
        this.isProcessing = false;
        this.db = database;
        this.httpClient = httpClient;
    }
    /**
     * Generate unique ID for webhooks and deliveries
     */
    generateId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Register a new webhook
     */
    async registerWebhook(request) {
        const webhook = {
            id: this.generateId('wh'),
            eventType: request.eventType,
            url: request.url,
            headers: request.headers,
            enabled: request.enabled ?? true,
            retryPolicy: {
                ...DEFAULT_RETRY_POLICY,
                ...request.retryPolicy,
            },
            secret: request.secret,
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: request.metadata,
        };
        const saved = await this.db.saveWebhook(webhook);
        this.emit('webhook:registered', saved);
        return saved;
    }
    /**
     * Get webhook by ID
     */
    async getWebhook(id) {
        return this.db.getWebhook(id);
    }
    /**
     * List webhooks with optional filtering
     */
    async listWebhooks(filter) {
        return this.db.listWebhooks(filter);
    }
    /**
     * Update webhook configuration
     */
    async updateWebhook(id, request) {
        const existing = await this.db.getWebhook(id);
        if (!existing) {
            throw new Error(`Webhook ${id} not found`);
        }
        const updates = {
            ...request,
            updatedAt: new Date(),
        };
        if (request.retryPolicy) {
            updates.retryPolicy = {
                ...existing.retryPolicy,
                ...request.retryPolicy,
            };
        }
        const updated = await this.db.updateWebhook(id, updates);
        this.emit('webhook:updated', updated);
        return updated;
    }
    /**
     * Delete webhook
     */
    async deleteWebhook(id) {
        const webhook = await this.db.getWebhook(id);
        if (!webhook) {
            throw new Error(`Webhook ${id} not found`);
        }
        await this.db.deleteWebhook(id);
        this.emit('webhook:deleted', webhook);
    }
    /**
     * Trigger event and deliver to registered webhooks
     */
    async triggerEvent(event) {
        const webhooks = await this.db.listWebhooks({
            eventType: event.eventType,
            enabled: true,
        });
        for (const webhook of webhooks) {
            const delivery = {
                id: this.generateId('del'),
                webhookId: webhook.id,
                eventType: event.eventType,
                eventData: event.data,
                status: WebhookDeliveryStatus.PENDING,
                attemptNumber: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            const saved = await this.db.saveDelivery(delivery);
            this.deliveryQueue.push(saved);
            this.emit('delivery:queued', saved);
        }
        // Start processing if not already running
        this.processDeliveryQueue();
    }
    /**
     * Get webhook deliveries with filtering
     */
    async getDeliveries(webhookId, filter) {
        return this.db.listDeliveries({
            ...filter,
            webhookId,
        });
    }
    /**
     * Get single delivery
     */
    async getDelivery(id) {
        return this.db.getDelivery(id);
    }
    /**
     * Manually retry a failed delivery
     */
    async retryDelivery(deliveryId) {
        const delivery = await this.db.getDelivery(deliveryId);
        if (!delivery) {
            throw new Error(`Delivery ${deliveryId} not found`);
        }
        if (delivery.status !== WebhookDeliveryStatus.FAILED) {
            throw new Error(`Can only retry failed deliveries, current status: ${delivery.status}`);
        }
        const updated = await this.db.updateDelivery(deliveryId, {
            status: WebhookDeliveryStatus.RETRYING,
            attemptNumber: delivery.attemptNumber + 1,
            updatedAt: new Date(),
        });
        this.deliveryQueue.push(updated);
        this.processDeliveryQueue();
        return updated;
    }
    /**
     * Process delivery queue
     */
    async processDeliveryQueue() {
        if (this.isProcessing || this.deliveryQueue.length === 0) {
            return;
        }
        this.isProcessing = true;
        try {
            while (this.deliveryQueue.length > 0) {
                const delivery = this.deliveryQueue.shift();
                if (delivery) {
                    await this.sendDelivery(delivery);
                }
            }
        }
        finally {
            this.isProcessing = false;
        }
    }
    /**
     * Send webhook delivery to registered URL
     */
    async sendDelivery(delivery) {
        try {
            const webhook = await this.db.getWebhook(delivery.webhookId);
            if (!webhook) {
                await this.db.updateDelivery(delivery.id, {
                    status: WebhookDeliveryStatus.FAILED,
                    error: 'Webhook configuration not found',
                    completedAt: new Date(),
                    updatedAt: new Date(),
                });
                this.emit('delivery:failed', delivery);
                return;
            }
            // Check if we should retry
            if (delivery.status === WebhookDeliveryStatus.RETRYING && delivery.nextRetryAt) {
                const now = new Date();
                if (now < delivery.nextRetryAt) {
                    // Not yet time to retry, re-queue
                    this.deliveryQueue.push(delivery);
                    return;
                }
            }
            // Prepare headers
            const headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'Conductor-Webhook/1.0',
                ...(webhook.headers || {}),
            };
            // Add signature if secret is configured
            if (webhook.secret) {
                const signature = this.generateSignature(delivery.eventData, webhook.secret);
                headers['X-Conductor-Signature'] = signature;
                headers['X-Conductor-Timestamp'] = new Date().toISOString();
            }
            // Send webhook
            const response = await this.httpClient.post(webhook.url, delivery.eventData, {
                headers,
                timeout: 30000,
            });
            if (response.statusCode >= 200 && response.statusCode < 300) {
                // Success
                await this.db.updateDelivery(delivery.id, {
                    status: WebhookDeliveryStatus.SUCCESS,
                    statusCode: response.statusCode,
                    responseBody: response.body,
                    sentAt: new Date(),
                    completedAt: new Date(),
                    updatedAt: new Date(),
                });
                this.emit('delivery:success', delivery);
            }
            else {
                // Failure - check if we should retry
                await this.handleDeliveryFailure(delivery, webhook, response.statusCode, response.body);
            }
        }
        catch (error) {
            // Network or other error - retry
            await this.handleDeliveryFailure(delivery, null, undefined, error instanceof Error ? error.message : 'Unknown error');
        }
    }
    /**
     * Handle delivery failure and schedule retry
     */
    async handleDeliveryFailure(delivery, webhook, statusCode, errorMessage) {
        const retryPolicy = webhook?.retryPolicy || DEFAULT_RETRY_POLICY;
        if (delivery.attemptNumber >= retryPolicy.maxRetries) {
            // Max retries exceeded
            await this.db.updateDelivery(delivery.id, {
                status: WebhookDeliveryStatus.FAILED,
                statusCode,
                responseBody: errorMessage,
                error: `Max retries exceeded after ${delivery.attemptNumber} attempts`,
                completedAt: new Date(),
                updatedAt: new Date(),
            });
            this.emit('delivery:failed', delivery);
        }
        else {
            // Schedule retry
            const delayMs = this.calculateBackoff(delivery.attemptNumber, retryPolicy.initialDelayMs, retryPolicy.maxDelayMs, retryPolicy.backoffMultiplier);
            const nextRetryAt = new Date(Date.now() + delayMs);
            await this.db.updateDelivery(delivery.id, {
                status: WebhookDeliveryStatus.RETRYING,
                statusCode,
                responseBody: errorMessage,
                error: errorMessage,
                attemptNumber: delivery.attemptNumber + 1,
                nextRetryAt,
                updatedAt: new Date(),
            });
            this.emit('delivery:retrying', delivery);
            // Re-queue for retry
            const updated = await this.db.getDelivery(delivery.id);
            if (updated) {
                this.deliveryQueue.push(updated);
            }
        }
    }
    /**
     * Calculate exponential backoff delay with jitter
     */
    calculateBackoff(attemptNumber, initialDelayMs, maxDelayMs, multiplier) {
        const exponentialDelay = Math.min(initialDelayMs * Math.pow(multiplier, attemptNumber - 1), maxDelayMs);
        // Add jitter (±10% of delay)
        const jitter = exponentialDelay * 0.1 * (Math.random() - 0.5);
        return Math.max(100, exponentialDelay + jitter);
    }
    /**
     * Generate HMAC signature for webhook payload
     */
    generateSignature(data, secret) {
        const payload = JSON.stringify(data);
        return crypto.createHmac('sha256', secret).update(payload).digest('hex');
    }
    /**
     * Verify webhook signature
     */
    static verifySignature(payload, signature, secret) {
        const computed = crypto.createHmac('sha256', secret).update(payload).digest('hex');
        return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
    }
}
/**
 * Factory function to create webhook service
 */
export function createWebhookService(database, httpClient) {
    return new WebhookService(database, httpClient);
}
//# sourceMappingURL=webhook-service.js.map