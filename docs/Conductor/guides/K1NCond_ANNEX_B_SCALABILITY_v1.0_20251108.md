# Annex B — K1.node1 Scalability & Resource Constraints

**Status**: Proposed
**Owner**: Claude
**Date**: 2025-11-08
**Scope**: Multi-agent concurrency limits and device contention resolution

---

## Dimensions

### 1. Agent Concurrency
Conductor allows **multiple agents to run in parallel workspaces**, but K1.node1 has **hardware bottlenecks**:

| Resource | Constraint | Impact |
|----------|-----------|--------|
| **Device (192.168.1.104)** | Single ESP32-S3; only one active pattern at a time | OTA uploads must serialize; pattern tests must queue |
| **USB/OTA Serial Port** | One physical connection | Only one agent can upload firmware at a time |
| **Build System** | PlatformIO compilation; 2–3 min per build | Parallel builds on same host use shared cache (OK) |
| **Host CPU/RAM** | MacBook Pro M4 Pro (14 cores, 48 GB RAM) | 12–16 concurrent workspaces reasonable; 20 burst with guardrails |

### Practical Limits (M4 Pro, 14c/48GB)
- **Firmware builds (CPU-bound)**: 3–4 concurrent active compiles (each compile spawns parallel jobs); beyond 4, wall‑clock often increases due to contention. Queue additional builds.
- **Webapp builds/dev (I/O/memory moderate)**: +4–6 in parallel is safe alongside firmware compiles.
- **Mixed workload example**: 3 firmware compiles + 6 webapp/dev/test workspaces concurrently without thrash.
- **Device uploads (single device)**: 1 at a time (enforce via `runScriptMode: "nonconcurrent"`).
- **Total active workspaces**: 12–16 steady‑state; up to 20 burst if most are non‑CPU‑bound (docs, analysis, light tests).

### Configuration Example (recommended defaults for M4 Pro)
```json
{
  "maxConcurrentWorkspaces": 16,
  "runScriptMode": "nonconcurrent",
  "deviceUploadQueue": {
    "max_concurrent": 1,
    "timeout_sec": 300,
    "retry_policy": "exponential_backoff"
  }
}
```

---

## Workspace Isolation Cost

Each Conductor workspace creates an **isolated Git worktree + copy of tracked files**.

### Size Impact
| Component | Size | Impact per Workspace |
|-----------|------|----------------------|
| `firmware/src/` | ~4 MB | 4 MB × N workspaces |
| `webapp/src/` | ~2 MB | 2 MB × N workspaces |
| `node_modules/` (cached symlink) | ~800 MB | Shared via host cache; 0 per workspace |
| `.pio/` (PlatformIO cache) | ~2 GB | Shared via host cache; 0 per workspace |
| **Total per workspace** | ~6 MB | 6 MB × N (very cheap) |

### Optimization
- Setup hook uses **symlinks** for `node_modules/` and `.pio/` → workspace never copies large caches
- Example:
  ```bash
  # In setup hook
  ln -s $CONDUCTOR_ROOT_PATH/node_modules $CONDUCTOR_WORKSPACE_PATH/node_modules
  ln -s $CONDUCTOR_ROOT_PATH/firmware/.pio $CONDUCTOR_WORKSPACE_PATH/firmware/.pio
  ```

---

## Device Upload Contention Resolution

### Problem
Multiple agents trying to upload firmware → serial port conflicts → failed uploads.

### Solution: Run Queue
Set `runScriptMode: "nonconcurrent"` in `conductor.json` to **serialize `run` hooks per workspace**.

This means:
- Workspace 1's `run` hook executes to completion
- Only then does Workspace 2's `run` hook start
- **Prevents simultaneous OTA uploads to same device**

### Example Timeline
```
T=0:00   Agent-A (fw:build+upload) starts → "pio run -t upload" begins
T=0:15   Agent-A upload in progress (serial port busy)
T=0:30   Agent-B (fw:build) tries to run → BLOCKED, waiting for A to finish
T=1:00   Agent-A upload completes; A's run hook ends
T=1:05   Agent-B's run hook resumes → "pio run" (no upload) executes
T=1:30   Agent-B compile completes
```

### Config
```json
{
  "scripts": {
    "run": "..."
  },
  "runScriptMode": "nonconcurrent"  // ← This serializes run hooks
}
```

---

## Device Availability & Fallback

### Scenario: Device Offline
If device at `192.168.1.104:3000` is unreachable:

| Scenario | Agent Action | Resolution |
|----------|-------------|-----------|
| **Pattern test queued** | Check device connectivity; retry 3× with 10s backoff | If fails, mark test as `SKIP` (not `FAIL`); escalate to human |
| **Firmware upload needed** | Attempt local OTA; if fails, suggest USB fallback | Human manually connects device via USB |
| **Metrics collection** | Timeout after 30s; return partial results | Log error; agent retries next cycle |

### Config (Timeout + Retry)
```bash
# In K1_TARGET=fw:upload handler
UPLOAD_TIMEOUT=300  # 5 minutes
RETRY_COUNT=3
RETRY_DELAY=10

for attempt in $(seq 1 $RETRY_COUNT); do
  if timeout $UPLOAD_TIMEOUT pio run -t upload; then
    echo "Upload successful"
    exit 0
  fi
  if [ $attempt -lt $RETRY_COUNT ]; then
    echo "Attempt $attempt failed; retrying in ${RETRY_DELAY}s"
    sleep $RETRY_DELAY
  fi
done

echo "Upload failed after $RETRY_COUNT attempts; escalating to human"
exit 1
```

---

## Firmware Build Parallelism

### Benefit
Multiple agents can **compile firmware in parallel** (same host), sharing PlatformIO cache.

### Example
```
Agent-A (test pattern on device) workspace:
  $ cd firmware && pio run -e esp32-s3-devkitc-1
  Compiling [####################################] 80%

Agent-B (optimize algorithm) workspace:
  $ cd firmware && pio run -e esp32-s3-devkitc-1
  Compiling [#####                                ] 20%

Both agents compile simultaneously:
  • Shared .pio/ cache (symlinked in setup hook)
  • Each gets own build/ directory
  • Parallel builds use both cores efficiently
```

### Optimization: LTO (Link-Time Optimization)
Disable LTO in `platformio.ini` for faster builds during agent iteration:
```ini
[env:esp32-s3-devkitc-1]
build_flags =
  -O2
  ; Disable LTO for faster iteration (enable only for release builds)
  ; -flto
```

---

## Data Storage & Artifact Management

### Artifact Cleanup
As workspaces accumulate, disk usage grows. Schedule weekly archive:

```bash
# ops/scripts/archive_old_workspaces.sh
THRESHOLD_DAYS=7
WORKSPACE_DIR="$HOME/.conductor/workspaces"

find $WORKSPACE_DIR -name "ws-*" -type d -mtime +$THRESHOLD_DAYS | while read ws; do
  conductor archive $ws
  rm -rf $ws
done

# Result: recover ~6 MB × number of old workspaces
```

### Artifact Storage
Large artifacts (firmware `.bin`, test reports) stored in:
- **Local**: `ops/artifacts/` (checked in if < 100 MB total)
- **Remote**: S3 bucket (future: `s3://k1-artifacts/...`)

---

## Monitoring & Oversight at Scale

### Metrics to Track (targets for M4 Pro)
```json
{
  "workspace_count_active": 14,
  "device_upload_queue_length": 0,
  "build_cache_hit_rate": 0.90,
  "agent_success_rate": 0.95,
  "mean_time_to_upload": "45s",
  "mean_time_to_compile": "90s",
  "render_fps_min": 120,
  "render_fps_target": 150
}
```

### Alerting
- If `device_upload_queue_length` > 5 for 10 min → escalate (device slow or offline)
- If `agent_success_rate` < 0.80 → review failure logs
- If workspace disk usage > 80% → trigger archive

### Dashboard (Grafana/Prometheus)
```yaml
# prometheus.yml
global:
  scrape_interval: 30s

scrape_configs:
  - job_name: conductor
    static_configs:
      - targets: ['localhost:8080']
```

---

## Capacity Planning

### MacBook Pro M4 Pro (48 GB RAM, 14 cores)

| Scenario | Concurrent Workspaces | Est. Build Time | Notes |
|----------|----------------------|-----------------|-------|
| **Light** (web/dev/docs heavy) | 12 | 5–7 min | Mostly I/O; low CPU contention |
| **Mixed** (3 fw builds + 6 webapp + 3 docs) | 12 | 8–10 min | Keep fw compiles ≤4 in parallel |
| **Heavy** (CPU‑bound bursts) | 16 | 12–15 min | Queue extra fw builds; uploads serialized |
| **Burst** (non‑CPU‑bound surge) | 20 | N/A | Only if most tasks are light (no fw compiles) |

### Growth Levers
1. **Guardrails**: Cap parallel firmware compiles at 4; queue excess.
2. **Add host**: 2‑node setup (primary + backup) → 24–32 workspaces and redundancy.
3. **Offload builds**: Use CI/CD for heavy or release builds; agents iterate locally against cached deps.
4. **Device redundancy**: +1–2 ESP32‑S3 devices → parallelize uploads/tests; route via device queue.

---

## Rate Limiting & Cost Guardrails

### API Quotas
- **GitHub API**: 5,000 req/hour per token; monitor via rate limit headers
- **Taskmaster MCP**: File-backed; cache parsed tasks.json in memory; watch file for changes
- **Model API**: Distribute across 2–3 API keys; auto-switch on rate limit

### Example: Multi-Key Rotation
```json
{
  "model_keys": [
    "sk-proj-abc123...",
    "sk-proj-def456...",
    "sk-proj-ghi789..."
  ],
  "rate_limit_threshold": 0.8,
  "fallback_strategy": "round_robin"
}
```

---

## SLOs & Escalation

### Target SLOs
| Metric | Target | Escalation |
|--------|--------|-----------|
| **Build success rate** | ≥ 95% | After 2 failures, escalate to human |
| **Device upload success rate** | ≥ 98% | After 1 failure, escalate |
| **Mean time to upload** | ≤ 1 min (90th percentile) | If > 2 min, investigate device/network |
| **Agent turn time** (workspace setup to PR) | ≤ 15 min | Log long turns; optimize setup hook |

### Failure Ladder
1. **Auto-retry** (2–3 attempts with backoff)
2. **Escalate to agent prompt** (retry with different approach)
3. **Escalate to human** (manual intervention, device check)
4. **Escalate to incident** (if system-wide, e.g., device completely offline)

---

## References

- **Conductor docs**: Concurrency, workspace isolation, `runScriptMode`
- **PlatformIO docs**: Build cache, parallel compilation
- **K1.node1 Device API**: HTTP endpoints, metrics
- **K1.node1 Master Brief**: [conductor_mcp_master_brief.md](conductor_mcp_master_brief.md)
