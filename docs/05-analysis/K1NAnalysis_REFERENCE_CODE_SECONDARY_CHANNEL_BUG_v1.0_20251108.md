# Code Reference: Secondary LED Channel Bug - Exact Locations

**File**: `/firmware/src/led_driver.cpp`
**File**: `/firmware/src/led_driver.h`

---

## THE BUG LOCATIONS

### Bug #1: Shared Encode Function Pointer (PRIMARY)

**File**: `/firmware/src/led_driver.cpp`
**Lines**: 65-67

```cpp
esp_err_t rmt_new_led_strip_encoder(const led_strip_encoder_config_t *config, rmt_encoder_handle_t *ret_encoder) {
    esp_err_t ret = ESP_OK;

    strip_encoder.base.encode = rmt_encode_led_strip;         // ✅ Correct - primary only
    strip_encoder.base.del    = rmt_del_led_strip_encoder;
    strip_encoder.base.reset  = rmt_led_strip_encoder_reset;

    // ... rest of initialization
    *ret_encoder = &strip_encoder.base;
    return ESP_OK;
}
```

---

### Bug #2: Shared Encode Function Pointer (SECONDARY) - THE CRITICAL LINE

**File**: `/firmware/src/led_driver.cpp`
**Line**: 97 ← **THIS IS THE BUG**

```cpp
esp_err_t rmt_new_led_strip_encoder_2(const led_strip_encoder_config_t *config, rmt_encoder_handle_t *ret_encoder) {
    esp_err_t ret = ESP_OK;

    strip_encoder_2.base.encode = rmt_encode_led_strip;       // ❌ BUG - SAME FUNCTION!
    strip_encoder_2.base.del    = rmt_del_led_strip_encoder;
    strip_encoder_2.base.reset  = rmt_led_strip_encoder_reset;

    // ... rest of initialization
    *ret_encoder = &strip_encoder_2.base;
    return ESP_OK;
}
```

**Problem**: Both `strip_encoder.base.encode` and `strip_encoder_2.base.encode` point to the same static function `rmt_encode_led_strip()`. This causes state machine collision.

---

## THE SHARED ENCODE FUNCTION

**File**: `/firmware/src/led_driver.h`
**Lines**: 122-155

```cpp
IRAM_ATTR static size_t rmt_encode_led_strip(
    rmt_encoder_t *encoder,
    rmt_channel_handle_t channel,
    const void *primary_data,
    size_t data_size,
    rmt_encode_state_t *ret_state
){
    rmt_led_strip_encoder_t *led_encoder = __containerof(encoder, rmt_led_strip_encoder_t, base);
    rmt_encoder_handle_t bytes_encoder = led_encoder->bytes_encoder;
    rmt_encoder_handle_t copy_encoder = led_encoder->copy_encoder;
    rmt_encode_state_t session_state = RMT_ENCODING_RESET;
    rmt_encode_state_t state = RMT_ENCODING_RESET;
    size_t encoded_symbols = 0;

    switch (led_encoder->state) {                              // <-- STATE MACHINE (danger zone)
    case 0: // send RGB data
        encoded_symbols += bytes_encoder->encode(bytes_encoder, channel, primary_data, data_size, &session_state);
        if (session_state & RMT_ENCODING_COMPLETE) {
            led_encoder->state = 1;                            // <-- STATE MODIFICATION (primary)
        }
        if (session_state & RMT_ENCODING_MEM_FULL) {
            state = (rmt_encode_state_t)(state | (uint32_t)RMT_ENCODING_MEM_FULL);
            goto out;
        }
    // fall-through
    case 1: // send reset code
        encoded_symbols += copy_encoder->encode(copy_encoder, channel, &led_encoder->reset_code,
                                                sizeof(led_encoder->reset_code), &session_state);
        if (session_state & RMT_ENCODING_COMPLETE) {
            led_encoder->state = RMT_ENCODING_RESET;           // <-- STATE MODIFICATION (secondary)
            state = (rmt_encode_state_t)(state | (uint32_t)RMT_ENCODING_COMPLETE);
        }
        if (session_state & RMT_ENCODING_MEM_FULL) {
            state = (rmt_encode_state_t)(state | (uint32_t)RMT_ENCODING_MEM_FULL);
            goto out;
        }
    }
out:
    *ret_state = state;
    return encoded_symbols;
}
```

**Problem**: When both primary and secondary call this function, the __containerof() macro extracts the correct encoder struct, BUT if timing is bad, the state machine can be corrupted.

---

## TRANSMISSION CALLS - BOTH CHANNELS

**File**: `/firmware/src/led_driver.h`
**Lines**: 272-274

```cpp
// Transmit to primary strip (GPIO 5)
esp_err_t tx_ret = rmt_transmit(tx_chan, led_encoder, raw_led_data, NUM_LEDS*3, &tx_config);

// Transmit to secondary strip (GPIO 4) - simultaneous, non-blocking
esp_err_t tx_ret_2 = rmt_transmit(tx_chan_2, led_encoder_2, raw_led_data, NUM_LEDS*3, &tx_config);
```

**How It Goes Wrong**:
1. `rmt_transmit(tx_chan, led_encoder, ...)` internally calls `led_encoder->encode()`
2. `led_encoder->encode` points to `rmt_encode_led_strip`
3. Function modifies `strip_encoder.state`
4. `rmt_transmit(tx_chan_2, led_encoder_2, ...)` internally calls `led_encoder_2->encode()`
5. `led_encoder_2->encode` ALSO points to `rmt_encode_led_strip` (same function!)
6. If called before primary's state machine completes, secondary sees corrupted state
7. Secondary encoding fails or produces invalid symbols
8. GPIO 4 gets no signal

---

## GLOBAL STATE VARIABLES

**File**: `/firmware/src/led_driver.cpp`
**Lines**: 25-30

```cpp
// RMT globals (shared declarations so header externs stay valid)
// Dual output: GPIO 5 (primary) and GPIO 4 (secondary)
rmt_channel_handle_t tx_chan = NULL;        // Primary channel handle
rmt_channel_handle_t tx_chan_2 = NULL;      // Secondary channel handle ✅ OK
rmt_encoder_handle_t led_encoder = NULL;    // Primary encoder handle
rmt_encoder_handle_t led_encoder_2 = NULL;  // Secondary encoder handle ✅ OK

rmt_led_strip_encoder_t strip_encoder{};    // Primary encoder struct ✅ OK
rmt_led_strip_encoder_t strip_encoder_2{};  // Secondary encoder struct ✅ OK
```

**Assessment**: Structs are distinct, handles are correct. **Problem is only the function pointers within these structs.**

---

## ENCODER STRUCT DEFINITION

**File**: `/firmware/src/led_driver.h`
**Lines**: 93-99

```cpp
typedef struct {
    rmt_encoder_t base;                  // Base encoder interface
    rmt_encoder_t *bytes_encoder;        // Sub-encoder for byte encoding
    rmt_encoder_t *copy_encoder;         // Sub-encoder for reset code
    int state;                           // ✅ State variable (separate for each encoder)
    rmt_symbol_word_t reset_code;        // Reset code (separate for each encoder)
} rmt_led_strip_encoder_t;
```

**Assessment**: Struct definition is correct. Each instance has its own state. **But the function pointers are shared**, which breaks the state machine separation.

---

## THE FIX - REQUIRED CHANGES

### Change 1: Add New Encoder Function (After line 155 in led_driver.cpp)

```cpp
// Separate encode function for secondary channel
// Prevents state machine collision when both channels transmit simultaneously
IRAM_ATTR static size_t rmt_encode_led_strip_2(
    rmt_encoder_t *encoder,
    rmt_channel_handle_t channel,
    const void *primary_data,
    size_t data_size,
    rmt_encode_state_t *ret_state
){
    // IDENTICAL IMPLEMENTATION TO rmt_encode_led_strip()
    // (See lines 122-155 in led_driver.h for reference)
    rmt_led_strip_encoder_t *led_encoder = __containerof(encoder, rmt_led_strip_encoder_t, base);
    rmt_encoder_handle_t bytes_encoder = led_encoder->bytes_encoder;
    rmt_encoder_handle_t copy_encoder = led_encoder->copy_encoder;
    rmt_encode_state_t session_state = RMT_ENCODING_RESET;
    rmt_encode_state_t state = RMT_ENCODING_RESET;
    size_t encoded_symbols = 0;

    switch (led_encoder->state) {
    case 0: // send RGB data
        encoded_symbols += bytes_encoder->encode(bytes_encoder, channel, primary_data, data_size, &session_state);
        if (session_state & RMT_ENCODING_COMPLETE) {
            led_encoder->state = 1;
        }
        if (session_state & RMT_ENCODING_MEM_FULL) {
            state = (rmt_encode_state_t)(state | (uint32_t)RMT_ENCODING_MEM_FULL);
            goto out;
        }
    // fall-through
    case 1: // send reset code
        encoded_symbols += copy_encoder->encode(copy_encoder, channel, &led_encoder->reset_code,
                                                sizeof(led_encoder->reset_code), &session_state);
        if (session_state & RMT_ENCODING_COMPLETE) {
            led_encoder->state = RMT_ENCODING_RESET;
            state = (rmt_encode_state_t)(state | (uint32_t)RMT_ENCODING_COMPLETE);
        }
        if (session_state & RMT_ENCODING_MEM_FULL) {
            state = (rmt_encode_state_t)(state | (uint32_t)RMT_ENCODING_MEM_FULL);
            goto out;
        }
    }
out:
    *ret_state = state;
    return encoded_symbols;
}
```

### Change 2: Update Function Pointer Assignment (Line 97 in led_driver.cpp)

**FROM**:
```cpp
strip_encoder_2.base.encode = rmt_encode_led_strip;
```

**TO**:
```cpp
strip_encoder_2.base.encode = rmt_encode_led_strip_2;
```

---

## VERIFICATION POINTS

After applying the fix, verify:

### 1. Compilation Success
- No new warnings
- No errors
- Build completes cleanly

### 2. Initialization Messages (Serial Monitor)
Should see:
```
init_rmt_driver
rmt_new_tx_channel (primary)
rmt_new_led_strip_encoder (primary)
rmt_enable (primary)
rmt_new_tx_channel (secondary)
rmt_new_led_strip_encoder_2 (secondary)
rmt_enable (secondary)
```

### 3. GPIO Signal Verification (Oscilloscope)
- GPIO 5: RMT waveform at ~800 kHz ✅
- GPIO 4: RMT waveform at ~800 kHz ✅ (was dead before fix)
- Timing: Signals should start/stop together (< 100ns skew)

### 4. Functional Test
- Load LED pattern that illuminates strips
- Both LED strips should light up identically
- No flickering or out-of-sync behavior

---

## SUMMARY TABLE

| Component | Location | Status | Issue |
|-----------|----------|--------|-------|
| Primary encoder function | `led_driver.h:122-155` | ✅ OK | Uses correct pointer |
| Secondary encoder function | NEW (add after line 155) | ✅ FIXED | Separate function |
| Primary pointer assignment | `led_driver.cpp:65` | ✅ OK | Points to primary func |
| Secondary pointer assignment | `led_driver.cpp:97` | ❌ BUG | Points to primary func |
| Transmission calls | `led_driver.h:272-274` | ✅ OK | Both channels called |
| Encoder structs | `led_driver.cpp:29-30` | ✅ OK | Separate instances |
| Channel handles | `led_driver.cpp:25-26` | ✅ OK | Separate handles |
| Data buffer | `led_driver.cpp:18` | ✅ OK | Shared is correct |

---

## Related Documentation

- **Full Analysis**: See `K1NAnalysis_ANALYSIS_SECONDARY_LED_CHANNEL_FAILURE_v1.0_20251108.md`
- **Visual Diagram**: See `K1NAnalysis_DIAGRAM_SECONDARY_CHANNEL_STATE_MACHINE_COLLISION_v1.0_20251108.txt`
- **Implementation Guide**: See `K1NAnalysis_CRITICAL_FIX_SECONDARY_LED_CHANNEL_v1.0_20251108.md`
- **Debug Summary**: See `K1NAnalysis_SUMMARY_DEBUG_SECONDARY_LED_OUTPUT_v1.0_20251108.md`
