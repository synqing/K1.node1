import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { RetryEngine } from '../../services/retry-engine';
import { CircuitBreakerService } from '../../services/circuit-breaker';
import { DLQService } from '../../services/dead-letter-queue';
import { createErrorRecoveryRouter } from '../../routes/v2/error-recovery';

describe('Error Recovery Integration Tests', () => {
  let app: Express;
  let retryEngine: RetryEngine;
  let circuitBreaker: CircuitBreakerService;
  let dlqService: DLQService;

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    // Initialize services
    retryEngine = new RetryEngine();
    circuitBreaker = new CircuitBreakerService();
    dlqService = new DLQService();

    // Mount error recovery routes
    app.use('/api/v2/errors', createErrorRecoveryRouter({ retryEngine, circuitBreaker, dlqService }));
  });

  beforeEach(async () => {
    // Clear state before each test
    await retryEngine.clearAll();
    await circuitBreaker.reset();
    await dlqService.clear();
  });

  describe('POST /api/v2/errors/retry', () => {
    it('should create a retry entry successfully', async () => {
      const response = await request(app)
        .post('/api/v2/errors/retry')
        .send({
          workflowId: 'wf-123',
          taskId: 'task-456',
          error: 'Network timeout',
          metadata: { retries: 0 },
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('pending');
    });

    it('should apply exponential backoff', async () => {
      const retryId = await retryEngine.scheduleRetry({
        workflowId: 'wf-123',
        taskId: 'task-456',
        error: 'Connection failed',
        strategy: 'exponential',
        maxAttempts: 5,
      });

      const retry = await retryEngine.getRetry(retryId);
      expect(retry.nextRetryAt).toBeDefined();
      expect(retry.nextRetryAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should enforce max attempts', async () => {
      const retryId = await retryEngine.scheduleRetry({
        workflowId: 'wf-123',
        taskId: 'task-456',
        error: 'Persistent failure',
        strategy: 'fixed',
        maxAttempts: 2,
      });

      const retry = await retryEngine.getRetry(retryId);
      expect(retry.maxAttempts).toBe(2);
    });

    it('should reject invalid payloads', async () => {
      const response = await request(app)
        .post('/api/v2/errors/retry')
        .send({
          // Missing required fields
          error: 'Test error',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/v2/errors/retry/:id', () => {
    it('should retrieve retry by ID', async () => {
      const createRes = await request(app)
        .post('/api/v2/errors/retry')
        .send({
          workflowId: 'wf-123',
          taskId: 'task-456',
          error: 'Test error',
          metadata: {},
        })
        .expect(201);

      const retryId = createRes.body.id;

      const getRes = await request(app)
        .get(`/api/v2/errors/retry/${retryId}`)
        .expect(200);

      expect(getRes.body.id).toBe(retryId);
      expect(getRes.body.error).toBe('Test error');
    });

    it('should return 404 for non-existent retry', async () => {
      await request(app)
        .get('/api/v2/errors/retry/nonexistent-id')
        .expect(404);
    });
  });

  describe('POST /api/v2/errors/resolve', () => {
    it('should resolve an error', async () => {
      const createRes = await request(app)
        .post('/api/v2/errors/retry')
        .send({
          workflowId: 'wf-123',
          taskId: 'task-456',
          error: 'Test error',
          metadata: {},
        })
        .expect(201);

      const retryId = createRes.body.id;

      const resolveRes = await request(app)
        .post('/api/v2/errors/resolve')
        .send({ retryId, resolution: 'manual_fix' })
        .expect(200);

      expect(resolveRes.body.status).toBe('resolved');
    });
  });

  describe('GET /api/v2/errors/stats', () => {
    it('should return error statistics', async () => {
      // Create multiple errors
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/v2/errors/retry')
          .send({
            workflowId: `wf-${i}`,
            taskId: `task-${i}`,
            error: 'Test error',
            metadata: {},
          });
      }

      const response = await request(app)
        .get('/api/v2/errors/stats')
        .expect(200);

      expect(response.body).toHaveProperty('totalErrors');
      expect(response.body.totalErrors).toBeGreaterThanOrEqual(3);
      expect(response.body).toHaveProperty('byStatus');
      expect(response.body).toHaveProperty('byStrategy');
    });
  });

  describe('POST /api/v2/errors/circuit-breaker/:service', () => {
    it('should report service failure to circuit breaker', async () => {
      const response = await request(app)
        .post('/api/v2/errors/circuit-breaker/payment-service')
        .send({
          status: 'failure',
          error: 'Service unavailable',
        })
        .expect(200);

      expect(response.body).toHaveProperty('state');
    });

    it('should transition circuit breaker to OPEN after threshold', async () => {
      const serviceName = 'test-service';

      // Report multiple failures
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post(`/api/v2/errors/circuit-breaker/${serviceName}`)
          .send({
            status: 'failure',
            error: `Failure ${i}`,
          });
      }

      const getRes = await request(app)
        .get(`/api/v2/errors/circuit-breaker/${serviceName}`)
        .expect(200);

      expect(getRes.body.state).toMatch(/OPEN|HALF_OPEN/);
    });
  });

  describe('Error recovery flow', () => {
    it('should handle complete error recovery flow', async () => {
      // 1. Detect error
      const retryRes = await request(app)
        .post('/api/v2/errors/retry')
        .send({
          workflowId: 'wf-complete',
          taskId: 'task-complete',
          error: 'Initial failure',
          metadata: { attempt: 1 },
        })
        .expect(201);

      const retryId = retryRes.body.id;

      // 2. Check stats
      const statsRes = await request(app)
        .get('/api/v2/errors/stats')
        .expect(200);
      expect(statsRes.body.totalErrors).toBeGreaterThan(0);

      // 3. Resolve error
      const resolveRes = await request(app)
        .post('/api/v2/errors/resolve')
        .send({ retryId, resolution: 'fixed' })
        .expect(200);

      expect(resolveRes.body.status).toBe('resolved');
    });
  });

  describe('Error rate limiting', () => {
    it('should respect batch size limits', async () => {
      const batchSize = 100;
      const response = await request(app)
        .post('/api/v2/errors/retry')
        .send({
          workflowIds: Array.from({ length: batchSize }, (_, i) => `wf-${i}`),
          error: 'Batch error',
        })
        .expect(200);

      expect(response.body).toHaveProperty('processed');
    });
  });
});
