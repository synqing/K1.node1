# K1.node1 WebServer Security Audit - Quick Reference

**Comprehensive Analysis:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/05-analysis/K1NAnalysis_WEBSERVER_BUFFER_BOUNDS_AUDIT_v1.0_20251110.md`

---

## Critical Vulnerabilities at a Glance

| CVE ID | Line | Severity | Issue | Fix Time |
|:-------|:-----|:---------|:------|:---------|
| CVE-WS-001 | webserver.cpp:1783 | CRITICAL | WebSocket null-term overflow | 30 min |
| CVE-QP-001 | webserver.cpp:743,817,853... (18x) | CRITICAL | strtoul() integer overflow | 2 hours |
| CVE-HEAP-001 | webserver.cpp:764,882,1302,1328,1352 | HIGH | Heap allocation without error checks | 1.5 hours |
| CVE-PARSE-001 | webserver.cpp:1339-1348 | HIGH | Query param conversion without validation | 45 min |

**Total Critical + High Fixes:** 4.5 hours of focused work

---

## Vulnerability Severity Distribution

```
CRITICAL:   3 vulnerabilities
HIGH:       6 vulnerabilities
MEDIUM:     4 vulnerabilities
LOW:        26 minor issues
────────────────────────
TOTAL:     39 findings
```

---

## Unsafe Functions Identified

### strtoul() - 18 Instances (CRITICAL)

Lines: 211, 743, 749, 817, 853, 857, 866, 870, 874, 1015, 1019, 1023, 1032, 1046, 1339, 1342, 1345, 1348

**Problem:** No overflow checking, silent truncation on cast

**Example (line 743):**
```cpp
uint32_t t_us = (uint32_t)strtoul(p->value().c_str(), nullptr, 10);
// Input: "18446744073709551615" → strtoul returns ULONG_MAX
// Cast to uint32_t: 4294967295 (overflow, wrong value)
```

**Replacement:**
```cpp
uint32_t safe_val = query_param_u32(ctx.request, "param_name", default, max_value);
```

### new[] / new - 6 Instances (HIGH)

Lines: 764, 882, 1302, 1328, 1352, request_handler.h:215

**Problem:** No NULL check after allocation, OOM crash on failure

**Example (line 764):**
```cpp
LedTxEvent* all = new LedTxEvent[cap];
uint16_t copied = led_tx_events_peek(all, count);
// If new[] returns NULL: NULL dereference crash
```

**Replacement:**
```cpp
LedTxEvent* all = new(std::nothrow) LedTxEvent[cap];
if (!all) {
    ctx.sendError(503, "memory_exhausted", "...");
    return;
}
```

### data[len] = 0 - 1 Instance (CRITICAL)

Line: webserver.cpp:1783

**Problem:** Writes beyond buffer bounds in WebSocket handler

**Example:**
```cpp
// line 1781: if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT) {
data[len] = 0;  // If len == buffer_size, this writes past end
```

**Replacement:**
```cpp
if (len < MAX_WEBSOCKET_MESSAGE_SIZE) {
    data[len] = 0;
} else {
    LOG_ERROR(TAG_WEB, "WebSocket message too large");
    return;
}
```

### memcpy_P() - 2 Instances (MEDIUM)

Lines: webserver_response_builders.cpp:79, 94

**Problem:** Stack buffer size not validated before copy

**Example (line 92-94):**
```cpp
uint8_t palette_data[256];
size_t palette_bytes = info.num_entries * 4;
memcpy_P(palette_data, info.data, palette_bytes);
// Missing: if (palette_bytes > 256) return;
```

---

## Endpoints Requiring Immediate Fixes

### Must Fix First (CRITICAL)

1. **GET /api/leds/frame** - Query param "n" uses strtoul
2. **GET /api/beat-events/recent** - Uses strtoul for "limit", heap alloc
3. **GET /api/led-tx/recent** - Uses strtoul for 5 params, heap alloc
4. **GET /api/led-tx/dump** - Uses strtoul for 4 params, heap alloc
5. **GET /api/latency/align** - Uses strtoul 8 times
6. **GET /api/audio/arrays** - Uses strtoul 6 times, JSON size
7. **POST /api/config/restore** - JSON parsing to 1024-byte buffer
8. WebSocket /ws - Null termination overflow

### High Priority (HIGH)

1. **GET /api/beat-events/dump** - Heap allocation without error check
2. **POST /api/wifi/credentials** - SSID/password length validation
3. **GET /api/palettes** - Stack buffer palette_data[256]

---

## Code Snippets for Quick Reference

### Safe Query Parameter Parsing

```cpp
// Add to webserver_param_validator.h
uint32_t query_param_u32(AsyncWebServerRequest* req, const char* key,
                         uint32_t default_val, uint32_t max_val) {
    if (!req->hasParam(key)) return default_val;

    auto p = req->getParam(key);
    const char* str = p->value().c_str();

    errno = 0;
    unsigned long val = strtoul(str, nullptr, 10);

    // Check for overflow
    if (errno == ERANGE || val > max_val) {
        LOG_WARN(TAG_WEB, "Query param %s overflow: clamped to %u", key, max_val);
        return max_val;
    }

    return (uint32_t)val;
}

// Usage in handlers:
uint32_t t_us = query_param_u32(ctx.request, "t_us", 0, 0xFFFFFFFFu);
uint16_t limit = (uint16_t)query_param_u32(ctx.request, "limit", 16, 64);
```

### Safe Heap Allocation Pattern

```cpp
// For arrays that might fail
LedTxEvent* all = new(std::nothrow) LedTxEvent[cap];
if (!all) {
    ctx.sendError(503, "memory_exhausted",
                  "Insufficient heap for event buffer");
    return;
}

// Use RAII for guaranteed cleanup
struct ArrayGuard {
    LedTxEvent* ptr;
    ~ArrayGuard() { delete[] ptr; }
};
ArrayGuard guard{all};

// Safe usage with automatic cleanup
uint16_t copied = led_tx_events_peek(all, count);
// Array automatically deleted when guard goes out of scope
```

### WebSocket Safe Null Termination

```cpp
// webserver.cpp:1780-1795
case WS_EVT_DATA: {
    AwsFrameInfo *info = (AwsFrameInfo*)arg;
    if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT) {
        // SAFE: Validate bounds before null-terminating
        if (len >= MAX_WEBSOCKET_MESSAGE_SIZE) {
            LOG_ERROR(TAG_WEB, "WebSocket message too large: %u bytes", len);
            client->close(1009, "message too large");
            break;
        }

        // Now safe to null-terminate
        data[len] = 0;

        LOG_DEBUG(TAG_WEB, "WebSocket message: %s", (char*)data);
        // Continue...
    }
    break;
}
```

---

## Testing Checklist

### Unit Tests Required

- [ ] WebSocket frame at MAX_SIZE (2048 bytes) - should handle safely
- [ ] Query parameter with value ULONG_MAX string - should clamp correctly
- [ ] Heap exhaustion scenario - should return 503, not crash
- [ ] JSON document > 8KB - should clamp or validate
- [ ] Palette data > 256 bytes - should be rejected before memcpy_P

### Integration Tests Required

- [ ] POST large JSON body (>64KB) - should return 413
- [ ] GET with 100 query parameters - should handle gracefully
- [ ] Multiple concurrent WebSocket connections at max size
- [ ] Allocate events while under memory pressure

### Regression Tests Required

- [ ] All 55 endpoints still return correct data
- [ ] Response JSON valid and complete
- [ ] No memory leaks on successful requests
- [ ] Rate limiting still enforced

---

## Files Modified

```
firmware/src/webserver_bounds.cpp          [Already present]
firmware/src/webserver_bounds.h            [Already present]
firmware/src/webserver_param_validator.h   [Extend with safe_* functions]
firmware/src/webserver.cpp                 [Fix 45+ unsafe operations]
firmware/src/webserver_request_handler.h   [Add allocation error handling]
firmware/src/webserver_response_builders.cpp [Add bounds checks]
```

---

## Implementation Order

1. **Create safe utility functions** (webserver_param_validator.h)
   - `query_param_u32()`
   - `query_param_u16()`
   - Safe allocation wrappers

2. **Fix WebSocket handler** (webserver.cpp:1783)
   - Add bounds check before data[len] = 0

3. **Fix query parameter parsing** (18 locations)
   - Replace all strtoul() with query_param_u32()

4. **Fix heap allocations** (5-6 locations)
   - Use new(std::nothrow)
   - Add NULL checks
   - Add RAII guards

5. **Fix JSON document sizes**
   - Pre-validate before serializeJson()
   - Clamp array iterations

6. **Add error handling** to remaining handlers
   - Palette data bounds check
   - Header sanitization
   - WebSocket message validation

---

## Recommended Reading Order

For reviewers or developers implementing fixes:

1. **Start Here:** This Quick Reference
2. **Detailed Analysis:** K1NAnalysis_WEBSERVER_BUFFER_BOUNDS_AUDIT_v1.0_20251110.md
3. **Code Snippets:** See sections above for copy-paste ready fixes
4. **Implementation:** Reference webserver_bounds.h for existing infrastructure
5. **Testing:** See Testing Checklist above

---

## Key Metrics

```
Code Coverage:         100% of webserver files (3,010 LOC)
Vulnerability Density: 39 findings / 3,010 LOC = 1.3% (HIGH)
Critical Issues:       3 (must fix before production)
Integration Gaps:      Bounds checking exists but unused (0% integration)
Estimated Fix Time:    6-8 hours (1 developer sprint)
Risk Level:            HIGH (active exploitation possible)
```

---

## Next Steps

1. [ ] Review this Quick Reference with team
2. [ ] Read full audit document (30 min)
3. [ ] Create Task 3 subtasks for each vulnerability
4. [ ] Implement Priority 1 fixes (4.5 hours)
5. [ ] Run test suite
6. [ ] Deploy with monitoring for new vulnerability patterns

---

**Document:** K1NAnalysis_WEBSERVER_QUICK_REFERENCE_v1.0_20251110.md
**Analysis Date:** 2025-11-10
**Status:** Ready for Implementation
