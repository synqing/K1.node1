/**
 * Webhook Service
 * Manages webhook registration, event delivery, signature verification,
 * and retry logic with exponential backoff
 */
import { EventEmitter } from 'events';
import { IWebhookService, WebhookDatabase, HttpClient, Webhook, WebhookDelivery, WebhookEvent, CreateWebhookRequest, UpdateWebhookRequest, WebhookFilterOptions, WebhookDeliveryFilterOptions } from '../types/webhook.types.js';
/**
 * Webhook Service
 * Handles webhook registration, event delivery, and retry management
 */
export declare class WebhookService extends EventEmitter implements IWebhookService {
    private db;
    private httpClient;
    private deliveryQueue;
    private isProcessing;
    constructor(database: WebhookDatabase, httpClient: HttpClient);
    /**
     * Generate unique ID for webhooks and deliveries
     */
    private generateId;
    /**
     * Register a new webhook
     */
    registerWebhook(request: CreateWebhookRequest): Promise<Webhook>;
    /**
     * Get webhook by ID
     */
    getWebhook(id: string): Promise<Webhook | null>;
    /**
     * List webhooks with optional filtering
     */
    listWebhooks(filter?: WebhookFilterOptions): Promise<Webhook[]>;
    /**
     * Update webhook configuration
     */
    updateWebhook(id: string, request: UpdateWebhookRequest): Promise<Webhook>;
    /**
     * Delete webhook
     */
    deleteWebhook(id: string): Promise<void>;
    /**
     * Trigger event and deliver to registered webhooks
     */
    triggerEvent(event: WebhookEvent): Promise<void>;
    /**
     * Get webhook deliveries with filtering
     */
    getDeliveries(webhookId: string, filter?: WebhookDeliveryFilterOptions): Promise<WebhookDelivery[]>;
    /**
     * Get single delivery
     */
    getDelivery(id: string): Promise<WebhookDelivery | null>;
    /**
     * Manually retry a failed delivery
     */
    retryDelivery(deliveryId: string): Promise<WebhookDelivery>;
    /**
     * Process delivery queue
     */
    private processDeliveryQueue;
    /**
     * Send webhook delivery to registered URL
     */
    private sendDelivery;
    /**
     * Handle delivery failure and schedule retry
     */
    private handleDeliveryFailure;
    /**
     * Calculate exponential backoff delay with jitter
     */
    private calculateBackoff;
    /**
     * Generate HMAC signature for webhook payload
     */
    private generateSignature;
    /**
     * Verify webhook signature
     */
    static verifySignature(payload: string, signature: string, secret: string): boolean;
}
/**
 * Factory function to create webhook service
 */
export declare function createWebhookService(database: WebhookDatabase, httpClient: HttpClient): WebhookService;
//# sourceMappingURL=webhook-service.d.ts.map