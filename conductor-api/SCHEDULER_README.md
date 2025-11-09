# Scheduler Core Engine - Implementation Documentation

## Overview

The Scheduler Core Engine provides cron-based scheduling for workflows in the K1.node1 Conductor system. It includes:

- **Cron Expression Parser**: Full support for standard 5-field cron format
- **Scheduler Core Service**: CRUD operations for schedules and execution history
- **Schedule Executor Worker**: Background worker that checks and executes schedules every 30 seconds

## Architecture

### Components

#### 1. CronParser (`src/utils/cron-parser.ts`)
Parses and validates standard cron expressions (5-field format: minute hour day month weekday).

**Features:**
- Validates cron expression syntax
- Calculates next execution time from any date
- Calculates previous execution time
- Supports all standard cron patterns:
  - Wildcards: `*`
  - Ranges: `1-5`
  - Lists: `1,3,5`
  - Steps: `*/5`, `1-10/2`

**Usage:**
```typescript
import { CronParser, validateCronExpression, getNextExecutionTime } from '@conductor/api';

// Validate expression
const result = validateCronExpression('0 9 * * *');
if (result.valid) {
  console.log('Valid cron expression');
}

// Get next execution
const next = getNextExecutionTime('0 9 * * *');
console.log('Next execution:', next);

// Use parser directly
const parser = new CronParser('0 9 * * *');
const nextExecution = parser.nextExecution(new Date());
```

#### 2. SchedulerCoreService (`src/services/scheduler-core.ts`)
Main service for managing schedules and tracking execution history.

**Operations:**
- `createSchedule(request)` - Create a new schedule
- `getSchedule(id)` - Retrieve a schedule by ID
- `listSchedules(filter?)` - List schedules with optional filtering
- `updateSchedule(id, request)` - Update schedule properties
- `deleteSchedule(id)` - Delete a schedule
- `recordExecution(...)` - Record execution in history
- `getExecutionHistory(scheduleId, filter?)` - Retrieve execution history

**Usage:**
```typescript
import { createSchedulerService } from '@conductor/api';

const scheduler = createSchedulerService();

// Create a schedule
const schedule = await scheduler.createSchedule({
  name: 'Daily Report',
  description: 'Run daily at 9 AM',
  workflowId: 'workflow_123',
  cronExpression: '0 9 * * *',
  enabled: true,
  timezone: 'UTC'
});

// List enabled schedules
const schedules = await scheduler.listSchedules({ enabled: true });

// Update a schedule
await scheduler.updateSchedule(schedule.id, {
  cronExpression: '0 10 * * *'
});

// Record execution
await scheduler.recordExecution(
  schedule.id,
  schedule.workflowId,
  'success',
  1000,
  undefined,
  { executedAt: new Date().toISOString() }
);

// Get execution history
const history = await scheduler.getExecutionHistory(schedule.id);
```

#### 3. ScheduleExecutor (`src/workers/schedule-executor.ts`)
Background worker that checks and executes scheduled workflows.

**Features:**
- Runs every 30 seconds
- Checks for schedules due for execution
- Triggers workflow execution via webhook
- Records execution status and metrics
- Tracks statistics (success/failure counts, uptime)

**Usage:**
```typescript
import { createScheduleExecutor, createSchedulerService } from '@conductor/api';

const scheduler = createSchedulerService();

// Create executor with custom webhook handler
const executor = createScheduleExecutor(
  scheduler,
  async (workflowId: string) => {
    // Call your workflow execution endpoint
    const response = await fetch(`/api/workflows/${workflowId}/execute`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Workflow execution failed');
  }
);

// Start executor
await executor.start();

// Monitor executor
if (executor.isRunning()) {
  const stats = executor.getStats();
  console.log(`Total executions: ${stats.totalExecutions}`);
  console.log(`Successful: ${stats.successfulExecutions}`);
  console.log(`Failed: ${stats.failedExecutions}`);
}

// Stop executor
await executor.stop();
```

## Database Schema

### `schedules` Table
Stores schedule definitions with cron expressions and execution metadata.

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(255) | Primary key |
| name | VARCHAR(255) | Schedule name |
| description | TEXT | Optional description |
| workflow_id | VARCHAR(255) | Workflow to execute (FK) |
| cron_expression | VARCHAR(255) | Cron expression |
| enabled | BOOLEAN | Enable/disable schedule |
| timezone | VARCHAR(50) | Timezone for cron calculation |
| next_execution_time | TIMESTAMP | Next scheduled execution |
| last_execution_time | TIMESTAMP | Last execution time |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |
| metadata | JSONB | Custom metadata |

### `execution_history` Table
Tracks all schedule executions for audit and monitoring.

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(255) | Primary key |
| schedule_id | VARCHAR(255) | Reference to schedule (FK) |
| workflow_id | VARCHAR(255) | Reference to workflow (FK) |
| status | VARCHAR(50) | Execution status (pending/running/success/failed) |
| started_at | TIMESTAMP | Execution start time |
| completed_at | TIMESTAMP | Execution completion time |
| duration_ms | INTEGER | Execution duration in milliseconds |
| execution_id | VARCHAR(255) | Conductor execution ID |
| error | TEXT | Error message if failed |
| result | JSONB | Execution result/output |
| metadata | JSONB | Custom metadata |
| created_at | TIMESTAMP | Record creation time |

### `schedule_execution_summary` View
Provides aggregated execution metrics by schedule.

**Columns:**
- schedule statistics (id, name, workflow_id, cron_expression)
- execution counts (total, successful, failed, running)
- performance metrics (avg_success_duration_ms, last_completion_time)

## Cron Expression Examples

| Expression | Description |
|------------|-------------|
| `0 0 * * *` | Daily at midnight |
| `0 9 * * *` | Daily at 9 AM |
| `0 */4 * * *` | Every 4 hours |
| `*/15 * * * *` | Every 15 minutes |
| `0 0 1 * *` | First of every month |
| `0 0 * * 0` | Every Sunday |
| `0 9 * * 1-5` | Every weekday at 9 AM |
| `0 0,12 * * *` | Twice daily (midnight and noon) |
| `0 0 1-7 * *` | First 7 days of month |

## Status Tracking

Execution statuses:
- `pending` - Scheduled but not yet running
- `running` - Currently executing
- `success` - Completed successfully
- `failed` - Failed with error

## Error Handling

The service validates all inputs:
- Cron expressions must be valid 5-field format
- Schedule IDs must exist for updates/deletes
- Workflow IDs must be valid
- Execution history can only be recorded for existing schedules

Example error handling:
```typescript
try {
  const schedule = await scheduler.createSchedule({
    name: 'Bad Schedule',
    workflowId: 'workflow_123',
    cronExpression: '* * * *' // Invalid: 4 fields instead of 5
  });
} catch (error) {
  console.error('Failed to create schedule:', error.message);
  // "Failed to create schedule: Invalid cron expression: expected 5 fields, got 4"
}
```

## Migration

The scheduler schema is created via migration `V14__scheduler_schema.sql`:
- Creates `schedules` table with appropriate indexes
- Creates `execution_history` table with compound indexes for efficient querying
- Creates `schedule_execution_summary` view for analytics

Apply migration:
```sql
psql conductor_db < migrations/V14__scheduler_schema.sql
```

## Performance Considerations

### Execution Interval
The executor runs every 30 seconds, which provides:
- Reasonable responsiveness for schedule execution
- Low overhead on system resources
- Acceptable delay for most use cases

### Database Indexes
Strategic indexes on frequently queried columns:
- `schedules(enabled)` - For filtering enabled schedules
- `schedules(next_execution_time)` - For finding due schedules
- `execution_history(schedule_id, started_at)` - For history retrieval
- `execution_history(status)` - For status filtering

### In-Memory Storage (Current)
The current implementation uses in-memory storage. For production:
- Replace `InMemoryScheduleStore` with actual database implementation
- Use connection pooling for concurrent access
- Implement transaction management

## Testing

Comprehensive test suite in `src/__tests__/scheduler.test.ts`:
- CronParser validation and execution time calculations
- Schedule CRUD operations
- Execution history tracking
- Filter and pagination logic
- Error handling

Run tests:
```bash
npm test
```

## Integration Example

```typescript
import { createSchedulerService, createScheduleExecutor } from '@conductor/api';

// Initialize services
const scheduler = createSchedulerService();
const executor = createScheduleExecutor(
  scheduler,
  async (workflowId) => {
    // Trigger workflow execution
    const res = await fetch(`/api/workflows/${workflowId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(`Execution failed: ${res.status}`);
  }
);

// Create schedules
const daily = await scheduler.createSchedule({
  name: 'Daily Report',
  workflowId: 'report_workflow',
  cronExpression: '0 9 * * *'
});

const hourly = await scheduler.createSchedule({
  name: 'Hourly Sync',
  workflowId: 'sync_workflow',
  cronExpression: '0 * * * *'
});

// Start executor
await executor.start();

// Monitor statistics
setInterval(() => {
  const stats = executor.getStats();
  console.log(`Scheduler Stats:`, stats);
}, 60000);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await executor.stop();
  process.exit(0);
});
```

## Files

- `/src/types/scheduler.types.ts` - Type definitions and interfaces
- `/src/utils/cron-parser.ts` - Cron expression parser
- `/src/services/scheduler-core.ts` - Core scheduler service
- `/src/workers/schedule-executor.ts` - Background executor worker
- `/src/__tests__/scheduler.test.ts` - Unit tests
- `/docker/migrations/V14__scheduler_schema.sql` - Database schema migration
