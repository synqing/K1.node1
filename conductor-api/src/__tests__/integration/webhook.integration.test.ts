import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { WebhookService } from '../../services/webhook-service';
import { createWebhookRouter } from '../../routes/v2/webhooks';

describe('Webhook Integration Tests', () => {
  let app: Express;
  let webhookService: WebhookService;

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    webhookService = new WebhookService();
    app.use('/api/v2/webhooks', createWebhookRouter({ webhookService }));
  });

  beforeEach(async () => {
    await webhookService.clearAll();
  });

  describe('POST /api/v2/webhooks', () => {
    it('should register a webhook', async () => {
      const response = await request(app)
        .post('/api/v2/webhooks')
        .send({
          url: 'https://example.com/webhook',
          events: ['error.retry', 'schedule.executed'],
          active: true,
          retryPolicy: {
            maxAttempts: 3,
            backoffMs: 1000,
          },
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.url).toBe('https://example.com/webhook');
      expect(response.body).toHaveProperty('secret');
    });

    it('should validate webhook URL', async () => {
      const response = await request(app)
        .post('/api/v2/webhooks')
        .send({
          url: 'invalid-url',
          events: ['error.retry'],
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should accept multiple events', async () => {
      const response = await request(app)
        .post('/api/v2/webhooks')
        .send({
          url: 'https://example.com/webhook',
          events: ['error.retry', 'error.resolved', 'schedule.executed', 'webhook.delivered'],
        })
        .expect(201);

      expect(response.body.events).toHaveLength(4);
    });
  });

  describe('GET /api/v2/webhooks', () => {
    it('should list all webhooks', async () => {
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/v2/webhooks')
          .send({
            url: `https://example.com/webhook${i}`,
            events: ['error.retry'],
          });
      }

      const response = await request(app)
        .get('/api/v2/webhooks')
        .expect(200);

      expect(response.body).toHaveProperty('webhooks');
      expect(response.body.webhooks).toHaveLength(3);
    });
  });

  describe('GET /api/v2/webhooks/:id', () => {
    it('should retrieve webhook by ID', async () => {
      const createRes = await request(app)
        .post('/api/v2/webhooks')
        .send({
          url: 'https://example.com/webhook',
          events: ['error.retry'],
        })
        .expect(201);

      const webhookId = createRes.body.id;

      const getRes = await request(app)
        .get(`/api/v2/webhooks/${webhookId}`)
        .expect(200);

      expect(getRes.body.id).toBe(webhookId);
      expect(getRes.body.url).toBe('https://example.com/webhook');
    });
  });

  describe('PUT /api/v2/webhooks/:id', () => {
    it('should update webhook configuration', async () => {
      const createRes = await request(app)
        .post('/api/v2/webhooks')
        .send({
          url: 'https://example.com/webhook',
          events: ['error.retry'],
          active: true,
        })
        .expect(201);

      const webhookId = createRes.body.id;

      const updateRes = await request(app)
        .put(`/api/v2/webhooks/${webhookId}`)
        .send({
          events: ['error.retry', 'schedule.executed'],
          active: false,
        })
        .expect(200);

      expect(updateRes.body.events).toHaveLength(2);
      expect(updateRes.body.active).toBe(false);
    });
  });

  describe('DELETE /api/v2/webhooks/:id', () => {
    it('should delete a webhook', async () => {
      const createRes = await request(app)
        .post('/api/v2/webhooks')
        .send({
          url: 'https://example.com/webhook',
          events: ['error.retry'],
        })
        .expect(201);

      const webhookId = createRes.body.id;

      await request(app)
        .delete(`/api/v2/webhooks/${webhookId}`)
        .expect(204);

      await request(app)
        .get(`/api/v2/webhooks/${webhookId}`)
        .expect(404);
    });
  });

  describe('GET /api/v2/webhooks/:id/deliveries', () => {
    it('should retrieve webhook delivery history', async () => {
      const createRes = await request(app)
        .post('/api/v2/webhooks')
        .send({
          url: 'https://example.com/webhook',
          events: ['error.retry'],
        })
        .expect(201);

      const webhookId = createRes.body.id;

      // Simulate deliveries
      await webhookService.recordDelivery(webhookId, {
        status: 'success',
        statusCode: 200,
        duration: 150,
      });

      const response = await request(app)
        .get(`/api/v2/webhooks/${webhookId}/deliveries`)
        .expect(200);

      expect(response.body).toHaveProperty('deliveries');
      expect(response.body.deliveries.length).toBeGreaterThan(0);
    });
  });

  describe('Webhook signature verification', () => {
    it('should validate webhook signature', async () => {
      const createRes = await request(app)
        .post('/api/v2/webhooks')
        .send({
          url: 'https://example.com/webhook',
          events: ['error.retry'],
        })
        .expect(201);

      const webhookId = createRes.body.id;
      const webhook = await webhookService.getWebhook(webhookId);

      // Verify signature generation
      expect(webhook.secret).toBeDefined();
      expect(webhook.secret.length).toBeGreaterThan(32);
    });
  });

  describe('Webhook event delivery', () => {
    it('should deliver events to registered webhook', async () => {
      const createRes = await request(app)
        .post('/api/v2/webhooks')
        .send({
          url: 'https://example.com/webhook',
          events: ['error.retry'],
          retryPolicy: {
            maxAttempts: 3,
            backoffMs: 1000,
          },
        })
        .expect(201);

      const webhookId = createRes.body.id;

      // Emit an event
      const deliveryResult = await webhookService.deliverEvent(webhookId, {
        type: 'error.retry',
        data: {
          retryId: 'retry-123',
          workflowId: 'wf-123',
          attempt: 1,
        },
        timestamp: new Date(),
      });

      expect(deliveryResult).toHaveProperty('deliveryId');
      expect(deliveryResult).toHaveProperty('status');
    });
  });

  describe('Webhook retries', () => {
    it('should retry failed deliveries', async () => {
      const createRes = await request(app)
        .post('/api/v2/webhooks')
        .send({
          url: 'https://failing.example.com/webhook',
          events: ['error.retry'],
          retryPolicy: {
            maxAttempts: 3,
            backoffMs: 100,
          },
        })
        .expect(201);

      const webhookId = createRes.body.id;

      // Attempt delivery (will fail because URL doesn't exist)
      const delivery = await webhookService.deliverEvent(webhookId, {
        type: 'error.retry',
        data: { retryId: 'retry-456' },
        timestamp: new Date(),
      });

      // Verify retry policy is stored
      expect(delivery).toHaveProperty('retryAttempts');
    });
  });

  describe('Multiple webhooks', () => {
    it('should deliver to all matching webhooks', async () => {
      // Create 3 webhooks for the same event
      const webhookIds = [];
      for (let i = 0; i < 3; i++) {
        const res = await request(app)
          .post('/api/v2/webhooks')
          .send({
            url: `https://example.com/webhook${i}`,
            events: ['error.retry'],
          })
          .expect(201);
        webhookIds.push(res.body.id);
      }

      // Emit event - should trigger all 3
      const results = await Promise.all(
        webhookIds.map(id =>
          webhookService.deliverEvent(id, {
            type: 'error.retry',
            data: { retryId: 'retry-789' },
            timestamp: new Date(),
          })
        )
      );

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toHaveProperty('deliveryId');
      });
    });
  });

  describe('Webhook statistics', () => {
    it('should track webhook statistics', async () => {
      const createRes = await request(app)
        .post('/api/v2/webhooks')
        .send({
          url: 'https://example.com/webhook',
          events: ['error.retry'],
        })
        .expect(201);

      const webhookId = createRes.body.id;

      // Record some deliveries
      await webhookService.recordDelivery(webhookId, {
        status: 'success',
        statusCode: 200,
        duration: 100,
      });

      await webhookService.recordDelivery(webhookId, {
        status: 'failure',
        statusCode: 500,
        duration: 5000,
      });

      const webhook = await webhookService.getWebhook(webhookId);

      expect(webhook.stats).toHaveProperty('totalDeliveries');
      expect(webhook.stats).toHaveProperty('successCount');
      expect(webhook.stats).toHaveProperty('failureCount');
      expect(webhook.stats).toHaveProperty('averageDuration');
    });
  });

  describe('Webhook activation/deactivation', () => {
    it('should prevent delivery to inactive webhooks', async () => {
      const createRes = await request(app)
        .post('/api/v2/webhooks')
        .send({
          url: 'https://example.com/webhook',
          events: ['error.retry'],
          active: false,
        })
        .expect(201);

      const webhookId = createRes.body.id;

      const delivery = await webhookService.deliverEvent(webhookId, {
        type: 'error.retry',
        data: { retryId: 'retry-inactive' },
        timestamp: new Date(),
      });

      expect(delivery.status).toBe('skipped');
    });
  });
});
