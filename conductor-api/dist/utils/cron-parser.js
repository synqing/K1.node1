/**
 * Cron Expression Parser
 * Parses standard cron expressions and calculates next/previous execution times
 * Supports standard 5-field format: minute hour day month weekday
 */
export class CronParser {
    constructor(expression) {
        this.expression = expression;
        this.invalid = false;
        this.error = '';
        this.minute = [];
        this.hour = [];
        this.day = [];
        this.month = [];
        this.weekday = [];
        this.parse();
    }
    /**
     * Check if cron expression is valid
     */
    isValid() {
        return !this.invalid;
    }
    /**
     * Get parse error if invalid
     */
    getError() {
        return this.error;
    }
    /**
     * Get next execution time from a given date
     */
    nextExecution(from = new Date()) {
        if (!this.isValid())
            return null;
        const current = new Date(from);
        current.setSeconds(0);
        current.setMilliseconds(0);
        // Start from next minute
        current.setMinutes(current.getMinutes() + 1);
        // Search up to 4 years ahead to find next execution
        const maxDate = new Date(current);
        maxDate.setFullYear(maxDate.getFullYear() + 4);
        while (current <= maxDate) {
            if (this.matchesSchedule(current)) {
                return new Date(current);
            }
            current.setMinutes(current.getMinutes() + 1);
        }
        return null;
    }
    /**
     * Get previous execution time from a given date
     */
    previousExecution(from = new Date()) {
        if (!this.isValid())
            return null;
        const current = new Date(from);
        current.setSeconds(0);
        current.setMilliseconds(0);
        // Start from previous minute
        current.setMinutes(current.getMinutes() - 1);
        // Search back up to 4 years
        const minDate = new Date(current);
        minDate.setFullYear(minDate.getFullYear() - 4);
        while (current >= minDate) {
            if (this.matchesSchedule(current)) {
                return new Date(current);
            }
            current.setMinutes(current.getMinutes() - 1);
        }
        return null;
    }
    /**
     * Parse the cron expression
     */
    parse() {
        const parts = this.expression.trim().split(/\s+/);
        if (parts.length !== 5) {
            this.invalid = true;
            this.error = `Invalid cron expression: expected 5 fields, got ${parts.length}`;
            return;
        }
        try {
            this.minute = this.parseField(parts[0], 0, 59);
            this.hour = this.parseField(parts[1], 0, 23);
            this.day = this.parseField(parts[2], 1, 31);
            this.month = this.parseField(parts[3], 1, 12);
            this.weekday = this.parseField(parts[4], 0, 6);
        }
        catch (err) {
            this.invalid = true;
            this.error = `Failed to parse cron expression: ${err instanceof Error ? err.message : 'unknown error'}`;
        }
    }
}
-5;
", ";
1, 3, 5;
")
    * /;
parseField(field, string, min, number, max, number);
number[];
{
    const values = new Set();
    // Handle wildcard
    if (field === '*') {
        for (let i = min; i <= max; i++) {
            values.add(i);
        }
        return Array.from(values).sort((a, b) => a - b);
    }
    // Handle step values (e.g., "*/5")
    if (field.includes('/')) {
        const [range, step] = field.split('/');
        const stepValue = parseInt(step, 10);
        if (isNaN(stepValue) || stepValue <= 0) {
            throw new Error(`Invalid step value: ${step}`);
        }
        let start = min;
        let end = max;
        if (range !== '*') {
            if (range.includes('-')) {
                const [rangeStart, rangeEnd] = range.split('-');
                start = Math.max(min, parseInt(rangeStart, 10));
                end = Math.min(max, parseInt(rangeEnd, 10));
            }
            else {
                start = Math.max(min, parseInt(range, 10));
                end = max;
            }
        }
        for (let i = start; i <= end; i += stepValue) {
            if (i >= min && i <= max) {
                values.add(i);
            }
        }
        return Array.from(values).sort((a, b) => a - b);
    }
    // Handle ranges (e.g., "1-5")
    if (field.includes('-')) {
        const parts = field.split('-');
        if (parts.length !== 2) {
            throw new Error(`Invalid range: ${field}`);
        }
        const start = parseInt(parts[0], 10);
        const end = parseInt(parts[1], 10);
        if (isNaN(start) || isNaN(end)) {
            throw new Error(`Invalid range values: ${field}`);
        }
        for (let i = Math.max(min, start); i <= Math.min(max, end); i++) {
            values.add(i);
        }
        return Array.from(values).sort((a, b) => a - b);
    }
    // Handle lists (e.g., "1,3,5")
    if (field.includes(',')) {
        const parts = field.split(',');
        for (const part of parts) {
            const value = parseInt(part.trim(), 10);
            if (isNaN(value) || value < min || value > max) {
                throw new Error(`Invalid value in list: ${value} (valid range: ${min}-${max})`);
            }
            values.add(value);
        }
        return Array.from(values).sort((a, b) => a - b);
    }
    // Handle single value
    const value = parseInt(field, 10);
    if (isNaN(value) || value < min || value > max) {
        throw new Error(`Invalid value: ${value} (valid range: ${min}-${max})`);
    }
    values.add(value);
    return Array.from(values);
}
matchesSchedule(date, Date);
boolean;
{
    const minute = date.getMinutes();
    const hour = date.getHours();
    const day = date.getDate();
    const month = date.getMonth() + 1; // JavaScript months are 0-based
    const weekday = date.getDay();
    // Check if all fields match
    // Note: Day and weekday are OR'd together in standard cron
    const minuteMatch = this.minute.includes(minute);
    const hourMatch = this.hour.includes(hour);
    const monthMatch = this.month.includes(month);
    const dayMatch = this.day.includes(day);
    const weekdayMatch = this.weekday.includes(weekday);
    // In standard cron, if both day and weekday are restricted (not '*'),
    // they are OR'd. Otherwise they are AND'd.
    const dayAndWeekdayMatch = (this.day.length === 31 && this.weekday.length === 7) ||
        this.day.length === 31 ||
        this.weekday.length === 7
        ? dayMatch || weekdayMatch
        : dayMatch && weekdayMatch;
    return minuteMatch && hourMatch && dayAndWeekdayMatch && monthMatch;
}
/**
 * Validate a cron expression
 */
export function validateCronExpression(expression) {
    const parser = new CronParser(expression);
    return {
        valid: parser.isValid(),
        error: parser.getError(),
    };
}
/**
 * Parse cron and get next execution time
 */
export function getNextExecutionTime(cronExpression, fromDate = new Date()) {
    const parser = new CronParser(cronExpression);
    if (!parser.isValid()) {
        return null;
    }
    return parser.nextExecution(fromDate);
}
/**
 * Parse cron and get previous execution time
 */
export function getPreviousExecutionTime(cronExpression, fromDate = new Date()) {
    const parser = new CronParser(cronExpression);
    if (!parser.isValid()) {
        return null;
    }
    return parser.previousExecution(fromDate);
}
//# sourceMappingURL=cron-parser.js.map