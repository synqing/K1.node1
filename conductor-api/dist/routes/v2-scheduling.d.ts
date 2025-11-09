/**
 * Scheduler API Routes (v2)
 * REST endpoints for schedule management and execution
 */
import { Router } from 'express';
import { ISchedulerService, IScheduleExecutor } from '../types/scheduler.types.js';
/**
 * Create v2 scheduling router
 * @param schedulerService - Scheduler core service
 * @param scheduleExecutor - Schedule executor worker
 * @returns Express Router
 */
export declare function createSchedulingRouter(schedulerService: ISchedulerService, scheduleExecutor: IScheduleExecutor): Router;
/**
 * Export router factory function
 */
export default createSchedulingRouter;
//# sourceMappingURL=v2-scheduling.d.ts.map