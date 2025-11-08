# RMT Encoder Initialization: Primary vs Secondary Channel Comparison

**Reference Document**
**Date:** 2025-11-07

## Side-by-Side Function Comparison

### Function Signatures

| Aspect | Primary | Secondary |
|--------|---------|-----------|
| Function name | `rmt_new_led_strip_encoder` | `rmt_new_led_strip_encoder_2` |
| Parameter 1 | `const led_strip_encoder_config_t *config` | `const led_strip_encoder_config_t *config` |
| Parameter 2 | `rmt_encoder_handle_t *ret_encoder` | `rmt_encoder_handle_t *ret_encoder` |
| Return type | `esp_err_t` | `esp_err_t` |
| Return value | `ESP_OK` (line 87) | `ESP_OK` (line 117) |

### Line-by-Line Source Comparison

```
Line    Primary (led_driver.cpp)                   Secondary (led_driver.cpp)
─────   ──────────────────────────────────────────────────────────────────────
 62:    esp_err_t rmt_new_led_strip_encoder(      94:    esp_err_t rmt_new_led_strip_encoder_2(
 63:        esp_err_t ret = ESP_OK;                95:        esp_err_t ret = ESP_OK;
 64:    (blank)                                    96:    (blank)
 65:        strip_encoder.base.encode =            97:        strip_encoder_2.base.encode =
 66:            rmt_encode_led_strip;              98:            rmt_encode_led_strip;
 67:        strip_encoder.base.del =               99:        strip_encoder_2.base.del =
 68:            rmt_del_led_strip_encoder;         100:           rmt_del_led_strip_encoder;
 69:        strip_encoder.base.reset =             101:           strip_encoder_2.base.reset =
 70:            rmt_led_strip_encoder_reset;       102:           rmt_led_strip_encoder_reset;
 71:    (blank)                                    103:   (blank)
 72:        // WS2812B timing @ 20 MHz             104:   // WS2812B timing @ 20 MHz
 73:        // Spec target comments               105:   // Same timing as primary channel
 74:        // Tick counts comment                106:   // (comment differs)
 75:        // Robustness comment                 107:   (blank)
 76:        rmt_bytes_encoder_config_t             108:   rmt_bytes_encoder_config_t
 77:            bytes_encoder_config = {           109:       bytes_encoder_config = {
 78:            .bit0 = { 7, 1, 18, 0 },           110:       .bit0 = { 7, 1, 18, 0 },
 79:            .bit1 = { 14, 1, 11, 0 },          111:       .bit1 = { 14, 1, 11, 0 },
 80:            .flags = { .msb_first = 1 }        112:       .flags = { .msb_first = 1 }
 81:        };                                     113:   };
 82:    (blank)                                    114:   (blank)
 83:        rmt_new_bytes_encoder(                115:   rmt_new_bytes_encoder(
 84:            &bytes_encoder_config,             116:       &bytes_encoder_config,
 85:            &strip_encoder.bytes_encoder);     117:       &strip_encoder_2.bytes_encoder);
 86:        rmt_copy_encoder_config_t              118:   rmt_copy_encoder_config_t
 87:            copy_encoder_config = {};          119:       copy_encoder_config = {};
 88:        rmt_new_copy_encoder(                 120:   rmt_new_copy_encoder(
 89:            &copy_encoder_config,              121:       &copy_encoder_config,
 90:            &strip_encoder.copy_encoder);      122:       &strip_encoder_2.copy_encoder);
 91:    (blank)                                    123:   (blank)
 92:        // Reset: ≥50us low comment           124:   // Reset: ≥50us low comment
 93:        strip_encoder.reset_code =             125:   strip_encoder_2.reset_code =
 94:            (rmt_symbol_word_t)                126:       (rmt_symbol_word_t)
 95:            { 1000, 0, 1000, 0 };              127:       { 1000, 0, 1000, 0 };
 96:    (blank)                                    128:   (blank)
 97:        *ret_encoder =                         129:   *ret_encoder =
 98:            &strip_encoder.base;               130:       &strip_encoder_2.base;
 99:        return ESP_OK;                         131:   return ESP_OK;
100:    }                                         132:   }
```

### State Struct Initialization Matrix

#### Global Struct Declarations (led_driver.cpp:29-30)
```cpp
rmt_led_strip_encoder_t strip_encoder{};      // Aggregate init: all members = 0
rmt_led_strip_encoder_t strip_encoder_2{};    // Aggregate init: all members = 0
```

#### Initialization Steps - Execution Order

| Step | Primary | Secondary | Status |
|------|---------|-----------|--------|
| **1. Zero-init global struct** | `strip_encoder{}` | `strip_encoder_2{}` | ✓ Identical |
| **2. Set base.encode** | Line 65 | Line 97 | ✓ Same function |
| **3. Set base.del** | Line 66 | Line 98 | ✓ Same function |
| **4. Set base.reset** | Line 67 | Line 99 | ✓ Same function |
| **5. Create bytes_encoder** | Line 79 | Line 109 | ✓ Independent targets |
| **6. Create copy_encoder** | Line 81 | Line 111 | ✓ Independent targets |
| **7. Set reset_code** | Line 84 | Line 114 | ✓ Same values |
| **8. Return encoder handle** | Line 86 | Line 116 | ✓ Correct instances |

### State Variable Initialization Tracking

#### Primary Channel (strip_encoder)
```cpp
Member                    Zero-Init?  Later Set?  Value at Return
────────────────────────  ──────────  ──────────  ──────────────────────────
base.encode               Yes→No      YES (L65)   rmt_encode_led_strip
base.del                  Yes→No      YES (L66)   rmt_del_led_strip_encoder
base.reset                Yes→No      YES (L67)   rmt_led_strip_encoder_reset
bytes_encoder             YES          NO         <handle from rmt_new_bytes_encoder()>
copy_encoder              YES          NO         <handle from rmt_new_copy_encoder()>
state                     YES          NO         0 (RMT_ENCODING_RESET)
reset_code[0]             YES          NO         1000
reset_code[1]             YES          NO         0
reset_code[2]             YES          NO         1000
reset_code[3]             YES          NO         0
```

#### Secondary Channel (strip_encoder_2)
```cpp
Member                    Zero-Init?  Later Set?  Value at Return
────────────────────────  ──────────  ──────────  ──────────────────────────
base.encode               Yes→No      YES (L97)   rmt_encode_led_strip
base.del                  Yes→No      YES (L98)   rmt_del_led_strip_encoder
base.reset                Yes→No      YES (L99)   rmt_led_strip_encoder_reset
bytes_encoder             YES          NO         <handle from rmt_new_bytes_encoder()>
copy_encoder              YES          NO         <handle from rmt_new_copy_encoder()>
state                     YES          NO         0 (RMT_ENCODING_RESET)
reset_code[0]             YES          NO         1000
reset_code[1]             YES          NO         0
reset_code[2]             YES          NO         1000
reset_code[3]             YES          NO         0
```

## Encoder Callback Routing

### Registration Points

**Primary:** Line 65
```cpp
strip_encoder.base.encode = rmt_encode_led_strip;
```

**Secondary:** Line 97
```cpp
strip_encoder_2.base.encode = rmt_encode_led_strip;
```

### Runtime Dispatch

When RMT peripheral calls the encoder callback:

**Primary Channel Call:**
```
RMT (GPIO 5) calls: rmt_encode_led_strip(&strip_encoder.base, ...)
    ↓
Macro extraction: __containerof(&strip_encoder.base, rmt_led_strip_encoder_t, base)
    ↓
Returns: &strip_encoder
    ↓
State machine: switch (strip_encoder.state)
    ↓
Uses: strip_encoder.bytes_encoder, strip_encoder.copy_encoder, strip_encoder.reset_code
```

**Secondary Channel Call:**
```
RMT (GPIO 4) calls: rmt_encode_led_strip(&strip_encoder_2.base, ...)
    ↓
Macro extraction: __containerof(&strip_encoder_2.base, rmt_led_strip_encoder_t, base)
    ↓
Returns: &strip_encoder_2
    ↓
State machine: switch (strip_encoder_2.state)
    ↓
Uses: strip_encoder_2.bytes_encoder, strip_encoder_2.copy_encoder, strip_encoder_2.reset_code
```

## Timing Configuration Comparison

### WS2812B Signal Timing (Both Channels Identical)

At 20 MHz resolution (50 ns per tick):

```
Bit 0 (0-level):
  ├─ duration0: 7 ticks  = 350 ns  (T0H target: 0.35 µs)
  ├─ level0: 1           = high
  ├─ duration1: 18 ticks = 900 ns  (T0L target: 0.90 µs)
  └─ level1: 0           = low
     TOTAL: 1.25 µs ✓

Bit 1 (1-level):
  ├─ duration0: 14 ticks = 700 ns  (T1H target: 0.70 µs)
  ├─ level0: 1           = high
  ├─ duration1: 11 ticks = 550 ns  (T1L target: 0.55 µs)
  └─ level1: 0           = low
     TOTAL: 1.25 µs ✓

Reset Code:
  ├─ duration0: 1000 ticks = 50 µs  (minimum reset requirement)
  ├─ level0: 0             = low
  ├─ duration1: 1000 ticks = 50 µs  (doubled for safety margin)
  └─ level1: 0             = low
     TOTAL: 100 µs (ensures latch)
```

**Conclusion:** Both channels use identical timing values. Configuration divergence is NOT an issue.

## Initialization Dependency Graph

```
Global declarations
├─ rmt_channel_handle_t tx_chan = NULL       (line 25)
├─ rmt_channel_handle_t tx_chan_2 = NULL     (line 26)
├─ rmt_encoder_handle_t led_encoder = NULL   (line 27)
├─ rmt_encoder_handle_t led_encoder_2 = NULL (line 28)
├─ rmt_led_strip_encoder_t strip_encoder{}   (line 29) ← PRIMARY
├─ rmt_led_strip_encoder_t strip_encoder_2{} (line 30) ← SECONDARY
└─ rmt_transmit_config_t tx_config = {...}   (line 31)
    ↓
    Called at runtime: init_rmt_driver() (line 467 in main.cpp)
    ├─ Creates tx_chan (line 139)
    │  └─ Calls rmt_new_led_strip_encoder() (line 146)
    │     └─ Populates strip_encoder members
    │     └─ Returns &strip_encoder.base → led_encoder (line 27)
    │
    ├─ Enables tx_chan (line 149)
    │
    ├─ Creates tx_chan_2 (line 163)
    │  └─ Calls rmt_new_led_strip_encoder_2() (line 167)
    │     └─ Populates strip_encoder_2 members
    │     └─ Returns &strip_encoder_2.base → led_encoder_2 (line 28)
    │
    └─ Enables tx_chan_2 (line 170)
        ↓
        Later: transmit_leds() calls
        ├─ rmt_transmit(tx_chan, led_encoder, ...)      (line 272)
        │  └─ RMT calls rmt_encode_led_strip(&strip_encoder.base, ...)
        │
        └─ rmt_transmit(tx_chan_2, led_encoder_2, ...) (line 274)
           └─ RMT calls rmt_encode_led_strip(&strip_encoder_2.base, ...)
```

## Error Conditions Not Currently Caught

| Scenario | Detection | Impact |
|----------|-----------|--------|
| `rmt_new_bytes_encoder()` returns error | ❌ NOT checked | `bytes_encoder` remains `nullptr` |
| `rmt_new_copy_encoder()` returns error | ❌ NOT checked | `copy_encoder` remains `nullptr` |
| Secondary channel fails initialization | ✓ ESP_ERROR_CHECK | Caught at line 167 |
| Primary channel fails initialization | ✓ ESP_ERROR_CHECK | Caught at line 146 |

**Note:** The outer functions are error-checked, but the sub-encoder creation calls are not.

## Summary Table: Completeness Assessment

| Requirement | Primary | Secondary | Status |
|------------|---------|-----------|--------|
| Function exists | ✓ Yes | ✓ Yes | ✓ Complete |
| Function signature correct | ✓ Yes | ✓ Yes | ✓ Complete |
| State struct allocated | ✓ Yes | ✓ Yes | ✓ Complete |
| base.encode assigned | ✓ Yes | ✓ Yes | ✓ Complete |
| base.del assigned | ✓ Yes | ✓ Yes | ✓ Complete |
| base.reset assigned | ✓ Yes | ✓ Yes | ✓ Complete |
| bytes_encoder created | ✓ Yes | ✓ Yes | ✓ Complete |
| copy_encoder created | ✓ Yes | ✓ Yes | ✓ Complete |
| bytes_encoder error-checked | ❌ No | ❌ No | ✗ **GAP** |
| copy_encoder error-checked | ❌ No | ❌ No | ✗ **GAP** |
| reset_code initialized | ✓ Yes | ✓ Yes | ✓ Complete |
| Handle returned correctly | ✓ Yes | ✓ Yes | ✓ Complete |
| State zero-initialized | ✓ Yes | ✓ Yes | ✓ Complete |

## Conclusion

The two encoder initialization functions are **structurally identical** with the exception of their target struct names. All initialization steps are present in both. The **critical gap** is missing error checking for sub-encoder creation operations.

