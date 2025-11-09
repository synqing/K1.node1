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
import { asyncHandler, ValidationError, NotFoundError, } from '../../middleware/v2-error-handler.js';
/**
 * Valid webhook event types
 */
const VALID_EVENT_TYPES = ['task.retry', 'schedule.executed', 'error.recovered'];
/**
 * Webhook configuration constants
 */
const WEBHOOK_CONFIG = {
    MAX_URL_LENGTH: 2048,
    MAX_HEADERS: 20,
    MAX_HEADER_VALUE_LENGTH: 1024,
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
};
/**
 * Create webhook routes
 */
export function createWebhookRouter(webhookService) {
    const router = Router();
    /**
     * POST /v2/webhooks - Register new webhook
     * Request body: {
     *   eventType: string (task.retry | schedule.executed | error.recovered)
     *   url: string (valid URL)
     *   headers?: object (optional custom headers)
     *   enabled?: boolean (default: true)
     *   retryPolicy?: object (optional retry configuration)
     *   secret?: string (optional HMAC secret)
     *   metadata?: object (optional metadata)
     * }
     */
    router.post('/', asyncHandler(async (req, res) => {
        const { eventType, url, headers, enabled, retryPolicy, secret, metadata } = req.body;
        // Validate required fields
        if (!eventType || !url) {
            throw new ValidationError('eventType and url are required');
        }
        // Validate event type
        if (!VALID_EVENT_TYPES.includes(eventType)) {
            throw new ValidationError(`Invalid eventType. Must be one of: ${VALID_EVENT_TYPES.join(', ')}`);
        }
        // Validate URL
        try {
            new URL(url);
        }
        catch {
            throw new ValidationError('Invalid URL format');
        }
        if (url.length > WEBHOOK_CONFIG.MAX_URL_LENGTH) {
            throw new ValidationError(`URL exceeds maximum length of ${WEBHOOK_CONFIG.MAX_URL_LENGTH}`);
        }
        // Validate headers
        if (headers) {
            if (!isObject(headers)) {
                throw new ValidationError('headers must be an object');
            }
            if (Object.keys(headers).length > WEBHOOK_CONFIG.MAX_HEADERS) {
                throw new ValidationError(`headers exceeds maximum count of ${WEBHOOK_CONFIG.MAX_HEADERS}`);
            }
            for (const [key, value] of Object.entries(headers)) {
                if (typeof value !== 'string' || value.length > WEBHOOK_CONFIG.MAX_HEADER_VALUE_LENGTH) {
                    throw new ValidationError(`header value for "${key}" exceeds maximum length of ${WEBHOOK_CONFIG.MAX_HEADER_VALUE_LENGTH}`);
                }
            }
        }
        // Validate retry policy if provided
        if (retryPolicy) {
            validateRetryPolicy(retryPolicy);
        }
        const request = {
            eventType,
            url,
            headers,
            enabled,
            retryPolicy,
            secret,
            metadata,
        };
        const webhook = await webhookService.registerWebhook(request);
        res.status(201).json({
            status: 'success',
            data: {
                webhook,
                message: 'Webhook registered successfully',
            },
        });
    }));
    /**
     * GET /v2/webhooks - List webhooks
     * Query params:
     *   eventType?: string
     *   enabled?: boolean
     *   limit?: number (default: 20, max: 100)
     *   offset?: number (default: 0)
     */
    router.get('/', asyncHandler(async (req, res) => {
        const { eventType, enabled, limit, offset } = req.query;
        // Parse and validate query parameters
        const pageSize = Math.min(Math.max(1, parseInt(String(limit)) || WEBHOOK_CONFIG.DEFAULT_PAGE_SIZE), WEBHOOK_CONFIG.MAX_PAGE_SIZE);
        const pageOffset = Math.max(0, parseInt(String(offset)) || 0);
        const filter = {
            limit: pageSize,
            offset: pageOffset,
        };
        if (eventType && VALID_EVENT_TYPES.includes(String(eventType))) {
            filter.eventType = String(eventType);
        }
        if (enabled !== undefined) {
            filter.enabled = String(enabled).toLowerCase() === 'true';
        }
        const webhooks = await webhookService.listWebhooks(filter);
        res.json({
            status: 'success',
            data: {
                webhooks,
                pagination: {
                    limit: pageSize,
                    offset: pageOffset,
                    count: webhooks.length,
                },
            },
        });
    }));
    /**
     * GET /v2/webhooks/:id - Get webhook details
     */
    router.get('/:id', asyncHandler(async (req, res) => {
        const { id } = req.params;
        const webhook = await webhookService.getWebhook(id);
        if (!webhook) {
            throw new NotFoundError(`Webhook ${id} not found`);
        }
        res.json({
            status: 'success',
            data: { webhook },
        });
    }));
    /**
     * PATCH /v2/webhooks/:id - Update webhook
     * Request body: {
     *   url?: string
     *   headers?: object
     *   enabled?: boolean
     *   retryPolicy?: object
     *   secret?: string
     *   metadata?: object
     * }
     */
    router.patch('/:id', asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { url, headers, enabled, retryPolicy, secret, metadata } = req.body;
        // Validate URL if provided
        if (url !== undefined) {
            try {
                new URL(url);
            }
            catch {
                throw new ValidationError('Invalid URL format');
            }
            if (url.length > WEBHOOK_CONFIG.MAX_URL_LENGTH) {
                throw new ValidationError(`URL exceeds maximum length of ${WEBHOOK_CONFIG.MAX_URL_LENGTH}`);
            }
        }
        // Validate headers if provided
        if (headers !== undefined) {
            if (!isObject(headers)) {
                throw new ValidationError('headers must be an object');
            }
            if (Object.keys(headers).length > WEBHOOK_CONFIG.MAX_HEADERS) {
                throw new ValidationError(`headers exceeds maximum count of ${WEBHOOK_CONFIG.MAX_HEADERS}`);
            }
        }
        // Validate retry policy if provided
        if (retryPolicy) {
            validateRetryPolicy(retryPolicy);
        }
        const request = {
            url,
            headers,
            enabled,
            retryPolicy,
            secret,
            metadata,
        };
        const webhook = await webhookService.updateWebhook(id, request);
        res.json({
            status: 'success',
            data: {
                webhook,
                message: 'Webhook updated successfully',
            },
        });
    }));
    /**
     * DELETE /v2/webhooks/:id - Delete webhook
     */
    router.delete('/:id', asyncHandler(async (req, res) => {
        const { id } = req.params;
        // Check if webhook exists
        const webhook = await webhookService.getWebhook(id);
        if (!webhook) {
            throw new NotFoundError(`Webhook ${id} not found`);
        }
        await webhookService.deleteWebhook(id);
        res.json({
            status: 'success',
            data: {
                message: 'Webhook deleted successfully',
                id,
            },
        });
    }));
    /**
     * GET /v2/webhooks/:id/deliveries - Webhook delivery history
     * Query params:
     *   status?: string (success | failed | pending | retrying)
     *   startDate?: ISO string
     *   endDate?: ISO string
     *   limit?: number (default: 20, max: 100)
     *   page?: number (default: 1)
     */
    router.get('/:id/deliveries', asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { status, startDate, endDate, limit, page } = req.query;
        // Check if webhook exists
        const webhook = await webhookService.getWebhook(id);
        if (!webhook) {
            throw new NotFoundError(`Webhook ${id} not found`);
        }
        // Parse pagination
        const pageSize = Math.min(Math.max(1, parseInt(String(limit)) || WEBHOOK_CONFIG.DEFAULT_PAGE_SIZE), WEBHOOK_CONFIG.MAX_PAGE_SIZE);
        const pageNum = Math.max(1, parseInt(String(page)) || 1);
        const offset = (pageNum - 1) * pageSize;
        // Parse dates
        let startDateObj;
        let endDateObj;
        if (startDate) {
            startDateObj = new Date(String(startDate));
            if (isNaN(startDateObj.getTime())) {
                throw new ValidationError('Invalid startDate format');
            }
        }
        if (endDate) {
            endDateObj = new Date(String(endDate));
            if (isNaN(endDateObj.getTime())) {
                throw new ValidationError('Invalid endDate format');
            }
        }
        const filter = {
            webhookId: id,
            limit: pageSize,
            offset,
            page: pageNum,
            startDate: startDateObj,
            endDate: endDateObj,
        };
        if (status) {
            filter.status = String(status);
        }
        const deliveries = await webhookService.getDeliveries(id, filter);
        res.json({
            status: 'success',
            data: {
                deliveries,
                pagination: {
                    page: pageNum,
                    limit: pageSize,
                    count: deliveries.length,
                },
            },
        });
    }));
    /**
     * GET /v2/webhooks/:id/deliveries/:deliveryId - Get delivery details
     */
    router.get('/:id/deliveries/:deliveryId', asyncHandler(async (req, res) => {
        const { id, deliveryId } = req.params;
        // Check if webhook exists
        const webhook = await webhookService.getWebhook(id);
        if (!webhook) {
            throw new NotFoundError(`Webhook ${id} not found`);
        }
        const delivery = await webhookService.getDelivery(deliveryId);
        if (!delivery || delivery.webhookId !== id) {
            throw new NotFoundError(`Delivery ${deliveryId} not found`);
        }
        res.json({
            status: 'success',
            data: { delivery },
        });
    }));
    /**
     * POST /v2/webhooks/:id/deliveries/:deliveryId/retry - Retry delivery
     */
    router.post('/:id/deliveries/:deliveryId/retry', asyncHandler(async (req, res) => {
        const { id, deliveryId } = req.params;
        // Check if webhook exists
        const webhook = await webhookService.getWebhook(id);
        if (!webhook) {
            throw new NotFoundError(`Webhook ${id} not found`);
        }
        const delivery = await webhookService.getDelivery(deliveryId);
        if (!delivery || delivery.webhookId !== id) {
            throw new NotFoundError(`Delivery ${deliveryId} not found`);
        }
        const retried = await webhookService.retryDelivery(deliveryId);
        res.json({
            status: 'success',
            data: {
                delivery: retried,
                message: 'Delivery retry scheduled successfully',
            },
        });
    }));
    return router;
}
/**
 * Validate retry policy object
 */
function validateRetryPolicy(policy) {
    if (!isObject(policy)) {
        throw new ValidationError('retryPolicy must be an object');
    }
    if (policy.maxRetries !== undefined) {
        if (!Number.isInteger(policy.maxRetries) || policy.maxRetries < 0 || policy.maxRetries > 100) {
            throw new ValidationError('maxRetries must be an integer between 0 and 100');
        }
    }
    if (policy.initialDelayMs !== undefined) {
        if (!Number.isInteger(policy.initialDelayMs) || policy.initialDelayMs < 100) {
            throw new ValidationError('initialDelayMs must be an integer >= 100');
        }
    }
    if (policy.maxDelayMs !== undefined) {
        if (!Number.isInteger(policy.maxDelayMs) || policy.maxDelayMs < 1000) {
            throw new ValidationError('maxDelayMs must be an integer >= 1000');
        }
    }
    if (policy.backoffMultiplier !== undefined) {
        if (typeof policy.backoffMultiplier !== 'number' || policy.backoffMultiplier < 1 || policy.backoffMultiplier > 10) {
            throw new ValidationError('backoffMultiplier must be a number between 1 and 10');
        }
    }
}
/**
 * Check if value is a plain object
 */
function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=webhooks.js.map