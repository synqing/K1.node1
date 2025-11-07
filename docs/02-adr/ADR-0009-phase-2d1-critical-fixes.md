---
title: ADR-0009 - Phase 2D1 Critical Security and Stability Fixes
status: active
date: 2025-11-05
author: Security & Architecture Team
intent: Define and prioritize critical fixes required before production
references:
  - docs/09-reports/AUDIT_SUMMARY_FOR_LEADERSHIP.md
  - ADR-0003-parallel-execution-model.md
---

# ADR-0009: Phase 2D1 Critical Security & Stability Fixes

## Status
**Active** - Implementation begins immediately

## Context

The Phase 2D1 audit identified 4 critical issues that must be fixed before production deployment:

1. **WiFi credentials exposed in git**
2. **I2S timeout causes audio task hang**
3. **WebServer unbounded memory allocation**
4. **No error code infrastructure**

These represent security vulnerabilities and stability risks that could cause field failures.

## Decision

**Execute all 4 critical fixes in Week 1-2 of Phase 2D1.**

### Fix #1: Remove Hardcoded WiFi Credentials (CRITICAL - Day 1)

#### Current State (VULNERABLE)
```cpp
// firmware/src/main.cpp:63-64
const char* ssid = "YourNetworkSSID";      // EXPOSED IN GIT
const char* password = "YourNetworkPassword"; // EXPOSED IN GIT
```

#### Fixed State (SECURE)
```cpp
// firmware/src/network_manager.h
class NetworkManager {
private:
  char ssid[33];
  char password[64];

public:
  void startProvisioning() {
    // Start AP mode for configuration
    WiFi.mode(WIFI_AP);
    WiFi.softAP("K1-Setup", "");  // Open network for setup

    // Web server for credentials
    server.on("/wifi", HTTP_POST, [this](AsyncWebServerRequest* req) {
      if(req->hasParam("ssid") && req->hasParam("password")) {
        strlcpy(ssid, req->getParam("ssid")->value().c_str(), 33);
        strlcpy(password, req->getParam("password")->value().c_str(), 64);
        saveCredentials();  // Store in SPIFFS
        connectToWiFi();
      }
    });
  }

  void loadCredentials() {
    // Load from SPIFFS, never from code
    File f = SPIFFS.open("/wifi.dat", "r");
    if(f) {
      f.readBytes(ssid, 32);
      f.readBytes(password, 63);
      f.close();
    }
  }
};
```

#### Git History Cleanup
```bash
# Remove credentials from git history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch firmware/src/main.cpp' \
  --prune-empty --tag-name-filter cat -- --all

# Force push to all remotes
git push --force --all
git push --force --tags
```

### Fix #2: I2S Timeout Handling (Day 1)

#### Current State (HANGS)
```cpp
// firmware/src/hardware/Microphone.h:195
size_t bytes_read = 0;
esp_err_t result = i2s_read(
  I2S_NUM_0, samples_32bit,
  SAMPLES_SHORT * sizeof(int32_t),
  &bytes_read, portMAX_DELAY  // BLOCKS FOREVER
);
```

#### Fixed State (RECOVERS)
```cpp
// Add timeout and recovery
esp_err_t result = i2s_read(
  I2S_NUM_0, samples_32bit,
  SAMPLES_SHORT * sizeof(int32_t),
  &bytes_read, pdMS_TO_TICKS(100)  // 100ms timeout
);

if(result != ESP_OK || bytes_read == 0) {
  ESP_LOGW(TAG, "I2S timeout, reinitializing");
  errorMgr.reportError(ERROR_I2S_TIMEOUT);

  // Recovery sequence
  i2s_stop(I2S_NUM_0);
  vTaskDelay(pdMS_TO_TICKS(10));
  i2s_start(I2S_NUM_0);

  // Fill with silence
  memset(samples_16bit, 0, SAMPLES_SHORT * sizeof(int16_t));
  return false;  // Signal invalid frame
}
```

### Fix #3: WebServer Memory Bounds (Day 2)

#### Current State (UNBOUNDED)
```cpp
// firmware/src/network/WebServer.h - No limits
String generatePatternList() {
  String json = "[";
  for(auto& pattern : patterns) {
    json += "{\"name\":\"" + pattern.name + "\"},";
  }
  json += "]";
  return json;  // COULD BE HUGE
}
```

#### Fixed State (BOUNDED)
```cpp
// Add memory limits and chunked response
void handlePatternList(AsyncWebServerRequest* request) {
  const size_t MAX_RESPONSE = 4096;  // 4KB limit

  AsyncResponseStream* response = request->beginResponseStream("application/json");
  response->print("[");

  size_t written = 1;
  bool first = true;

  for(auto& pattern : patterns) {
    String item = String(first ? "" : ",") +
                  "{\"name\":\"" + pattern.name + "\"}";

    if(written + item.length() > MAX_RESPONSE) {
      response->print("{\"error\":\"too_many_patterns\"}");
      break;
    }

    response->print(item);
    written += item.length();
    first = false;
  }

  response->print("]");
  request->send(response);
}
```

### Fix #4: Error Code Infrastructure (Day 2)

#### Current State (NO ERROR TRACKING)
```cpp
// Errors lost, no diagnostics
if(something_failed) {
  ESP_LOGE(TAG, "Failed");  // Only in serial console
  return;  // No tracking
}
```

#### Fixed State (FULL TRACKING)
```cpp
// firmware/src/diagnostics/error_manager.h
enum ErrorCode {
  ERROR_NONE = 0,
  ERROR_WIFI_CONNECT = 100,
  ERROR_I2S_TIMEOUT = 200,
  ERROR_I2S_INIT = 201,
  ERROR_MEMORY_ALLOC = 300,
  ERROR_WEB_REQUEST = 400,
  ERROR_PATTERN_INVALID = 500
};

class ErrorManager {
private:
  struct ErrorEntry {
    ErrorCode code;
    uint32_t timestamp;
    uint32_t count;
    char context[32];
  };

  ErrorEntry errors[32];  // Circular buffer
  uint8_t errorIndex = 0;
  SemaphoreHandle_t mutex;

public:
  void reportError(ErrorCode code, const char* context = "") {
    xSemaphoreTake(mutex, portMAX_DELAY);

    errors[errorIndex] = {
      .code = code,
      .timestamp = millis(),
      .count = 1,
    };
    strlcpy(errors[errorIndex].context, context, 32);

    errorIndex = (errorIndex + 1) % 32;
    xSemaphoreGive(mutex);

    ESP_LOGE("ErrorMgr", "Error %d: %s", code, context);
  }

  String getErrorReport() {
    xSemaphoreTake(mutex, portMAX_DELAY);

    StaticJsonDocument<1024> doc;
    JsonArray array = doc.createNestedArray("errors");

    for(int i = 0; i < 32; i++) {
      if(errors[i].code != ERROR_NONE) {
        JsonObject err = array.createNestedObject();
        err["code"] = errors[i].code;
        err["time"] = errors[i].timestamp;
        err["count"] = errors[i].count;
        err["context"] = errors[i].context;
      }
    }

    xSemaphoreGive(mutex);

    String output;
    serializeJson(doc, output);
    return output;
  }
};

// Global instance
ErrorManager errorMgr;

// Diagnostic endpoint
server.on("/api/errors", HTTP_GET, [](AsyncWebServerRequest* req) {
  req->send(200, "application/json", errorMgr.getErrorReport());
});
```

## Validation Requirements

### Each Fix Must Pass

| Fix | Validation Method | Success Criteria |
|-----|------------------|------------------|
| **WiFi Credentials** | Git history check | Zero hardcoded credentials |
| **WiFi Credentials** | Provisioning test | Can configure via AP mode |
| **I2S Timeout** | Stress test | Recovers from disconnection |
| **I2S Timeout** | Long run test | 24 hours without hang |
| **Memory Bounds** | Load test | 1000 requests without OOM |
| **Memory Bounds** | Memory monitor | Heap stays >20KB free |
| **Error Codes** | Injection test | All paths report errors |
| **Error Codes** | API test | /api/errors returns JSON |

### Security Validation

Run security audit after fixes:
```bash
# Check for exposed credentials
grep -r "password\|secret\|key\|token" firmware/

# Check for unbounded allocations
grep -r "malloc\|new\|String +" firmware/

# Check for infinite waits
grep -r "portMAX_DELAY\|while(true)" firmware/
```

## Implementation Timeline

### Day 1 (8 hours)
- **Morning:** WiFi credential removal (2 hours)
- **Morning:** Git history cleanup (1 hour)
- **Afternoon:** I2S timeout fix (2 hours)
- **Afternoon:** Testing both fixes (3 hours)

### Day 2 (8 hours)
- **Morning:** WebServer bounds (3 hours)
- **Morning:** Error infrastructure (3 hours)
- **Afternoon:** Integration testing (2 hours)

### Day 3-5 (Validation)
- Hardware testing on device
- Stress testing
- Security audit
- Performance validation

## Consequences

### Positive
- **Security improved** - No exposed credentials
- **Stability enhanced** - No more hangs
- **Diagnostics enabled** - Error visibility
- **Production ready** - Can deploy safely

### Negative
- **Setup complexity** - Users must provision WiFi
- **Performance impact** - Timeout checks add overhead
- **Memory overhead** - Error tracking uses RAM
- **Migration work** - Existing devices need update

## Review Schedule

- **Day 1 evening:** Fix review
- **Day 2 evening:** Integration review
- **Day 5:** Validation complete
- **Week 2:** Production deployment

## Approval

- **Security:** ✅ Mandatory
- **Architecture:** ✅ Approved
- **QA:** ⏳ Pending validation