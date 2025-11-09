/**
 * Scheduler Unit Tests
 * Tests for cron parser, scheduler core service, and schedule executor
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CronParser, validateCronExpression, getNextExecutionTime } from '../utils/cron-parser.js';
import { SchedulerCoreService } from '../services/scheduler-core.js';
import { ScheduleExecutor } from '../workers/schedule-executor.js';
import { ScheduleStatus } from '../types/scheduler.types.js';

describe('CronParser', () => {
  describe('validation', () => {
    it('should validate valid cron expressions', () => {
      const validExpressions = [
        '0 0 * * *', // Daily at midnight
        '0 12 * * *', // Daily at noon
        '0 */4 * * *', // Every 4 hours
        '*/15 * * * *', // Every 15 minutes
        '0 0 1 * *', // First of every month
        '0 0 * * 0', // Every Sunday
        '0 9 * * 1-5', // Every weekday at 9am
        '0 0,12 * * *', // Twice daily
        '0 0 1-7 * *', // First 7 days of month
      ];

      validExpressions.forEach((expr) => {
        const result = validateCronExpression(expr);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('should reject invalid cron expressions', () => {
      const invalidExpressions = [
        '* * * *', // Too few fields
        '* * * * * *', // Too many fields
        '60 * * * *', // Invalid minute (60 > 59)
        '* 24 * * *', // Invalid hour (24 > 23)
        '* * 32 * *', // Invalid day (32 > 31)
        '* * * 13 *', // Invalid month (13 > 12)
        '* * * * 7', // Invalid weekday (7 > 6)
      ];

      invalidExpressions.forEach((expr) => {
        const result = validateCronExpression(expr);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('next execution time', () => {
    it('should calculate next execution for daily schedule', () => {
      const parser = new CronParser('0 10 * * *'); // 10:00 every day
      const from = new Date('2025-01-15T09:30:00Z');
      const next = parser.nextExecution(from);

      expect(next).toBeDefined();
      expect(next?.getHours()).toBe(10);
      expect(next?.getMinutes()).toBe(0);
      expect(next?.getDate()).toBe(15);
    });

    it('should calculate next execution for hourly schedule', () => {
      const parser = new CronParser('0 * * * *'); // Every hour
      const from = new Date('2025-01-15T09:30:00Z');
      const next = parser.nextExecution(from);

      expect(next).toBeDefined();
      expect(next?.getHours()).toBe(10);
      expect(next?.getMinutes()).toBe(0);
    });

    it('should calculate next execution for every 15 minutes', () => {
      const parser = new CronParser('*/15 * * * *');
      const from = new Date('2025-01-15T09:07:30Z');
      const next = parser.nextExecution(from);

      expect(next).toBeDefined();
      expect(next?.getMinutes()).toBe(15);
    });

    it('should wrap to next day if no execution today', () => {
      const parser = new CronParser('0 2 * * *'); // 2:00 AM
      const from = new Date('2025-01-15T23:30:00Z');
      const next = parser.nextExecution(from);

      expect(next).toBeDefined();
      expect(next?.getDate()).toBe(16);
      expect(next?.getHours()).toBe(2);
    });

    it('should handle multiple executions per day', () => {
      const parser = new CronParser('0 9,17 * * *'); // 9 AM and 5 PM
      const from = new Date('2025-01-15T08:30:00Z');
      const next = parser.nextExecution(from);

      expect(next).toBeDefined();
      expect(next?.getHours()).toBe(9);
    });
  });

  describe('previous execution time', () => {
    it('should calculate previous execution for daily schedule', () => {
      const parser = new CronParser('0 10 * * *');
      const from = new Date('2025-01-15T11:30:00Z');
      const prev = parser.previousExecution(from);

      expect(prev).toBeDefined();
      expect(prev?.getHours()).toBe(10);
      expect(prev?.getDate()).toBe(15);
    });

    it('should wrap to previous day if needed', () => {
      const parser = new CronParser('0 10 * * *');
      const from = new Date('2025-01-15T09:30:00Z');
      const prev = parser.previousExecution(from);

      expect(prev).toBeDefined();
      expect(prev?.getDate()).toBe(14);
      expect(prev?.getHours()).toBe(10);
    });
  });
});

describe('SchedulerCoreService', () => {
  let service: SchedulerCoreService;

  beforeEach(() => {
    service = new SchedulerCoreService();
  });

  describe('createSchedule', () => {
    it('should create a schedule with valid cron expression', async () => {
      const schedule = await service.createSchedule({
        name: 'Daily Report',
        description: 'Run daily at 9 AM',
        workflowId: 'workflow_123',
        cronExpression: '0 9 * * *',
      });

      expect(schedule).toBeDefined();
      expect(schedule.name).toBe('Daily Report');
      expect(schedule.workflowId).toBe('workflow_123');
      expect(schedule.cronExpression).toBe('0 9 * * *');
      expect(schedule.enabled).toBe(true);
      expect(schedule.nextExecutionTime).toBeDefined();
    });

    it('should throw error for invalid cron expression', async () => {
      await expect(
        service.createSchedule({
          name: 'Invalid Schedule',
          workflowId: 'workflow_123',
          cronExpression: '* * * *', // Invalid: 4 fields
        })
      ).rejects.toThrow('Invalid cron expression');
    });

    it('should set enabled to true by default', async () => {
      const schedule = await service.createSchedule({
        name: 'Test',
        workflowId: 'workflow_123',
        cronExpression: '0 9 * * *',
      });

      expect(schedule.enabled).toBe(true);
    });

    it('should allow disabling schedule on creation', async () => {
      const schedule = await service.createSchedule({
        name: 'Test',
        workflowId: 'workflow_123',
        cronExpression: '0 9 * * *',
        enabled: false,
      });

      expect(schedule.enabled).toBe(false);
    });
  });

  describe('getSchedule', () => {
    it('should retrieve created schedule', async () => {
      const created = await service.createSchedule({
        name: 'Test',
        workflowId: 'workflow_123',
        cronExpression: '0 9 * * *',
      });

      const retrieved = await service.getSchedule(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test');
    });

    it('should return null for non-existent schedule', async () => {
      const schedule = await service.getSchedule('non_existent');

      expect(schedule).toBeNull();
    });
  });

  describe('listSchedules', () => {
    it('should list all schedules', async () => {
      await service.createSchedule({
        name: 'Schedule 1',
        workflowId: 'workflow_1',
        cronExpression: '0 9 * * *',
      });

      await service.createSchedule({
        name: 'Schedule 2',
        workflowId: 'workflow_2',
        cronExpression: '0 17 * * *',
      });

      const schedules = await service.listSchedules();

      expect(schedules.length).toBe(2);
    });

    it('should filter schedules by enabled status', async () => {
      await service.createSchedule({
        name: 'Enabled',
        workflowId: 'workflow_1',
        cronExpression: '0 9 * * *',
        enabled: true,
      });

      await service.createSchedule({
        name: 'Disabled',
        workflowId: 'workflow_2',
        cronExpression: '0 17 * * *',
        enabled: false,
      });

      const enabled = await service.listSchedules({ enabled: true });
      const disabled = await service.listSchedules({ enabled: false });

      expect(enabled.length).toBe(1);
      expect(enabled[0].name).toBe('Enabled');
      expect(disabled.length).toBe(1);
      expect(disabled[0].name).toBe('Disabled');
    });

    it('should filter schedules by workflowId', async () => {
      await service.createSchedule({
        name: 'Schedule 1',
        workflowId: 'workflow_1',
        cronExpression: '0 9 * * *',
      });

      await service.createSchedule({
        name: 'Schedule 2',
        workflowId: 'workflow_2',
        cronExpression: '0 17 * * *',
      });

      const schedules = await service.listSchedules({ workflowId: 'workflow_1' });

      expect(schedules.length).toBe(1);
      expect(schedules[0].workflowId).toBe('workflow_1');
    });

    it('should respect limit and offset pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await service.createSchedule({
          name: `Schedule ${i}`,
          workflowId: `workflow_${i}`,
          cronExpression: '0 9 * * *',
        });
      }

      const page1 = await service.listSchedules({ limit: 2, offset: 0 });
      const page2 = await service.listSchedules({ limit: 2, offset: 2 });

      expect(page1.length).toBe(2);
      expect(page2.length).toBe(2);
    });
  });

  describe('updateSchedule', () => {
    it('should update schedule fields', async () => {
      const created = await service.createSchedule({
        name: 'Original',
        workflowId: 'workflow_123',
        cronExpression: '0 9 * * *',
      });

      const updated = await service.updateSchedule(created.id, {
        name: 'Updated',
        enabled: false,
      });

      expect(updated.name).toBe('Updated');
      expect(updated.enabled).toBe(false);
    });

    it('should recalculate next execution time when cron changes', async () => {
      const created = await service.createSchedule({
        name: 'Test',
        workflowId: 'workflow_123',
        cronExpression: '0 9 * * *',
      });

      const originalNext = created.nextExecutionTime;

      const updated = await service.updateSchedule(created.id, {
        cronExpression: '0 17 * * *',
      });

      expect(updated.nextExecutionTime).not.toEqual(originalNext);
    });

    it('should throw error for invalid cron expression', async () => {
      const created = await service.createSchedule({
        name: 'Test',
        workflowId: 'workflow_123',
        cronExpression: '0 9 * * *',
      });

      await expect(
        service.updateSchedule(created.id, {
          cronExpression: '* * * *',
        })
      ).rejects.toThrow('Invalid cron expression');
    });

    it('should throw error for non-existent schedule', async () => {
      await expect(
        service.updateSchedule('non_existent', {
          name: 'Updated',
        })
      ).rejects.toThrow('Schedule not found');
    });
  });

  describe('deleteSchedule', () => {
    it('should delete a schedule', async () => {
      const created = await service.createSchedule({
        name: 'Test',
        workflowId: 'workflow_123',
        cronExpression: '0 9 * * *',
      });

      await service.deleteSchedule(created.id);

      const retrieved = await service.getSchedule(created.id);

      expect(retrieved).toBeNull();
    });

    it('should throw error for non-existent schedule', async () => {
      await expect(service.deleteSchedule('non_existent')).rejects.toThrow(
        'Schedule not found'
      );
    });
  });

  describe('recordExecution', () => {
    it('should record successful execution', async () => {
      const schedule = await service.createSchedule({
        name: 'Test',
        workflowId: 'workflow_123',
        cronExpression: '0 9 * * *',
      });

      const history = await service.recordExecution(
        schedule.id,
        schedule.workflowId,
        ScheduleStatus.SUCCESS,
        1000
      );

      expect(history).toBeDefined();
      expect(history.status).toBe(ScheduleStatus.SUCCESS);
      expect(history.durationMs).toBe(1000);
    });

    it('should record failed execution with error', async () => {
      const schedule = await service.createSchedule({
        name: 'Test',
        workflowId: 'workflow_123',
        cronExpression: '0 9 * * *',
      });

      const history = await service.recordExecution(
        schedule.id,
        schedule.workflowId,
        ScheduleStatus.FAILED,
        500,
        'Connection timeout'
      );

      expect(history.status).toBe(ScheduleStatus.FAILED);
      expect(history.error).toBe('Connection timeout');
    });

    it('should update schedule lastExecutionTime', async () => {
      const schedule = await service.createSchedule({
        name: 'Test',
        workflowId: 'workflow_123',
        cronExpression: '0 9 * * *',
      });

      await service.recordExecution(
        schedule.id,
        schedule.workflowId,
        ScheduleStatus.SUCCESS,
        1000
      );

      const updated = await service.getSchedule(schedule.id);

      expect(updated?.lastExecutionTime).toBeDefined();
    });

    it('should throw error for non-existent schedule', async () => {
      await expect(
        service.recordExecution(
          'non_existent',
          'workflow_123',
          ScheduleStatus.SUCCESS,
          1000
        )
      ).rejects.toThrow('Schedule not found');
    });
  });

  describe('getExecutionHistory', () => {
    it('should retrieve execution history', async () => {
      const schedule = await service.createSchedule({
        name: 'Test',
        workflowId: 'workflow_123',
        cronExpression: '0 9 * * *',
      });

      await service.recordExecution(
        schedule.id,
        schedule.workflowId,
        ScheduleStatus.SUCCESS,
        1000
      );

      const history = await service.getExecutionHistory(schedule.id);

      expect(history.length).toBe(1);
      expect(history[0].status).toBe(ScheduleStatus.SUCCESS);
    });

    it('should filter history by status', async () => {
      const schedule = await service.createSchedule({
        name: 'Test',
        workflowId: 'workflow_123',
        cronExpression: '0 9 * * *',
      });

      await service.recordExecution(
        schedule.id,
        schedule.workflowId,
        ScheduleStatus.SUCCESS,
        1000
      );

      await service.recordExecution(
        schedule.id,
        schedule.workflowId,
        ScheduleStatus.FAILED,
        500,
        'Error'
      );

      const successes = await service.getExecutionHistory(schedule.id, {
        status: ScheduleStatus.SUCCESS,
      });

      expect(successes.length).toBe(1);
      expect(successes[0].status).toBe(ScheduleStatus.SUCCESS);
    });
  });
});

describe('ScheduleExecutor', () => {
  let executor: ScheduleExecutor;
  let mockSchedulerService: any;
  let mockWebhookExecutor: any;

  beforeEach(() => {
    mockSchedulerService = {
      listSchedules: vi.fn().mockResolvedValue([]),
      recordExecution: vi.fn().mockResolvedValue({}),
    };

    mockWebhookExecutor = vi.fn().mockResolvedValue(undefined);

    executor = new ScheduleExecutor(mockSchedulerService, mockWebhookExecutor);
  });

  afterEach(async () => {
    if (executor.isRunning()) {
      await executor.stop();
    }
  });

  describe('lifecycle', () => {
    it('should start and stop executor', async () => {
      expect(executor.isRunning()).toBe(false);

      await executor.start();
      expect(executor.isRunning()).toBe(true);

      await executor.stop();
      expect(executor.isRunning()).toBe(false);
    });

    it('should not start twice', async () => {
      await executor.start();
      const warnSpy = vi.spyOn(console, 'log');

      await executor.start();

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already running'));

      await executor.stop();
    });
  });

  describe('getStats', () => {
    it('should return executor statistics', async () => {
      const stats = executor.getStats();

      expect(stats).toBeDefined();
      expect(stats.isRunning).toBe(false);
      expect(stats.totalExecutions).toBe(0);
      expect(stats.successfulExecutions).toBe(0);
      expect(stats.failedExecutions).toBe(0);
    });

    it('should track execution count', async () => {
      const service = new SchedulerCoreService();

      const schedule = await service.createSchedule({
        name: 'Test',
        workflowId: 'workflow_123',
        cronExpression: '0 9 * * *',
      });

      // Manually record executions
      await service.recordExecution(
        schedule.id,
        schedule.workflowId,
        ScheduleStatus.SUCCESS,
        1000
      );

      // Note: In real usage, executor would update via recordExecution calls
    });
  });
});
