/**
 * Batch Operations API Tests (T12)
 * Comprehensive test coverage for batch endpoints
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import { createBatchRouter } from '../routes/v2/batch.js';
import { v2ErrorHandler } from '../middleware/v2-error-handler.js';

describe('Batch Operations API (T12)', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/v2/batch', createBatchRouter());
    app.use(v2ErrorHandler);
  });

  describe('POST /v2/batch/errors/retry', () => {
    it('should successfully batch retry tasks', async () => {
      const response = await request(app)
        .post('/v2/batch/errors/retry')
        .send({
          taskIds: ['task-1', 'task-2', 'task-3'],
          retryPolicy: {
            maxRetries: 3,
            initialDelayMs: 1000,
            maxDelayMs: 60000,
            strategy: 'exponential',
            backoffMultiplier: 2,
          },
        })
        .expect(200);

      expect(response.body).toHaveProperty('batchId');
      expect(response.body.operation).toBe('errors.retry');
      expect(response.body.totalItems).toBe(3);
      expect(response.body.successCount).toBe(3);
      expect(response.body.failureCount).toBe(0);
      expect(response.body.results).toHaveLength(3);
      expect(response.body.results[0]).toHaveProperty('id');
      expect(response.body.results[0]).toHaveProperty('status', 'success');
      expect(response.body.results[0]).toHaveProperty('retryId');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should respect max batch size of 100', async () => {
      const taskIds = Array.from({ length: 101 }, (_, i) => `task-${i}`);
      const response = await request(app)
        .post('/v2/batch/errors/retry')
        .send({
          taskIds,
          retryPolicy: {
            maxRetries: 3,
            initialDelayMs: 1000,
            maxDelayMs: 60000,
            strategy: 'exponential',
          },
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('Maximum 100 items');
    });

    it('should validate retry policy is required', async () => {
      const response = await request(app)
        .post('/v2/batch/errors/retry')
        .send({
          taskIds: ['task-1'],
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('retryPolicy');
    });

    it('should validate taskIds array is not empty', async () => {
      const response = await request(app)
        .post('/v2/batch/errors/retry')
        .send({
          taskIds: [],
          retryPolicy: { maxRetries: 3 },
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('cannot be empty');
    });

    it('should validate taskIds is array', async () => {
      const response = await request(app)
        .post('/v2/batch/errors/retry')
        .send({
          taskIds: 'not-an-array',
          retryPolicy: { maxRetries: 3 },
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle various retry strategies', async () => {
      const strategies = ['exponential', 'linear', 'fixed'];

      for (const strategy of strategies) {
        const response = await request(app)
          .post('/v2/batch/errors/retry')
          .send({
            taskIds: ['task-1'],
            retryPolicy: {
              maxRetries: 3,
              initialDelayMs: 1000,
              maxDelayMs: 60000,
              strategy,
            },
          })
          .expect(200);

        expect(response.body.successCount).toBe(1);
      }
    });
  });

  describe('POST /v2/batch/errors/resolve', () => {
    it('should successfully batch resolve errors', async () => {
      const response = await request(app)
        .post('/v2/batch/errors/resolve')
        .send({
          taskIds: ['task-1', 'task-2'],
          reason: 'Resolved by manual intervention',
        })
        .expect(200);

      expect(response.body).toHaveProperty('batchId');
      expect(response.body.operation).toBe('errors.resolve');
      expect(response.body.totalItems).toBe(2);
      expect(response.body.successCount).toBe(2);
      expect(response.body.failureCount).toBe(0);
      expect(response.body.results).toHaveLength(2);
    });

    it('should validate reason is required', async () => {
      const response = await request(app)
        .post('/v2/batch/errors/resolve')
        .send({
          taskIds: ['task-1'],
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('reason');
    });

    it('should validate reason is not empty', async () => {
      const response = await request(app)
        .post('/v2/batch/errors/resolve')
        .send({
          taskIds: ['task-1'],
          reason: '   ',
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('cannot be empty');
    });

    it('should validate reason is string', async () => {
      const response = await request(app)
        .post('/v2/batch/errors/resolve')
        .send({
          taskIds: ['task-1'],
          reason: 12345,
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should include reason in result message', async () => {
      const reason = 'Resolved due to timeout';
      const response = await request(app)
        .post('/v2/batch/errors/resolve')
        .send({
          taskIds: ['task-1'],
          reason,
        })
        .expect(200);

      expect(response.body.results[0].message).toContain(reason);
    });
  });

  describe('POST /v2/batch/schedules/execute', () => {
    it('should successfully batch execute schedules', async () => {
      const response = await request(app)
        .post('/v2/batch/schedules/execute')
        .send({
          scheduleIds: ['schedule-1', 'schedule-2', 'schedule-3'],
        })
        .expect(200);

      expect(response.body).toHaveProperty('batchId');
      expect(response.body.operation).toBe('schedules.execute');
      expect(response.body.totalItems).toBe(3);
      expect(response.body.successCount).toBe(3);
      expect(response.body.failureCount).toBe(0);
      expect(response.body.results).toHaveLength(3);
      expect(response.body.results[0]).toHaveProperty('retryId');
    });

    it('should validate scheduleIds is not empty', async () => {
      const response = await request(app)
        .post('/v2/batch/schedules/execute')
        .send({
          scheduleIds: [],
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should respect max batch size for schedules', async () => {
      const scheduleIds = Array.from({ length: 101 }, (_, i) => `schedule-${i}`);
      const response = await request(app)
        .post('/v2/batch/schedules/execute')
        .send({
          scheduleIds,
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /v2/batch/dlq/resolve', () => {
    it('should successfully batch resolve DLQ entries', async () => {
      const response = await request(app)
        .post('/v2/batch/dlq/resolve')
        .send({
          dlqIds: ['dlq-1', 'dlq-2', 'dlq-3'],
          notes: 'Batch resolved entries',
        })
        .expect(200);

      expect(response.body).toHaveProperty('batchId');
      expect(response.body.operation).toBe('dlq.resolve');
      expect(response.body.totalItems).toBe(3);
      expect(response.body.successCount).toBe(3);
      expect(response.body.failureCount).toBe(0);
      expect(response.body.results).toHaveLength(3);
    });

    it('should allow DLQ resolve without notes', async () => {
      const response = await request(app)
        .post('/v2/batch/dlq/resolve')
        .send({
          dlqIds: ['dlq-1'],
        })
        .expect(200);

      expect(response.body.successCount).toBe(1);
      expect(response.body.results[0].message).toBe('Resolved');
    });

    it('should validate notes is string if provided', async () => {
      const response = await request(app)
        .post('/v2/batch/dlq/resolve')
        .send({
          dlqIds: ['dlq-1'],
          notes: 12345,
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate dlqIds is not empty', async () => {
      const response = await request(app)
        .post('/v2/batch/dlq/resolve')
        .send({
          dlqIds: [],
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should include notes in result message when provided', async () => {
      const notes = 'Manual batch resolution';
      const response = await request(app)
        .post('/v2/batch/dlq/resolve')
        .send({
          dlqIds: ['dlq-1'],
          notes,
        })
        .expect(200);

      expect(response.body.results[0].message).toContain(notes);
    });
  });

  describe('Batch Response Format', () => {
    it('should include required fields in all batch responses', async () => {
      const response = await request(app)
        .post('/v2/batch/errors/retry')
        .send({
          taskIds: ['task-1'],
          retryPolicy: { maxRetries: 3 },
        })
        .expect(200);

      const batch = response.body;
      expect(batch).toHaveProperty('batchId');
      expect(batch).toHaveProperty('operation');
      expect(batch).toHaveProperty('totalItems');
      expect(batch).toHaveProperty('successCount');
      expect(batch).toHaveProperty('failureCount');
      expect(batch).toHaveProperty('results');
      expect(batch).toHaveProperty('timestamp');

      // Verify types
      expect(typeof batch.batchId).toBe('string');
      expect(typeof batch.operation).toBe('string');
      expect(typeof batch.totalItems).toBe('number');
      expect(typeof batch.successCount).toBe('number');
      expect(typeof batch.failureCount).toBe('number');
      expect(Array.isArray(batch.results)).toBe(true);
      expect(typeof batch.timestamp).toBe('string');
    });

    it('should have matching total items with success + failure counts', async () => {
      const response = await request(app)
        .post('/v2/batch/errors/retry')
        .send({
          taskIds: ['task-1', 'task-2', 'task-3'],
          retryPolicy: { maxRetries: 3 },
        })
        .expect(200);

      const batch = response.body;
      expect(batch.totalItems).toBe(batch.successCount + batch.failureCount);
    });

    it('should have ISO 8601 formatted timestamp', async () => {
      const response = await request(app)
        .post('/v2/batch/errors/retry')
        .send({
          taskIds: ['task-1'],
          retryPolicy: { maxRetries: 3 },
        })
        .expect(200);

      const batch = response.body;
      const timestamp = new Date(batch.timestamp);
      expect(timestamp.toString()).not.toBe('Invalid Date');
    });
  });

  describe('Batch Item Result Format', () => {
    it('should include required fields in results', async () => {
      const response = await request(app)
        .post('/v2/batch/errors/retry')
        .send({
          taskIds: ['task-1'],
          retryPolicy: { maxRetries: 3 },
        })
        .expect(200);

      const result = response.body.results[0];
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('status');
      expect(['success', 'failed', 'partial']).toContain(result.status);
    });

    it('should include error in failed results', async () => {
      const response = await request(app)
        .post('/v2/batch/errors/retry')
        .send({
          taskIds: [''],
          retryPolicy: { maxRetries: 3 },
        })
        .expect(200);

      const result = response.body.results[0];
      if (result.status === 'failed') {
        expect(result).toHaveProperty('error');
      }
    });

    it('should include retryId in successful retry results', async () => {
      const response = await request(app)
        .post('/v2/batch/errors/retry')
        .send({
          taskIds: ['task-1'],
          retryPolicy: { maxRetries: 3 },
        })
        .expect(200);

      const result = response.body.results[0];
      expect(result.status).toBe('success');
      expect(result).toHaveProperty('retryId');
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for invalid JSON', async () => {
      const response = await request(app)
        .post('/v2/batch/errors/retry')
        .set('Content-Type', 'application/json')
        .send('invalid json{')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/v2/batch/errors/retry')
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
