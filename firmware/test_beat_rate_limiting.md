# Beat Detection Rate Limiting Fix

## Problem
The beat detection system was flooding the serial output with continuous "BEAT detected" messages at 42.0 BPM, occurring every 0.6-0.8 seconds. This created excessive log spam that made debugging difficult and potentially impacted system performance.

## Root Cause
The beat detection logic had multiple LOG_INFO statements that fired every time a beat was detected, but lacked proper rate limiting to prevent log flooding. The system was detecting beats correctly, but logging them too frequently.

## Solution
Implemented rate limiting on beat detection logging in three locations:

### 1. Phase-based beat detection (line ~426)
```cpp
// Rate limit beat detection logging to prevent flooding
static uint32_t last_beat_log_ms = 0;
uint32_t now_log_ms = millis();
if (now_log_ms - last_beat_log_ms >= 1000) {  // Max 1 log per second
    LOG_INFO(TAG_BEAT, "BEAT detected @ %.1f BPM", best_bpm);
    last_beat_log_ms = now_log_ms;
}
```

### 2. Confidence-based fallback detection (line ~449)
```cpp
// Log BEAT_EVENT with detected BPM (rate limited to avoid flooding)
float best_bpm = get_best_bpm();
static uint32_t last_beat_log_ms = 0;
uint32_t now_log_ms = millis();
if (now_log_ms - last_beat_log_ms >= 1000) {  // Rate limit: max 1 log per second
    LOG_INFO(TAG_BEAT, "BEAT detected @ %.1f BPM", best_bpm);
    last_beat_log_ms = now_log_ms;
}
```

### 3. Beat event drain loop (line ~1049)
```cpp
// Rate limit BEAT_EVENT logging to prevent serial flooding
static uint32_t last_event_log_ms = 0;
uint32_t now_event_ms = millis();
if (now_event_ms - last_event_log_ms >= 1000) {  // Max 1 log per second
    LOG_INFO(TAG_BEAT, "BEAT_EVENT ts_us=%lu conf=%u", (unsigned long)ev.timestamp_us, (unsigned)ev.confidence);
    last_event_log_ms = now_event_ms;
}
```

## Key Features
- **Rate Limiting**: Maximum 1 beat log per second per location
- **Static Variables**: Each rate limiter maintains its own state independently
- **Non-blocking**: Beat detection continues normally, only logging is throttled
- **Preserves Functionality**: All beat events are still processed and stored

## Testing
The fix has been compiled successfully and maintains all existing beat detection functionality while preventing log flooding.

## Expected Behavior
- Beat detection continues to work normally
- Beat events are still captured and stored in the ring buffer
- Serial output is limited to maximum 1 beat log per second per source
- System performance is improved due to reduced serial I/O