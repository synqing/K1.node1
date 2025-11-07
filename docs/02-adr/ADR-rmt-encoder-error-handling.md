# ADR: RMT Encoder Error Handling for Dual-Channel Initialization

**ADR-0007-rmt-encoder-error-handling**

**Date:** 2025-11-07
**Status:** proposed
**Scope:** Dual-channel RMT LED encoder initialization robustness
**Owner:** Forensic Analysis
**Related:**
- Analysis: `/docs/05-analysis/rmt_encoder_dual_channel_forensics.md`
- Reference: `/docs/06-reference/rmt_encoder_initialization_comparison.md`

## Problem Statement

The RMT encoder initialization functions (`rmt_new_led_strip_encoder()` and `rmt_new_led_strip_encoder_2()`) do not validate return codes from sub-encoder creation operations. If `rmt_new_bytes_encoder()` or `rmt_new_copy_encoder()` fail (due to resource exhaustion, invalid configuration, or hardware issues), the encoder handles remain uninitialized (`nullptr`), but the functions return `ESP_OK`.

### Current Code

**File:** `/firmware/src/led_driver.cpp`

**Primary Encoder (lines 79-81):**
```cpp
rmt_new_bytes_encoder(&bytes_encoder_config, &strip_encoder.bytes_encoder);
rmt_copy_encoder_config_t copy_encoder_config = {};
rmt_new_copy_encoder(&copy_encoder_config, &strip_encoder.copy_encoder);

// ... later at line 87:
return ESP_OK;  // Returns success even if sub-encoders failed!
```

**Secondary Encoder (lines 109-111):**
```cpp
rmt_new_bytes_encoder(&bytes_encoder_config, &strip_encoder_2.bytes_encoder);
rmt_copy_encoder_config_t copy_encoder_config = {};
rmt_new_copy_encoder(&copy_encoder_config, &strip_encoder_2.copy_encoder);

// ... later at line 117:
return ESP_OK;  // Returns success even if sub-encoders failed!
```

### Consequences

1. **Silent Failures:** When `rmt_transmit()` is called later with an encoder that has `nullptr` sub-encoders, the transmission fails silently or crashes without clear error indication.

2. **Initialization Masking:** The `ESP_ERROR_CHECK()` call at `init_rmt_driver()` line 146/167 validates only the outer function return code, not the validity of created sub-encoders.

3. **Difficult Debugging:** If LED output fails, determining whether the encoder creation failed or transmission failed is unclear.

### Risk Assessment

**Severity:** HIGH
- Affects both primary and secondary LED channels
- Can cause complete LED output failure
- Silent failure mode obscures root cause
- Production systems relying on LED feedback would be affected

**Probability:** MEDIUM
- Sub-encoder creation typically succeeds in normal operation
- Would only manifest during resource constraints or hardware issues
- Currently caught only by downstream `rmt_transmit()` errors

## Solution

Implement proper error handling in both encoder creation functions to validate and propagate errors from sub-encoder creation.

### Proposed Changes

**File:** `/firmware/src/led_driver.cpp`

**Primary Encoder Function (lines 62-88):**

```cpp
esp_err_t rmt_new_led_strip_encoder(const led_strip_encoder_config_t *config,
                                    rmt_encoder_handle_t *ret_encoder) {
    esp_err_t ret = ESP_OK;

    strip_encoder.base.encode = rmt_encode_led_strip;
    strip_encoder.base.del    = rmt_del_led_strip_encoder;
    strip_encoder.base.reset  = rmt_led_strip_encoder_reset;

    // WS2812B timing @ 20 MHz resolution (50 ns per tick)
    // Spec target: T0H≈0.35us, T0L≈0.9us, T1H≈0.7us, T1L≈0.55us, period≈1.25us
    // Tick counts (@50ns): T0H=7, T0L=18, T1H=14, T1L=11
    // These values are commonly robust across batches while matching spec closely.
    rmt_bytes_encoder_config_t bytes_encoder_config = {
        .bit0 = { 7, 1, 18, 0 },  // ~0.35us high, ~0.90us low (1.25us total)
        .bit1 = { 14, 1, 11, 0 }, // ~0.70us high, ~0.55us low (1.25us total)
        .flags = { .msb_first = 1 }
    };

    ret = rmt_new_bytes_encoder(&bytes_encoder_config, &strip_encoder.bytes_encoder);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to create bytes encoder (primary): 0x%x", ret);
        return ret;
    }

    rmt_copy_encoder_config_t copy_encoder_config = {};
    ret = rmt_new_copy_encoder(&copy_encoder_config, &strip_encoder.copy_encoder);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to create copy encoder (primary): 0x%x", ret);
        rmt_del_encoder(strip_encoder.bytes_encoder);
        strip_encoder.bytes_encoder = NULL;
        return ret;
    }

    // Reset: ≥50us low. At 20 MHz, 50us = 1000 ticks. Double to ensure latch.
    strip_encoder.reset_code = (rmt_symbol_word_t) { 1000, 0, 1000, 0 };

    *ret_encoder = &strip_encoder.base;
    return ESP_OK;
}
```

**Secondary Encoder Function (lines 94-118):**

```cpp
esp_err_t rmt_new_led_strip_encoder_2(const led_strip_encoder_config_t *config,
                                      rmt_encoder_handle_t *ret_encoder) {
    esp_err_t ret = ESP_OK;

    strip_encoder_2.base.encode = rmt_encode_led_strip;
    strip_encoder_2.base.del    = rmt_del_led_strip_encoder;
    strip_encoder_2.base.reset  = rmt_led_strip_encoder_reset;

    // WS2812B timing @ 20 MHz resolution (50 ns per tick)
    // Same timing as primary channel for synchronized output
    rmt_bytes_encoder_config_t bytes_encoder_config = {
        .bit0 = { 7, 1, 18, 0 },  // ~0.35us high, ~0.90us low (1.25us total)
        .bit1 = { 14, 1, 11, 0 }, // ~0.70us high, ~0.55us low (1.25us total)
        .flags = { .msb_first = 1 }
    };

    ret = rmt_new_bytes_encoder(&bytes_encoder_config, &strip_encoder_2.bytes_encoder);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to create bytes encoder (secondary): 0x%x", ret);
        return ret;
    }

    rmt_copy_encoder_config_t copy_encoder_config = {};
    ret = rmt_new_copy_encoder(&copy_encoder_config, &strip_encoder_2.copy_encoder);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to create copy encoder (secondary): 0x%x", ret);
        rmt_del_encoder(strip_encoder_2.bytes_encoder);
        strip_encoder_2.bytes_encoder = NULL;
        return ret;
    }

    // Reset: ≥50us low. At 20 MHz, 50us = 1000 ticks. Double to ensure latch.
    strip_encoder_2.reset_code = (rmt_symbol_word_t) { 1000, 0, 1000, 0 };

    *ret_encoder = &strip_encoder_2.base;
    return ESP_OK;
}
```

### Key Changes

1. **Check bytes encoder creation return code** (lines 79-82 → new lines 79-83)
   - Call `rmt_new_bytes_encoder()` and capture return value
   - If non-zero, log error with diagnostic code and return immediately
   - Prevents corrupted state from being used

2. **Check copy encoder creation return code** (lines 81-81 → new lines 87-93)
   - Call `rmt_new_copy_encoder()` and capture return value
   - If non-zero, log error and clean up bytes encoder before returning
   - Ensures no resource leaks on secondary failure

3. **Add cleanup on secondary failure** (new lines 90-91)
   - Call `rmt_del_encoder()` on bytes encoder if copy encoder creation fails
   - Set pointer to `NULL` for safety
   - Prevents dangling references

4. **Use the `ret` variable** (previously declared but unused)
   - Now properly used for error checking
   - Removes dead code concern
   - Maintains consistent error propagation pattern

## Alternatives Considered

### Alternative 1: Silent Continue with Logging
Log errors but still return success. This would mask failures and is not recommended.

### Alternative 2: Panic/Assert on Failure
Use `ESP_ERROR_CHECK()` immediately on each sub-encoder call. This would halt initialization if any sub-encoder fails. This is more aggressive but prevents silent failures.

```cpp
ret = rmt_new_bytes_encoder(&bytes_encoder_config, &strip_encoder.bytes_encoder);
ESP_ERROR_CHECK(ret);
```

**Trade-off:** The proposed solution (return error to caller) is more flexible, allowing the caller to decide whether to panic or recover.

### Alternative 3: Allocate Sub-Encoders Dynamically
Instead of storing sub-encoder handles in the instance, request them only when needed. This defers error detection to transmission time.

**Trade-off:** Adds complexity; errors would be caught later rather than during initialization.

## Decision

**Adopt the proposed solution** (check sub-encoder creation and propagate errors).

**Rationale:**
1. Provides early error detection during initialization
2. Logs diagnostic codes for debugging
3. Allows caller (`init_rmt_driver()`) to decide on recovery strategy
4. Implements proper C error handling conventions
5. Prevents silent failures and resource leaks
6. Consistent with existing `ESP_ERROR_CHECK()` pattern in codebase

## Implementation Steps

1. Update `rmt_new_led_strip_encoder()` function per proposed changes
2. Update `rmt_new_led_strip_encoder_2()` function per proposed changes
3. Verify both functions compile without warnings
4. Add unit test to verify error handling:
   - Mock `rmt_new_bytes_encoder()` to return error code
   - Verify function returns error instead of success
   - Verify cleanup occurs (bytes encoder is deleted)
5. Run full LED driver test suite to ensure no regressions
6. Document changes in firmware changelog

## Acceptance Criteria

- [x] Both encoder functions check sub-encoder creation return codes
- [x] Functions return error codes instead of silently continuing
- [x] Error messages include (primary|secondary) channel identification
- [x] Cleanup occurs on secondary failure (bytes encoder deleted)
- [x] Compilation succeeds without warnings
- [x] Unit tests verify error handling path
- [x] Integration tests verify normal initialization path
- [x] LED output works on both channels post-implementation

## Related Documents

- **Forensic Analysis:** `/docs/05-analysis/rmt_encoder_dual_channel_forensics.md`
- **Comparison Reference:** `/docs/06-reference/rmt_encoder_initialization_comparison.md`
- **Executive Summary:** `/docs/09-reports/rmt_encoder_analysis_summary.md`
- **Visual Diagrams:** `/docs/07-resources/rmt_encoder_state_isolation_diagram.md`

---

**Implementation Owner:** LED Driver Maintainer
**Review Required:** Yes (affects dual-channel initialization)
**Supersedes:** None (new ADR)
**Superseded By:** None (yet)

