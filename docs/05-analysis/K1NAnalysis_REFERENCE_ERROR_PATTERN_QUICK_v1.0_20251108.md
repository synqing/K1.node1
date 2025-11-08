# Compilation Error Pattern Quick Reference

**Quick diagnosis guide for K1.node1 build failures**

---

## 🔴 CRITICAL: Build-Blocking Errors

### Pattern 1: RMT Type Errors
```
error: 'rmt_channel_handle_t' does not name a type
error: 'rmt_encoder_handle_t' does not name a type
error: 'rmt_encoder_t' does not name a type
error: 'rmt_symbol_word_t' does not name a type
```
**Diagnosis:** ESP-IDF v5.x RMT types missing (code needs v5.1+, platform is v4.4)
**Fix:** Upgrade `platform = espressif32@6.12.0` in `platformio.ini`
**Files:** `led_driver.h`, `led_driver.cpp`, `emotiscope_helpers.cpp`, `main.cpp`

### Pattern 2: I2S Type Errors
```
error: 'i2s_chan_handle_t' does not name a type
error: 'i2s_chan_config_t' has no member named 'role'
```
**Diagnosis:** ESP-IDF v5.x I2S types missing (code needs v5.1+, platform is v4.4)
**Fix:** Upgrade `platform = espressif32@6.12.0` in `platformio.ini`
**Files:** `microphone.h`, `microphone.cpp`, `vu.cpp`

---

## 🟡 SECONDARY: Cascading Errors

### Pattern 3: Type Conflicts
```
error: conflicting declaration 'typedef int gpio_num_t'
note: previous declaration as 'typedef enum gpio_num_t gpio_num_t'
```
**Diagnosis:** Fallback stub conflicts with real ESP-IDF header
**Fix:** Upgrade platform (removes need for stubs) OR remove fallback stubs
**Files:** `microphone.h` line 25

### Pattern 4: Function Not Declared
```
error: 'rmt_transmit' was not declared in this scope
error: 'rmt_tx_wait_all_done' was not declared in this scope
error: 'rmt_new_tx_channel' was not declared in this scope
```
**Diagnosis:** v5.x RMT functions don't exist in v4.4
**Fix:** Upgrade platform OR rewrite with v4.4 functions (`rmt_write_items`, etc.)
**Files:** `led_driver.h` lines 215, 251

---

## 🟢 INFORMATIONAL: Warnings

### Pattern 5: Macro Redefinition
```
warning: "portMAX_DELAY" redefined
note: this is the location of the previous definition
```
**Diagnosis:** Fallback stub redefines FreeRTOS macro (harmless)
**Fix:** Remove fallback stub at `microphone.h` line 91 (optional)
**Impact:** Non-blocking, can be ignored

---

## Diagnosis Flowchart

```
┌─────────────────────────────┐
│ Build fails?                │
└─────────────┬───────────────┘
              │
              ▼
    ┌─────────────────────┐
    │ Check error message │
    └─────────┬───────────┘
              │
      ┌───────┴──────────────────────────────────────────┐
      │                                                   │
      ▼                                                   ▼
┌───────────────────┐                         ┌───────────────────────┐
│ Contains "rmt_*"  │                         │ Contains "i2s_*"      │
│ "does not name a  │                         │ "does not name a type"│
│ type"?            │                         │ or "has no member"?   │
└─────┬─────────────┘                         └─────┬─────────────────┘
      │ YES                                         │ YES
      ▼                                             ▼
┌──────────────────────┐                  ┌──────────────────────┐
│ ROOT CAUSE:          │                  │ ROOT CAUSE:          │
│ ESP-IDF v5.x RMT API │                  │ ESP-IDF v5.x I2S API │
│ missing              │                  │ missing              │
└──────────────────────┘                  └──────────────────────┘
      │                                             │
      └─────────────────┬───────────────────────────┘
                        │
                        ▼
              ┌────────────────────┐
              │ FIX: Upgrade        │
              │ platformio.ini      │
              │ to espressif32@6.12 │
              └────────────────────┘
```

---

## Error Count by File

| File | RMT Errors | I2S Errors | Total |
|------|-----------|-----------|-------|
| `led_driver.h` | 10+ | 0 | 10+ |
| `led_driver.cpp` | 15+ | 0 | 15+ |
| `microphone.h` | 0 | 1 (conflict) | 1 |
| `microphone.cpp` | 0 | 2 | 2 |
| `vu.cpp` | 0 | 1 (cascading) | 1 |
| `emotiscope_helpers.cpp` | 10+ (cascading) | 0 | 10+ |
| `main.cpp` | 10+ (cascading) | 0 | 10+ |
| **TOTAL** | **45+** | **4** | **49+** |

---

## Quick Commands

### Check Platform Version
```bash
cd firmware
grep "^platform" platformio.ini
# If shows: espressif32@5.4.0 → OUTDATED (ESP-IDF v4.4)
# If shows: espressif32@6.12.0 → OK (ESP-IDF v5.1+)
```

### Reproduce Errors
```bash
cd firmware
pio run -e esp32-s3-devkitc-1 2>&1 | grep "error:"
```

### Apply Recommended Fix
```bash
# 1. Edit firmware/platformio.ini line 5
sed -i '' 's/espressif32@5.4.0/espressif32@6.12.0/' platformio.ini

# 2. Clean and rebuild
pio run --target clean
pio run -e esp32-s3-devkitc-1

# Expected: 0 errors
```

---

## Related Documents

- **Full Root Cause Analysis:** `docs/05-analysis/K1NAnalysis_ANALYSIS_COMPILATION_ERROR_ROOT_CAUSE_v1.0_20251108.md`
- **Error Timeline:** `docs/05-analysis/K1NAnalysis_TIMELINE_COMPILATION_ERROR_AND_IMPACT_v1.0_20251108.md`
- **Migration Decision:** `docs/04-planning/K1NPlan_DECISION_ESP_IDF_API_MIGRATION_v1.0_20251108.md`

---

**Last Updated:** 2025-11-06
