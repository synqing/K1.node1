# Phase 5.3 Architectural Patterns: Quick Reference

**Date**: 2025-11-10
**Status**: Research Complete
**Related**: `docs/05-analysis/phase_5_3_pattern_research_synthesis.md` (detailed synthesis)

---

## Pattern 1: ERROR RECOVERY

**Pattern**: DLQ + Exponential Backoff + Circuit Breaker

**Stack**:
```
tenacity (retry decorator)
+ pybreaker (circuit breaker)
+ PostgreSQL (DLQ table)
```

**Key Code**:
```python
from tenacity import retry, stop_after_attempt, wait_exponential
from pybreaker import CircuitBreaker

breaker = CircuitBreaker(fail_max=5, reset_timeout=60)

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=60))
def task():
    return breaker.call(external_service)
```

**Why for K1.node1**:
- Non-transient errors land in DLQ (no infinite retries)
- Circuit breaker prevents cascading failures
- DLQ metadata enables forensics

**Gotchas**:
- Ensure task idempotency
- Set jitter (10–20%)
- DLQ retention policy (TTL or size limit)

---

## Pattern 2: DYNAMIC SCHEDULING

**Pattern**: APScheduler + PostgreSQL JobStore

**Stack**:
```
APScheduler
+ asyncpg (async PostgreSQL driver)
+ SQLAlchemy JobStore
```

**Key Code**:
```python
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.triggers.cron import CronTrigger

jobstore = SQLAlchemyJobStore(url='postgresql+asyncpg://user:pass@localhost/k1_db')
scheduler = BackgroundScheduler(jobstores={'default': jobstore})
scheduler.add_job(func, trigger=CronTrigger(hour=2, minute=0), id='nightly')
scheduler.start()
```

**Why for K1.node1**:
- Persistent (survives restart)
- Zero external dependencies (reuses PostgreSQL)
- Simple, clear upgrade path to Celery if needed

**Gotchas**:
- Set `coalesce=True` (skip misfired jobs)
- Configure pool limits (`pool_size=5`)
- Timezone-aware (use `pytz.UTC`)

---

## Pattern 3: WEBSOCKET REAL-TIME

**Pattern**: Native WebSocket + Rooms/Namespaces + Redis Pub/Sub

**Stack**:
```
python-socketio + aiohttp
+ AsyncRedisManager (Redis pub/sub)
+ Socket.io client (JS)
```

**Key Code**:
```python
from python_socketio import AsyncServer, AsyncRedisManager

sio = AsyncServer(
    client_manager=AsyncRedisManager('redis://localhost:6379'),
    cors_allowed_origins='*'
)

@sio.event
async def subscribe_to_project(sid, data):
    sio.enter_room(sid, f'project_{data["project_id"]}')

async def broadcast_task_complete(project_id, task_data):
    await sio.emit('task_completed', task_data, room=f'project_{project_id}')
```

**Why for K1.node1**:
- Rooms scale to N clients without polling
- Redis pub/sub enables horizontal scaling
- Matches project/user hierarchy

**Gotchas**:
- Always authenticate room join
- Set heartbeat interval (30s)
- No sticky sessions needed (thanks to pub/sub)

---

## Pattern 4: CONDUCTOR INTEGRATION

**Pattern**: Stateless Polling Workers + Circuit Breaker

**Stack**:
```
conductor-python SDK
+ pybreaker (circuit breaker)
+ TaskHandler (worker pool)
```

**Key Code**:
```python
from conductor.client.worker.worker_task import worker_task
from conductor.client.automator.task_handler import TaskHandler
from pybreaker import CircuitBreaker

breaker = CircuitBreaker(fail_max=5, reset_timeout=60)

@worker_task(task_definition_name='analyze_profile')
def analyze_profile(project_id: str, data_path: str) -> str:
    result = breaker.call(external_api_call, project_id, data_path)
    return result['id']

TaskHandler(workers=[], configuration=config, scan_for_annotated_workers=True).start_processes(max_workers=3)
```

**Workflow Definition** (JSON):
```json
{
  "name": "profile_workflow",
  "tasks": [
    {
      "name": "analyze_profile",
      "type": "SIMPLE",
      "retryLogic": {
        "maximumRetries": 3,
        "retryDelaySeconds": 1,
        "backoffScaleFactor": 2.0
      }
    }
  ]
}
```

**Why for K1.node1**:
- Versioned workflows (rollback capability)
- Audit trail (all executions recorded)
- Built-in retries + exponential backoff
- Decoupled execution (workers don't know workflow)

**Gotchas**:
- Keep workers stateless
- Wrap external calls with circuit breaker
- Use structured logging (JSON)
- Graceful shutdown (drain pending tasks)

---

## Integrated Architecture

```
Scheduler (APScheduler)
    ↓ Enqueue workflow
Conductor (Orchestration + Retries)
    ↓ Poll for tasks
Workers (Python, Circuit-Breaker Protected)
    ↓ Success/Failure
Error Recovery (DLQ + Exponential Backoff)
    ↓ Emit events
Redis Pub/Sub (Broadcast)
    ↓ Route by room
WebSocket Server (Real-Time Dashboard)
    ↓
Clients (Subscribe to project rooms)
```

---

## Implementation Checklist

**Week 1**: Error Recovery + Scheduling
- [ ] DLQ table + pybreaker circuit breaker
- [ ] APScheduler + PostgreSQL jobstore
- [ ] Endpoints: `/api/dlq/stats`, `/api/scheduler/jobs`

**Week 2**: Conductor Integration
- [ ] Deploy Conductor server
- [ ] Write 2–3 sample workflows (JSON)
- [ ] Python workers with @worker_task decorator
- [ ] Circuit breaker on external calls

**Week 3**: Real-Time Monitoring
- [ ] SocketIO server + AsyncRedisManager
- [ ] Rooms: `project_{id}`, `user_{id}`
- [ ] Dashboard subscription + event listener

**Week 4**: Integration & Validation
- [ ] End-to-end testing
- [ ] Performance baseline capture
- [ ] Documentation + runbooks

---

## Library Versions (Pin These)

```bash
# Scheduling
apscheduler==3.11.0
asyncpg==0.29.0
sqlalchemy==2.0.0

# Error Recovery
tenacity==8.2.0
pybreaker==1.4.1

# Orchestration
conductor-python==1.0.28

# Real-Time
python-socketio==5.10.0
aiohttp==3.9.0
aioredis==2.0.1

# General
structlog==24.1.0
pytz==2024.1
```

---

## Validation Metrics

| Metric | Target |
|---|---|
| Task Success Rate | 99%+ |
| Avg Retry Attempts | < 1.5 |
| DLQ Depth (daily avg) | < 5 |
| Scheduled Job Uptime | 99.9% |
| WebSocket Latency (p95) | < 200ms |
| Circuit Breaker Trip Rate | < 2% (normal) |

---

## Quick Links

- **Full Synthesis**: `docs/05-analysis/phase_5_3_pattern_research_synthesis.md`
- **Conductor Docs**: https://conductor-oss.github.io/conductor/
- **APScheduler**: https://apscheduler.readthedocs.io/
- **SocketIO**: https://python-socketio.readthedocs.io/
- **PyBreaker**: https://github.com/danielfm/pybreaker
