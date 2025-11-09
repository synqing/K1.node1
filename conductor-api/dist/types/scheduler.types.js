/**
 * Scheduler Service - Type Definitions
 * Cron-based scheduling, execution tracking, and history management
 */
/**
 * Schedule status enum
 */
export var ScheduleStatus;
(function (ScheduleStatus) {
    ScheduleStatus["PENDING"] = "pending";
    ScheduleStatus["RUNNING"] = "running";
    ScheduleStatus["SUCCESS"] = "success";
    ScheduleStatus["FAILED"] = "failed";
})(ScheduleStatus || (ScheduleStatus = {}));
//# sourceMappingURL=scheduler.types.js.map