/**
 * Scheduler API Routes (v2)
 * REST endpoints for schedule management and execution
 */
import { Router } from 'express';
import { ScheduleStatus, } from '../types/scheduler.types.js';
import { validateCronExpression } from '../utils/cron-parser.js';
import { APIError, ValidationError, NotFoundError, asyncHandler, } from '../middleware/v2-error-handler.js';
/**
 * Create v2 scheduling router
 * @param schedulerService - Scheduler core service
 * @param scheduleExecutor - Schedule executor worker
 * @returns Express Router
 */
export function createSchedulingRouter(schedulerService, scheduleExecutor) {
    const router = Router();
    /**
     * POST /v2/schedules
     * Create a new schedule
     */
    router.post('/schedules', asyncHandler(async (req, res) => {
        const { name, cronExpression, workflowId, enabled, description, timezone, metadata } = req.body;
        // Validate required fields
        if (!name || typeof name !== 'string' || name.trim() === '') {
            throw new ValidationError('Schedule name is required and must be a non-empty string');
        }
        if (!cronExpression || typeof cronExpression !== 'string') {
            throw new ValidationError('Cron expression is required and must be a string');
        }
        if (!workflowId || typeof workflowId !== 'string') {
            throw new ValidationError('Workflow ID is required and must be a string');
        }
        // Validate cron expression
        const cronValidation = validateCronExpression(cronExpression);
        if (!cronValidation.valid) {
            throw new ValidationError(`Invalid cron expression: ${cronValidation.error || 'Unknown error'}`);
        }
        // Create the request object
        const createRequest = {
            name: name.trim(),
            cronExpression: cronExpression.trim(),
            workflowId: workflowId.trim(),
            enabled: enabled !== false,
            description: description?.trim(),
            timezone: timezone || 'UTC',
            metadata,
        };
        // Create schedule via service
        const schedule = await schedulerService.createSchedule(createRequest);
        res.status(201).json({
            data: schedule,
            message: 'Schedule created successfully',
        });
    }));
    /**
     * GET /v2/schedules
     * List all schedules with pagination and filtering
     */
    router.get('/schedules', asyncHandler(async (req, res) => {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const pageSize = Math.max(1, Math.min(100, parseInt(req.query.pageSize) || 20));
        const enabledOnly = req.query.enabledOnly === 'true';
        const offset = (page - 1) * pageSize;
        // Build filter options
        const filterOptions = {
            limit: pageSize,
            offset,
            enabled: enabledOnly ? true : undefined,
        };
        // List schedules
        const schedules = await schedulerService.listSchedules(filterOptions);
        res.json({
            data: schedules,
            pagination: {
                page,
                pageSize,
                total: schedules.length,
            },
            message: 'Schedules retrieved successfully',
        });
    }));
    /**
     * GET /v2/schedules/:id
     * Get a specific schedule by ID
     */
    router.get('/schedules/:id', asyncHandler(async (req, res) => {
        const { id } = req.params;
        if (!id || typeof id !== 'string') {
            throw new ValidationError('Schedule ID is required');
        }
        const schedule = await schedulerService.getSchedule(id);
        if (!schedule) {
            throw new NotFoundError(`Schedule not found: ${id}`);
        }
        res.json({
            data: schedule,
            message: 'Schedule retrieved successfully',
        });
    }));
    /**
     * PUT /v2/schedules/:id
     * Update a schedule
     */
    router.put('/schedules/:id', asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { name, cronExpression, enabled, description, timezone, metadata } = req.body;
        if (!id || typeof id !== 'string') {
            throw new ValidationError('Schedule ID is required');
        }
        // Verify schedule exists
        const existingSchedule = await schedulerService.getSchedule(id);
        if (!existingSchedule) {
            throw new NotFoundError(`Schedule not found: ${id}`);
        }
        // Validate cron expression if provided
        if (cronExpression !== undefined) {
            if (typeof cronExpression !== 'string') {
                throw new ValidationError('Cron expression must be a string');
            }
            const cronValidation = validateCronExpression(cronExpression);
            if (!cronValidation.valid) {
                throw new ValidationError(`Invalid cron expression: ${cronValidation.error || 'Unknown error'}`);
            }
        }
        // Validate name if provided
        if (name !== undefined) {
            if (typeof name !== 'string' || name.trim() === '') {
                throw new ValidationError('Schedule name must be a non-empty string');
            }
        }
        // Build update request
        const updateRequest = {};
        if (name !== undefined) {
            updateRequest.name = name.trim();
        }
        if (cronExpression !== undefined) {
            updateRequest.cronExpression = cronExpression.trim();
        }
        if (enabled !== undefined) {
            updateRequest.enabled = Boolean(enabled);
        }
        if (description !== undefined) {
            updateRequest.description = description?.trim();
        }
        if (timezone !== undefined) {
            updateRequest.timezone = timezone;
        }
        if (metadata !== undefined) {
            updateRequest.metadata = metadata;
        }
        // Update schedule
        const updated = await schedulerService.updateSchedule(id, updateRequest);
        res.json({
            data: updated,
            message: 'Schedule updated successfully',
        });
    }));
    /**
     * DELETE /v2/schedules/:id
     * Delete a schedule
     */
    router.delete('/schedules/:id', asyncHandler(async (req, res) => {
        const { id } = req.params;
        if (!id || typeof id !== 'string') {
            throw new ValidationError('Schedule ID is required');
        }
        // Verify schedule exists before deletion
        const schedule = await schedulerService.getSchedule(id);
        if (!schedule) {
            throw new NotFoundError(`Schedule not found: ${id}`);
        }
        // Delete schedule
        await schedulerService.deleteSchedule(id);
        res.json({
            message: 'Schedule deleted successfully',
        });
    }));
    /**
     * POST /v2/schedules/:id/execute
     * Trigger immediate execution of a schedule
     */
    router.post('/schedules/:id/execute', asyncHandler(async (req, res) => {
        const { id } = req.params;
        if (!id || typeof id !== 'string') {
            throw new ValidationError('Schedule ID is required');
        }
        // Verify schedule exists
        const schedule = await schedulerService.getSchedule(id);
        if (!schedule) {
            throw new NotFoundError(`Schedule not found: ${id}`);
        }
        if (!schedule.enabled) {
            throw new APIError('SCHEDULE_DISABLED', 400, 'Cannot execute a disabled schedule');
        }
        // Record immediate execution start
        const executionStartTime = Date.now();
        try {
            // In a real implementation, this would trigger the workflow execution
            // For now, we'll simulate successful execution
            console.log(`Triggering immediate execution for schedule: ${id}`);
            const durationMs = Date.now() - executionStartTime;
            // Record execution in history
            const execution = await schedulerService.recordExecution(id, schedule.workflowId, ScheduleStatus.SUCCESS, durationMs, undefined, {
                triggeredManually: true,
                triggeredAt: new Date().toISOString(),
            });
            res.json({
                data: {
                    schedule: schedule.id,
                    execution: execution.id,
                    status: execution.status,
                    durationMs: execution.durationMs,
                },
                message: 'Schedule executed successfully',
            });
        }
        catch (error) {
            const durationMs = Date.now() - executionStartTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            // Record failed execution
            await schedulerService.recordExecution(id, schedule.workflowId, ScheduleStatus.FAILED, durationMs, errorMessage);
            throw error;
        }
    }));
    /**
     * GET /v2/schedules/:id/history
     * Get execution history for a schedule
     */
    router.get('/schedules/:id/history', asyncHandler(async (req, res) => {
        const { id } = req.params;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const pageSize = Math.max(1, Math.min(100, parseInt(req.query.pageSize) || 20));
        const status = req.query.status;
        if (!id || typeof id !== 'string') {
            throw new ValidationError('Schedule ID is required');
        }
        // Verify schedule exists
        const schedule = await schedulerService.getSchedule(id);
        if (!schedule) {
            throw new NotFoundError(`Schedule not found: ${id}`);
        }
        const offset = (page - 1) * pageSize;
        // Build filter options
        const filterOptions = {
            limit: pageSize,
            offset,
            scheduleId: id,
        };
        if (status) {
            const validStatuses = Object.values(ScheduleStatus);
            if (!validStatuses.includes(status)) {
                throw new ValidationError(`Invalid status: ${status}. Valid statuses: ${validStatuses.join(', ')}`);
            }
            filterOptions.status = status;
        }
        // Get execution history
        const history = await schedulerService.getExecutionHistory(id, filterOptions);
        res.json({
            data: history,
            pagination: {
                page,
                pageSize,
                total: history.length,
            },
            message: 'Execution history retrieved successfully',
        });
    }));
    /**
     * GET /v2/scheduler/status
     * Get scheduler executor status and stats
     */
    router.get('/scheduler/status', asyncHandler(async (req, res) => {
        const stats = scheduleExecutor.getStats();
        res.json({
            data: stats,
            message: 'Scheduler status retrieved successfully',
        });
    }));
    /**
     * POST /v2/scheduler/start
     * Start the scheduler executor
     */
    router.post('/scheduler/start', asyncHandler(async (req, res) => {
        if (scheduleExecutor.isRunning()) {
            throw new APIError('SCHEDULER_ALREADY_RUNNING', 400, 'Scheduler is already running');
        }
        await scheduleExecutor.start();
        res.json({
            message: 'Scheduler started successfully',
        });
    }));
    /**
     * POST /v2/scheduler/stop
     * Stop the scheduler executor
     */
    router.post('/scheduler/stop', asyncHandler(async (req, res) => {
        if (!scheduleExecutor.isRunning()) {
            throw new APIError('SCHEDULER_NOT_RUNNING', 400, 'Scheduler is not running');
        }
        await scheduleExecutor.stop();
        res.json({
            message: 'Scheduler stopped successfully',
        });
    }));
    return router;
}
/**
 * Export router factory function
 */
export default createSchedulingRouter;
//# sourceMappingURL=v2-scheduling.js.map