/**
 * Workflow Management Routes
 *
 * REST API endpoints for triggering and monitoring Orkes workflows.
 */

import { Router, Request, Response } from 'express';
import { getOrkesClient } from '../config/orkes.js';
import type {
  WorkflowExecutionRequest,
  WorkflowExecutionResponse,
  WorkflowStatusResponse,
} from '../types/workflows.js';

const router = Router();

/**
 * POST /api/workflows/execute
 * Trigger a workflow execution
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const request: WorkflowExecutionRequest = req.body;

    if (!request.workflowName || !request.input) {
      res.status(400).json({
        error: 'Missing required fields: workflowName and input',
      });
      return;
    }

    const client = await getOrkesClient();

    // Start workflow execution
    const workflowId = await client.workflowResource.startWorkflow({
      name: request.workflowName,
      version: 1,
      input: request.input,
      correlationId: request.correlationId,
      priority: request.priority || 0,
      taskToDomain: request.tags || {},
    });

    const response: WorkflowExecutionResponse = {
      workflowId,
      status: 'RUNNING',
    };

    res.status(202).json(response);
  } catch (error) {
    console.error('[Workflows] Execute error:', error);
    res.status(500).json({
      error: 'Failed to execute workflow',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/workflows/:workflowId
 * Get workflow execution status and details
 */
router.get('/:workflowId', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;

    const client = await getOrkesClient();
    const execution = await client.workflowResource.getExecutionStatus(workflowId, true);

    const response: WorkflowStatusResponse = {
      workflowId: execution.workflowId || workflowId,
      status: execution.status as any,
      input: execution.input,
      output: execution.output,
      startTime: execution.startTime || new Date().toISOString(),
      endTime: execution.endTime,
      tasks: (execution.tasks || []).map((task) => ({
        taskName: task.taskDefName || task.taskType || 'unknown',
        status: task.status || 'UNKNOWN',
        startTime: task.startTime || '',
        endTime: task.endTime,
      })),
    };

    res.json(response);
  } catch (error) {
    console.error('[Workflows] Get status error:', error);
    res.status(500).json({
      error: 'Failed to get workflow status',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * DELETE /api/workflows/:workflowId
 * Terminate a running workflow
 */
router.delete('/:workflowId', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    const { reason } = req.body;

    const client = await getOrkesClient();
    await client.workflowResource.terminate(workflowId, reason || 'Terminated by user');

    res.json({ success: true, workflowId });
  } catch (error) {
    console.error('[Workflows] Terminate error:', error);
    res.status(500).json({
      error: 'Failed to terminate workflow',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/workflows/:workflowId/pause
 * Pause a running workflow
 */
router.post('/:workflowId/pause', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;

    const client = await getOrkesClient();
    await client.workflowResource.pauseWorkflow(workflowId);

    res.json({ success: true, workflowId, status: 'PAUSED' });
  } catch (error) {
    console.error('[Workflows] Pause error:', error);
    res.status(500).json({
      error: 'Failed to pause workflow',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/workflows/:workflowId/resume
 * Resume a paused workflow
 */
router.post('/:workflowId/resume', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;

    const client = await getOrkesClient();
    await client.workflowResource.resumeWorkflow(workflowId);

    res.json({ success: true, workflowId, status: 'RUNNING' });
  } catch (error) {
    console.error('[Workflows] Resume error:', error);
    res.status(500).json({
      error: 'Failed to resume workflow',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/workflows/:workflowId/retry
 * Retry a failed workflow from the last failed task
 */
router.post('/:workflowId/retry', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    const { resumeSubworkflowTasks } = req.body;

    const client = await getOrkesClient();
    await client.workflowResource.retry(workflowId, resumeSubworkflowTasks || false);

    res.json({ success: true, workflowId, status: 'RUNNING' });
  } catch (error) {
    console.error('[Workflows] Retry error:', error);
    res.status(500).json({
      error: 'Failed to retry workflow',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
