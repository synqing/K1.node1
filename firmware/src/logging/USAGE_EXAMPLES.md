# K1.reinvented Logger - Usage Examples

## Quick Start

### 1. Initialize in setup()

```cpp
#include "logging/logger.h"

void setup() {
    Logger::init();  // Call this once at startup

    LOG_INFO(TAG_CORE0, "K1 firmware version 1.0.0 starting");
    // ... rest of setup
}
```

### 2. Use logging macros throughout your code

```cpp
#include "logging/logger.h"

void audio_task(void* param) {
    while (true) {
        // Debug-level logging (disabled in production)
        LOG_DEBUG(TAG_AUDIO, "Processing frame %u", frame_count);

        // Info-level logging
        LOG_INFO(TAG_I2S, "Sample rate: %lu Hz", SAMPLE_RATE);

        // Warning for degraded conditions
        if (signal_strength < MIN_THRESHOLD) {
            LOG_WARN(TAG_AUDIO, "Low signal: %.1f dB (threshold: %.1f)",
                     signal_strength, MIN_THRESHOLD);
        }

        // Error for failures
        if (i2s_error != ESP_OK) {
            LOG_ERROR(TAG_I2S, "I2S read failed: %d", i2s_error);
        }

        vTaskDelay(pdMS_TO_TICKS(10));
    }
}
```

## Tag Reference

Each subsystem has a single-character tag for compact output:

| Tag | Subsystem | Example |
|-----|-----------|---------|
| `TAG_AUDIO` | Audio processing | Frequency analysis, spectral data |
| `TAG_I2S` | I2S microphone interface | Sample acquisition, DMA |
| `TAG_LED` | LED driver and rendering | Frame composition, gamma correction |
| `TAG_GPU` | GPU/rendering pipeline | Shader compilation, buffer management |
| `TAG_TEMPO` | Tempo detection | BPM calculation, confidence |
| `TAG_BEAT` | Beat detection | Onset detection, synchronization |
| `TAG_SYNC` | Audio-visual sync | Pipeline alignment, timing |
| `TAG_WIFI` | WiFi subsystem | Connection, RSSI |
| `TAG_WEB` | Web API and control | HTTP requests, WebSocket |
| `TAG_CORE0` | Main thread | Default tag, general purpose |
| `TAG_CORE1` | Second thread | I2S/audio core operations |
| `TAG_MEMORY` | Memory management | Allocation, fragmentation |
| `TAG_PROFILE` | Performance profiling | FPS, CPU usage |

## Output Format

### With Colors (Default)

```
[00:01:23.456] ERROR [A] Failed to initialize microphone: 5
[00:01:23.457] WARN  [I] I2S buffer underrun (core 1)
[00:01:23.458] INFO  [L] Rendering frame 12345 (60 FPS)
[00:01:23.459] DEBUG [T] Tempo update: 120.5 BPM (confidence: 0.95)
```

Colors:
- Time: Dark gray (subtle)
- Severity: Color-coded (red/yellow/green/blue)
- Tag: Cyan
- Message: White

### Raw (Colors Disabled)

Disable colors by setting in `log_config.h`:
```cpp
#define LOG_USE_COLORS 0
```

Output becomes:
```
[00:01:23.456] ERROR [A] Failed to initialize microphone: 5
[00:01:23.457] WARN  [I] I2S buffer underrun (core 1)
```

## Configuration

### Compile-Time Verbosity

In `log_config.h`, set the verbosity level:

```cpp
// Production - errors and warnings only
#define LOG_LEVEL LOG_LEVEL_WARN

// Development - all messages including debug
#define LOG_LEVEL LOG_LEVEL_DEBUG

// Ultra-quiet - errors only
#define LOG_LEVEL LOG_LEVEL_ERROR
```

Messages below the configured level are **compiled out entirely** (zero runtime overhead).

### Runtime Tag Filtering (Optional)

Enable per-tag filtering in `log_config.h`:

```cpp
#define LOG_ENABLE_TAG_FILTERING 1
```

Then in your code:

```cpp
// TODO: Add runtime filtering API (set_tag_enabled, etc.)
// Current version compiles at configuration time only
```

### Serial Baud Rate

Change baud rate in `log_config.h`:

```cpp
#define LOG_SERIAL_BAUD 2000000  // 2M baud (default)
#define LOG_SERIAL_BAUD 921600   // 921K baud (fallback)
```

## Multi-Threaded Example

The logger is thread-safe using FreeRTOS mutexes:

```cpp
// Core 0 - Rendering
void render_task(void* param) {
    LOG_INFO(TAG_CORE0, "Render task starting on core %d", xPortGetCoreID());

    while (true) {
        LOG_DEBUG(TAG_LED, "Composing frame");
        render_frame();

        vTaskDelay(pdMS_TO_TICKS(16));  // ~60 FPS
    }
}

// Core 1 - Audio Processing
void audio_task(void* param) {
    LOG_INFO(TAG_CORE1, "Audio task starting on core %d", xPortGetCoreID());

    while (true) {
        LOG_DEBUG(TAG_AUDIO, "Acquiring sample chunk");
        acquire_sample_chunk();

        LOG_DEBUG(TAG_TEMPO, "Detecting beat");
        detect_beat();

        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

// Even if both tasks log simultaneously, messages won't overlap
```

**Output (won't interleave):**
```
[00:01:23.100] INFO  [0] Render task starting on core 0
[00:01:23.101] INFO  [1] Audio task starting on core 1
[00:01:23.102] DEBUG [L] Composing frame
[00:01:23.103] DEBUG [A] Acquiring sample chunk
[00:01:23.104] DEBUG [B] Detecting beat
[00:01:23.105] DEBUG [L] Composing frame
```

No garbled output like:
```
[00:01:23.102] DEBUG DEBUG [L] [A] Compos Acquiringingle...
```

## Printf-Style Formatting

The logger supports all standard printf format specifiers:

```cpp
// Integers
LOG_INFO(TAG_CORE0, "Value: %d, Unsigned: %u, Hex: 0x%x", -42, 100, 255);

// Floats
LOG_INFO(TAG_AUDIO, "Level: %.2f dB, Phase: %.1f degrees", -3.25, 45.0);

// Strings
LOG_INFO(TAG_CORE0, "Status: %s", error_message);

// Multiple arguments
LOG_WARN(TAG_I2S, "Frame %u: samples=%d, rate=%lu Hz, level=%.1f",
         frame_num, sample_count, SAMPLE_RATE, signal_level);

// Pointers (for debugging)
LOG_DEBUG(TAG_CORE0, "Object at %p", &my_struct);
```

## Performance Characteristics

### RAM Usage

- Static buffers: ~800 bytes
- FreeRTOS mutex: ~100 bytes
- **Total: <2KB** (well within ESP32-S3 limits)

### CPU Overhead

- Disabled messages: **0 CPU** (compiled out)
- Enabled messages: ~1-2 microseconds (formatting + serial)
- Mutex contention: minimal (hold time <100 microseconds)

### Serial Transmission

- 2M baud = ~250KB/s throughput
- Average message: ~80 bytes = ~0.3ms transmission
- No blocking on message composition

## Common Patterns

### Periodic Status Reporting

```cpp
void periodic_status() {
    static uint32_t last_report = 0;
    uint32_t now = millis();

    if (now - last_report > 5000) {  // Report every 5 seconds
        LOG_INFO(TAG_PROFILE, "FPS: %.1f, CPU: %.1f%%, Memory: %u KB free",
                 FPS_CPU, cpu_usage, free_memory / 1024);
        last_report = now;
    }
}
```

### Conditional Debug Logging

```cpp
#ifdef DEBUG_AUDIO
    LOG_DEBUG(TAG_AUDIO, "Spectral frame: peaks=%d, avg=%.1f",
              peak_count, avg_magnitude);
#endif
```

### Error Handling with Context

```cpp
esp_err_t result = i2s_read(i2s_num, buffer, bytes_to_read, &bytes_read, 1000);
if (result != ESP_OK) {
    LOG_ERROR(TAG_I2S, "Read failed: %d (expected %d bytes, got %d)",
              result, bytes_to_read, bytes_read);
    return result;
}
LOG_DEBUG(TAG_I2S, "Successfully read %d bytes", bytes_read);
```

### Task Lifecycle Logging

```cpp
void my_task(void* param) {
    int core_id = xPortGetCoreID();
    LOG_INFO(TAG_CORE0, "Task started on core %d", core_id);

    while (true) {
        // Work

        if (should_exit) {
            break;
        }
    }

    LOG_INFO(TAG_CORE0, "Task exiting from core %d", core_id);
    vTaskDelete(nullptr);
}
```

## Troubleshooting

### Logs not appearing

1. **Check initialization**: Did you call `Logger::init()` in `setup()`?
2. **Check Serial monitor baud rate**: Must be 2M (or your configured rate)
3. **Check verbosity level**: Is `LOG_LEVEL` in `log_config.h` high enough?
4. **Check tag filtering**: Is the tag enabled in `tag_filter[]`?

### Garbled or overlapping output

This indicates a missing or failed mutex:
1. Check FreeRTOS is properly initialized
2. Check available heap (mutex needs ~100 bytes)
3. Increase `configMINIMAL_STACK_SIZE` if running out of memory

### Performance impact

If logging affects frame rate:
1. **Lower verbosity** to `LOG_LEVEL_WARN` or `LOG_LEVEL_ERROR`
2. **Reduce message frequency** with periodic reporting
3. **Use tag filtering** to disable noisy subsystems

## Integration Checklist

- [ ] Copy `firmware/src/logging/` directory to your project
- [ ] Include `#include "logging/logger.h"` in files that need logging
- [ ] Call `Logger::init()` in `setup()`
- [ ] Replace existing Serial.print() calls with LOG_* macros
- [ ] Configure `log_config.h` for your verbosity level
- [ ] Test with Serial monitor at 2M baud (or configured rate)
- [ ] Verify no garbled output in multi-threaded scenarios
