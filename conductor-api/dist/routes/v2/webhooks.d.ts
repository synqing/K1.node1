/**
 * Webhook API Routes (T11)
 * Endpoints for webhook registration, delivery tracking, and management
 *
 * Endpoints:
 * - POST /v2/webhooks - Register new webhook
 * - GET /v2/webhooks - List webhooks
 * - GET /v2/webhooks/:id - Get webhook details
 * - PATCH /v2/webhooks/:id - Update webhook
 * - DELETE /v2/webhooks/:id - Delete webhook
 * - GET /v2/webhooks/:id/deliveries - Webhook delivery history
 * - GET /v2/webhooks/:id/deliveries/:deliveryId - Get delivery details
 * - POST /v2/webhooks/:id/deliveries/:deliveryId/retry - Retry delivery
 */
import { Router } from 'express';
import { WebhookService } from '../../services/webhook-service.js';
/**
 * Create webhook routes
 */
export declare function createWebhookRouter(webhookService: WebhookService): Router;
//# sourceMappingURL=webhooks.d.ts.map