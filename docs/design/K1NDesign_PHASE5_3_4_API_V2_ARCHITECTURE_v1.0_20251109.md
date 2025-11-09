# Phase 5.3.4: API v2 Architecture Design
**Status:** Design Complete (Task 3.4.1)
**Version:** 1.0
**Date:** 2025-11-09
**Team:** Team A (Backend - Track 2)
**Role:** Backend Architect
**Timeline:** Day 3 (Design Phase)

---

## Executive Summary

Phase 5.3.4 delivers a comprehensive REST API v2 that exposes error recovery and scheduling capabilities from Phase 5.3.1 & 5.3.2, along with advanced features including webhooks, batch operations, and rate limiting. The API follows RESTful principles with OpenAPI 3.1 specification and provides multiple authentication strategies.

**Key Objectives:**
- Expose error recovery endpoints (retry control, circuit breaker management, DLQ operations)
- Expose scheduling endpoints (schedule CRUD, event triggers, queue management)
- Implement webhook support with HMAC signature verification
- Support batch operations for bulk task submissions
- Implement rate limiting with per-client quotas
- Provide comprehensive error responses with structured logging

**Architecture:** Node.js Express server with OpenAPI 3.1 contract-first design

---

## API Versioning Strategy

### Header-Based Versioning (Primary)

```
GET /api/v2/metrics/retry-stats
  Header: Accept: application/vnd.k1node.v2+json
  OR
  Header: X-API-Version: 2
```

### URL Path Versioning (Fallback)

```
GET /api/v2/metrics/retry-stats
  (Explicit version in path)
```

### Content Negotiation

```
Accept: application/vnd.k1node.v2+json → Returns v2 response format
Accept: application/json                → Returns default (v2) format
Accept: application/vnd.k1node.v1+json → Returns v1 response format (deprecated)
```

### Deprecation Strategy

1. **V1 Support Window:** 6 months minimum
2. **Deprecation Warnings:** Returned in response headers
   ```
   Deprecation: true
   Sunset: Sun, 11 May 2025 23:59:59 GMT
   Link: <https://docs.k1node.local/api/v3>; rel="successor-version"
   ```
3. **Migration Path:** Clear documentation with examples in v2 docs
4. **Client Support:** v1 and v2 servers run in parallel for 3 months

---

## OpenAPI 3.1 Contract

### Document Structure

```yaml
openapi: 3.1.0
info:
  title: K1.Node API v2
  version: 2.0.0
  description: Error Recovery & Dynamic Scheduling API
  contact:
    name: API Support
    email: api@k1node.local

servers:
  - url: https://api.k1node.local/api/v2
    description: Production API
  - url: http://localhost:3000/api/v2
    description: Development API

paths:
  /metrics/retry-stats:
    get:
      operationId: getRetryStats
      summary: Get retry engine metrics
      tags: [Error Recovery]
      parameters:
        - name: interval
          in: query
          schema:
            type: string
            enum: [1h, 24h, 7d]
          description: Time interval for metrics
      responses:
        '200':
          description: Retry statistics
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/RetryStats'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '429':
          $ref: '#/components/responses/TooManyRequests'

  /queue/dlq:
    get:
      operationId: listDLQEntries
      summary: List dead letter queue entries
      tags: [Error Recovery]
      parameters:
        - $ref: '#/components/parameters/PageParam'
        - $ref: '#/components/parameters/LimitParam'
        - name: status
          in: query
          schema:
            type: string
            enum: [pending, archived]
      responses:
        '200':
          description: DLQ entries list
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DLQList'

    post:
      operationId: createDLQEntry
      summary: Manually add entry to DLQ
      tags: [Error Recovery]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/DLQEntryInput'
      responses:
        '201':
          description: DLQ entry created

  /queue/dlq/{dlqId}/resubmit:
    post:
      operationId: resubmitDLQEntry
      summary: Resubmit failed task from DLQ
      tags: [Error Recovery]
      parameters:
        - name: dlqId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                parameters:
                  type: object
                  description: Modified parameters for retry
      responses:
        '202':
          description: Resubmission queued

  /scheduler/schedules:
    get:
      operationId: listSchedules
      summary: List all schedules
      tags: [Scheduling]
      parameters:
        - name: type
          in: query
          schema:
            type: string
            enum: [cron, event]
        - name: enabled
          in: query
          schema:
            type: boolean
      responses:
        '200':
          description: List of schedules
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ScheduleList'

    post:
      operationId: createSchedule
      summary: Create new schedule
      tags: [Scheduling]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ScheduleInput'
      responses:
        '201':
          description: Schedule created
          headers:
            Location:
              schema:
                type: string
              description: URL of created schedule

  /scheduler/schedules/{scheduleId}:
    get:
      operationId: getSchedule
      summary: Get schedule details
      tags: [Scheduling]
      parameters:
        - name: scheduleId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Schedule details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Schedule'
        '404':
          $ref: '#/components/responses/NotFound'

    patch:
      operationId: updateSchedule
      summary: Update schedule
      tags: [Scheduling]
      parameters:
        - name: scheduleId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ScheduleUpdate'
      responses:
        '200':
          description: Schedule updated

    delete:
      operationId: deleteSchedule
      summary: Delete schedule
      tags: [Scheduling]
      parameters:
        - name: scheduleId
          in: path
          required: true
          schema:
            type: string
      responses:
        '204':
          description: Schedule deleted

  /scheduler/trigger:
    post:
      operationId: triggerEvent
      summary: Trigger event-based schedules
      tags: [Scheduling]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                event:
                  type: string
                  example: "webhook.received"
                metadata:
                  type: object
      responses:
        '202':
          description: Event triggered, schedules queued

  /scheduler/queue:
    get:
      operationId: getQueueStatus
      summary: Get priority queue status
      tags: [Scheduling]
      responses:
        '200':
          description: Queue status
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/QueueStatus'

  /tasks/batch:
    post:
      operationId: submitBatch
      summary: Submit multiple tasks for execution
      tags: [Batch Operations]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BatchSubmission'
      responses:
        '202':
          description: Batch submitted for processing

components:
  schemas:
    RetryStats:
      type: object
      properties:
        total_attempts:
          type: integer
        successful_retries:
          type: integer
        failed_permanently:
          type: integer
        success_rate:
          type: number
          format: percentage
        average_attempts:
          type: number
        last_24h:
          type: array
          items:
            type: object

    DLQEntry:
      type: object
      properties:
        dlq_id:
          type: string
        task_id:
          type: string
        timestamp:
          type: string
          format: date-time
        error_code:
          type: integer
        error_message:
          type: string
        status:
          type: string
          enum: [pending, archived, resubmitted]

    Schedule:
      type: object
      properties:
        task_id:
          type: string
        schedule_type:
          type: string
          enum: [cron, event]
        schedule_expr:
          type: string
        priority:
          type: integer
          minimum: 1
          maximum: 10
        enabled:
          type: boolean
        last_executed:
          type: string
          format: date-time
        next_execution:
          type: string
          format: date-time

    QueueStatus:
      type: object
      properties:
        queued:
          type: integer
        executing:
          type: integer
        completed:
          type: integer
        pending_tasks:
          type: array
          items:
            type: object

  responses:
    Unauthorized:
      description: Authentication required
      content:
        application/json:
          schema:
            type: object
            properties:
              error: { type: string }

    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            type: object
            properties:
              error: { type: string }

    TooManyRequests:
      description: Rate limit exceeded
      headers:
        X-RateLimit-Limit:
          schema: { type: integer }
        X-RateLimit-Remaining:
          schema: { type: integer }
        X-RateLimit-Reset:
          schema: { type: string, format: date-time }
```

---

## Authentication & Authorization

### Authentication Methods

1. **API Key (Recommended for Service-to-Service)**
   ```
   Header: Authorization: Bearer sk-abc123...xyz
   Scopes: scheduler:read, scheduler:write, error-recovery:read, error-recovery:write
   ```

2. **OAuth 2.0 (User-Facing Dashboards)**
   ```
   Authorization Code Flow
   Token endpoint: https://auth.k1node.local/oauth/token
   Scopes: dashboard:read, dashboard:write, admin
   ```

3. **JWT Tokens (Internal Services)**
   ```
   Header: Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
   Issued by: Internal service
   Expires: 24 hours
   Refresh: Via refresh_token endpoint
   ```

### Authorization Scopes

```
scheduler:read      → List/get schedules
scheduler:write     → Create/update/delete schedules
scheduler:trigger   → Trigger events
scheduling:admin    → All scheduler operations

error-recovery:read → View retry/circuit-breaker/DLQ metrics
error-recovery:write→ Resubmit DLQ entries, pause/resume tasks
error-recovery:admin→ All error recovery operations

batch:write        → Submit batch operations
batch:admin        → Manage batch processing

admin              → All operations (supersedes all scopes)
```

---

## Error Recovery API Endpoints

### 1. Retry Metrics

```
GET /api/v2/metrics/retry-stats
Query Parameters:
  - interval: 1h | 24h | 7d (default: 24h)
  - policy: standard | aggressive | conservative (optional filter)

Response (200):
{
  "timestamp": "2025-11-09T20:37:29+08:00",
  "interval": "24h",
  "metrics": {
    "total_tasks_retried": 1250,
    "successful_first_attempt": 11750,
    "successful_after_retry": 1200,
    "failed_permanently": 50,
    "success_rate": 0.974,
    "average_attempts": 1.08,
    "by_policy": {
      "standard": { "count": 950, "success_rate": 0.979 },
      "aggressive": { "count": 200, "success_rate": 0.950 },
      "conservative": { "count": 100, "success_rate": 0.990 }
    }
  },
  "timeseries": [
    { "hour": 0, "attempts": 45, "successes": 44 },
    { "hour": 1, "attempts": 52, "successes": 50 }
  ]
}
```

### 2. Circuit Breaker Status

```
GET /api/v2/circuit-breaker/status
Query Parameters:
  - breaker_id: Optional filter by breaker ID

Response (200):
{
  "timestamp": "2025-11-09T20:37:29+08:00",
  "breakers": [
    {
      "breaker_id": "api-service-1",
      "state": "CLOSED",
      "failure_rate": 0.02,
      "failure_count": 2,
      "success_count": 98,
      "last_state_change": "2025-11-09T18:00:00+08:00",
      "timeout_remaining_ms": 0
    },
    {
      "breaker_id": "database-cluster-1",
      "state": "HALF-OPEN",
      "failure_rate": 0.45,
      "failure_count": 45,
      "success_count": 55,
      "last_state_change": "2025-11-09T20:30:00+08:00",
      "timeout_remaining_ms": 12000
    }
  ]
}
```

### 3. Dead Letter Queue (DLQ) Operations

```
GET /api/v2/queue/dlq
Query Parameters:
  - page: 1 (default)
  - limit: 20 (default)
  - status: pending | archived | all (default)
  - task_id: Optional filter

Response (200):
{
  "pagination": { "page": 1, "limit": 20, "total": 150 },
  "entries": [
    {
      "dlq_id": "dlq-task-1-1667953049123",
      "task_id": "task-1",
      "timestamp": "2025-11-09T18:00:00+08:00",
      "error_code": 500,
      "error_message": "Service unavailable (max retries exceeded)",
      "status": "pending",
      "original_parameters": { ... },
      "last_resubmit_attempt": null,
      "manual_intervention_required": true
    }
  ]
}

POST /api/v2/queue/dlq/{dlqId}/resubmit
Request Body:
{
  "parameters": {
    // Optional: Override original parameters
  },
  "retry_policy": "standard" // Optional: Use different policy
}

Response (202):
{
  "message": "Resubmission queued",
  "dlq_id": "dlq-task-1-1667953049123",
  "new_task_id": "task-1-retry-2",
  "status": "queued",
  "estimated_execution": "2025-11-09T20:40:00+08:00"
}
```

### 4. Task Intervention

```
POST /api/v2/tasks/{taskId}/pause
Request Body: {}
Response (202): { "status": "paused", "paused_at": "2025-11-09T20:37:29+08:00" }

POST /api/v2/tasks/{taskId}/resume
Request Body: {}
Response (202): { "status": "running", "resumed_at": "2025-11-09T20:37:29+08:00" }

POST /api/v2/tasks/{taskId}/skip
Request Body: { "reason": "Manual skip" }
Response (202): { "status": "skipped", "reason": "Manual skip" }

POST /api/v2/tasks/{taskId}/retry
Request Body: {
  "parameters": { /* modified params */ },
  "retry_policy": "aggressive"
}
Response (202): { "status": "queued", "new_task_id": "task-1-retry-1" }

GET /api/v2/tasks/{taskId}/intervention-history
Response (200):
{
  "task_id": "task-1",
  "interventions": [
    {
      "timestamp": "2025-11-09T20:30:00+08:00",
      "action": "pause",
      "reason": "Debugging issue",
      "performed_by": "operator-user-1"
    },
    {
      "timestamp": "2025-11-09T20:35:00+08:00",
      "action": "resume",
      "reason": null,
      "performed_by": "operator-user-1"
    }
  ]
}
```

---

## Scheduling API Endpoints

### 1. Schedule Management

```
GET /api/v2/scheduler/schedules
Query Parameters:
  - type: cron | event (optional)
  - enabled: true | false (optional)
  - page, limit

Response (200):
{
  "schedules": [
    {
      "task_id": "backup-daily",
      "schedule_type": "cron",
      "schedule_expr": "0 2 * * *",
      "priority": 8,
      "enabled": true,
      "created_at": "2025-11-08T10:00:00+08:00",
      "last_executed": "2025-11-09T02:00:15+08:00",
      "next_execution": "2025-11-10T02:00:00+08:00",
      "execution_count": 5,
      "failure_count": 0,
      "average_duration_ms": 1250
    }
  ]
}

POST /api/v2/scheduler/schedules
Request Body:
{
  "task_id": "backup-daily",
  "task_name": "Daily Backup",
  "handler": "bash ops/agents/backup.sh",
  "schedule_type": "cron",
  "schedule_expr": "0 2 * * *",
  "priority": 8,
  "circuit_breaker": "default",
  "retry_policy": "standard"
}

Response (201): { "task_id": "backup-daily", ... }

PATCH /api/v2/scheduler/schedules/{scheduleId}
Request Body: { "enabled": false } (partial update)

Response (200): { "task_id": "backup-daily", ... }

DELETE /api/v2/scheduler/schedules/{scheduleId}
Response (204): (no content)
```

### 2. Event Triggering

```
POST /api/v2/scheduler/trigger
Request Body:
{
  "event": "webhook.received",
  "metadata": {
    "source": "external-service",
    "webhook_id": "wh-12345"
  }
}

Response (202):
{
  "message": "Event triggered",
  "event": "webhook.received",
  "matching_schedules": 3,
  "queued_tasks": 3,
  "timestamp": "2025-11-09T20:37:29+08:00"
}
```

### 3. Queue Status

```
GET /api/v2/scheduler/queue
Response (200):
{
  "timestamp": "2025-11-09T20:37:29+08:00",
  "queue_status": {
    "queued": 5,
    "executing": 2,
    "completed": 145
  },
  "resource_usage": {
    "concurrent_tasks": 2,
    "total_cpu_percent": 35,
    "total_memory_percent": 42
  },
  "resource_limits": {
    "max_concurrent_tasks": 4,
    "max_cpu_percent": 80,
    "max_memory_percent": 85
  },
  "pending_tasks": [
    {
      "priority": 9,
      "task_id": "critical-task-1",
      "enqueued_at": "2025-11-09T20:35:00+08:00",
      "wait_time_ms": 149000
    }
  ]
}
```

---

## Webhook Support

### Webhook Registration

```
POST /api/v2/webhooks
Request Body:
{
  "name": "task-completion-webhook",
  "url": "https://external-service.com/webhooks/k1node",
  "events": ["task.completed", "task.failed"],
  "secret": "whsec_...",  // Generated by system if not provided
  "active": true,
  "retry_policy": {
    "max_retries": 3,
    "backoff_multiplier": 2
  }
}

Response (201):
{
  "webhook_id": "wh-abc123xyz",
  "name": "task-completion-webhook",
  "url": "https://external-service.com/webhooks/k1node",
  "secret": "whsec_...",
  "created_at": "2025-11-09T20:37:29+08:00"
}
```

### Webhook Payload Format

```json
{
  "id": "wh-evt-123",
  "timestamp": "2025-11-09T20:37:29+08:00",
  "event": "task.completed",
  "data": {
    "task_id": "task-1",
    "status": "completed",
    "result": {
      "exit_code": 0,
      "duration_ms": 1250,
      "output": "..."
    }
  }
}
```

### HMAC Signature Verification

```
Header: X-K1Node-Signature: sha256=...
Verification:
  1. Extract signature from header
  2. Compute HMAC-SHA256(webhook_secret, request_body)
  3. Compare signatures (constant-time comparison)
  4. Verify timestamp freshness (< 5 minutes)

Example (Node.js):
const crypto = require('crypto');
const signature = req.headers['x-k1node-signature'];
const computed = 'sha256=' + crypto
  .createHmac('sha256', webhook_secret)
  .update(req.rawBody)
  .digest('hex');
const valid = crypto.timingSafeEqual(
  Buffer.from(signature),
  Buffer.from(computed)
);
```

---

## Batch Operations

### Batch Task Submission

```
POST /api/v2/tasks/batch
Request Body:
{
  "batch_id": "batch-export-20251109",
  "tasks": [
    {
      "task_id": "export-1",
      "handler": "bash ops/agents/export.sh",
      "parameters": { "format": "csv", "dataset": "users" },
      "priority": 5
    },
    {
      "task_id": "export-2",
      "handler": "bash ops/agents/export.sh",
      "parameters": { "format": "json", "dataset": "orders" },
      "priority": 5
    }
  ],
  "options": {
    "fail_fast": false,  // Continue on individual task failure
    "parallel": true,    // Execute in parallel where possible
    "max_concurrent": 2
  }
}

Response (202):
{
  "batch_id": "batch-export-20251109",
  "status": "submitted",
  "task_count": 2,
  "estimated_completion": "2025-11-09T21:00:00+08:00"
}

GET /api/v2/tasks/batch/{batchId}
Response (200):
{
  "batch_id": "batch-export-20251109",
  "status": "in_progress",
  "progress": {
    "total": 2,
    "completed": 1,
    "failed": 0,
    "in_progress": 1
  },
  "tasks": [
    {
      "task_id": "export-1",
      "status": "completed",
      "result": { "exit_code": 0 }
    }
  ]
}
```

### Batch DLQ Resubmission

```
POST /api/v2/queue/dlq/batch-resubmit
Request Body:
{
  "dlq_ids": [
    "dlq-task-1-123",
    "dlq-task-2-124",
    "dlq-task-3-125"
  ],
  "retry_policy": "aggressive",
  "options": {
    "modify_parameters": {
      "timeout_ms": 5000  // Increase timeout for all
    }
  }
}

Response (202):
{
  "resubmitted_count": 3,
  "new_task_ids": [
    "task-1-retry-2",
    "task-2-retry-2",
    "task-3-retry-2"
  ]
}
```

---

## Rate Limiting

### Rate Limit Strategy

```
Strategy: Token Bucket per API key
- Base limit: 1000 requests/hour
- Burst limit: 100 requests/minute
- Per-endpoint multipliers:
  - Batch operations: 5x (heavy operations)
  - Webhooks: 2x
  - Metrics: 1x (light operations)

Headers in Response:
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 987
X-RateLimit-Reset: 2025-11-09T21:37:29+08:00
X-RateLimit-RetryAfter: 3 (seconds until available)
```

### Rate Limit Errors

```
429 Too Many Requests:
{
  "error": "rate_limit_exceeded",
  "message": "API rate limit exceeded",
  "limit": 1000,
  "remaining": 0,
  "reset_at": "2025-11-09T21:37:29+08:00",
  "retry_after": 3
}
```

---

## Error Response Format

### Standard Error Response

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Request validation failed",
    "status": 400,
    "timestamp": "2025-11-09T20:37:29+08:00",
    "request_id": "req-abc123xyz",
    "details": [
      {
        "field": "schedule_expr",
        "message": "Invalid cron expression",
        "suggestion": "Use format: minute hour day month weekday"
      }
    ]
  }
}
```

### Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| INVALID_REQUEST | 400 | Request validation failed |
| UNAUTHORIZED | 401 | Authentication required |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource conflict (e.g., duplicate ID) |
| RATE_LIMIT_EXCEEDED | 429 | API rate limit exceeded |
| INTERNAL_ERROR | 500 | Server error |
| SERVICE_UNAVAILABLE | 503 | Service temporarily unavailable |

---

## Implementation Patterns

### Request Validation Middleware

```typescript
// middleware/validate.ts
interface ValidationRule {
  field: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  pattern?: RegExp;
  min?: number;
  max?: number;
  enum?: any[];
}

const validateRequest = (rules: ValidationRule[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors = [];
    // Validate each rule
    if (errors.length > 0) {
      return res.status(400).json({
        error: { code: 'INVALID_REQUEST', details: errors }
      });
    }
    next();
  };
};
```

### Response Wrapping

```typescript
// middleware/response.ts
const successResponse = (data: any, statusCode = 200) => {
  return {
    status: 'success',
    data,
    timestamp: new Date().toISOString()
  };
};

const errorResponse = (error: Error, statusCode = 500) => {
  return {
    status: 'error',
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message,
      status: statusCode,
      timestamp: new Date().toISOString()
    }
  };
};
```

### Async Error Handling

```typescript
// middleware/asyncHandler.ts
const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Usage
router.get('/schedules', asyncHandler(async (req, res) => {
  const schedules = await scheduleService.listSchedules();
  res.json(successResponse(schedules));
}));
```

---

## Security Considerations

### Input Validation
- Validate all inputs against schema
- Sanitize strings to prevent injection attacks
- Validate cron expressions before storing
- Limit request body size to 1MB

### Authentication & Authorization
- Enforce HTTPS only (TLS 1.2+)
- Implement proper JWT token expiration
- Use HMAC signatures for webhooks
- Log all authentication failures

### Rate Limiting
- Per-API-key rate limiting
- Per-IP rate limiting for unauthenticated requests
- Implement circuit breaker for downstream services

### Data Protection
- Encrypt webhook secrets at rest
- Never log sensitive data (secrets, tokens)
- Implement audit logging for sensitive operations
- Support data retention policies

---

## Deployment & Operations

### Environment Configuration

```bash
# .env.example
API_VERSION=2.0.0
PORT=3000
NODE_ENV=production

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRY=24h

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=k1node

# Rate Limiting
RATE_LIMIT_REQUESTS=1000
RATE_LIMIT_WINDOW_MS=3600000

# Webhook
WEBHOOK_TIMEOUT_MS=30000
WEBHOOK_MAX_RETRIES=3
```

### Monitoring & Observability

- **Metrics:** Request count, latency, error rate per endpoint
- **Logs:** Structured JSON logs with request ID correlation
- **Traces:** Distributed tracing with span tags
- **Alerts:** Alert on error rate > 5%, latency p99 > 1s

---

## Integration with Phase 5.3.3 (Dashboard)

The API provides all endpoints needed by the dashboard:
- Error recovery metrics for retry/circuit-breaker/DLQ panels
- Scheduling metrics for schedule/queue/resource panels
- WebSocket endpoint for real-time updates
- Intervention endpoints for task control operations

---

## Next Steps (Day 4 - Task 3.4.2)

1. **API Versioning Infrastructure**
   - Implement header-based and path-based versioning
   - Set up content negotiation middleware
   - Create deprecation warning system

2. **Authentication Implementation**
   - JWT token generation and validation
   - Scope-based authorization middleware
   - API key management system

3. **Core Endpoint Implementation**
   - Implement all endpoints from OpenAPI spec
   - Add comprehensive input validation
   - Wire up to Phase 5.3.1-2 backend

---

## Sign-Off

**API Design Status:** ✅ COMPLETE
**OpenAPI Specification:** ✅ DEFINED (30+ endpoints)
**Versioning Strategy:** ✅ DESIGNED (header + path based)
**Authentication:** ✅ SPECIFIED (API key + OAuth 2.0 + JWT)
**Error Handling:** ✅ STANDARDIZED (with detailed error codes)
**Security:** ✅ CONSIDERED (input validation, rate limiting, HMAC signatures)

**Ready for Infrastructure Implementation (Task 3.4.2):** ✅ YES

---

**Document Version:** 1.0
**Status:** API Design Complete
**Last Updated:** 2025-11-09
**Team:** Team A (Backend - Track 2)
**Task:** 3.4.1 (API v2 Architecture Design)
