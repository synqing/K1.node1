# Phase 5.3: Implementation Decision Matrix

**Status**: Awaiting Team Review
**Date**: 2025-11-10
**Owner**: Research Analysis
**Related**: `docs/05-analysis/phase_5_3_pattern_research_synthesis.md`, `docs/07-resources/K1NRes_PHASE_5_3_PATTERN_QUICKREF_v1.0_20251110.md`

---

## Decision Framework

This document captures decision points for Phase 5.3 pattern implementations. Each section presents options with tradeoffs; team should select (1) preferred option or (2) hybrid approach.

---

## 1. ERROR RECOVERY: DLQ Implementation

### Option A: PostgreSQL Table + Custom Logic (Minimal Dependencies)

**Pros**:
- Zero new dependencies
- Leverages existing PostgreSQL infrastructure
- Simple schema: `dlq_tasks (id, task_id, error, attempt_count, created_at, retry_after)`
- Manual replay capability (UPDATE + requeue)

**Cons**:
- Must implement retry scheduling manually
- No built-in metrics/monitoring UI
- Custom query logic for filtering/sorting

**Recommendation**: **Start with this** for initial implementation; upgrade to option B if DLQ grows > 1000 tasks/day

---

### Option B: Temporal/Cassandra + Specialized Queue (Advanced)

**Pros**:
- Built-in time-series queries (when failures occur)
- Automatic retention policies (TTL)
- Distributed, high-throughput

**Cons**:
- Adds new infrastructure (operational burden)
- Overkill for expected DLQ depth (< 50 tasks/day at K1.node1 scale)
- Steep learning curve

**Recommendation**: **Defer until Phase 5.5+** if DLQ metrics justify it

---

### Decision Point

**Team Choice**: [ ] Option A (PostgreSQL) | [ ] Option B (Temporal) | [ ] Deferred

---

## 2. RETRY STRATEGY: Exponential Backoff Configuration

### Option A: Conductor Built-In + Application-Level Decorator

**Configuration**:
```json
{
  "retryLogic": {
    "maximumRetries": 3,
    "retryDelaySeconds": 1,
    "backoffScaleFactor": 2.0
  }
}
```

**Backoff Sequence**: 1s → 2s → 4s (deterministic, no jitter)

**Pros**:
- Conductor handles scheduling automatically
- Simple to reason about
- Integrated with workflow versioning

**Cons**:
- No jitter (potential synchronized retries at scale)
- Fixed retry budget across all task types

**Recommendation**: **Use this as baseline** with tuning in Option B

---

### Option B: Application-Level (tenacity) + Dynamic Jitter

**Configuration**:
```python
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    reraise=True
)
def task():
    pass
```

**Backoff Sequence**: 1s ± 10% → 2s ± 10% → 4s ± 10% (randomized)

**Pros**:
- Per-task retry customization
- Jitter prevents thundering herd
- Graceful degradation handling

**Cons**:
- Two retry layers (Conductor + tenacity) → potential complexity
- Harder to debug (which layer retried?)

**Recommendation**: **Add this only if DLQ metrics show synchronized failures**

---

### Decision Point

**Team Choice**: [ ] Option A (Conductor only) | [ ] Option B (tenacity overlay) | [ ] Hybrid (both)

---

## 3. SCHEDULING: Persistent Job Store

### Option A: APScheduler + PostgreSQL SQLAlchemy JobStore

**Setup**:
```python
jobstore = SQLAlchemyJobStore(url='postgresql+asyncpg://...')
scheduler = BackgroundScheduler(jobstores={'default': jobstore})
```

**Pros**:
- Persistent (survives restart)
- Zero new dependencies (uses existing PostgreSQL)
- Jobs visible via SQL queries for debugging
- Handles misfire recovery automatically

**Cons**:
- Single-point-of-failure (one scheduler instance)
- Can't auto-scale to multiple schedulers
- Polling interval must be tuned (default 10s might miss timings)

**Recommendation**: **Use this for Phase 5.3** (sufficient for initial load)

---

### Option B: Celery Beat + RabbitMQ/Redis

**Setup**:
```python
from celery.beat import Scheduler
app.conf.beat_schedule = {
    'nightly-profile': {
        'task': 'tasks.profile.run',
        'schedule': crontab(hour=2, minute=0),
    }
}
```

**Pros**:
- Distributed (multiple schedulers can coexist without conflict)
- High-throughput task processing
- Built-in UI (Flower) for monitoring

**Cons**:
- Requires RabbitMQ or Redis
- Significant operational complexity
- Learning curve (Celery notoriously difficult to debug)

**Recommendation**: **Defer until Phase 5.4** if job volume exceeds APScheduler capacity (> 10k scheduled jobs)

---

### Option C: Temporal/Airflow (Enterprise)

**Pros**:
- Rich UI, built-in monitoring, versioning
- Handles complex workflows natively
- Industry-standard for data pipelines

**Cons**:
- Significant infrastructure (Java/Python services)
- Steeper learning curve than APScheduler
- Overkill for K1.node1's initial needs

**Recommendation**: **Out of scope** for Phase 5.3; consider if workflow complexity increases

---

### Decision Point

**Team Choice**: [ ] Option A (APScheduler + PostgreSQL) | [ ] Option B (Celery Beat) | [ ] Option C (Temporal) | [ ] Deferred

**Preference**: **Option A** (minimal dependencies, sufficient for Phase 5.3)

---

## 4. WEBSOCKET ARCHITECTURE: Real-Time Event Delivery

### Option A: Native WebSocket + Redis Pub/Sub

**Setup**:
```python
from python_socketio import AsyncServer, AsyncRedisManager

sio = AsyncServer(client_manager=AsyncRedisManager('redis://...'))
await sio.emit('event', data, room=f'project_{id}')
```

**Pros**:
- No polling (true push model)
- Rooms naturally filter by project/user
- Redis scales to 10k+ concurrent connections
- Simple pub/sub model (fire-and-forget)

**Cons**:
- Requires Redis infrastructure
- Client library dependency (socket.io-client)
- Debugging real-time events harder than polling

**Recommendation**: **Use this** (matches K1.node1's project-based hierarchy perfectly)

---

### Option B: REST Polling + Long-Polling

**Endpoint**: `GET /api/tasks/{task_id}/status?since=timestamp`

**Backoff**: Exponential polling interval (1s → 2s → 5s max)

**Pros**:
- No WebSocket complexity
- Works behind any proxy/firewall
- Stateless (easier to scale)

**Cons**:
- Higher latency (polling interval)
- Network overhead (repeated requests)
- Not true real-time (update delay = polling interval)

**Recommendation**: **Use as fallback** (for clients that can't use WebSocket), but prefer Option A

---

### Option C: Server-Sent Events (SSE)

**Endpoint**: `GET /api/stream/tasks`

**Model**: Unidirectional server → client stream (HTTP long-lived connection)

**Pros**:
- Simpler than WebSocket (uses HTTP)
- Browser-native support (no extra library)

**Cons**:
- Unidirectional (no client → server messages)
- Connection limits per domain (browsers limit to 6 concurrent SSE streams)
- Not suitable for pub/sub (each client gets separate connection)

**Recommendation**: **Consider only if** pub/sub filtering not needed; **avoid for multi-user dashboards**

---

### Decision Point

**Team Choice**: [ ] Option A (WebSocket + Pub/Sub) | [ ] Option B (REST Polling) | [ ] Option C (SSE) | [ ] Hybrid

**Preference**: **Option A primary + Option B fallback** (real-time + resilience)

---

## 5. CONDUCTOR INTEGRATION: Worker Model

### Option A: Decorator-Based Workers (python-socketio SDK)

**Code**:
```python
@worker_task(task_definition_name='analyze')
def analyze(project_id: str) -> str:
    return analyze_profile(project_id)

TaskHandler(workers=[], scan_for_annotated_workers=True).start_processes()
```

**Pros**:
- Minimal boilerplate
- Auto-discovery of worker functions
- Type hints enable validation
- Easy to test (just call the function)

**Cons**:
- Less control over task lifecycle
- Harder to implement complex error handling
- Limited visibility into polling behavior

**Recommendation**: **Use this** (matches K1.node1's Python-first approach)

---

### Option B: Class-Based Workers (Manual TaskResult)

**Code**:
```python
class AnalyzeTask:
    def execute(self, task: Task) -> TaskResult:
        task_result = TaskResult(...)
        task_result.status = TaskResultStatus.COMPLETED
        return task_result
```

**Pros**:
- Full control over lifecycle
- Better for complex state management
- Explicit error handling

**Cons**:
- More boilerplate
- Error-prone (must set status, task_id, etc. manually)
- Manual registration required

**Recommendation**: **Defer to Option B if** decorator approach proves insufficient in Phase 5.3b

---

### Option C: Microservice Workers (Separate K8s Deployments)

**Architecture**:
```
K8s Pod (Conductor Worker Sidecar)
  ↓
Local gRPC/HTTP task executor
  ↓
Conductor Polling Loop
```

**Pros**:
- Isolation (worker failures don't affect main app)
- Resource control (dedicated CPU/memory)
- Language flexibility (worker in any language)

**Cons**:
- Operational complexity (K8s manifest, sidecars)
- Debugging harder (logs spread across containers)
- Overkill for Phase 5.3 (no scale pressure yet)

**Recommendation**: **Out of scope** for Phase 5.3; consider Phase 5.5+ if worker throughput is bottleneck

---

### Decision Point

**Team Choice**: [ ] Option A (Decorators) | [ ] Option B (Class-based) | [ ] Option C (Sidecar) | [ ] Hybrid

**Preference**: **Option A initially + upgrade to B if needed**

---

## 6. MONITORING & OBSERVABILITY: Metrics & Logging

### Option A: Structured Logging (JSON) + Prometheus Metrics

**Setup**:
```python
import structlog

log = structlog.get_logger()
log.info('task_completed', task_id='123', duration_ms=1500, status='success')

# Prometheus metrics
retry_counter = Counter('task_retries_total', 'Total retries', ['task_type', 'status'])
dlq_gauge = Gauge('dlq_depth', 'Tasks in DLQ', ['error_type'])
```

**Pros**:
- Structured queries (grep JSON logs easily)
- Prometheus integrates with existing monitoring (Grafana dashboards)
- Low overhead (log structured, not parsed)

**Cons**:
- Requires log aggregation (ELK, Loki, etc.)
- Must define metric schema upfront

**Recommendation**: **Use this** (aligns with K1.node1 observability standards)

---

### Option B: Application Performance Monitoring (APM) SDK

**Setup** (e.g., New Relic, DataDog, Jaeger):
```python
from newrelic.agent import background_task, record_exception

@background_task()
def worker_task():
    try:
        execute()
    except Exception as e:
        record_exception(e)
        raise
```

**Pros**:
- Automatic tracing (request flows across services)
- Built-in alerting
- Visual UI (no dashboards to build)

**Cons**:
- Vendor lock-in (DataDog, New Relic, etc.)
- Cost at scale
- Privacy concerns (third-party agents)

**Recommendation**: **Deferred** (use Option A initially; migrate to APM if operational metrics justify cost)

---

### Option C: Custom Dashboard (Flask + Prometheus)

**Setup**:
```python
@app.route('/api/metrics/health')
def health():
    return {
        'dlq_depth': count_dlq_tasks(),
        'active_workers': count_active_workers(),
        'scheduled_jobs': list_scheduler_jobs()
    }
```

**Pros**:
- Lightweight (no dependencies)
- Full control over presentation
- Embeddable in existing dashboard

**Cons**:
- Manual refresh required
- No historical data (must query database each time)
- Doesn't scale (query becomes slow as data grows)

**Recommendation**: **Use as supplement** to Option A; don't rely on as primary monitoring

---

### Decision Point

**Team Choice**: [ ] Option A (Structured Logging + Prometheus) | [ ] Option B (APM SDK) | [ ] Option C (Custom Dashboard) | [ ] Hybrid

**Preference**: **Option A primary + Option C supplement** (cost-effective, maintainable)

---

## Summary: Recommended Phase 5.3 Tech Stack

| Component | Choice | Rationale |
|---|---|---|
| **DLQ** | PostgreSQL table | Minimal dependencies |
| **Retry Logic** | Conductor built-in | Sufficient; upgrade if metrics justify |
| **Scheduling** | APScheduler + PostgreSQL | Persistent, zero new deps |
| **WebSocket** | SocketIO + Redis Pub/Sub | True real-time; rooms match hierarchy |
| **Conductor Workers** | Decorator-based (@worker_task) | Minimal boilerplate |
| **Monitoring** | Structured logging + Prometheus | Standard, cost-effective |

**Total New Dependencies**:
- apscheduler (scheduler)
- conductor-python (orchestration)
- python-socketio + aioredis (real-time)
- pybreaker (circuit breaker)
- structlog (logging)
- prometheus-client (metrics)

**Total New Infrastructure**:
- Conductor server (optional: can start with mock/local)
- Redis (for pub/sub; can reuse existing if available)

**Estimated Implementation Effort**:
- Week 1: DLQ + Scheduling (2–3 days)
- Week 2: Conductor setup + workers (3 days)
- Week 3: WebSocket + monitoring (3 days)
- Week 4: Integration + testing (2–3 days)

---

## Open Questions for Team Discussion

1. **Do we have existing Redis infrastructure?** (Affects pub/sub feasibility)
2. **Can we deploy Conductor server?** (Or use Orkes cloud?)
3. **What's the acceptable DLQ depth?** (< 10 tasks/day? < 100?)
4. **Do we need multi-region scheduling?** (Single APScheduler sufficient?)
5. **WebSocket client library constraints?** (Socket.io supported in frontend?)

---

## Next Steps

1. **Team reviews this document** (discuss open questions)
2. **Resolve Option A/B/C choices** (record decisions above)
3. **Create Phase 5.3 RFC** with final architecture diagram
4. **Assign Week 1 owner** for DLQ + scheduling
5. **Begin implementation** with validation milestones
