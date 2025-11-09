import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { SchedulerCore } from '../../services/scheduler-core';
import { createSchedulerRouter } from '../../routes/v2/scheduling';

describe('Scheduler Integration Tests', () => {
  let app: Express;
  let scheduler: SchedulerCore;

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    scheduler = new SchedulerCore();
    app.use('/api/v2/schedules', createSchedulerRouter({ scheduler }));
  });

  beforeEach(async () => {
    await scheduler.clear();
  });

  describe('POST /api/v2/schedules', () => {
    it('should create a schedule', async () => {
      const response = await request(app)
        .post('/api/v2/schedules')
        .send({
          name: 'Daily backup',
          cron: '0 2 * * *', // 2 AM daily
          workflowId: 'wf-backup',
          enabled: true,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Daily backup');
      expect(response.body.nextExecution).toBeDefined();
    });

    it('should validate cron expression', async () => {
      const response = await request(app)
        .post('/api/v2/schedules')
        .send({
          name: 'Invalid cron',
          cron: 'invalid-cron',
          workflowId: 'wf-test',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should support various cron patterns', async () => {
      const patterns = [
        '*/5 * * * *',         // Every 5 minutes
        '0 */2 * * *',         // Every 2 hours
        '0 0 * * 0',           // Weekly (Sundays)
        '0 0 1 * *',           // Monthly
        '0 0 1 1 *',           // Yearly
      ];

      for (const cron of patterns) {
        const response = await request(app)
          .post('/api/v2/schedules')
          .send({
            name: `Schedule ${cron}`,
            cron,
            workflowId: `wf-${cron}`,
          })
          .expect(201);

        expect(response.body.nextExecution).toBeDefined();
      }
    });
  });

  describe('GET /api/v2/schedules', () => {
    it('should list all schedules', async () => {
      // Create multiple schedules
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/v2/schedules')
          .send({
            name: `Schedule ${i}`,
            cron: `0 ${i} * * *`,
            workflowId: `wf-${i}`,
          });
      }

      const response = await request(app)
        .get('/api/v2/schedules')
        .expect(200);

      expect(response.body).toHaveProperty('schedules');
      expect(response.body.schedules).toHaveLength(3);
    });

    it('should filter by enabled status', async () => {
      await request(app)
        .post('/api/v2/schedules')
        .send({
          name: 'Enabled',
          cron: '0 0 * * *',
          workflowId: 'wf-enabled',
          enabled: true,
        });

      await request(app)
        .post('/api/v2/schedules')
        .send({
          name: 'Disabled',
          cron: '0 0 * * *',
          workflowId: 'wf-disabled',
          enabled: false,
        });

      const response = await request(app)
        .get('/api/v2/schedules?enabled=true')
        .expect(200);

      expect(response.body.schedules.every((s: any) => s.enabled === true)).toBe(true);
    });
  });

  describe('GET /api/v2/schedules/:id', () => {
    it('should retrieve schedule by ID', async () => {
      const createRes = await request(app)
        .post('/api/v2/schedules')
        .send({
          name: 'Test schedule',
          cron: '0 0 * * *',
          workflowId: 'wf-test',
        })
        .expect(201);

      const scheduleId = createRes.body.id;

      const getRes = await request(app)
        .get(`/api/v2/schedules/${scheduleId}`)
        .expect(200);

      expect(getRes.body.id).toBe(scheduleId);
      expect(getRes.body.name).toBe('Test schedule');
    });

    it('should return 404 for non-existent schedule', async () => {
      await request(app)
        .get('/api/v2/schedules/nonexistent-id')
        .expect(404);
    });
  });

  describe('PUT /api/v2/schedules/:id', () => {
    it('should update a schedule', async () => {
      const createRes = await request(app)
        .post('/api/v2/schedules')
        .send({
          name: 'Original name',
          cron: '0 0 * * *',
          workflowId: 'wf-test',
        })
        .expect(201);

      const scheduleId = createRes.body.id;

      const updateRes = await request(app)
        .put(`/api/v2/schedules/${scheduleId}`)
        .send({
          name: 'Updated name',
          cron: '0 2 * * *',
          enabled: false,
        })
        .expect(200);

      expect(updateRes.body.name).toBe('Updated name');
      expect(updateRes.body.enabled).toBe(false);
    });
  });

  describe('DELETE /api/v2/schedules/:id', () => {
    it('should delete a schedule', async () => {
      const createRes = await request(app)
        .post('/api/v2/schedules')
        .send({
          name: 'To delete',
          cron: '0 0 * * *',
          workflowId: 'wf-delete',
        })
        .expect(201);

      const scheduleId = createRes.body.id;

      await request(app)
        .delete(`/api/v2/schedules/${scheduleId}`)
        .expect(204);

      await request(app)
        .get(`/api/v2/schedules/${scheduleId}`)
        .expect(404);
    });
  });

  describe('GET /api/v2/schedules/:id/history', () => {
    it('should retrieve execution history', async () => {
      const createRes = await request(app)
        .post('/api/v2/schedules')
        .send({
          name: 'History test',
          cron: '0 0 * * *',
          workflowId: 'wf-history',
        })
        .expect(201);

      const scheduleId = createRes.body.id;

      // Simulate executions
      await scheduler.recordExecution(scheduleId, 'success', null);
      await scheduler.recordExecution(scheduleId, 'success', null);
      await scheduler.recordExecution(scheduleId, 'failure', 'Timeout error');

      const response = await request(app)
        .get(`/api/v2/schedules/${scheduleId}/history`)
        .expect(200);

      expect(response.body).toHaveProperty('executions');
      expect(response.body.executions.length).toBeGreaterThan(0);
      expect(response.body).toHaveProperty('stats');
    });
  });

  describe('POST /api/v2/schedules/:id/execute', () => {
    it('should manually trigger schedule execution', async () => {
      const createRes = await request(app)
        .post('/api/v2/schedules')
        .send({
          name: 'Manual trigger',
          cron: '0 0 * * *',
          workflowId: 'wf-manual',
        })
        .expect(201);

      const scheduleId = createRes.body.id;

      const response = await request(app)
        .post(`/api/v2/schedules/${scheduleId}/execute`)
        .expect(202);

      expect(response.body).toHaveProperty('executionId');
      expect(response.body.status).toBe('queued');
    });
  });

  describe('Scheduler workflow', () => {
    it('should handle complete schedule lifecycle', async () => {
      // 1. Create schedule
      const createRes = await request(app)
        .post('/api/v2/schedules')
        .send({
          name: 'Lifecycle test',
          cron: '0 0 * * *',
          workflowId: 'wf-lifecycle',
          enabled: true,
        })
        .expect(201);

      const scheduleId = createRes.body.id;

      // 2. Retrieve schedule
      const getRes = await request(app)
        .get(`/api/v2/schedules/${scheduleId}`)
        .expect(200);
      expect(getRes.body.enabled).toBe(true);

      // 3. Update schedule
      await request(app)
        .put(`/api/v2/schedules/${scheduleId}`)
        .send({ name: 'Updated lifecycle' })
        .expect(200);

      // 4. Manually execute
      await request(app)
        .post(`/api/v2/schedules/${scheduleId}/execute`)
        .expect(202);

      // 5. Check history
      const historyRes = await request(app)
        .get(`/api/v2/schedules/${scheduleId}/history`)
        .expect(200);
      expect(historyRes.body).toHaveProperty('executions');

      // 6. Disable schedule
      await request(app)
        .put(`/api/v2/schedules/${scheduleId}`)
        .send({ enabled: false })
        .expect(200);

      // 7. Delete schedule
      await request(app)
        .delete(`/api/v2/schedules/${scheduleId}`)
        .expect(204);
    });
  });

  describe('Concurrent executions', () => {
    it('should handle concurrent schedule requests', async () => {
      const createRes = await request(app)
        .post('/api/v2/schedules')
        .send({
          name: 'Concurrent test',
          cron: '*/5 * * * *',
          workflowId: 'wf-concurrent',
        })
        .expect(201);

      const scheduleId = createRes.body.id;

      // Make 10 concurrent execution requests
      const promises = Array.from({ length: 10 }, () =>
        request(app)
          .post(`/api/v2/schedules/${scheduleId}/execute`)
      );

      const results = await Promise.all(promises);

      // All should succeed or queue
      results.forEach(res => {
        expect([202, 200, 409]).toContain(res.status);
      });
    });
  });

  describe('Performance', () => {
    it('should list 1000 schedules efficiently', async () => {
      // Create 1000 schedules
      for (let i = 0; i < 1000; i++) {
        await request(app)
          .post('/api/v2/schedules')
          .send({
            name: `Schedule ${i}`,
            cron: `${i % 60} ${i % 24} * * *`,
            workflowId: `wf-${i}`,
            enabled: i % 2 === 0,
          });
      }

      const startTime = Date.now();
      const response = await request(app)
        .get('/api/v2/schedules?limit=1000')
        .expect(200);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete in less than 5 seconds
      expect(response.body.schedules.length).toBe(1000);
    });
  });
});
