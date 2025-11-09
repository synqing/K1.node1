# Phase 5.3 Pattern Research Synthesis

**Status**: Research Complete
**Date**: 2025-11-10
**Owner**: Claude Research Agent
**Related**: Phase 5.3 specification, Phase 5.1 baseline profiling

---

## Executive Summary

This research synthesizes best practices for four critical architectural patterns needed in Phase 5.3:

1. **ERROR RECOVERY**: Use DLQ + exponential backoff with configurable retry policies
2. **DYNAMIC SCHEDULING**: PostgreSQL-backed APScheduler for persistence; Celery if distributed scaling needed
3. **WEBSOCKET REAL-TIME**: Pub/Sub + rooms/namespaces with external message broker (Redis)
4. **CONDUCTOR INTEGRATION**: Stateless polling workers with circuit breaker protection

All patterns emphasize **resilience through isolation, bounded failure modes, and observability**.

---

## 1. ERROR RECOVERY PATTERNS

### Recommended Pattern: DLQ + Exponential Backoff + Circuit Breaker

#### Architecture
```
Task Pipeline → Retry Logic → Success/DLQ
      ↓
  Exponential Backoff
  (base * exponent^n + jitter)
      ↓
  Non-transient? → Dead Letter Queue (DLQ)
  Transient? → Async Retry
```

#### Key Components

**Exponential Backoff Formula**
- `delay = base * exponent^attempt_count + random_jitter`
- Example: 1s, 2s, 4s, 8s, 16s... (with ±10% jitter)
- **Why jitter**: Prevents synchronized retry storms (thundering herd)

**Dead Letter Queue (DLQ) Design**
- **Trigger**: After max retry attempts (e.g., 5) or non-transient errors detected
- **Storage**: Separate queue with rich metadata (attempt count, timestamps, error logs)
- **Handling**: Two modes
  - Passive: Archive for manual inspection
  - Active: Trigger alerting workflow (e.g., PagerDuty, Slack notification)

**Circuit Breaker Pattern** (Protection Layer)
- **States**: Closed (normal) → Open (failing) → Half-Open (recovery test)
- **Thresholds**: Trip after 5 consecutive failures; reset after 60s timeout
- **Action**: Fail-fast when circuit is open; prevent cascading failures
- **Library**: `pybreaker` (lightweight, Redis-backed for distributed systems)

#### Why It's Best Fit for K1.node1

1. **Isolates failure modes**: Non-transient (poison pills) don't retry indefinitely
2. **Reduces cascading failures**: Circuit breaker stops hammering failing services
3. **Observability**: DLQ metadata enables forensics without losing the failed task
4. **Simple to test**: Exponential backoff is deterministic; jitter adds realistic variance

#### Key Libraries/Tools

- **Retry Logic**: `tenacity` (Python) — declarative retry decorators with exponential backoff
- **Circuit Breaker**: `pybreaker` (https://github.com/danielfm/pybreaker) — simple, production-ready
- **DLQ Storage**: PostgreSQL table or Redis Stream (if already using Redis)
- **Monitoring**: Log to syslog/ELK; expose `/api/dlq/stats` endpoint

#### Implementation Checklist

- [ ] Define retry budget (max attempts, timeout)
- [ ] Distinguish transient vs. non-transient errors in task code
- [ ] Implement exponential backoff with jitter (min 1s, max 60s recommended)
- [ ] Create DLQ table/stream with metadata schema
- [ ] Set up circuit breaker around external service calls (Conductor, database)
- [ ] Add `/api/dlq/stats` and `/api/circuitbreaker/status` endpoints
- [ ] Test: inject failures, verify backoff timing, confirm DLQ population
- [ ] Document retry budget and DLQ replay procedure

#### Gotchas to Avoid

- **Jitter without bounds**: Use 10–20% random variation; avoid > 50%
- **Retry without idempotency**: Ensure tasks are idempotent (e.g., upsert vs. insert)
- **Ignoring disk/memory pressure**: DLQ can grow; set retention policy (TTL or size limit)
- **No observability on circuit state**: Always expose `/api/circuitbreaker/status` for debugging

#### Real-World Reference Implementations

- **LittleHorse Orchestrator** (https://littlehorse.io/blog/retries-and-dlq)
  - Automates retries, DLQ, and fallback workflows declaratively
  - Excellent pattern inspiration even if not using LittleHorse directly

- **AWS SQS DLQ + Replay** (https://aws.amazon.com/blogs/compute/using-amazon-sqs-dead-letter-queues-to-replay-messages/)
  - Shows how to replay DLQ messages; applicable to Postgres-backed queues

- **Netflix Conductor** (See Section 4)
  - Built-in retry policies per task type; automatic state persistence

---

## 2. DYNAMIC SCHEDULING PATTERNS

### Recommended Pattern: APScheduler + PostgreSQL + Redis Pub/Sub (for scale)

#### Decision Matrix

| Requirement | In-Process | APScheduler + PG | Celery + Beat |
|---|---|---|---|
| **Persistence** | No | Yes | Yes |
| **Distribution** | Single process | Single scheduler instance | N workers |
| **Scalability** | Limited | Medium (1K jobs) | High (100K+ jobs) |
| **Dependency** | None | PostgreSQL | Redis/RabbitMQ |
| **Learning Curve** | Trivial | Simple | Steep |
| **Use Case** | Dev only | Small–medium | Enterprise |

#### Recommended Architecture: APScheduler + PostgreSQL JobStore

```python
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

# 1. Configure job store
jobstore = SQLAlchemyJobStore(
    url='postgresql+asyncpg://user:pass@localhost/k1_db'
)

# 2. Create scheduler
scheduler = BackgroundScheduler(
    jobstores={'default': jobstore},
    job_defaults={'coalesce': True, 'max_instances': 1}
)

# 3. Add jobs
scheduler.add_job(
    func=background_task,
    trigger=CronTrigger(hour=2, minute=0),  # 2 AM daily
    id='nightly_profiling',
    name='Run nightly profiling',
    replace_existing=True
)

# 4. Start (persists jobs to DB; restarts on scheduler boot)
scheduler.start()
```

#### Key Features

**Job Persistence**
- Jobs survive scheduler restart
- Handles misfired jobs (scheduled time missed due to shutdown)
- Coalesce option prevents duplicate execution

**Trigger Types**
1. **CronTrigger**: `0 2 * * *` (Unix cron syntax) — 2 AM daily
2. **IntervalTrigger**: `interval_seconds=3600` — every hour
3. **DateTrigger**: Single execution at specific time

**Misfire Handling**
- When scheduler restarts after a job's scheduled time has passed:
  - `coalesce=True`: Execute once (default, recommended)
  - `coalesce=False`: Execute for each missed schedule

#### Why It's Best Fit for K1.node1

1. **Zero external dependencies** for basic use (local scheduler) → easier testing
2. **PostgreSQL backing** reuses existing infrastructure (no Redis/RabbitMQ)
3. **Simple failure recovery**: Missed jobs auto-catchup on restart
4. **Clear upgrade path**: Start with APScheduler; move to Celery if scale demands it

#### Key Libraries/Tools

- **APScheduler**: `pip install apscheduler` — full-featured, production-ready
- **SQLAlchemy Jobstore**: Built-in; uses standard SQLAlchemy session
- **AsyncPG Driver**: `pip install asyncpg` — async PostgreSQL adapter
- **Monitoring**: Expose `/api/scheduler/jobs` to list scheduled tasks

#### Implementation Checklist

- [ ] Install APScheduler + asyncpg: `pip install apscheduler[asyncpg]`
- [ ] Create jobstore table (APScheduler creates automatically)
- [ ] Define at least 3 scheduled jobs (e.g., profiling, cleanup, health check)
- [ ] Configure coalesce and max_instances per job
- [ ] Add graceful shutdown: `scheduler.shutdown(wait=True)`
- [ ] Expose `/api/scheduler/jobs` (list) and `/api/scheduler/jobs/{job_id}` (detail)
- [ ] Test: kill scheduler mid-job, restart, verify job completes
- [ ] Document job definitions in `docs/09-implementation/` (runbook)

#### Gotchas to Avoid

- **Missing PostgreSQL connection pool limits**: Set `pool_size=5, max_overflow=10` in SQLAlchemy URL
- **Jobs that block the scheduler loop**: Always use async tasks or thread-based workers
- **No timezone awareness**: Specify `timezone=pytz.UTC` in scheduler config
- **Scheduled job logging to IRAM**: Use structured logging to disk/ELK, never print to stdout in job functions

#### Scaling Path (When Needed)

If scheduling > 10,000 concurrent jobs or need multi-instance coordination:

1. **Option A**: Keep APScheduler + add external job queue
   - Scheduler enqueues tasks to Celery for execution
   - Example: `celery.send_task('path.to.task', args=[data])`

2. **Option B**: Migrate to Celery + Celery Beat
   - Distributed scheduler; multi-worker support
   - Learning curve steeper; setup more complex

#### Real-World Reference Implementations

- **APScheduler PostgreSQL Example**
  - https://github.com/agronholm/apscheduler/blob/master/examples/standalone/async_postgres.py
  - Shows async scheduler with SQLAlchemy jobstore

- **Frappe's RQ Migration**
  - https://frappe.io/blog/technology/why-we-moved-from-celery-to-rq
  - Comparison of Celery vs. simpler alternatives; useful decision framework

---

## 3. WEBSOCKET REAL-TIME ARCHITECTURE

### Recommended Pattern: Native WebSocket + Rooms/Namespaces + Redis Pub/Sub

#### Architecture Diagram

```
Conductor Service (Event Source)
       ↓
REST API webhook / task completion event
       ↓
K1 Event Handler
       ↓
Redis Pub/Sub (broadcast layer)
       ↓
WebSocket Server (Node.js or Python-Socketio)
       ├─ Namespace: /tasks
       ├─ Namespace: /profiling
       └─ Room: {project_id} (per-project subscription)
       ↓
Web Client (Subscribe → Listen → Update UI)
```

#### Core Pattern: Pub/Sub with Rooms

**Why Pub/Sub + Rooms (not direct push)**
- Server → Client is 1:N; pub/sub prevents each server from managing all connections
- Rooms scope events to interested clients (filter at broker, not app layer)
- Enables horizontal scaling: add WebSocket servers; pub/sub routes events to all

#### Implementation (Python-SocketIO)

```python
from python_socketio import AsyncServer, AsyncSimpleClient
from aioredis import Redis

sio = AsyncServer(
    async_mode='aiohttp',
    client_manager=AsyncRedisManager('redis://localhost:6379'),
    cors_allowed_origins='*'
)

# 1. Client subscribes to project namespace + room
@sio.event
async def subscribe_to_project(sid, data):
    project_id = data['project_id']
    sio.enter_room(sid, f'project_{project_id}')
    await sio.emit('subscribed', {'project_id': project_id}, to=sid)

# 2. Backend event triggers broadcast
async def on_task_complete(task_id, result):
    project_id = get_project_id(task_id)  # Lookup
    await sio.emit(
        'task_completed',
        {'task_id': task_id, 'result': result},
        room=f'project_{project_id}'
    )

# 3. Client-side (JavaScript)
socket.emit('subscribe_to_project', {project_id: 123})
socket.on('task_completed', (data) => {
  console.log(`Task ${data.task_id} finished:`, data.result)
  updateUI(data)
})
```

#### Key Concepts

**Namespaces** (logical separation)
- `/tasks`: Task-related events (created, started, completed)
- `/profiling`: Profiling results, metrics
- `/admin`: System health, alerts

**Rooms** (filtering within namespace)
- `project_{id}`: All events for project 123 go to this room
- `user_{id}`: Per-user notifications (e.g., "task assigned to you")
- Allows clients to subscribe selectively

**Event Types**
1. **Lifecycle**: `task_created`, `task_started`, `task_completed`, `task_failed`
2. **Progress**: `progress_update` (e.g., `{percent: 45, eta_ms: 5000}`)
3. **System**: `heartbeat`, `error_alert`, `connection_status`

#### Why It's Best Fit for K1.node1

1. **No extra dependencies** if using Node.js (SocketIO native); Python-SocketIO if async
2. **Room-based filtering** matches project/user hierarchy perfectly
3. **Redis Pub/Sub** scales to thousands of concurrent connections
4. **Integrates with Conductor webhooks**: Task completion → Redis event → WebSocket broadcast

#### Key Libraries/Tools

**Backend**
- **Python-SocketIO** (https://python-socketio.readthedocs.io/) — async WebSocket server
  - Requires: `pip install python-socketio[asyncio_client] aioredis`
  - AsyncRedisManager handles distributed pub/sub

- **Redis Pub/Sub**: Built-in Redis command (no extra library); scales to 10k+ concurrent

**Frontend**
- **Socket.io Client** (https://socket.io/docs/v4/client-api/) — JavaScript library
  - Auto-reconnect, fallback to polling, etc.

#### Implementation Checklist

- [ ] Install: `pip install python-socketio aioredis aiohttp`
- [ ] Configure Redis connection string in app config
- [ ] Define 2–3 namespaces (`/tasks`, `/profiling`)
- [ ] Implement subscription handler (emit `subscribed` back to client)
- [ ] Add room-based broadcast when tasks complete
- [ ] Implement heartbeat (emit every 30s to detect stale connections)
- [ ] Test: Connect 2 clients to different rooms; emit event; verify only correct room receives
- [ ] Add `/api/websocket/stats` (active connections, rooms, messages/sec)
- [ ] Document namespace/room schema in `docs/06-reference/` (event catalog)

#### Gotchas to Avoid

- **Sticky Sessions Misconception**: With Redis Pub/Sub, you DON'T need sticky sessions; any WS server can emit to any room
- **Forgetting to `enter_room`**: Clients won't receive events unless they explicitly join
- **Unbounded message queue**: Set max message size (e.g., 64KB) and rate-limit broadcast
- **No authentication on room join**: Validate `project_id` ownership before allowing subscription
- **WebSocket keep-alive**: Set heartbeat interval; clients auto-reconnect on disconnect

#### Scaling Pattern

**Horizontal Scaling (Multiple WS Servers)**
1. Deploy 2–3 WebSocket servers behind a load balancer (no sticky session needed)
2. All use same Redis broker (`AsyncRedisManager`)
3. Any server can emit to any room; pub/sub routes to subscribers regardless of server

**Event Flow**
```
Server A emits 'task_completed' to room 'project_1'
       ↓
Redis Pub/Sub broadcasts to all subscribed processes
       ↓
Server B receives and routes to connected clients in that room
       ↓
Server C receives and routes to connected clients in that room
```

#### Real-World Reference Implementations

- **Socket.IO Real-Time Dashboards**
  - https://www.oreilly.com/library/view/socketio-cookbook/9781785880865/ch02.html
  - Shows subscription, room-based filtering, and data synchronization

- **Ably WebSocket Architecture Patterns**
  - https://ably.com/topic/websocket-architecture-best-practices
  - Comprehensive guide on scaling, pub/sub, rooms, authentication

- **Google Cloud Pub/Sub + WebSockets**
  - https://cloud.google.com/pubsub/docs/streaming-cloud-pub-sub-messages-over-websockets
  - Shows integration of message broker with WebSocket delivery

---

## 4. CONDUCTOR INTEGRATION PATTERNS

### Recommended Pattern: Stateless Polling Workers + Circuit Breaker + Exponential Backoff

#### Architecture

```
Conductor Server (API: http://localhost:8080/api)
       ↓
Task Poll (Workers request pending tasks)
       ↓
Worker Pool (3–5 instances, horizontally scalable)
       ├─ Worker 1: Execute task
       ├─ Worker 2: Execute task
       └─ Worker 3: Execute task
       ↓
Task Result (POST back to Conductor with status, output, logs)
       ↓
Conductor Workflow State (persisted, audit trail)
```

#### Worker Implementation Pattern (Python SDK)

**Decorator-Based (Recommended)**
```python
from conductor.client.worker.worker_task import worker_task
from conductor.client.automator.task_handler import TaskHandler
from conductor.client.configuration.configuration import Configuration
from pybreaker import CircuitBreaker

# 1. Define circuit breaker for external calls
external_service_cb = CircuitBreaker(fail_max=5, reset_timeout=60)

# 2. Decorate task function
@worker_task(task_definition_name='process_profile_data')
def process_profile_data(
    project_id: str,
    profile_path: str,
    analysis_type: str
) -> str:
    """
    Task: Analyze profiling data and return summary.
    Inputs: project_id, profile_path, analysis_type
    Output: analysis_id (for later retrieval)
    """
    try:
        # Wrap external calls with circuit breaker
        result = external_service_cb.call(
            analyze_profile,
            project_id=project_id,
            profile_path=profile_path,
            analysis_type=analysis_type
        )
        return result['analysis_id']
    except Exception as e:
        # Conductor SDK will handle retries; log and re-raise
        log.error(f"Task failed: {e}")
        raise

# 3. Start worker
if __name__ == '__main__':
    config = Configuration(debug=False)  # Set to http://conductor-host:8080/api if not localhost

    with TaskHandler(
        workers=[],
        configuration=config,
        scan_for_annotated_workers=True,
        import_modules=['__main__']
    ) as task_handler:
        task_handler.start_processes(max_workers=3)
        try:
            task_handler.join()  # Block until shutdown signal
        except KeyboardInterrupt:
            task_handler.stop_processes()
```

#### Key Design Patterns

**1. Stateless Workers**
- Workers don't store state between tasks
- All state is Conductor-managed (persisted in database)
- Enables horizontal scaling: kill/restart workers without losing progress

**2. Task Inputs/Outputs**
- **Inputs**: Simple types (str, int, bool) or dataclasses
  ```python
  from dataclasses import dataclass

  @dataclass
  class ProfileData:
    project_id: str
    metrics: dict
    timestamp: int

  @worker_task(task_definition_name='analyze')
  def analyze(data: ProfileData) -> str:
      return f"Processed {data.project_id}"
  ```
- **Outputs**: Return value is serialized to JSON; must be JSON-serializable

**3. Polling Strategy**
- Workers poll Conductor API for pending tasks (default: poll every 100ms)
- Long-polling reduces CPU; no busy-wait
- Configurable poll interval in TaskHandler

**4. Error Handling**
- Raise exception to signal task failure
- Conductor SDK catches exception, logs it, and retries per workflow definition
- Retry policy (max attempts, backoff) defined in Conductor workflow JSON

#### Conductor API Integration Points

**Endpoint: POST /api/workflows**
```bash
curl -X POST http://localhost:8080/api/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "profile_workflow",
    "version": 1,
    "tasks": [
      {
        "name": "process_profile",
        "taskReferenceName": "process_profile_ref",
        "type": "SIMPLE",
        "retryLogic": {
          "timeoutPolicy": "TIME_OUT_WF",
          "retryDelaySeconds": 5,
          "backoffScaleFactor": 2.0,
          "maximumRetries": 3
        }
      }
    ]
  }'
```

**Endpoint: GET /api/tasks/poll/{taskType}**
- Workers call this to fetch pending tasks
- Conductor SDK wraps this in TaskHandler

**Endpoint: POST /api/tasks/{taskId}**
- Workers POST task results back (status, output, logs)

#### Why It's Best Fit for K1.node1

1. **Workflow Versioning**: JSON-based workflows enable version control + rollback
2. **Audit Trail**: Full history of task executions stored in Conductor database
3. **Decoupled Execution**: Workers don't know about workflow; Conductor orchestrates
4. **Retries Built-In**: Exponential backoff configured per task in workflow
5. **Multi-Language**: Workers can be Python, Node.js, Java, Go, etc.

#### Key Libraries/Tools

- **Conductor Python SDK**: `pip install conductor-python`
- **Circuit Breaker**: `pybreaker` (wrap external service calls)
- **Structured Logging**: Use `structlog` or `python-json-logger` for JSON logs
- **Monitoring**: Expose `/api/conductor/workers` (active workers, queue depth)

#### Implementation Checklist

- [ ] Install: `pip install conductor-python pybreaker`
- [ ] Define 2–3 worker task types in your codebase
- [ ] Implement each with @worker_task decorator
- [ ] Add circuit breaker around external service calls
- [ ] Add structured logging (JSON format for aggregation)
- [ ] Create workflow JSON file in `docs/09-implementation/` (versioned)
- [ ] Deploy worker as background process (systemd, Docker, K8s)
- [ ] Expose `/api/conductor/workers` (list active workers, poll stats)
- [ ] Test: Submit workflow via API; monitor task execution in Conductor UI
- [ ] Document task inputs/outputs in `docs/06-reference/conductor_task_catalog.md`

#### Gotchas to Avoid

- **Shared State Between Tasks**: Each task execution is independent; don't cache workflow-specific data in worker globals
- **Missing Circuit Breaker on External Calls**: Conductor retries may create thundering herd if service is down; use circuit breaker
- **Logging in Task Output**: Log to file/syslog; don't rely on return value for diagnostic info
- **Workflow Versioning Confusion**: Always increment workflow version when adding/removing tasks; don't modify version 1 after deployment
- **Worker Shutdown Without Draining**: Use graceful shutdown (drain pending tasks) before stopping workers

#### Conductor Retry & Backoff Configuration

In workflow JSON:
```json
{
  "retryLogic": {
    "timeoutPolicy": "TIME_OUT_WF",
    "retryDelaySeconds": 1,
    "backoffScaleFactor": 2.0,
    "maximumRetries": 3
  }
}
```

- First retry: 1s
- Second retry: 2s (1 * 2^1)
- Third retry: 4s (1 * 2^2)
- Max 3 attempts; fail workflow if all exhausted

**Best Practice**: Set `maximumRetries=3` and `backoffScaleFactor=2.0` for transient errors

#### Real-World Reference Implementations

- **Conductor Python SDK Examples**
  - https://github.com/conductor-sdk/python-sdk-examples
  - Shows decorator, class-based, and workflow patterns

- **Netflix Conductor Blog**
  - https://netflixtechblog.com/netflix-conductor-a-microservices-orchestrator-2e8d4771bf40
  - Architecture decisions and lessons learned at scale

- **Conductor OSS Documentation**
  - https://conductor-oss.github.io/conductor/
  - Comprehensive reference for workflow definitions and API

---

## Comparison Matrix: Choosing Between Patterns

| Scenario | Pattern | Why |
|---|---|---|
| **Task fails sporadically** | DLQ + Exponential Backoff | Distinguish transient from permanent failures; avoid retry storms |
| **Need to run profiling nightly** | APScheduler + PostgreSQL | Persistent scheduler; no external dependencies |
| **Dashboard needs live task updates** | WebSocket + Rooms + Redis Pub/Sub | Scalable to N clients without polling overhead |
| **Long-running workflow (multi-step)** | Conductor + Stateless Workers | Built-in retries, versioning, audit trail |
| **Mix of all above** | Combined Architecture (see below) |  |

---

## Integrated Architecture for Phase 5.3

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 5.3: Full Task Management & Real-Time Monitoring      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ 1. SCHEDULING                                                │
│    APScheduler (PostgreSQL JobStore)                         │
│    └─ Trigger: Profiling, cleanup, health checks            │
│       ↓ Enqueue to                                           │
│                                                               │
│ 2. ORCHESTRATION                                             │
│    Conductor Workflows (REST API)                            │
│    └─ Define: Profile → Analyze → Store → Notify           │
│       ↓ Workers execute                                      │
│                                                               │
│ 3. WORKER EXECUTION                                          │
│    Python Workers (TaskHandler)                              │
│    └─ Protected by: Circuit Breaker + Pybreaker             │
│       ↓ On failure/success                                   │
│                                                               │
│ 4. ERROR RECOVERY                                            │
│    Exponential Backoff (Conductor built-in)                  │
│    └─ Max retries=3; scale factor=2.0                       │
│    └─ After max retries: DLQ (PostgreSQL)                   │
│       ↓ Alerts/monitoring                                    │
│                                                               │
│ 5. REAL-TIME MONITORING                                      │
│    WebSocket Server (SocketIO + AsyncRedisManager)           │
│    └─ Subscribe: /tasks namespace, rooms by project_id      │
│       ← Broadcast from: Task completion events              │
│       └─ Via Redis Pub/Sub                                   │
│                                                               │
│ 6. REST API (Status Monitoring)                              │
│    GET /api/tasks/{task_id}     — Task status polling       │
│    GET /api/dlq/stats           — DLQ depth and metrics     │
│    GET /api/scheduler/jobs      — Scheduled jobs            │
│    GET /api/conductor/workers   — Active worker pool        │
│    WS /ws                       — WebSocket upgrade          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

#### Dataflow Example: Profiling Task

1. **Scheduler** (APScheduler)
   - 2 AM daily: trigger `start_profiling_workflow`
   - Enqueue workflow ID to Conductor

2. **Conductor** (Orchestration)
   - Workflow: Profile → Analyze → Store
   - Poll task queue; assign to available worker

3. **Worker** (Python)
   - Receive `profile_task`; execute with circuit breaker
   - If external service down: circuit breaker fails fast
   - Return result or raise exception

4. **Error Recovery**
   - Conductor retries with exponential backoff (1s, 2s, 4s)
   - After 3 failures: move to DLQ

5. **Monitoring**
   - Task completion event → Redis Pub/Sub
   - WebSocket server broadcasts to subscribed clients
   - UI updates in real-time

6. **Observability**
   - REST API `/api/dlq/stats`: Shows failed tasks
   - `/api/conductor/workers`: Active workers
   - `/api/scheduler/jobs`: Next scheduled runs

---

## Implementation Priority & Timeline

**Week 1 (Phase 5.3a)**
- [ ] Error recovery: Implement DLQ table + pybreaker circuit breaker
- [ ] Scheduling: APScheduler + PostgreSQL jobstore
- [ ] Create `/api/scheduler/jobs` and `/api/dlq/stats` endpoints

**Week 2 (Phase 5.3b)**
- [ ] Conductor integration: Deploy Conductor server, write 2–3 sample workflows
- [ ] Python workers: Implement task decorators + TaskHandler
- [ ] Add circuit breaker around external calls

**Week 3 (Phase 5.3c)**
- [ ] WebSocket: Deploy SocketIO server, configure Redis pub/sub
- [ ] Frontend: Subscribe to task events, update dashboard in real-time
- [ ] Testing: End-to-end workflow execution with monitoring

**Week 4 (Phase 5.3d)**
- [ ] Integration testing & performance validation
- [ ] Documentation: Task catalog, runbooks, monitoring guide
- [ ] Validation: All 4 patterns working together

---

## Key Metrics & Validation Criteria

Track these before → after Phase 5.3 implementation:

| Metric | Baseline | Target |
|---|---|---|
| **Task Success Rate** | 95% | 99%+ |
| **Avg Retry Attempts** | N/A | < 1.5 per task |
| **DLQ Depth (daily avg)** | N/A | < 5 tasks |
| **Scheduled Job Uptime** | N/A | 99.9% (no missed runs) |
| **WebSocket Latency (p95)** | N/A | < 200ms |
| **Circuit Breaker Trip Rate** | N/A | < 2% (normal ops) |

---

## Appendix: Quick Reference Links

**Error Recovery**
- pybreaker: https://github.com/danielfm/pybreaker
- tenacity: https://github.com/jmoiron/tenacity
- LittleHorse blog: https://littlehorse.io/blog/retries-and-dlq

**Scheduling**
- APScheduler docs: https://apscheduler.readthedocs.io/
- APScheduler PostgreSQL example: https://github.com/agronholm/apscheduler/blob/master/examples/standalone/async_postgres.py

**WebSocket**
- python-socketio: https://python-socketio.readthedocs.io/
- Socket.io cookbook: https://www.oreilly.com/library/view/socketio-cookbook/9781785880865/ch02.html
- Ably best practices: https://ably.com/topic/websocket-architecture-best-practices

**Conductor**
- Conductor OSS: https://conductor-oss.github.io/conductor/
- Python SDK: https://github.com/conductor-sdk/conductor-python
- Netflix blog: https://netflixtechblog.com/netflix-conductor-a-microservices-orchestrator-2e8d4771bf40

---

## Next Steps

1. **Review this synthesis** with Phase 5.3 team
2. **Validate pattern choices** against K1.node1 constraints (e.g., Python-only? K8s? Single-node?)
3. **Create detailed implementation spec** (Phase 5.3 RFC) with API contracts
4. **Assign ownership** for each pattern (DLQ lead, Scheduler lead, etc.)
5. **Begin Week 1 implementation** with validation milestones
