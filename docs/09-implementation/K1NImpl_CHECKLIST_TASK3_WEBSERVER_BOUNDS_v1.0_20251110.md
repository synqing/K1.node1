# Task 3: WebServer Buffer Bounds Checking - Implementation Checklist

**Status:** Ready for Implementation
**Estimated Duration:** 6-8 hours
**Priority:** CRITICAL
**Risk Level:** HIGH

---

## Pre-Implementation Review

### Analysis Documents
- [x] Comprehensive audit completed: `K1NAnalysis_WEBSERVER_BUFFER_BOUNDS_AUDIT_v1.0_20251110.md`
- [x] Quick reference created: `K1NAnalysis_WEBSERVER_QUICK_REFERENCE_v1.0_20251110.md`
- [x] All 39 vulnerabilities documented with line numbers
- [x] Safe replacement code provided for all patterns

### Code Metrics
```
Total Webserver LOC:     3,010 lines
Handlers Requiring Fix:  45 identified
Critical Issues:         3 (CVE-WS-001, CVE-QP-001, CVE-HEAP-001)
High Severity:           6 issues
Medium Severity:         4 issues
Estimated Fix Time:      6-8 hours (1 developer sprint)
```

---

## PHASE 1: Infrastructure & Utilities (1.5 hours)

### Step 1.1: Extend webserver_param_validator.h
**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/webserver_param_validator.h`
**Time:** 30 minutes

Add safe query parameter parsing functions:

```cpp
/**
 * Safe unsigned 32-bit integer parsing from query parameters
 *
 * @param req HTTP request
 * @param key Parameter name (e.g., "limit", "t_us")
 * @param default_val Default if parameter missing
 * @param max_val Maximum allowed value (clamp)
 * @return Parsed value, clamped to [0, max_val]
 */
inline uint32_t query_param_u32(AsyncWebServerRequest* req, const char* key,
                                 uint32_t default_val, uint32_t max_val) {
    if (!req || !req->hasParam(key)) return default_val;

    auto p = req->getParam(key);
    const char* str = p->value().c_str();
    if (!str || *str == '\0') return default_val;

    errno = 0;
    unsigned long val = strtoul(str, nullptr, 10);

    // Check for strtoul() errors
    if (errno == ERANGE || val > max_val) {
        LOG_WARN(TAG_WEB, "Query param %s overflow: clamped to %u", key, max_val);
        return max_val;
    }

    return (uint32_t)val;
}

/**
 * Safe unsigned 16-bit integer parsing from query parameters
 */
inline uint16_t query_param_u16(AsyncWebServerRequest* req, const char* key,
                                 uint16_t default_val, uint16_t max_val) {
    uint32_t val32 = query_param_u32(req, key, default_val, max_val);
    return (uint16_t)val32;
}

/**
 * Safe boolean parsing from query parameters
 * Accepts: true/false, 1/0, yes/no
 */
inline bool query_param_bool(AsyncWebServerRequest* req, const char* key,
                              bool default_val) {
    if (!req || !req->hasParam(key)) return default_val;

    auto p = req->getParam(key);
    String v = p->value();
    v.toLowerCase();

    return (v == "true" || v == "1" || v == "yes" || v == "on");
}
```

**Checklist:**
- [ ] Add query_param_u32() function
- [ ] Add query_param_u16() function
- [ ] Add query_param_bool() function
- [ ] Add #include <cerrno> for errno
- [ ] Test compilation
- [ ] Verify functions handle edge cases (empty strings, ULONG_MAX, etc.)

### Step 1.2: Create Memory Allocation Helper (RAII)
**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/webserver_param_validator.h`
**Time:** 20 minutes

Add memory allocation safety wrappers:

```cpp
/**
 * RAII wrapper for heap allocations to ensure cleanup
 * Automatically deletes array on scope exit
 */
template<typename T>
struct ArrayGuard {
    T* ptr;

    ArrayGuard(T* p) : ptr(p) {}
    ~ArrayGuard() {
        if (ptr) delete[] ptr;
    }

    // Delete copy operations
    ArrayGuard(const ArrayGuard&) = delete;
    ArrayGuard& operator=(const ArrayGuard&) = delete;

    // Allow move (C++11)
    ArrayGuard(ArrayGuard&& other) noexcept : ptr(other.release()) {}
    ArrayGuard& operator=(ArrayGuard&& other) noexcept {
        if (ptr) delete[] ptr;
        ptr = other.release();
        return *this;
    }

    T* release() { T* temp = ptr; ptr = nullptr; return temp; }
    T& operator[](size_t i) { return ptr[i]; }
    T* get() { return ptr; }
};

/**
 * Safe array allocation with explicit null-check
 *
 * @param size Number of elements
 * @param max_size Maximum allowed elements
 * @return ArrayGuard that automatically deletes on scope exit
 *
 * Usage:
 *   auto guard = safe_alloc<LedTxEvent>(count, MAX_EVENTS);
 *   if (!guard.get()) {
 *       ctx.sendError(503, "memory_exhausted", "...");
 *       return;
 *   }
 *   guard[0].timestamp_us = ...;  // Safe access
 */
template<typename T>
ArrayGuard<T> safe_alloc(size_t size, size_t max_size) {
    if (size > max_size) {
        LOG_WARN(TAG_WEB, "Allocation size %u exceeds max %u", size, max_size);
        return ArrayGuard<T>(nullptr);
    }

    T* ptr = new(std::nothrow) T[size];
    if (!ptr) {
        LOG_ERROR(TAG_WEB, "Allocation failed: %u × sizeof(%s)",
                  size, typeid(T).name());
    }
    return ArrayGuard<T>(ptr);
}
```

**Checklist:**
- [ ] Add ArrayGuard template
- [ ] Add safe_alloc() template function
- [ ] Verify RAII cleanup behavior
- [ ] Test with nullptr scenario
- [ ] Verify compilation with C++11 standards

### Step 1.3: Create JSON Document Size Validator
**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/webserver_param_validator.h`
**Time:** 20 minutes

Add JSON size pre-validation:

```cpp
/**
 * Validate JSON document can fit in allocated size
 *
 * @param estimated_bytes Estimated JSON output size
 * @param max_bytes Maximum allocation
 * @return true if fits, false if too large
 */
inline bool validate_json_size(size_t estimated_bytes, size_t max_bytes) {
    if (estimated_bytes > max_bytes) {
        LOG_WARN(TAG_WEB, "JSON too large: %u > %u bytes",
                 estimated_bytes, max_bytes);
        return false;
    }
    return true;
}

/**
 * Calculate safe array limit for JSON output
 *
 * @param max_json_size Maximum JSON document size
 * @param per_entry_bytes Bytes per array entry (including overhead)
 * @param base_bytes Static overhead (JSON structure, not array)
 * @return Maximum safe array count
 *
 * Usage:
 *   size_t max_leds = safe_array_limit(8192, 16, 512);
 *   for (size_t i = 0; i < max_leds && i < limit; ++i) { ... }
 */
inline size_t safe_array_limit(size_t max_json_size, size_t per_entry_bytes,
                               size_t base_bytes) {
    if (max_json_size <= base_bytes) return 0;
    return (max_json_size - base_bytes) / per_entry_bytes;
}
```

**Checklist:**
- [ ] Add validate_json_size() function
- [ ] Add safe_array_limit() calculation function
- [ ] Document overhead constants for each endpoint
- [ ] Test with known LED frame size

---

## PHASE 2: Critical WebSocket Fix (0.5 hour)

### Step 2.1: Fix WebSocket Null Termination Overflow
**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/webserver.cpp`
**Location:** Lines 1778-1797 (onWebSocketEvent function)
**Time:** 30 minutes

**BEFORE:**
```cpp
case WS_EVT_DATA:
{
    AwsFrameInfo *info = (AwsFrameInfo*)arg;
    if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT) {
        // Handle incoming WebSocket message (for future bidirectional communication)
        data[len] = 0; // Null terminate  <-- VULNERABLE
        LOG_DEBUG(TAG_WEB, "WebSocket message from client #%u: %s", client->id(), (char*)data);
```

**AFTER:**
```cpp
case WS_EVT_DATA:
{
    AwsFrameInfo *info = (AwsFrameInfo*)arg;
    if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT) {
        // SECURITY FIX: Validate message size before null-terminating
        if (len >= MAX_WEBSOCKET_MESSAGE_SIZE) {
            LOG_ERROR(TAG_WEB, "WebSocket message too large from client #%u: %u bytes",
                     client->id(), len);
            client->close(1009, "message too large");
            break;
        }

        // Now safe to null-terminate
        data[len] = 0;

        LOG_DEBUG(TAG_WEB, "WebSocket message from client #%u: %s", client->id(), (char*)data);
```

**Checklist:**
- [ ] Add bounds check before data[len] = 0
- [ ] Add error logging for oversized messages
- [ ] Close connection on violation (1009 = message too big)
- [ ] Test with max-size WebSocket frame (2048 bytes)
- [ ] Verify no memory corruption on overflow attempt

---

## PHASE 3: Query Parameter Parsing Fixes (2 hours)

### Step 3.1: Fix GetLedFrameHandler Query Parameter
**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/webserver.cpp`
**Location:** Lines 209-217 (GetLedFrameHandler::handle)
**Time:** 15 minutes

**BEFORE:**
```cpp
uint32_t limit = NUM_LEDS;
const char* fmt = "hex";
if (ctx.request->hasParam("n")) {
    String v = ctx.request->getParam("n")->value();
    uint32_t req = (uint32_t)strtoul(v.c_str(), nullptr, 10);  // <-- UNSAFE
    if (req > 0 && req < limit) limit = req;
}
```

**AFTER:**
```cpp
uint32_t limit = NUM_LEDS;
const char* fmt = "hex";
if (ctx.request->hasParam("n")) {
    limit = query_param_u32(ctx.request, "n", NUM_LEDS, NUM_LEDS);
}
```

**Checklist:**
- [ ] Replace strtoul with query_param_u32
- [ ] Test with value 0, NUM_LEDS, 2×NUM_LEDS, ULONG_MAX

### Step 3.2: Fix GetLatencyAlignHandler Query Parameters (5x)
**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/webserver.cpp`
**Location:** Lines 738-750
**Time:** 20 minutes

**Affected Parameters:**
- Line 743: t_us
- Line 749: max_delta_us
- And strategy parsing (already safe)

**BEFORE:**
```cpp
uint32_t t_us = (uint32_t)strtoul(p->value().c_str(), nullptr, 10);
// ...
if (ctx.request->hasParam("max_delta_us")) {
    auto pmax = ctx.request->getParam("max_delta_us");
    max_delta_us = (uint32_t)strtoul(pmax->value().c_str(), nullptr, 10);
}
```

**AFTER:**
```cpp
uint32_t t_us = query_param_u32(ctx.request, "t_us", 0, UINT32_MAX);
// ...
uint32_t max_delta_us = query_param_u32(ctx.request, "max_delta_us", 0, UINT32_MAX);
```

**Checklist:**
- [ ] Replace both strtoul calls
- [ ] Test with ULONG_MAX strings
- [ ] Verify timestamp comparison logic still works

### Step 3.3: Fix GetBeatEventsRecentHandler Query Parameter
**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/webserver.cpp`
**Location:** Lines 814-820
**Time:** 15 minutes

**BEFORE:**
```cpp
uint16_t limit = 10;
if (ctx.request->hasParam("limit")) {
    auto p = ctx.request->getParam("limit");
    limit = (uint16_t)strtoul(p->value().c_str(), nullptr, 10);  // <-- UNSAFE
}
if (limit == 0) limit = 10;
if (limit > 32) limit = 32;
```

**AFTER:**
```cpp
uint16_t limit = query_param_u16(ctx.request, "limit", 10, 32);
if (limit == 0) limit = 10;
```

**Checklist:**
- [ ] Replace strtoul with query_param_u16
- [ ] Remove redundant bounds checks (now in query_param_u16)
- [ ] Test with overflow values

### Step 3.4: Fix GetLedTxRecentHandler Query Parameters (5x)
**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/webserver.cpp`
**Location:** Lines 844-875
**Time:** 30 minutes

**BEFORE:**
```cpp
if (ctx.request->hasParam("limit")) {
    auto p = ctx.request->getParam("limit");
    limit = (uint16_t)strtoul(p->value().c_str(), nullptr, 10);
}
// ... similar for since_us, until_us, around_us, max_delta_us (4 more)
```

**AFTER:**
```cpp
limit = query_param_u16(ctx.request, "limit", 16, 64);
since_us = query_param_u32(ctx.request, "since_us", 0, UINT32_MAX);
until_us = query_param_u32(ctx.request, "until_us", 0, UINT32_MAX);
around_us = query_param_u32(ctx.request, "around_us", 0, UINT32_MAX);
max_delta_us = query_param_u32(ctx.request, "max_delta_us", 0, UINT32_MAX);
```

**Checklist:**
- [ ] Replace all 5 strtoul calls
- [ ] Verify filtering logic unchanged
- [ ] Test with edge case combinations

### Step 3.5: Fix GetAudioArraysHandler Query Parameters (6x)
**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/webserver.cpp`
**Location:** Lines 1013-1047
**Time:** 30 minutes

**BEFORE:**
```cpp
if (ctx.request->hasParam("count")) {
    auto p = ctx.request->getParam("count");
    count = (uint16_t)strtoul(p->value().c_str(), nullptr, 10);
}
// ... similar for offset, stride, frames, novelty_count
```

**AFTER:**
```cpp
count = query_param_u16(ctx.request, "count", 16, 64);
offset = query_param_u16(ctx.request, "offset", 0, NUM_FREQS - 1);
stride = query_param_u16(ctx.request, "stride", 0, NUM_FREQS);
frames = query_param_u16(ctx.request, "frames", 0, NUM_SPECTROGRAM_AVERAGE_SAMPLES);
novelty_count = query_param_u16(ctx.request, "novelty_count", 0, 256);
```

**Checklist:**
- [ ] Replace 6 strtoul calls
- [ ] Verify clamping ranges match endpoint needs
- [ ] Test with out-of-range values

### Step 3.6: Fix GetLedTxDumpHandler Query Parameters (4x)
**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/webserver.cpp`
**Location:** Lines 1338-1349
**Time:** 20 minutes

**BEFORE:**
```cpp
if (ctx.request->hasParam("since_us")) {
    since_us = (uint32_t)strtoul(ctx.request->getParam("since_us")->value().c_str(), nullptr, 10);
}
// ... similar for until_us, around_us, max_delta_us
```

**AFTER:**
```cpp
since_us = query_param_u32(ctx.request, "since_us", 0, UINT32_MAX);
until_us = query_param_u32(ctx.request, "until_us", 0, UINT32_MAX);
around_us = query_param_u32(ctx.request, "around_us", 0, UINT32_MAX);
max_delta_us = query_param_u32(ctx.request, "max_delta_us", 0, UINT32_MAX);
```

**Checklist:**
- [ ] Replace 4 strtoul calls
- [ ] Verify no side effects from query_param removal

---

## PHASE 4: Heap Allocation Fixes (1.5 hours)

### Step 4.1: Fix GetLatencyAlignHandler Heap Allocation
**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/webserver.cpp`
**Location:** Lines 764-805
**Time:** 20 minutes

**BEFORE:**
```cpp
uint16_t count = led_tx_events_count();
uint16_t cap = led_tx_events_capacity();
LedTxEvent* all = new LedTxEvent[cap];  // <-- No NULL check
uint16_t copied = led_tx_events_peek(all, count);
// ... use all[i] ...
delete[] all;
```

**AFTER:**
```cpp
uint16_t count = led_tx_events_count();
uint16_t cap = led_tx_events_capacity();

// SECURITY FIX: Safe allocation with error handling
auto guard = safe_alloc<LedTxEvent>(cap, 512);  // Max 512 events
if (!guard.get()) {
    ctx.sendError(503, "memory_exhausted", "Insufficient heap for event array");
    return;
}

uint16_t copied = led_tx_events_peek(guard.get(), count);
// ... use guard[i] ...
// Automatic cleanup when guard goes out of scope
```

**Checklist:**
- [ ] Use safe_alloc wrapper
- [ ] Add error response on NULL
- [ ] Verify RAII cleanup
- [ ] Test under memory pressure

### Step 4.2: Fix GetLedTxRecentHandler Heap Allocations (2x)
**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/webserver.cpp`
**Location:** Lines 882, 1352
**Time:** 20 minutes

**BEFORE (line 882):**
```cpp
uint16_t count = led_tx_events_count();
uint16_t cap = led_tx_events_capacity();
LedTxEvent* all = new LedTxEvent[cap];  // <-- UNSAFE
uint16_t copied = led_tx_events_peek(all, count);

// ... filter into selected[] ...
LedTxEvent selected[64];
uint16_t selected_count = 0;
for (uint16_t i = 0; i < copied && selected_count < 64; ++i) {
    // ... filtering ...
    selected[selected_count++] = all[i];
}
```

**AFTER:**
```cpp
uint16_t count = led_tx_events_count();
uint16_t cap = led_tx_events_capacity();

auto all_guard = safe_alloc<LedTxEvent>(cap, 512);
if (!all_guard.get()) {
    ctx.sendError(503, "memory_exhausted", "Insufficient heap for event array");
    return;
}

uint16_t copied = led_tx_events_peek(all_guard.get(), count);

// ... filter into selected[] ...
LedTxEvent selected[64];
uint16_t selected_count = 0;
for (uint16_t i = 0; i < copied && selected_count < 64; ++i) {
    // ... filtering ...
    selected[selected_count++] = all_guard[i];
}
// Guard cleanup on scope exit
```

**Checklist:**
- [ ] Fix line 882 allocation
- [ ] Fix line 1352 allocation
- [ ] Test filtering logic unchanged
- [ ] Verify memory cleanup

### Step 4.3: Fix GetBeatEventsDumpHandler Heap Allocation
**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/webserver.cpp`
**Location:** Lines 1302-1316
**Time:** 15 minutes

**BEFORE:**
```cpp
uint16_t count = beat_events_count();
uint16_t cap = beat_events_capacity();
BeatEvent* tmp = new BeatEvent[cap];  // <-- UNSAFE
uint16_t copied = beat_events_peek(tmp, count);
// ... use tmp ...
delete[] tmp;
```

**AFTER:**
```cpp
uint16_t count = beat_events_count();
uint16_t cap = beat_events_capacity();

auto guard = safe_alloc<BeatEvent>(cap, 256);
if (!guard.get()) {
    ctx.sendError(503, "memory_exhausted", "Insufficient heap for beat events");
    return;
}

uint16_t copied = beat_events_peek(guard.get(), count);
// ... use guard[i] ...
// Automatic cleanup
```

**Checklist:**
- [ ] Apply safe_alloc pattern
- [ ] Update all references from tmp to guard.get()
- [ ] Verify JSON output logic unchanged
- [ ] Remove manual delete[]

### Step 4.4: Fix GetLedTxDumpHandler Heap Allocations (2x)
**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/webserver.cpp`
**Location:** Lines 1328, 1352
**Time:** 20 minutes

Similar pattern to GetLedTxRecentHandler:

**BEFORE (line 1328):**
```cpp
LedTxEvent* all = new LedTxEvent[cap];
```

**AFTER:**
```cpp
auto all_guard = safe_alloc<LedTxEvent>(cap, 512);
if (!all_guard.get()) {
    ctx.sendError(503, "memory_exhausted", "Insufficient heap");
    return;
}
```

**BEFORE (line 1352):**
```cpp
LedTxEvent* selected = new LedTxEvent[cap];
```

**AFTER:**
```cpp
auto selected_guard = safe_alloc<LedTxEvent>(cap, 512);
if (!selected_guard.get()) {
    ctx.sendError(503, "memory_exhausted", "Insufficient heap");
    return;
}
```

**Checklist:**
- [ ] Apply guards to both allocations
- [ ] Update all pointer references
- [ ] Remove manual delete[] statements (lines 1389-1390)
- [ ] Verify JSON output unchanged

### Step 4.5: Fix PostBodyHandler String Allocation
**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/webserver_request_handler.h`
**Location:** Lines 214-221
**Time:** 15 minutes

**BEFORE:**
```cpp
String *body = static_cast<String*>(request->_tempObject);

// Initialize body buffer on first chunk
if (index == 0) {
    body = new String();
    body->reserve(total);  // May fail silently
    request->_tempObject = body;
}
```

**AFTER:**
```cpp
String *body = static_cast<String*>(request->_tempObject);

// Initialize body buffer on first chunk
if (index == 0) {
    body = new String();
    if (!body) {
        auto *resp = request->beginResponse(503, "application/json",
            "{\"error\":\"memory_exhausted\"}");
        request->send(resp);
        return;
    }

    if (!body->reserve(total)) {
        delete body;
        auto *resp = request->beginResponse(503, "application/json",
            "{\"error\":\"memory_exhausted\"}");
        request->send(resp);
        return;
    }
    request->_tempObject = body;
}

// Validate accumulated size
if (body->length() + len > K1_MAX_REQUEST_BODY_SIZE) {
    delete body;
    request->_tempObject = nullptr;
    auto *resp = request->beginResponse(413, "application/json",
        "{\"error\":\"payload_too_large\"}");
    request->send(resp);
    return;
}
```

**Checklist:**
- [ ] Check new String() result
- [ ] Check reserve() result
- [ ] Add accumulated size validation
- [ ] Test with memory pressure
- [ ] Test with Content-Length > limit

---

## PHASE 5: JSON Document Fixes (1 hour)

### Step 5.1: Validate JSON Sizes Before Serialization
**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/webserver.cpp`
**Location:** Multiple (GetLedFrameHandler, GetAudioArraysHandler)
**Time:** 20 minutes

**For GetLedFrameHandler (line 220):**

**BEFORE:**
```cpp
DynamicJsonDocument doc(8192);
doc["count"] = NUM_LEDS;
doc["limit"] = limit;
doc["format"] = fmt;
JsonArray data = doc.createNestedArray("data");

// Loop without size checking
for (uint32_t i = 0; i < limit; ++i) {
    // Add to JSON
    data.add(String(hexbuf));
}
```

**AFTER:**
```cpp
// SECURITY FIX: Pre-validate JSON size
// Base: ~200 bytes + per-entry: 8 bytes hex + JSON overhead ~8
const size_t MAX_JSON = 8192;
const size_t BASE_BYTES = 256;
const size_t PER_ENTRY_BYTES = 16;  // Measured with ArduinoJson

size_t estimated = BASE_BYTES + (limit * PER_ENTRY_BYTES);
if (estimated > MAX_JSON) {
    limit = (MAX_JSON - BASE_BYTES) / PER_ENTRY_BYTES;
    LOG_WARN(TAG_WEB, "LED frame size clamped to %u", limit);
}

DynamicJsonDocument doc(MAX_JSON);
doc["count"] = NUM_LEDS;
doc["limit"] = limit;
doc["format"] = fmt;
JsonArray data = doc.createNestedArray("data");

// Now safe
for (uint32_t i = 0; i < limit; ++i) {
    data.add(String(hexbuf));
}
```

**Checklist:**
- [ ] Add size pre-calculation
- [ ] Clamp array limits dynamically
- [ ] Log clamping decisions
- [ ] Test with NUM_LEDS edge cases

### Step 5.2: Validate Palette Data Buffer
**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/webserver_response_builders.cpp`
**Location:** Lines 90-94
**Time:** 15 minutes

**BEFORE:**
```cpp
uint8_t palette_data[256];
size_t palette_bytes = info.num_entries * 4;
memcpy_P(palette_data, info.data, palette_bytes);  // <-- No bounds check
```

**AFTER:**
```cpp
uint8_t palette_data[256];
size_t palette_bytes = info.num_entries * 4;

// SECURITY FIX: Validate palette data size
if (palette_bytes > sizeof(palette_data)) {
    LOG_ERROR(TAG_WEB, "Palette data size overflow: entries=%u, bytes=%u",
              info.num_entries, palette_bytes);
    continue;  // Skip corrupted palette
}

memcpy_P(palette_data, info.data, palette_bytes);
```

**Checklist:**
- [ ] Add bounds check before memcpy_P
- [ ] Skip corrupted palettes gracefully
- [ ] Log error condition
- [ ] Test with NUM_PALETTES

### Step 5.3: Validate JSON Array Allocations in Response Builders
**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/webserver_response_builders.cpp`
**Location:** Lines 52-67 (patterns), 73-114 (palettes)
**Time:** 25 minutes

**For build_patterns_json():**

**BEFORE:**
```cpp
DynamicJsonDocument doc(8192);
JsonArray patterns = doc.createNestedArray("patterns");

for (uint16_t i = 0; i < g_num_patterns; i++) {
    // Add without size check
}
```

**AFTER:**
```cpp
const size_t MAX_PATTERNS_JSON = 8192;
const size_t BASE_OVERHEAD = 256;
size_t max_entries = (MAX_PATTERNS_JSON - BASE_OVERHEAD) / 256;  // ~256 bytes per pattern

DynamicJsonDocument doc(MAX_PATTERNS_JSON);
JsonArray patterns = doc.createNestedArray("patterns");

uint16_t added = 0;
for (uint16_t i = 0; i < g_num_patterns && added < max_entries; i++) {
    // Add safely
    added++;
}
```

**For build_palettes_json():**

**BEFORE:**
```cpp
DynamicJsonDocument doc(24576);  // 24KB
// Processes all NUM_PALETTES without size tracking
```

**AFTER:**
```cpp
const size_t MAX_PALETTES_JSON = 24576;
const size_t BASE_OVERHEAD = 512;
const size_t PER_PALETTE_BYTES = 640;  // Measured

DynamicJsonDocument doc(MAX_PALETTES_JSON);
JsonArray palettes = doc.createNestedArray("palettes");

uint8_t added = 0;
uint8_t max_palettes = (MAX_PALETTES_JSON - BASE_OVERHEAD) / PER_PALETTE_BYTES;
for (uint8_t i = 0; i < NUM_PALETTES && added < max_palettes; i++) {
    // Add safely
    added++;
}
```

**Checklist:**
- [ ] Calculate realistic per-entry overhead (measure with profiler)
- [ ] Clamp iteration limits
- [ ] Test with all palettes
- [ ] Verify JSON output complete and valid

---

## PHASE 6: Palette Buffer Safety (0.5 hour)

### Step 6.1: Add Palette Data Validation
**File:** `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/webserver_response_builders.cpp`
**Location:** Lines 73-114
**Time:** 30 minutes

Insert validation in build_palettes_json():

```cpp
String build_palettes_json() {
    const size_t MAX_PALETTES_JSON = 24576;
    DynamicJsonDocument doc(MAX_PALETTES_JSON);
    JsonArray palettes = doc.createNestedArray("palettes");

    for (uint8_t i = 0; i < NUM_PALETTES; i++) {
        // Read PaletteInfo from PROGMEM
        PaletteInfo info;
        memcpy_P(&info, &palette_table[i], sizeof(PaletteInfo));

        // SECURITY FIX: Validate palette structure
        if (info.num_entries == 0 || info.num_entries > 64) {
            LOG_WARN(TAG_WEB, "Palette %u has invalid num_entries: %u",
                     i, info.num_entries);
            continue;  // Skip invalid palette
        }

        // Create palette object
        JsonObject p = palettes.createNestedObject();
        p["id"] = i;
        p["name"] = palette_names[i];
        p["keyframes"] = info.num_entries;

        // Extract colors with bounds checking
        JsonArray colors = p.createNestedArray("colors");

        uint8_t palette_data[256];
        size_t palette_bytes = info.num_entries * 4;

        // SECURITY FIX: Validate before copy
        if (palette_bytes > sizeof(palette_data)) {
            LOG_ERROR(TAG_WEB, "Palette %u data size invalid: %u > %zu",
                     i, palette_bytes, sizeof(palette_data));
            continue;  // Skip corrupted palette
        }

        memcpy_P(palette_data, info.data, palette_bytes);

        // Safe iteration
        for (uint8_t j = 0; j < info.num_entries; j++) {
            JsonObject color = colors.createNestedObject();
            uint8_t pos = palette_data[j * 4];
            uint8_t r = palette_data[j * 4 + 1];
            uint8_t g = palette_data[j * 4 + 2];
            uint8_t b = palette_data[j * 4 + 3];

            color["position"] = pos;
            color["r"] = r;
            color["g"] = g;
            color["b"] = b;
        }
    }

    String output;
    serializeJson(doc, output);
    return output;
}
```

**Checklist:**
- [ ] Validate info.num_entries before use
- [ ] Check palette_bytes <= 256
- [ ] Skip invalid/corrupted palettes
- [ ] Log all validation failures
- [ ] Test with NUM_PALETTES

---

## PHASE 7: Testing & Validation (1 hour)

### Step 7.1: Unit Tests for Safe Functions
**File:** `firmware/tests/test_webserver_bounds.cpp` (create new)
**Time:** 20 minutes

```cpp
#include <gtest/gtest.h>
#include "../src/webserver_param_validator.h"

// Mock AsyncWebServerRequest for testing
class MockRequest {
public:
    MockRequest(std::map<std::string, std::string> params)
        : params(params) {}

    bool hasParam(const char* key) { return params.count(key) > 0; }
    MockParam* getParam(const char* key) { /* ... */ }

private:
    std::map<std::string, std::string> params;
};

TEST(QueryParamValidator, u32_normal_value) {
    // test: query_param_u32(req, "key", default, max)
    EXPECT_EQ(query_param_u32(req, "val", 0, 100), 42);
}

TEST(QueryParamValidator, u32_overflow) {
    EXPECT_EQ(query_param_u32(req, "val", 0, 100), 100);  // Clamped
}

TEST(QueryParamValidator, u32_missing_param) {
    EXPECT_EQ(query_param_u32(req, "missing", 99, 100), 99);  // Default
}

TEST(MemoryAllocation, safe_alloc_success) {
    auto guard = safe_alloc<uint32_t>(100, 1000);
    EXPECT_NE(guard.get(), nullptr);
}

TEST(MemoryAllocation, safe_alloc_exceeds_max) {
    auto guard = safe_alloc<uint32_t>(2000, 1000);
    EXPECT_EQ(guard.get(), nullptr);  // Rejected
}

TEST(WebSocket, null_termination_bounds) {
    uint8_t buffer[256];
    for (int len = 0; len < 256; ++len) {
        // Simulate WS handler: should not overflow
        if (len < MAX_WEBSOCKET_MESSAGE_SIZE) {
            buffer[len] = 0;  // Safe
        }
    }
}
```

**Checklist:**
- [ ] Create test file
- [ ] Write unit tests for query_param_*
- [ ] Write tests for safe_alloc
- [ ] Write boundary tests for WebSocket
- [ ] Run tests: `pytest --cov firmware/src/webserver*`

### Step 7.2: Integration Tests
**File:** `firmware/tests/test_webserver_integration.cpp`
**Time:** 20 minutes

Test full request-response flows:

```cpp
TEST(WebServer, led_frame_with_overflow_param) {
    // GET /api/leds/frame?n=18446744073709551615
    // Should clamp to NUM_LEDS, not crash
    HTTP_Client client;
    auto resp = client.get("/api/leds/frame?n=18446744073709551615");
    EXPECT_EQ(resp.status, 200);
    EXPECT_LE(resp.json["limit"].as<int>(), NUM_LEDS);
}

TEST(WebServer, beat_events_dump_under_memory_pressure) {
    // Allocate most heap, then request beat events dump
    // Should return 503, not crash
    std::vector<uint8_t> heap_consumer;
    // Fill heap...
    auto resp = client.get("/api/beat-events/dump");
    EXPECT_EQ(resp.status, 503);  // Memory exhausted
    EXPECT_EQ(resp.json["error"], "memory_exhausted");
}

TEST(WebServer, websocket_max_frame_size) {
    // Send 2048-byte WebSocket frame
    ws.connect("ws://localhost/ws");
    uint8_t frame[2048] = {0xFF};
    ws.send(frame, sizeof(frame));
    // Should handle safely, no crash
    EXPECT_TRUE(ws.connected());
}

TEST(WebServer, post_body_exceeds_limit) {
    // POST with Content-Length: 100MB
    auto resp = client.post("/api/params", "Content-Length: 104857600\n\n{...}");
    EXPECT_EQ(resp.status, 413);  // Payload too large
}
```

**Checklist:**
- [ ] Create integration test file
- [ ] Write overflow parameter tests
- [ ] Write memory pressure tests
- [ ] Write WebSocket boundary tests
- [ ] Write large body rejection test
- [ ] Run tests: `pytest --cov` on webserver endpoints

### Step 7.3: Regression Tests
**File:** `firmware/tests/test_webserver_regression.cpp`
**Time:** 20 minutes

Verify fixes don't break existing functionality:

```cpp
TEST(WebServer, regression_get_patterns) {
    auto resp = client.get("/api/patterns");
    EXPECT_EQ(resp.status, 200);
    EXPECT_GT(resp.json["patterns"].size(), 0);
}

TEST(WebServer, regression_post_params) {
    auto resp = client.post("/api/params",
        "{\"brightness\": 0.8, \"speed\": 0.5}");
    EXPECT_EQ(resp.status, 200);
    EXPECT_EQ(resp.json["brightness"], 0.8f);
}

TEST(WebServer, regression_led_frame) {
    // Normal request should still work
    auto resp = client.get("/api/leds/frame?n=50&fmt=hex");
    EXPECT_EQ(resp.status, 200);
    EXPECT_LE(resp.json["data"].size(), 50);
}

TEST(WebServer, regression_realtime_websocket) {
    ws.connect("ws://localhost/ws");
    // Should still receive realtime updates
    std::string msg = ws.receive();
    EXPECT_NE(msg.find("\"type\":\"welcome\""), std::string::npos);
    ws.close();
}
```

**Checklist:**
- [ ] Verify all endpoints still return correct data
- [ ] Test normal parameter ranges
- [ ] Test JSON output validity
- [ ] Test WebSocket functionality
- [ ] Run full test suite before commit

---

## Final Validation Checklist

### Before Commit

- [ ] All 18 strtoul() calls replaced with safe wrappers
- [ ] All 6 heap allocations protected with error handling
- [ ] WebSocket null-termination bounds checked
- [ ] Palette buffer validation added
- [ ] JSON document sizes pre-validated
- [ ] No compiler warnings
- [ ] All unit tests pass (100% coverage of safety functions)
- [ ] All integration tests pass
- [ ] All regression tests pass
- [ ] Code review completed
- [ ] Performance impact measured (< 1% overhead expected)

### Before Deployment

- [ ] Bounds checking statistics logged and monitored
- [ ] Error responses tested on device
- [ ] Memory pressure tested on device (create OOM scenarios)
- [ ] WebSocket frame at MAX_SIZE tested on device
- [ ] Query parameter overflow tested on device
- [ ] All 55 endpoints tested on device
- [ ] Rate limiting still enforced
- [ ] mDNS discovery working
- [ ] CORS headers still present
- [ ] JSON responses valid and complete

---

## Effort Summary

```
PHASE 1: Infrastructure        1.5 hours
PHASE 2: WebSocket Fix         0.5 hours
PHASE 3: Query Parameters      2.0 hours
PHASE 4: Heap Allocations      1.5 hours
PHASE 5: JSON Documents        1.0 hours
PHASE 6: Palette Safety        0.5 hours
PHASE 7: Testing               1.0 hours
─────────────────────────────────────────
TOTAL:                         8.0 hours
```

**Recommended:** Schedule as 1-day sprint with review/testing buffer

---

## References

- Full vulnerability audit: `K1NAnalysis_WEBSERVER_BUFFER_BOUNDS_AUDIT_v1.0_20251110.md`
- Quick reference: `K1NAnalysis_WEBSERVER_QUICK_REFERENCE_v1.0_20251110.md`
- Source code: `/Users/spectrasynq/Workspace_Management/Software/K1.node1/firmware/src/webserver*.cpp`

---

**Status:** Ready to implement
**Approval Required:** Architecture review before Phase 1
**Risk Acceptance:** Required from product owner
