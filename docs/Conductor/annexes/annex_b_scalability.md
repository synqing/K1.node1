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
| **Host CPU/RAM** | M1/M2 MacBook Pro (8–10 cores, 16 GB RAM default) | 4–5 concurrent workspaces reasonable; 8+ causes swapping |

### Practical Limits
- **Firmware builds**: 3–5 concurrent (serial compilation OK if deps cached; reuse .pio/ cache)
- **Device uploads**: 1 at a time (enforce via `runScriptMode: "nonconcurrent"`)
- **Total active workspaces**: 6–8 on 16 GB RAM; 10–12 on 32+ GB RAM

### Configuration Example
```json
{
  "maxConcurrentWorkspaces": 6,
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

### Metrics to Track
```json
{
  "workspace_count_active": 6,
  "device_upload_queue_length": 2,
  "build_cache_hit_rate": 0.85,
  "agent_success_rate": 0.92,
  "mean_time_to_upload": "45s",
  "mean_time_to_compile": "120s"
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

### M1/M2 MacBook Pro (16 GB RAM, 8 cores)

| Scenario | Concurrent Workspaces | Est. Build Time | Est. Disk |
|----------|----------------------|-----------------|-----------|
| **Light** (3 agents on web features) | 3 | 5 min | 18 MB |
| **Medium** (5 agents: 3 firmware, 2 webapp) | 5 | 10 min (serialized uploads) | 30 MB |
| **Heavy** (8 agents across all domains) | 8 | 15+ min (if queued) | 48 MB |

### Growth Levers
1. **Add RAM**: 32 GB → support 12+ concurrent workspaces
2. **Add host**: 2-node setup (primary + backup) → 16+ workspaces, redundancy
3. **Offload builds**: Use CI/CD for heavy builds; agents only iterate locally
4. **Device redundancy**: 2x ESP32-S3 devices → parallel uploads, device rotation for maintenance

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
