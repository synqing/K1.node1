/**
 * Scheduling Routes (v2)
 * Handles schedule creation, retrieval, and updates
 * Task T3: API v2 Router Scaffolding
 */

import { Router, Response } from 'express';
import {
  AuthenticatedRequest,
  requireScopesV2,
  requireAuthV2,
  SCOPES_V2,
} from '../../middleware/v2-authentication';

const router = Router();

/**
 * Request validation stub
 * In production, use a library like Joi or Zod
 */
const validateScheduleRequest = (body: any): { valid: boolean; errors?: string[] } => {
  const errors: string[] = [];

  if (!body.task_id) errors.push('task_id is required');
  if (!body.cron_expression) errors.push('cron_expression is required');
  if (body.description && typeof body.description !== 'string') {
    errors.push('description must be a string');
  }
  if (body.enabled !== undefined && typeof body.enabled !== 'boolean') {
    errors.push('enabled must be a boolean');
  }
  if (body.max_concurrent_runs && typeof body.max_concurrent_runs !== 'number') {
    errors.push('max_concurrent_runs must be a number');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
};

/**
 * Response formatting stub
 * Provides consistent response structure across endpoints
 */
interface FormattedResponse<T> {
  status: 'success' | 'error';
  data?: T;
  error?: {
    code: string;
    message: string;
    status: number;
    details?: Record<string, any>;
  };
  timestamp: string;
  correlation_id?: string;
}

const formatResponse = <T>(
  status: 'success' | 'error',
  data?: T,
  error?: any,
  correlationId?: string
): FormattedResponse<T> => {
  const response: FormattedResponse<T> = {
    status,
    timestamp: new Date().toISOString(),
  };

  if (status === 'success' && data) {
    response.data = data;
  }

  if (status === 'error' && error) {
    response.error = error;
  }

  if (correlationId) {
    response.correlation_id = correlationId;
  }

  return response;
};

// ==================== Scheduling Endpoints ====================

/**
 * POST /v2/schedules
 * Create a new schedule
 */
router.post(
  '/',
  requireAuthV2,
  requireScopesV2(SCOPES_V2.SCHEDULER_WRITE),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        task_id,
        cron_expression,
        description,
        enabled = true,
        max_concurrent_runs = 1,
        timezone = 'UTC',
      } = req.body;
      const correlationId = (req as any).correlationId;

      // Validate request
      const validation = validateScheduleRequest(req.body);
      if (!validation.valid) {
        return res.status(400).json(
          formatResponse(
            'error',
            undefined,
            {
              code: 'VALIDATION_ERROR',
              message: 'Request validation failed',
              status: 400,
              details: { errors: validation.errors },
            },
            correlationId
          )
        );
      }

      // Simulate creating schedule (replace with DB insert)
      const schedule = {
        schedule_id: `sched-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        task_id,
        cron_expression,
        description: description || null,
        enabled,
        max_concurrent_runs,
        timezone,
        status: 'active',
        created_at: new Date().toISOString(),
        created_by: req.user?.id || req.client?.id || 'unknown',
        next_run_at: new Date(Date.now() + 60000).toISOString(),
        last_run_at: null,
        run_count: 0,
      };

      res.status(201).json(
        formatResponse('success', schedule, undefined, correlationId)
      );
    } catch (error) {
      const correlationId = (req as any).correlationId;
      console.error('[Scheduling] POST / failed:', error);

      res.status(500).json(
        formatResponse(
          'error',
          undefined,
          {
            code: 'INTERNAL_ERROR',
            message: 'Failed to create schedule',
            status: 500,
          },
          correlationId
        )
      );
    }
  }
);

/**
 * GET /v2/schedules/:id
 * Retrieve a specific schedule
 */
router.get(
  '/:id',
  requireScopesV2(SCOPES_V2.SCHEDULER_READ),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const correlationId = (req as any).correlationId;

      // Validate ID format
      if (!id || id.length === 0) {
        return res.status(400).json(
          formatResponse(
            'error',
            undefined,
            {
              code: 'INVALID_REQUEST',
              message: 'Schedule ID is required',
              status: 400,
            },
            correlationId
          )
        );
      }

      // Simulate fetching schedule (replace with DB query)
      const schedule = {
        schedule_id: id,
        task_id: 'task-abc123',
        cron_expression: '0 0 * * *',
        description: 'Daily cleanup job',
        enabled: true,
        max_concurrent_runs: 1,
        timezone: 'UTC',
        status: 'active',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        created_by: 'user-12345',
        updated_at: new Date().toISOString(),
        next_run_at: new Date(Date.now() + 3600000).toISOString(),
        last_run_at: new Date(Date.now() - 86400000).toISOString(),
        last_run_duration_ms: 2500,
        run_count: 45,
        recent_runs: [
          {
            run_id: 'run-1',
            started_at: new Date(Date.now() - 86400000).toISOString(),
            completed_at: new Date(Date.now() - 86397500).toISOString(),
            status: 'success',
          },
          {
            run_id: 'run-2',
            started_at: new Date(Date.now() - 172800000).toISOString(),
            completed_at: new Date(Date.now() - 172797500).toISOString(),
            status: 'success',
          },
        ],
      };

      res.json(formatResponse('success', schedule, undefined, correlationId));
    } catch (error) {
      const correlationId = (req as any).correlationId;
      console.error('[Scheduling] GET /:id failed:', error);

      res.status(500).json(
        formatResponse(
          'error',
          undefined,
          {
            code: 'INTERNAL_ERROR',
            message: 'Failed to retrieve schedule',
            status: 500,
          },
          correlationId
        )
      );
    }
  }
);

/**
 * PUT /v2/schedules/:id
 * Update a specific schedule
 */
router.put(
  '/:id',
  requireAuthV2,
  requireScopesV2(SCOPES_V2.SCHEDULER_WRITE),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { cron_expression, description, enabled, max_concurrent_runs, timezone } = req.body;
      const correlationId = (req as any).correlationId;

      // Validate ID format
      if (!id || id.length === 0) {
        return res.status(400).json(
          formatResponse(
            'error',
            undefined,
            {
              code: 'INVALID_REQUEST',
              message: 'Schedule ID is required',
              status: 400,
            },
            correlationId
          )
        );
      }

      // Validate cron expression if provided
      if (cron_expression && typeof cron_expression !== 'string') {
        return res.status(400).json(
          formatResponse(
            'error',
            undefined,
            {
              code: 'VALIDATION_ERROR',
              message: 'cron_expression must be a string',
              status: 400,
            },
            correlationId
          )
        );
      }

      // Simulate updating schedule (replace with DB update)
      const updatedSchedule = {
        schedule_id: id,
        task_id: 'task-abc123',
        cron_expression: cron_expression || '0 0 * * *',
        description: description !== undefined ? description : 'Daily cleanup job',
        enabled: enabled !== undefined ? enabled : true,
        max_concurrent_runs: max_concurrent_runs || 1,
        timezone: timezone || 'UTC',
        status: 'active',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        created_by: 'user-12345',
        updated_at: new Date().toISOString(),
        updated_by: req.user?.id || req.client?.id || 'unknown',
        next_run_at: new Date(Date.now() + 3600000).toISOString(),
        last_run_at: new Date(Date.now() - 86400000).toISOString(),
        run_count: 45,
      };

      res.json(formatResponse('success', updatedSchedule, undefined, correlationId));
    } catch (error) {
      const correlationId = (req as any).correlationId;
      console.error('[Scheduling] PUT /:id failed:', error);

      res.status(500).json(
        formatResponse(
          'error',
          undefined,
          {
            code: 'INTERNAL_ERROR',
            message: 'Failed to update schedule',
            status: 500,
          },
          correlationId
        )
      );
    }
  }
);

/**
 * GET /v2/schedules
 * List all schedules with pagination
 */
router.get(
  '/',
  requireScopesV2(SCOPES_V2.SCHEDULER_READ),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const page = parseInt((req.query.page as string) || '1');
      const limit = parseInt((req.query.limit as string) || '20');
      const enabled = req.query.enabled as string | undefined;
      const correlationId = (req as any).correlationId;

      // Validate pagination params
      if (page < 1 || limit < 1 || limit > 100) {
        return res.status(400).json(
          formatResponse(
            'error',
            undefined,
            {
              code: 'INVALID_REQUEST',
              message: 'Invalid pagination parameters',
              status: 400,
              details: { page, limit },
            },
            correlationId
          )
        );
      }

      // Simulate fetching schedules (replace with DB query)
      const schedules = [
        {
          schedule_id: 'sched-1',
          task_id: 'task-abc123',
          cron_expression: '0 0 * * *',
          description: 'Daily cleanup',
          enabled: true,
          status: 'active',
          next_run_at: new Date(Date.now() + 3600000).toISOString(),
          run_count: 45,
        },
        {
          schedule_id: 'sched-2',
          task_id: 'task-def456',
          cron_expression: '0 */6 * * *',
          description: 'Sync every 6 hours',
          enabled: true,
          status: 'active',
          next_run_at: new Date(Date.now() + 7200000).toISOString(),
          run_count: 120,
        },
      ];

      const filteredSchedules = enabled
        ? schedules.filter((s) => s.enabled === (enabled === 'true'))
        : schedules;

      res.json(
        formatResponse(
          'success',
          {
            pagination: {
              page,
              limit,
              total: filteredSchedules.length,
              total_pages: Math.ceil(filteredSchedules.length / limit),
            },
            items: filteredSchedules.slice((page - 1) * limit, page * limit),
          },
          undefined,
          correlationId
        )
      );
    } catch (error) {
      const correlationId = (req as any).correlationId;
      console.error('[Scheduling] GET / failed:', error);

      res.status(500).json(
        formatResponse(
          'error',
          undefined,
          {
            code: 'INTERNAL_ERROR',
            message: 'Failed to list schedules',
            status: 500,
          },
          correlationId
        )
      );
    }
  }
);

/**
 * DELETE /v2/schedules/:id
 * Delete a schedule
 */
router.delete(
  '/:id',
  requireAuthV2,
  requireScopesV2(SCOPES_V2.SCHEDULER_WRITE),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const correlationId = (req as any).correlationId;

      // Validate ID format
      if (!id || id.length === 0) {
        return res.status(400).json(
          formatResponse(
            'error',
            undefined,
            {
              code: 'INVALID_REQUEST',
              message: 'Schedule ID is required',
              status: 400,
            },
            correlationId
          )
        );
      }

      // Simulate deleting schedule (replace with DB delete)
      res.status(204).send();
    } catch (error) {
      const correlationId = (req as any).correlationId;
      console.error('[Scheduling] DELETE /:id failed:', error);

      res.status(500).json(
        formatResponse(
          'error',
          undefined,
          {
            code: 'INTERNAL_ERROR',
            message: 'Failed to delete schedule',
            status: 500,
          },
          correlationId
        )
      );
    }
  }
);

export default router;
