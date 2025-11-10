# Error Code Subsystem Modernization Playbook (Technical Edition)

**Audience:** Multi-agent implementation squad (firmware, tooling, telemetry, docs). This version is intentionally verbose—every section includes concrete file paths, sample commands, payloads, and acceptance tests so a cold-start engineer can execute the plan without tribal knowledge.

---

## 0. Background & Constraints
### 0.1 Current State
- Registry lives in `firmware/src/error_codes.cpp/.h` as a hand-authored array.
- Only `webserver_bounds.*`, `spi_led_driver.cpp`, and parts of `audio/microphone.cpp` reference codes.
- Docs (`docs/09-implementation/ERROR_CODE_REGISTRY.md`) describe .env-based WiFi config that no longer exists.
- REST endpoints (`/api/device/*`, `/api/wifi/*`) return plain strings, no `error_code` payloads.
- Telemetry heartbeat packets omit error metadata.

### 0.2 Constraints
- Firmware target: ESP32-S3 (Flash ~16MB, RAM limited). Generated tables must be `const` to reside in flash.
- Build system: PlatformIO + CMake; generator must hook into `pio run` without manual steps.
- Legacy automation expects 8-bit codes; transition plan must maintain compatibility (e.g., alias top 0-255 while introducing 16-bit representation internally).

### 0.3 Desired End-State
- Single source of truth (YAML) for all error metadata.
- All major subsystems raise structured error codes via helper API.
- REST/WebSocket/telemetry surfaces emit standardized JSON with severity, recovery actions, cause/remediation.
- Documentation auto-generated; ops runbooks link to code references.
- CI enforces schema validity and usage coverage.

---

## 1. Deliverable Overview
| ID | Deliverable | Description | Owner | Acceptance Criteria |
|----|-------------|-------------|-------|---------------------|
| D1 | Structured registry source | `registry/error_codes.yaml` + JSON schema | Tooling | `make verify-error-registry` passes; schema validated; generator consumes file |
| D2 | Generated firmware tables | `firmware/src/generated/error_codes.inc` auto-emitted | Tooling/Firmware | Manual table removed; `pio run` regenerates w/out diff |
| D3 | Helper API + tests | `error_reporting.{h,cpp}` helpers + `test_error_registry` | Firmware | Helper API used by subsystems; tests pass |
| D4 | Subsystem adoption | WiFi, provisioning, cert manager, stateful nodes, graph runtime, etc. mapped to codes | Firmware | Each subsystem has mapping matrix + tests/logs |
| D5 | Telemetry/Web integration | REST, WebSocket, heartbeat, dashboards updated | Telemetry/Web | Payloads validated; metrics flow to Grafana |
| D6 | Docs & Ops | Auto-generated tables + playbooks + CI lint | Docs/Ops | Docs build clean; ops sign-off |

---

## 2. Work Breakdown Structure (Detailed)
### 2.1 Tooling (D1 + D2)
#### 2.1.1 Schema Definition
- File: `docs/schema/error_codes.schema.json`
- Sample excerpt:
  ```json
  {
    "$id": "https://k1.node1/schema/error-codes",
    "type": "object",
    "properties": {
      "errors": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["code", "name", "subsystem", "severity", "recovery"],
          "properties": {
            "code": { "type": "string", "pattern": "^0x[0-9A-Fa-f]{4}$" },
            "name": { "type": "string", "pattern": "^ERR_[A-Z0-9_]+$" },
            "subsystem": { "type": "string" },
            "severity": { "enum": ["INFO","LOW","MEDIUM","HIGH","CRITICAL"] },
            "recovery": { "enum": ["IGNORE","LOG","RETRY","FALLBACK","RESET","REBOOT"] },
            "cause": { "type": "string" },
            "remediation": { "type": "string" },
            "references": { "type": "array", "items": { "type": "string" } }
          }
        }
      }
    }
  }
  ```

#### 2.1.2 Registry Source (`registry/error_codes.yaml`)
- Structure:
  ```yaml
  errors:
    - code: 0x0000
      name: ERR_OK
      subsystem: core
      title: Operation successful
      severity: INFO
      recovery: IGNORE
      cause: No error
      remediation: N/A
      references:
        - firmware/src/error_reporting.cpp:log_success
    - code: 0x0101
      name: ERR_WIFI_AP_START_FAIL
      subsystem: wifi.provisioning
      title: SoftAP failed to start
      severity: HIGH
      recovery: FALLBACK
      cause: esp_wifi_start_softap returned error
      remediation: Reboot device; verify 2.4GHz band available
      references:
        - firmware/src/wifi_monitor.cpp:enable_ap_fallback
  ```
- Subsystem high byte plan:
  | High Byte | Subsystem |
  |-----------|-----------|
  | 0x00 | Core / Generic |
  | 0x01 | WiFi / Provisioning |
  | 0x02 | Certificate & Security |
  | 0x03 | Web server / HTTP |
  | 0x04 | OTA / Firmware update |
  | 0x05 | Audio / I2S |
  | 0x06 | LED / RMT |
  | 0x07 | Storage / NVS / SPIFFS |
  | 0x08 | Stateful Nodes |
  | 0x09 | Graph Runtime / Codegen |
  | 0x0A | Telemetry / Diagnostics |

#### 2.1.3 Generator (`tools/codegen/generate_error_registry.py`)
- Responsibilities:
  - Validate YAML vs schema (`jsonschema` module).
  - Emit `firmware/src/generated/error_codes.inc` like:
    ```cpp
    static constexpr ErrorMetadata kErrorRegistry[] PROGMEM = {
        {ErrorCode::ERR_OK, "ERR_OK", "Operation successful", ErrorSeverity::Info, ErrorRecovery::Ignore, "No error", "N/A", "core"},
        ...
    };
    ```
  - Emit `docs/09-implementation/generated/ERROR_CODE_TABLE.md` with Markdown table.
  - Emit `webapp/src/generated/errorCodes.ts`:
    ```ts
    export const ERROR_REGISTRY: Record<ErrorCode, ErrorMetadata> = {
      0x0101: { name: 'ERR_WIFI_AP_START_FAIL', subsystem: 'wifi.provisioning', ... }
    }
    ```
- CLI usage:
  ```bash
  $ python tools/codegen/generate_error_registry.py \
      --yaml registry/error_codes.yaml \
      --schema docs/schema/error_codes.schema.json \
      --out-cpp firmware/src/generated/error_codes.inc \
      --out-md docs/09-implementation/generated/ERROR_CODE_TABLE.md \
      --out-ts webapp/src/generated/errorCodes.ts
  ```

#### 2.1.4 Build Integration
- Add PlatformIO extra script `tools/scripts/pre_build_error_registry.py` to run generator before compilation.
- Update `CMakeLists.txt` to include generated `.inc`:
  ```cmake
  target_sources(firmware PRIVATE src/error_codes.cpp src/generated/error_codes.inc)
  ```
- CI job `make verify-error-registry`:
  ```bash
  python tools/codegen/generate_error_registry.py ...
  git diff --exit-code firmware/src/generated docs/09-implementation/generated webapp/src/generated
  ```

**Tooling Acceptance Tests**
- `pytest tools/codegen/tests` covering schema validation, generation, and error handling.
- Manual run: delete generated files, run `pio run` → build should recreate files without manual steps.

---

### 2.2 Firmware Core (D2 + D3)
#### 2.2.1 Enum + Helper API
- Files: `firmware/src/error_codes.h`, `firmware/src/error_codes.cpp`, new `firmware/src/error_reporting.{h,cpp}`.
- API outline:
  ```cpp
  enum class ErrorSubsystem : uint8_t { Core = 0x00, Wifi = 0x01, ... };
  enum class ErrorCode : uint16_t {
      ERR_OK = 0x0000,
      ERR_WIFI_AP_START_FAIL = 0x0101,
      ...
  };

  struct ErrorReport {
      ErrorCode code;
      const ErrorMetadata* meta;
      uint32_t timestamp_ms;
      const char* context;
  };

  ErrorReport error_raise(ErrorCode code, const char* context);
  void error_log(ErrorCode code, const char* fmt, ...);
  const ErrorMetadata* lookup_error(ErrorCode code);
  size_t error_to_json(ErrorCode code, char* buf, size_t len);
  ```
- Implementation detail: `error_raise` should update global `last_error_code`, increment counters, and optionally notify telemetry hooks (`error_telemetry_dispatch(report)` delegate).
- Macros:
  ```cpp
  #define RETURN_ERROR(code) return error_raise(code, __func__)
  #define CHECK_OR_RAISE(cond, code) do { if (!(cond)) RETURN_ERROR(code); } while (0)
  ```

#### 2.2.2 Unit Tests
- New suite `firmware/test/test_error_registry/test_error_registry.cpp`
  - Cases: `lookup_error` returns metadata; unknown codes fallback to `ERR_UNKNOWN` entry; JSON serialization includes severity/recovery strings.
  - Example test snippet:
    ```cpp
    void test_error_to_json() {
        char buf[256];
        size_t len = error_to_json(ErrorCode::ERR_WIFI_AP_START_FAIL, buf, sizeof(buf));
        TEST_ASSERT_GREATER_THAN(0, len);
        TEST_ASSERT_NOT_NULL(strstr(buf, "ERR_WIFI_AP_START_FAIL"));
        TEST_ASSERT_NOT_NULL(strstr(buf, "FALLBACK"));
    }
    ```
- Run via `pio test -e esp32-s3-devkitc-1 -f test_error_registry`.

#### 2.2.3 Acceptance Criteria
- `error_codes.cpp` no longer contains manual array; includes generated `.inc`.
- All firmware modules compile using `ErrorCode` enums; `git grep ERR_` returns only definitions and relevant uses (no stray ints).
- Unit tests added to CI.

---

### 2.3 Subsystem Adoption (D4)
For each subsystem, create a **mapping matrix** plus code injection points. Provide failure simulation steps and expected log/telemetry outputs.

#### 2.3.1 WiFi Monitor / Provisioning
- Files: `firmware/src/wifi_monitor.cpp`, `wifi_monitor.h`
- Scenarios & Codes:
  | Condition | Function | ErrorCode | Severity | Recovery | Notes |
  |-----------|----------|-----------|----------|----------|-------|
  | No credentials in NVS | `wifi_monitor_init` | `ERR_WIFI_NO_CREDENTIALS` | HIGH | FALLBACK | Immediately trigger AP fallback |
  | SoftAP start failure | `start_ap_fallback_if_needed` | `ERR_WIFI_AP_START_FAIL` | HIGH | FALLBACK | Provide cause (`esp_err_t`)
  | Credential cooldown triggered | `wifi_monitor_update_credentials` | `ERR_WIFI_COOLDOWN_ACTIVE` | MEDIUM | LOG | Include remaining ms |
  | Certificate provisioning parse error | new path | `ERR_WIFI_CERT_PARSE_FAIL` | HIGH | LOG | Link to certificate manager |
- Implementation snippet:
  ```cpp
  esp_err_t err = WiFi.softAP(ap_ssid, "k1setup123");
  if (err != ESP_OK) {
      auto report = error_raise(ErrorCode::ERR_WIFI_AP_START_FAIL, __func__);
      LOG_ERROR(TAG_WIFI, "[%s] SoftAP failed: %s", report.meta->name, esp_err_to_name(err));
      return;
  }
  ```
- Testing:
  - Use ESP-IDF’s WiFi stubs or run device with radio disabled to force AP start failure.
  - Capture logs; ensure `ERR_WIFI_AP_START_FAIL` appears and telemetry increments counters.

#### 2.3.2 Certificate / Network Security Module
- Files: `firmware/src/network_security_module.*`, `advanced_wifi_manager.*`
- New codes: `ERR_CERT_INVALID_CHAIN`, `ERR_CERT_EXPIRED`, `ERR_RADIUS_TIMEOUT`, `ERR_RADIUS_AUTH_FAIL`.
- Telemetry: integrate with `SecurityEvent` system so events include `error_code`.
- Testing: use test certificates (expired/invalid) to trigger errors; confirm code in logs and REST responses.

#### 2.3.3 Web Server / HTTP
- Files: `firmware/src/webserver.cpp`, `webserver_response_builders.cpp`, `webserver_bounds.cpp`
- Add middleware `error_response(RequestContext&, ErrorCode code)` that wraps JSON via `error_to_json`.
- Example usage:
  ```cpp
  if (!body.containsKey("ssid")) {
      return ctx.sendJson(400, build_error_payload(ErrorCode::ERR_HTTP_BODY_INVALID));
  }
  ```
- Ensure endpoints `/api/wifi/credentials`, `/api/wifi/certificate/upload`, `/api/ota/update` map all failure modes.
- REST tests: create Postman suite verifying response body includes `error.code`, `error.name`, etc.

#### 2.3.4 OTA / Firmware
- Files: `firmware/src/main.cpp` (OTA init), `ota_manager.cpp`
- Map OTA steps to codes: `ERR_OTA_INIT_FAILED`, `ERR_OTA_WRITE_FAILED`, etc.
- Add instrumentation to OTA tasks; ensure error codes propagate to front-end.
- Testing: simulate OTA failure by injecting invalid image; verify `error_code` surfaces.

#### 2.3.5 Audio / I2S
- Files: `firmware/src/audio/microphone.cpp`
- Align timeouts: set `pdMS_TO_TICKS(20)` and map to `ERR_I2S_READ_TIMEOUT` with severity HIGH, recovery FALLBACK.
- Test update: `firmware/test/test_fix2_i2s_timeout/test_i2s_timeout.cpp` should assert `error_raise` invoked.

#### 2.3.6 LED / RMT
- Already using error codes; update to new helper API.

#### 2.3.7 Stateful Nodes
- Files: `firmware/src/stateful_nodes.cpp/h`
- Codes: `ERR_STATEFUL_NODE_ALLOC_FAIL`, `ERR_STATEFUL_NODE_INTEGRITY_FAIL`, `ERR_STATEFUL_NODE_RESET_REQUIRED`.
- Provide detection logic in `stateful_nodes_validate()`.

#### 2.3.8 Graph Runtime (Future-proof)
- Files: `firmware/src/graph_codegen/*`
- Placeholder codes for missing runtime features: `ERR_GRAPH_COMPILER_NOT_READY`, `ERR_GRAPH_NODE_TYPE_UNKNOWN`.
- Document these as TODO but include in YAML to prevent collisions later.

**Acceptance:** For each subsystem, attach log excerpts and, if possible, unit/integration tests demonstrating code emission. Maintain `docs/09-implementation/error-playbooks/<subsystem>.md` mapping.

---

### 2.4 Telemetry & Web Integration (D5)
#### 2.4.1 REST Responses
- Modify `webserver_response_builders.cpp` to include helper:
  ```cpp
  String build_error_payload(ErrorCode code) {
      char buf[256];
      error_to_json(code, buf, sizeof(buf));
      return String(buf);
  }
  ```
- Example response for `/api/wifi/credentials` failure:
  ```json
  {
    "status": "error",
    "error_code": 0x0102,
    "error": {
      "code": 258,
      "name": "ERR_WIFI_CERT_PARSE_FAIL",
      "message": "Certificate parsing failed",
      "severity": "HIGH",
      "recovery_action": "LOG",
      "cause": "PEM parser rejected input",
      "remediation": "Upload valid X.509 PEM chain"
    }
  }
  ```
- Update API docs (`docs/06-reference/api/*.md`) with new payload contract.

#### 2.4.2 WebSocket Diagnostics
- Extend diagnostics broadcaster to include `last_error_code` and `recent_errors` array.
- Sample WS message:
  ```json
  {
    "type": "error_event",
    "timestamp": 1731264000000,
    "error_code": 0x0101,
    "name": "ERR_WIFI_AP_START_FAIL",
    "context": "start_ap_fallback_if_needed",
    "subsystem": "wifi.provisioning"
  }
  ```
- Update webapp components (`webapp/src/components/analysis/ErrorPanel.tsx`) to display severity badges.

#### 2.4.3 Heartbeat Telemetry
- Extend heartbeat struct (likely `firmware/src/diagnostics/heartbeat_logger.cpp`) to include:
  ```cpp
  struct HeartbeatPacket {
      uint32_t uptime_ms;
      float fps;
      uint32_t heap_free;
      ErrorCode last_error_code;
      uint32_t error_count_total;
      uint32_t error_count_critical;
  };
  ```
- Update ingestion pipeline (Grafana Loki/Prom) to parse new fields. Provide sample Prom query:
  ```promql
  sum by (error_code) (increase(device_last_error_code{device="k1-node"}[1h]))
  ```

#### 2.4.4 Monitoring Assets
- Create Grafana dashboard JSON under `ops/grafana/error-telemetry-dashboard.json` with panels:
  - Top error codes (bar chart)
  - Error counts over time (line)
  - Critical errors heatmap
- Provide alert rule snippet:
  ```yaml
  title: "WiFi AP Start Failures"
  condition: sum_over_time(device_error_code{code="0x0101"}[5m]) > 3
  ```

**Acceptance:** Run manual failure to confirm REST, WS, telemetry, Grafana surfaces show consistent code/metadata.

---

### 2.5 Documentation & Ops (D6)
#### 2.5.1 Auto-generated Docs
- Replace manual table with include:
  ```md
  <!-- AUTO-GENERATED: DO NOT EDIT -->
  {% include_relative generated/ERROR_CODE_TABLE.md %}
  ```
- Document generation command in `docs/README.md`:
  ```bash
  make docs-error-registry
  ```

#### 2.5.2 Playbooks & SOPs
- Directory: `docs/09-implementation/error-playbooks/`
- Example file `wifi-provisioning.md`:
  ```md
  ## ERR_WIFI_AP_START_FAIL (0x0101)
  - **Detected in:** `wifi_monitor.cpp:start_ap_fallback_if_needed`
  - **Log signature:** `[ERR_WIFI_AP_START_FAIL] SoftAP failed: ESP_ERR_INVALID_STATE`
  - **Telemetry:** `device_last_error_code` gauge increments
  - **Immediate actions:** Reboot device; check RF environment; verify AP fallback SSID
  - **Escalation:** Contact Firmware On-call if >3 occurrences in 5 minutes
  ```

#### 2.5.3 CI Validation
- Script `tools/scripts/verify_error_code_usage.py`:
  - Parse registry YAML.
  - `git grep` each code name; ensure at least one usage (or mark as `reserved: true`).
  - Fail CI if unused/undocumented.
- Add pre-commit hook to reject manual edits inside generated doc sections.

#### 2.5.4 Ops Enablement
- Update `ops/runbooks/error-response.md` with new telemetry flows.
- Schedule training session; capture recording/link for reference.

**Acceptance:**
- `make docs` produces updated registry + playbooks; `git status` clean.
- CI job `lint:err-registry` ensures no drift.
- Ops lead acknowledges training complete.

---

## 3. Timeline (Suggested)
| Week | Tasks |
|------|-------|
| 1 | Schema + YAML drafted; generator skeleton committed; CI job stub |
| 2 | Generator fully functional; helper API + tests merged |
| 3 | WiFi + WebServer subsystems migrated; doc auto-generation integrated |
| 4 | Remaining subsystems + telemetry/WebSocket integration; Grafana dashboards live |
| 5 | Documentation finalization; ops training; final audit + sign-off |

Parallelization tips:
- Tooling + firmware helper work can happen concurrently with doc automation.
- Subsystem adoption can proceed in waves (WiFi/web first, then security/OTA, then stateful nodes/graph).

---

## 4. Verification & Sign-off Checklist
- [ ] `python tools/codegen/generate_error_registry.py ...` run produces no diff.
- [ ] `pio test -e esp32-s3-devkitc-1 -f test_error_registry` passes in CI.
- [ ] WiFi provisioning failure logs show `[ERR_WIFI_AP_START_FAIL]` and telemetry increments.
- [ ] REST endpoint `/api/wifi/credentials` returns error payload with `error_code` when invalid body provided.
- [ ] WebSocket diagnostics stream emits error events; UI displays badges.
- [ ] Grafana dashboard panel verifies with simulated errors.
- [ ] `docs/09-implementation/generated/ERROR_CODE_TABLE.md` matches YAML.
- [ ] Ops playbooks updated; training recorded and linked.
- [ ] Release notes mention subsystem overhaul.

---

## 5. Reference Commands & Snippets
- Run generator manually:
  ```bash
  python tools/codegen/generate_error_registry.py --yaml registry/error_codes.yaml \
      --schema docs/schema/error_codes.schema.json \
      --out-cpp firmware/src/generated/error_codes.inc \
      --out-md docs/09-implementation/generated/ERROR_CODE_TABLE.md \
      --out-ts webapp/src/generated/errorCodes.ts
  ```
- Run firmware tests:
  ```bash
  cd firmware
  pio test -e esp32-s3-devkitc-1 -f test_error_registry
  ```
- Simulate WiFi AP failure (device shell):
  ```cpp
  WiFi.softAPdisconnect(true); // disable AP
  // Force SoftAP failure by setting invalid channel before calling wifi_monitor
  ```
- REST validation (curl):
  ```bash
  curl -X POST http://k1-node.local/api/wifi/credentials \
       -H 'Content-Type: application/json' \
       -d '{"ssid":123}' | jq
  ```

---

## 6. Contacts
- **Tooling**: @registry-bot maintainer (#firmware-tooling)
- **Firmware**: Platform lead @spectrasynq (#firmware-platform)
- **Telemetry**: @monitoring-guild (#telemetry)
- **Docs/Ops**: @knowledge-base (#ops-runbooks)

---

## 7. Next Actions
1. Assign D1–D6 owners in Taskmaster; link this doc as canonical spec.
2. Schedule schema design review (include WiFi/security stakeholders to finalize subsystem IDs).
3. Kick off implementation per timeline; hold weekly checkpoint reviewing checklist progress.
