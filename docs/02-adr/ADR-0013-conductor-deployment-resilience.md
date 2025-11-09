---
title: ADR-0013: Conductor Deployment Resilience Strategy
status: proposed
version: v1.0
owner: Claude Code Agent
reviewers: [spectrasynq]
last_updated: 2025-11-09
next_review_due: 2025-12-09
tags: [infrastructure, persistence, scaling, phase4]
related_docs: [K1N_COMPREHENSIVE_TECHNICAL_DOCUMENTATION_v1.0_20251109.md]
---
<!-- markdownlint-disable MD013 -->

# ADR-0013: Conductor Deployment Resilience Strategy

**Status:** Proposed
**Date:** 2025-11-09
**Author:** @claude-code-agent
**References:**
- Risk analysis from comprehensive technical documentation
- Phase 4 implementation gaps identified during review

---

## Context

**What problem triggers this ADR?**

K1.node1 Conductor integration has three critical architectural risks that block production deployment:

1. **Docker dependency (single point of failure)** - System completely fails if Docker daemon unavailable
2. **No persistent storage** - All workflow state lost on restart; cannot recover from crashes
3. **Untested at scale** - No validation of 22-task orchestration; unknown bottlenecks and performance characteristics

Current implementation assumes Docker always available and uses in-memory storage, making the system unsuitable for production use.

**Why can't we keep doing what we're doing?**

- Docker failures cause complete orchestration system outage (100% dependency)
- Restart = data loss (workflow history, metrics, audit trail all lost)
- Cannot guarantee <2 hour execution time or ≥95% quality gate pass rate without validation
- No recovery mechanism from failures
- No audit trail for compliance

**Background:**
- System designed for 22 tasks across 5 agents with complex dependencies
- Target: <120 minute execution, ≥95% quality pass rate
- Currently Phase 4.4 blocked on Docker infrastructure (85% complete)
- No persistence layer implemented
- No scaling validation performed

---

## Decision

**We will implement a 3-tier fallback deployment architecture with PostgreSQL persistence and comprehensive scaling validation.**

**Approach:**

```
Tier 1 (Preferred): Docker Compose + PostgreSQL (persistent storage)
  ↓ Auto-fallback if Docker unavailable
Tier 2 (Fallback): Standalone JAR + SQLite (minimal dependencies)
  ↓ Manual fallback if Java unavailable
Tier 3 (Emergency): Direct MCP-to-Agent bypass (no orchestration)
```

**Core Components:**

1. **PostgreSQL Persistence Layer**
   - Replace in-memory storage with persistent database
   - Workflow state survives restarts
   - Full audit trail for all executions
   - Query capabilities for metrics analysis

2. **Auto-Fallback Detection**
   - `conductor-start.sh` detects Docker availability
   - Automatically falls back to JAR mode if Docker unavailable
   - Graceful degradation vs hard failure

3. **Scaling Validation Suite**
   - 5 test scenarios (single task → full 22-task → stress test)
   - Performance instrumentation at all levels
   - Bottleneck identification with metrics
   - Validation report generation

---

## Consequences

### Positive

- ✅ **Resilience:** System operational even when Docker fails (Tier 2 fallback)
- ✅ **Persistence:** Workflow state survives container restarts/crashes
- ✅ **Audit Trail:** Full execution history in PostgreSQL for compliance
- ✅ **Recovery:** Can resume workflows after infrastructure failure
- ✅ **Validated:** Performance characteristics known; bottlenecks identified
- ✅ **Production-Ready:** Multiple deployment options support diverse environments
- ✅ **Metrics:** Historical data enables optimization and trend analysis

### Negative

- ⚠️ **Complexity:** 3 deployment tiers to maintain and test
- ⚠️ **Storage Overhead:** PostgreSQL adds ~100MB disk requirement
- ⚠️ **Performance:** Database writes may add 5-10% latency vs in-memory
- ⚠️ **Testing Burden:** Must validate all 3 tiers independently

### Implementation

- **Scope:** `.conductor/docker/*`, `ops/scripts/conductor-*.sh`, test suite in `tests/`
- **Effort:** 9 hours (3h persistence + 3h fallback + 3h validation)
- **Disk Impact:** +100MB (PostgreSQL), +50MB (JAR), +20MB (SQLite)
- **Memory Impact:** +200-400MB (PostgreSQL container vs in-memory)
- **Risk:** Migration complexity from non-existent to persistent storage

---

## Alternatives Considered

### Alternative 1: Docker-Only (Status Quo)
**Approach:** Keep current Docker-only design with in-memory storage
**Pros:** Simple, minimal code
**Cons:** Single point of failure, no persistence, production-unsuitable
**Decision:** Rejected - violates reliability and persistence requirements

### Alternative 2: Cloud-Managed Conductor (Orkes Cloud)
**Approach:** Use Orkes Cloud SaaS instead of self-hosted
**Pros:** Zero infrastructure, built-in persistence, professional support
**Cons:** $$ cost, external dependency, data leaves premises
**Decision:** Rejected - project requires zero-cost open-source solution

### Alternative 3: Kubernetes Native
**Approach:** Deploy Conductor on Kubernetes with persistent volumes
**Pros:** Production-grade orchestration, built-in scaling
**Cons:** Requires K8s cluster (higher barrier than Docker), complexity overkill for single-node use
**Decision:** Rejected - excessive complexity for current scale

### Rationale for Chosen Approach

3-tier fallback provides best balance:
- Tier 1 (Docker) optimal for production (isolated services, easy version control)
- Tier 2 (JAR) ensures continuity when Docker unavailable (development machines, restricted environments)
- Tier 3 (Direct) emergency operation for testing individual agents
- PostgreSQL industry-standard persistence with ACID guarantees
- Scaling validation proves system meets performance targets before production deployment

---

## Validation

**How will we know this decision is correct?**

- [ ] **Persistence Test:** Execute workflow → Stop containers → Restart → Query history (state retained)
- [ ] **Fallback Test:** Disable Docker → Run conductor-start.sh → Execute Task 1 (succeeds via JAR)
- [ ] **Performance Test:** Full 22-task workflow completes in <140 min
- [ ] **Quality Test:** ≥95% quality gates pass across all tasks
- [ ] **Recovery Test:** Kill Conductor mid-workflow → Restart → Resume workflow
- [ ] **Stress Test:** 5 concurrent workflows execute without failure

**Measurement Plan:**

1. Automated test suite in `tests/validate_conductor_resilience.sh`
2. Metrics collected to `.conductor/metrics/`
3. Performance report generated: `docs/09-reports/K1NReport_PHASE4_SCALING_VALIDATION_v1.0_20251109.md`
4. Validation deadline: Before Phase 5 (production deployment)

---

## Implementation Notes

**Related files:**
- `.conductor/docker/docker-compose.yaml` - PostgreSQL + services
- `.conductor/docker/init-db.sql` - Database schema
- `.conductor/docker/server/Dockerfile` - Conductor server image
- `ops/scripts/conductor-start.sh` - Auto-fallback startup script
- `ops/scripts/conductor-fallback-jar.sh` - JAR mode launcher
- `tests/validate_conductor_*.sh` - Scaling test suite

**Implementation Tasks:**
1. **Phase 1: Persistent Storage** (3h)
   - Create docker-compose.yaml with PostgreSQL
   - Configure Conductor for PostgreSQL backend
   - Implement init-db.sql schema
   - Test persistence across restarts

2. **Phase 2: Fallback Mechanisms** (3h)
   - Download/configure standalone Conductor JAR
   - Implement conductor-start.sh with auto-detection
   - Configure SQLite fallback mode
   - Test Docker → JAR fallback

3. **Phase 3: Scaling Validation** (3h)
   - Create 5-test validation suite
   - Add performance instrumentation
   - Execute tests and collect metrics
   - Generate validation report

**Timeline:**
- Start: 2025-11-09
- Target completion: 2025-11-10 (1 working day)
- Validation: 2025-11-11 (report generation)

---

## References

- [Comprehensive Technical Documentation](../01-architecture/K1N_COMPREHENSIVE_TECHNICAL_DOCUMENTATION_v1.0_20251109.md)
- [Phase 4 Implementation Plan](../04-planning/K1NPlan_PHASE4_CONDUCTOR_MCP_INTEGRATION_IMPLEMENTATION_v1.0_20251108.md)
- [Conductor OSS Documentation](https://conductor.netflix.com)
- [PostgreSQL Persistence Guide](https://conductor.netflix.com/devguide/running/conductor-on-postgres.html)

---

## Discussion & Approval

**Open Questions:**
- [ ] Approve 3-tier fallback architecture?
- [ ] Approve PostgreSQL as persistence layer (vs MySQL/SQLite)?
- [ ] Approve 9-hour implementation timeline?
- [ ] Proceed with implementation immediately?

**Approvers:**
- [ ] @spectrasynq (architecture steward)

**Sign-off:**
- [ ] Architecture review: pending
- [ ] Infrastructure review: pending
- [ ] Security review: pending (PostgreSQL credentials management)

---

<!-- markdownlint-enable MD013 -->
