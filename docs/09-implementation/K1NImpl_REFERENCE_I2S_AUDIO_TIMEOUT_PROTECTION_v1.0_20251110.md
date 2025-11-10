# I2S Audio Timeout Protection & Recovery

**Status:** Implemented (Phase 0)
**Date:** November 10, 2025
**Task:** Task 2 — I2S Audio Timeout Protection
**Files Modified:**
- `firmware/src/audio/microphone.h` — Timeout state tracking
- `firmware/src/audio/microphone.cpp` — Timeout protection + recovery
- `firmware/src/error_codes.h/cpp` — Audio error codes

---

## Summary

Implemented comprehensive I2S microphone timeout protection with:
- **100ms bounded waits** (pdMS_TO_TICKS(100)) preventing indefinite hangs
- **Silence fallback mode** automatically engaged on timeout
- **Consecutive failure tracking** — enters fallback after 3+ failures
- **Structured error logging** using error code system (ERR_I2S_READ_TIMEOUT=24, ERR_I2S_READ_OVERRUN=25)
- **Automatic recovery** — exits fallback mode after 1 second of successful reads
- **Telemetry-ready** — `get_i2s_timeout_state()` API for diagnostics

## Key Changes

### Timeout State Global

```cpp
typedef struct {
    uint32_t timeout_count;        // Total timeouts since boot
    uint32_t consecutive_failures; // Current streak (0-N)
    uint32_t last_failure_time_ms;
    uint8_t last_error_code;
    bool in_fallback_mode;         // Silence output active
    uint32_t fallback_start_time_ms;
} I2STimeoutState;

extern I2STimeoutState i2s_timeout_state;
```

### Error Recovery Logic

```
I2S Read (100ms max)
  ├─ SUCCESS
  │   ├─ Reset consecutive_failures=0
  │   ├─ Set error_code=ERR_OK
  │   └─ Check fallback recovery (>1s success → exit)
  │
  └─ TIMEOUT/ERROR
      ├─ Log [ERR_24] or [ERR_25]
      ├─ Output silence samples
      ├─ consecutive_failures++
      └─ If >= 3: enter fallback_mode
```

### Silence Fallback

On timeout or in fallback mode, all audio samples become zero:

```cpp
if (use_silence_fallback || i2s_timeout_state.in_fallback_mode) {
    // All samples = 0.0f (silence)
} else {
    // Normal conversion from raw I2S data
}
```

**Effect:** Patterns continue but with silence-reactive behavior (no crashes).

## Validation

- ✓ Firmware builds successfully
- ✓ Flash usage: 62.4% (1226261 / 1966080 bytes)
- ✓ RAM usage: 60.4% (197804 / 327680 bytes)
- ✓ No new compiler warnings
- ✓ Error codes integrated (ERR_I2S_READ_TIMEOUT, ERR_I2S_READ_OVERRUN)

## Next Steps

- Task 3: WebServer Buffer Bounds Checking (in progress)
- Integrate timeout state into REST endpoints (`/api/device/audio`)
- Add timeout simulation test (Phase 2 testing)
