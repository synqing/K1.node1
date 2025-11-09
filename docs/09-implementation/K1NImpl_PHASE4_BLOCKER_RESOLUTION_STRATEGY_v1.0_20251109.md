# Phase 4.4 Blocker Resolution Strategy

**Document Type:** K1NImpl (Implementation Strategy)
**Version:** 1.0
**Date:** 2025-11-09
**Status:** READY FOR EXECUTION
**Owner:** Claude Code Agent

---

## Executive Summary

**Problem:** Phase 4.4 blocked by Maven Central HTTP 503 (cannot download Conductor JAR)

**Solution:** Multi-source fallback + lightweight alternative approach

**Key Discovery:** GitHub releases provide alternative download source with newer Conductor version (v3.21.20) including lightweight "lite" variant

**Estimated Resolution Time:** 15-30 minutes

---

## Blocker Analysis

### Primary Blocker: Maven Central Unavailability

**Issue:** HTTP 503 Service Unavailable
**URL:** https://repo1.maven.org/maven2/com/netflix/conductor/conductor-server/3.15.0/conductor-server-3.15.0-boot.jar
**Impact:** Cannot download Conductor JAR for Tier 2 deployment
**Root Cause:** External service temporary outage

### Secondary Considerations

**Docker Unavailable:** Expected in this environment (container/CI)
**Agent Handlers Missing:** Phase 2 not implemented (separate issue)

---

## Resolution Strategy

### Approach 1: GitHub Releases (RECOMMENDED) ✅

**Discovery:** Conductor project publishes standalone JARs to GitHub releases

**Available Options:**
1. **Latest version (v3.21.20)** - Newer than our target (3.15.0)
   - URL: `https://github.com/conductor-oss/conductor/releases/download/v3.21.20/conductor-server-lite-standalone.jar`
   - Type: **Lite** variant (smaller, faster startup)
   - Status: ✅ Verified available (HTTP 200)

2. **Original version (v3.15.0)** - Our documented target
   - URL: `https://github.com/conductor-oss/conductor/releases/download/v3.15.0/conductor-server-3.15.0-boot.jar`
   - Type: Full server
   - Status: ✅ Verified available (HTTP 200)

**Recommendation:** Use **v3.21.20 lite** variant for faster validation, then test with v3.15.0 if needed

**Advantages:**
- ✅ Newer version with bug fixes
- ✅ Lite variant = smaller download, faster startup
- ✅ GitHub more reliable than Maven Central for downloads
- ✅ No changes needed to our infrastructure (API compatible)

**Implementation:**
```bash
# Download from GitHub instead of Maven Central
mkdir -p ~/.conductor
curl -fL -o ~/.conductor/conductor-server.jar \
  "https://github.com/conductor-oss/conductor/releases/download/v3.21.20/conductor-server-lite-standalone.jar"

# Verify download
ls -lh ~/.conductor/conductor-server.jar

# Start Conductor (existing script will work)
./ops/scripts/conductor-start.sh
```

---

### Approach 2: Enhanced Startup Script (AUTOMATIC FALLBACK)

**Concept:** Update `conductor-start.sh` to try multiple sources automatically

**Download Priority:**
1. Check local cache (`~/.conductor/conductor-server.jar`)
2. Try Maven Central (primary)
3. Fallback to GitHub releases (secondary)
4. Fallback to project cache (tertiary, if we bundle JAR)

**Implementation:**
```bash
# Pseudo-code for enhanced download logic
download_conductor_jar() {
    # 1. Check local cache
    if [ -f ~/.conductor/conductor-server.jar ] && [ -s ~/.conductor/conductor-server.jar ]; then
        echo "Using cached JAR"
        return 0
    fi

    # 2. Try Maven Central
    if curl -fL -o ~/.conductor/conductor-server.jar "$MAVEN_URL" 2>/dev/null; then
        echo "Downloaded from Maven Central"
        return 0
    fi

    # 3. Try GitHub (latest)
    if curl -fL -o ~/.conductor/conductor-server.jar "$GITHUB_LATEST_URL" 2>/dev/null; then
        echo "Downloaded from GitHub (v3.21.20)"
        return 0
    fi

    # 4. Try GitHub (specific version)
    if curl -fL -o ~/.conductor/conductor-server.jar "$GITHUB_3150_URL" 2>/dev/null; then
        echo "Downloaded from GitHub (v3.15.0)"
        return 0
    fi

    # All sources failed
    return 1
}
```

**Advantages:**
- ✅ Automatic resilience
- ✅ No manual intervention needed
- ✅ Works for future deployments
- ✅ Production-ready

---

### Approach 3: Bundle JAR in Repository (LONG-TERM)

**Concept:** Include Conductor JAR in `.conductor/cache/` directory for offline deployments

**Advantages:**
- ✅ Zero external dependencies
- ✅ Air-gapped deployment support
- ✅ Consistent versioning
- ✅ Fastest startup

**Disadvantages:**
- ⚠️ Increases repository size (~100 MB)
- ⚠️ Manual updates needed for Conductor upgrades
- ⚠️ Git LFS might be required for large files

**Decision:** Defer to long-term (Phase 5+) after validating external downloads work

---

## Recommended Execution Plan

### Phase 1: Immediate Resolution (15 minutes)

**Step 1: Download from GitHub**
```bash
mkdir -p ~/.conductor
curl -fL -o ~/.conductor/conductor-server.jar \
  "https://github.com/conductor-oss/conductor/releases/download/v3.21.20/conductor-server-lite-standalone.jar"
```

**Step 2: Verify Download**
```bash
ls -lh ~/.conductor/conductor-server.jar
# Expected: ~80-100 MB file

file ~/.conductor/conductor-server.jar
# Expected: Java archive data (JAR)
```

**Step 3: Start Conductor**
```bash
./ops/scripts/conductor-start.sh
# Should auto-detect cached JAR and start Tier 2
```

**Step 4: Verify Health**
```bash
# Wait 30-45 seconds for startup
sleep 45

curl http://localhost:8080/api/health
# Expected: {"healthy": true} or similar
```

---

### Phase 2: Enhanced Resilience (15 minutes)

**Update `conductor-start.sh` with multi-source fallback**

Add to `start_tier2()` function:
```bash
download_with_fallback() {
    local jar_path="$1"
    local urls=(
        "https://repo1.maven.org/maven2/com/netflix/conductor/conductor-server/3.15.0/conductor-server-3.15.0-boot.jar"
        "https://github.com/conductor-oss/conductor/releases/download/v3.21.20/conductor-server-lite-standalone.jar"
        "https://github.com/conductor-oss/conductor/releases/download/v3.15.0/conductor-server-3.15.0-boot.jar"
    )

    for url in "${urls[@]}"; do
        log_info "Attempting download: $url"
        if curl -fL -o "$jar_path" "$url" 2>/dev/null; then
            log_success "Downloaded from $(echo $url | cut -d'/' -f3)"
            return 0
        fi
        log_warn "Failed: $url"
    done

    return 1
}
```

**Test enhanced script:**
```bash
rm ~/.conductor/conductor-server.jar  # Force re-download
./ops/scripts/conductor-start.sh
# Should try Maven Central → GitHub automatically
```

---

### Phase 3: Validation Execution (2-3 hours)

**Once Conductor running:**

1. **Run Resilience Validation Suite**
   ```bash
   ./tests/validate_conductor_resilience.sh
   ```

2. **Execute Phase 4.4 Tests**
   - Test 4.4.1: Single task (Task 1)
   - Test 4.4.2: Dependency chain (6→7→8)
   - Test 4.4.3: Error handling

3. **Collect Metrics**
   - Performance baselines
   - Resource usage
   - Persistence validation

4. **Generate Final Report**
   - Update Phase 4.4 validation report
   - Document actual vs expected performance
   - Archive metrics

---

## Alternative: Agent Handler Mock (PARALLEL TRACK)

**Problem:** Agent handlers don't exist (Phase 2 not implemented)

**Quick Solution:** Create minimal mock handlers for validation

### Mock Agent Handler Pattern

```bash
#!/bin/bash
# Mock agent handler for validation testing
# Location: ops/agents/mock-agent-handler.sh

AGENT_TYPE="$1"
TASK_ID="$2"

# Simulate agent work (3-5 seconds)
sleep $((3 + RANDOM % 3))

# Generate mock result
cat > ".conductor/task-results/task-${TASK_ID}.json" <<EOF
{
    "task_id": ${TASK_ID},
    "agent_type": "${AGENT_TYPE}",
    "status": "COMPLETED",
    "start_time": "$(date -Iseconds)",
    "end_time": "$(date -Iseconds)",
    "duration_seconds": 3,
    "quality_gates": {
        "total": 15,
        "passed": 14,
        "failed": 1,
        "pass_rate": "93%"
    },
    "result": {
        "message": "Mock agent execution successful (validation only)"
    }
}
EOF

echo "Mock agent completed: ${AGENT_TYPE} Task ${TASK_ID}"
exit 0
```

**Usage:**
```bash
# Create mock agent
mkdir -p ops/agents
cat > ops/agents/mock-agent-handler.sh <<'EOF'
[... mock handler code ...]
EOF
chmod +x ops/agents/mock-agent-handler.sh

# Test mock
./ops/agents/mock-agent-handler.sh SecurityAgent 1
cat .conductor/task-results/task-1.json
```

**Advantages:**
- ✅ Allows infrastructure testing without real agents
- ✅ Validates Conductor orchestration
- ✅ Tests persistence and metrics collection
- ✅ Can be replaced with real agents later

**Limitations:**
- ⚠️ No real work performed
- ⚠️ Quality gates are simulated
- ⚠️ Does not validate actual agent logic

---

## Risk Assessment

### Approach 1 (GitHub Download) Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Version incompatibility | Low | Medium | Test with 3.21.20, fallback to 3.15.0 |
| GitHub unavailable | Very Low | Medium | Multiple version URLs as fallback |
| JAR corrupted | Very Low | Low | Verify file size and type |

### Approach 2 (Enhanced Script) Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| All sources down | Very Low | High | Cache JAR locally after first success |
| Script complexity | Low | Low | Incremental testing |

### Approach 3 (Mock Agents) Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| False validation | Medium | Medium | Clearly document mock behavior |
| Confusion with real agents | Low | Low | Prefix with "mock-" |

---

## Success Criteria

### Immediate Success (Phase 1)

- [ ] Conductor JAR downloaded successfully (from any source)
- [ ] Conductor server starts without errors
- [ ] Health endpoint responding (HTTP 200)
- [ ] API endpoints accessible

### Validation Success (Phase 3)

- [ ] Resilience validation suite: 7/7 tests pass
- [ ] Persistence validated (workflow survives restart)
- [ ] Performance metrics collected
- [ ] Phase 4.4 validation report completed

---

## Timeline

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Phase 1: Immediate Resolution** | 15 min | Download JAR, start Conductor, verify health |
| **Phase 2: Enhanced Resilience** | 15 min | Update startup script with multi-source fallback |
| **Phase 3: Validation Execution** | 2-3 hours | Run all Phase 4.4 tests, collect metrics, report |
| **TOTAL** | **2.5-3.5 hours** | Complete Phase 4.4 |

---

## Recommendation

**Execute in order:**

1. **NOW:** Download Conductor JAR from GitHub (Approach 1)
2. **NEXT:** Start Conductor and verify health
3. **THEN:** Run validation suite
4. **FINALLY:** Update startup script for future resilience (Approach 2)
5. **OPTIONAL:** Create mock agents if real agents unavailable (Approach 3)

**Confidence Level:** HIGH (95%+)
- GitHub source verified available
- Lite variant appropriate for validation
- Existing infrastructure compatible with newer version

---

## Commands to Execute

```bash
# 1. Download Conductor from GitHub
mkdir -p ~/.conductor
curl -fL -o ~/.conductor/conductor-server.jar \
  "https://github.com/conductor-oss/conductor/releases/download/v3.21.20/conductor-server-lite-standalone.jar"

# 2. Verify download
ls -lh ~/.conductor/conductor-server.jar
file ~/.conductor/conductor-server.jar

# 3. Start Conductor
./ops/scripts/conductor-start.sh

# 4. Wait for startup
sleep 45

# 5. Verify health
curl http://localhost:8080/api/health

# 6. Run validation suite
./tests/validate_conductor_resilience.sh

# 7. Check results
cat test-results/conductor_resilience_*.json
```

---

## Document Control

- **Type:** K1NImpl (Implementation Strategy)
- **Version:** 1.0
- **Status:** Ready for Execution
- **Created:** 2025-11-09
- **Author:** Claude Code Agent
- **Location:** `docs/09-implementation/K1NImpl_PHASE4_BLOCKER_RESOLUTION_STRATEGY_v1.0_20251109.md`

---

**Strategy: READY FOR EXECUTION**

Awaiting authorization to proceed with Phase 1 (download from GitHub).
