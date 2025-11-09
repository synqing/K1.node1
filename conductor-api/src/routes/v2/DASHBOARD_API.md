# Dashboard API (T15) - Implementation Guide

## Overview

The Dashboard API aggregates real-time data from multiple services (T9, T10, T13, T14) to provide a comprehensive system monitoring interface. It enables unified visibility across error recovery, scheduling, webhooks, and metrics.

## Architecture

```
Dashboard Router (T15)
├── Data Aggregation Layer
│   ├── Error Recovery Stats (T9)
│   ├── Scheduler Stats (T10)
│   ├── Webhook Stats (T9)
│   └── Real-time Status (T13 WebSocket)
├── Timeline Generation
│   └── Event Correlation & Sorting
└── Health Metrics
    └── System Resource Tracking
```

## Endpoints

### 1. GET /v2/dashboard/overview

**Purpose**: Quick summary for dashboard initial load

**Query Parameters**: None

**Response**:
```json
{
  "success": true,
  "data": {
    "timestamp": "2024-11-10T12:00:00Z",
    "errors": {
      "active": 12,
      "resolved24h": 45,
      "pendingRetries": 3,
      "avgResolutionTimeMs": 5432,
      "retrySuccessRate": 0.87,
      "circuitBreakers": {
        "payment-service": {
          "serviceName": "payment-service",
          "state": "closed",
          "failureCount": 2,
          "failureRate": 0.01,
          "lastFailureAt": "2024-11-10T11:55:00Z"
        }
      },
      "commonErrors": [
        {
          "errorType": "timeout",
          "count": 18,
          "lastOccurred": "2024-11-10T11:58:00Z"
        }
      ]
    },
    "schedules": {
      "total": 24,
      "enabled": 22,
      "disabled": 2,
      "nextExecutions": [...],
      "executionTrend": [...],
      "averageExecutionTimeMs": 2847,
      "failureRate": 0.023
    },
    "webhooks": {
      "total": 15,
      "active": 14,
      "disabled": 1,
      "recentDeliveries": [...],
      "failureRate": 0.034,
      "pendingRetries": 2,
      "averageDeliveryTimeMs": 542
    },
    "systemHealth": {
      "uptime": 86400,
      "memoryUsagePercent": 45.2,
      "cpuUsagePercent": 12.5
    }
  },
  "timestamp": "2024-11-10T12:00:00Z"
}
```

**Use Cases**:
- Initial dashboard load
- Quick health check
- System overview at a glance

---

### 2. GET /v2/dashboard/errors

**Purpose**: Recent errors with trend analysis and retry success metrics

**Query Parameters**:
- `limit` (optional, default: 100) - Maximum errors to return

**Response**:
```json
{
  "success": true,
  "data": {
    "timestamp": "2024-11-10T12:00:00Z",
    "stats": {
      "active": 12,
      "resolved24h": 45,
      "pendingRetries": 3,
      "circuitBreakers": {...},
      "commonErrors": [...]
    },
    "recentErrors": [
      {
        "errorId": "err-001",
        "errorType": "timeout",
        "service": "payment-service",
        "message": "Request timeout after 30s",
        "firstOccurred": "2024-11-10T10:00:00Z",
        "lastOccurred": "2024-11-10T11:58:00Z",
        "occurrenceCount": 8,
        "retryStatus": "in_progress",
        "nextRetryAt": "2024-11-10T12:05:00Z"
      }
    ],
    "trend24h": [
      {
        "hour": "2024-11-09T12:00:00Z",
        "count": 12
      }
    ]
  },
  "timestamp": "2024-11-10T12:00:00Z"
}
```

**Use Cases**:
- Error monitoring dashboard
- Trend analysis
- Retry management

---

### 3. GET /v2/dashboard/schedules

**Purpose**: Schedule status, execution stats, and next scheduled tasks

**Query Parameters**: None

**Response**:
```json
{
  "success": true,
  "data": {
    "timestamp": "2024-11-10T12:00:00Z",
    "stats": {
      "total": 24,
      "enabled": 22,
      "disabled": 2,
      "nextExecutions": [
        {
          "scheduleId": "sched-001",
          "scheduleName": "Daily user sync",
          "nextExecutionAt": "2024-11-10T13:00:00Z",
          "status": "enabled"
        }
      ],
      "executionTrend": [
        {
          "hour": "2024-11-10T11:00:00Z",
          "count": 26,
          "successful": 25,
          "failed": 1
        }
      ],
      "averageExecutionTimeMs": 2847,
      "failureRate": 0.023
    }
  },
  "timestamp": "2024-11-10T12:00:00Z"
}
```

**Use Cases**:
- Schedule monitoring
- Execution trend analysis
- Next execution planning

---

### 4. GET /v2/dashboard/webhooks

**Purpose**: Webhook delivery status and retry metrics

**Query Parameters**: None

**Response**:
```json
{
  "success": true,
  "data": {
    "timestamp": "2024-11-10T12:00:00Z",
    "stats": {
      "total": 15,
      "active": 14,
      "disabled": 1,
      "recentDeliveries": [
        {
          "webhookId": "whk-001",
          "deliveryId": "del-001",
          "timestamp": "2024-11-10T11:59:00Z",
          "status": "success",
          "statusCode": 200
        }
      ],
      "failureRate": 0.034,
      "pendingRetries": 2,
      "averageDeliveryTimeMs": 542
    }
  },
  "timestamp": "2024-11-10T12:00:00Z"
}
```

**Use Cases**:
- Webhook delivery monitoring
- Integration health checking
- Retry queue management

---

### 5. GET /v2/dashboard/timeline

**Purpose**: Combined timeline of all events (errors, executions, deliveries)

**Query Parameters**:
- `timeRange` (optional, default: 3600000) - Time range in milliseconds
- `limit` (optional, default: 50) - Maximum events to return

**Response**:
```json
{
  "success": true,
  "data": {
    "timestamp": "2024-11-10T12:00:00Z",
    "timeRange": {
      "duration": 3600000,
      "unit": "milliseconds"
    },
    "eventCount": 8,
    "events": [
      {
        "timestamp": "2024-11-10T11:59:00Z",
        "type": "error",
        "severity": "warning",
        "title": "Retry attempt 2 succeeded",
        "description": "Error err-456 resolved after retry",
        "metadata": {
          "errorId": "err-456",
          "retryCount": 2
        }
      },
      {
        "timestamp": "2024-11-10T11:58:00Z",
        "type": "execution",
        "severity": "info",
        "title": "Schedule executed successfully",
        "description": "Daily user sync completed in 2.3s",
        "metadata": {
          "scheduleId": "sched-001",
          "duration": 2300
        }
      },
      {
        "timestamp": "2024-11-10T11:57:30Z",
        "type": "delivery",
        "severity": "info",
        "title": "Webhook delivered",
        "description": "Event notification webhook delivered successfully",
        "metadata": {
          "webhookId": "whk-001",
          "status": 200
        }
      }
    ]
  },
  "timestamp": "2024-11-10T12:00:00Z"
}
```

**Event Types**:
- `error`: Error occurrence, retry, or circuit breaker change
- `execution`: Schedule execution (success/failure)
- `delivery`: Webhook delivery attempt (success/failure/pending)

**Severity Levels**:
- `info`: Informational
- `warning`: Warning condition
- `critical`: Critical condition requiring attention

**Use Cases**:
- Activity log viewing
- Correlation analysis
- Audit trail
- Historical trending

---

### 6. GET /v2/dashboard/health

**Purpose**: System health and resource metrics

**Query Parameters**: None

**Response**:
```json
{
  "success": true,
  "data": {
    "timestamp": "2024-11-10T12:00:00Z",
    "uptime": 86400,
    "memory": {
      "heapUsed": 52428800,
      "heapTotal": 134217728,
      "heapUsagePercent": 39.06,
      "external": 1048576,
      "rss": 167772160
    },
    "cpu": {
      "userCpuTime": 125000,
      "systemCpuTime": 45000
    },
    "services": {
      "errorRecovery": {
        "status": "healthy",
        "lastCheck": "2024-11-10T12:00:00Z"
      },
      "scheduler": {
        "status": "healthy",
        "lastCheck": "2024-11-10T12:00:00Z"
      },
      "webhooks": {
        "status": "healthy",
        "lastCheck": "2024-11-10T12:00:00Z"
      }
    }
  },
  "timestamp": "2024-11-10T12:00:00Z"
}
```

**Use Cases**:
- System monitoring
- Resource tracking
- Performance troubleshooting
- Service health verification

---

## Data Aggregation Strategy

### From T9 (Error Recovery)
- Active error count
- Resolved errors (24h)
- Pending retries
- Circuit breaker states
- Common error types
- Retry success rate

### From T10 (Scheduler)
- Schedule counts (enabled/disabled)
- Next executions
- Execution history & trends
- Average execution time
- Failure rate

### From T13 (WebSocket)
- Real-time status updates
- Service availability
- Connection status

### From T14 (Metrics)
- System metrics
- Resource usage
- Performance data

### Generated Locally
- Timeline aggregation
- Event correlation
- Health summaries

---

## Caching Strategy

### Recommended Cache TTLs
- Overview: 30 seconds (frequently accessed)
- Error stats: 30 seconds
- Schedule stats: 60 seconds
- Webhook stats: 30 seconds
- Timeline: 10 seconds (real-time)
- Health: 5 seconds (real-time)

### Cache Invalidation
- Manual: On webhook event
- Scheduled: Periodic refresh
- Event-based: On service changes

---

## Response Format Standards

All responses follow this structure:
```json
{
  "success": true|false,
  "data": {...},
  "timestamp": "ISO-8601",
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

---

## Error Handling

### Validation Errors (400)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameter: limit must be > 0"
  }
}
```

### Service Unavailable (503)
```json
{
  "success": false,
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Error recovery service is currently unavailable"
  }
}
```

### Server Error (500)
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to retrieve dashboard data"
  }
}
```

---

## Integration Points

### T9 Integration
- Query error statistics
- Get circuit breaker states
- Retrieve retry metrics

### T10 Integration
- Get schedule list and status
- Query execution history
- Calculate execution trends

### T13 Integration
- Get WebSocket connection status
- Verify service readiness
- Check real-time data availability

### T14 Integration
- Retrieve performance metrics
- Get resource usage data
- Pull aggregated statistics

---

## Performance Considerations

1. **Response Size**: Limit large result sets with pagination
2. **Query Optimization**: Index frequently queried fields
3. **Data Freshness**: Balance accuracy with performance
4. **Caching**: Implement appropriate cache layers
5. **Rate Limiting**: Consider rate limits for public access

---

## Future Enhancements

1. WebSocket support for real-time updates
2. Custom alerting thresholds
3. Historical data retention (>24h)
4. Custom dashboard views
5. Export functionality (CSV, PDF)
6. Correlation analysis
7. Predictive alerts
8. Integration with external monitoring tools

---

## Testing

Run tests with:
```bash
npm test -- dashboard.test.ts
```

Test coverage includes:
- All endpoint functionality
- Data aggregation accuracy
- Error handling
- Query parameter validation
- Response format compliance
- Integration with upstream services
