/**
 * Cron Expression Parser
 * Parses standard cron expressions and calculates next/previous execution times
 * Supports standard 5-field format: minute hour day month weekday
 */
export declare class CronParser {
    private expression;
    private minute;
    private hour;
    private day;
    private month;
    private weekday;
    private invalid;
    private error;
    constructor(expression: string);
    /**
     * Check if cron expression is valid
     */
    isValid(): boolean;
    /**
     * Get parse error if invalid
     */
    getError(): string;
    /**
     * Get next execution time from a given date
     */
    nextExecution(from?: Date): Date | null;
    /**
     * Get previous execution time from a given date
     */
    previousExecution(from?: Date): Date | null;
    /**
     * Parse the cron expression
     */
    private parse;
    /**
     * Parse a single cron field (e.g., "0", "*/ 5: any;
    ", ": any;
    1: any;
}
/**
 * Validate a cron expression
 */
export declare function validateCronExpression(expression: string): {
    valid: boolean;
    error?: string;
};
/**
 * Parse cron and get next execution time
 */
export declare function getNextExecutionTime(cronExpression: string, fromDate?: Date): Date | null;
/**
 * Parse cron and get previous execution time
 */
export declare function getPreviousExecutionTime(cronExpression: string, fromDate?: Date): Date | null;
//# sourceMappingURL=cron-parser.d.ts.map