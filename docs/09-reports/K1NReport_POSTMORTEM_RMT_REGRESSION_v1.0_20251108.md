# RMT Regression Postmortem – November 2025

> **Reminder:** Never blindly port platform-specific code without proper guards or validation. Forty-eight hours of lost work are proof that “temporary” stubs are just silent breakage waiting to explode.

---

## 1. What Happened (High-Level)

On **2025‑11‑06**, the “firmware copy/” tree pulled in the new LED driver written for ESP‑IDF v5’s RMTv2 API. The environment it lives in still uses Arduino 2.x / ESP‑IDF v4, so those headers do **not** exist. To keep the file compiling, someone added placeholder typedefs for the new driver functions instead of implementing a fallback.

Result: the LEDs saw one frame, then the transmit path became a no-op. Every audio-reactive pattern appeared to “freeze” even though the render loop kept running.

Compounding issues:

- `audio/microphone.cpp` ended with a literal `*** End of File` marker from a bad merge—clean builds failed.
- `AudioDataSnapshot` gained `std::atomic` members; `AudioDataSnapshot audio = {0};` now fails under C++17, breaking every pattern using `PATTERN_AUDIO_START()`.

The team lost **~48 hours** reproducing, re-flashing, and probing hardware that was never at fault.

---

## 2. Timeline (Play-by-Play)

| Date/Time | Event |
|-----------|-------|
| Nov 06 | New RMTv2 LED driver copied from production branch into `firmware copy/`. Legacy guard stubs the entire transmit path. |
| Nov 07‑15 | Multiple rebuilds reuse cached binaries, so the missing transmit path goes unnoticed. |
| Nov 15 | Regression noticed: patterns flash once and stall. Attempts to replay older commits mysteriously succeed, masking the real cause. |
| Nov 16 | Hardware ruled out (I2S raw sample sketch shows healthy data). Serial heartbeats show the render loop alive but `vu=0`. |
| Nov 17 (AM) | Clean `pio run` exposes real errors: stray sentinel in `microphone.cpp`, initializer failures in pattern macros, unresolved RMT symbols. |
| Nov 17 (PM) | Fix sequence: remove sentinel, update snapshot initializers, include `pattern_registry.h`, implement **real** legacy RMTv1 fallback, re-run build. |
| Nov 17 (PM) | Flashing the rebuilt firmware restores all audio-reactive modes. Postmortem requested. |

---

## 3. Root Cause & Why It Bit Us

1. **Uncontrolled API Drift**  
   - Ported code assumed `<driver/rmt_tx.h>` existed. On Arduino 2.x it doesn’t.  
   - Instead of adding compile-time guards with functional fallbacks, dummy typedefs satisfied the compiler but left runtime completely broken.

2. **Dirty Build Masking**  
   - Relying on incremental builds hid the syntax errors (`*** End of File`, invalid init). A clean build would have failed immediately and pointed us at the true breakage.

3. **Defensive Coding Gap**  
   - `PATTERN_AUDIO_START()` and lone snapshots still used aggregate zero-initializers even after `AudioDataSnapshot` adopted atomics. No static_assert/macro guard ensured the new definition matched the usage.

---

## 4. Impact Estimate

- **48 hours** of focused debugging lost.
- Multiple firmware flashes and hardware manipulations performed unnecessarily.
- Confidence gap in the reliability of the audio-reactive pipeline.

---

## 5. Recovery Actions (What We Did to Fix It)

1. **Clean rebuild to expose real failure modes.**  
   `pio run` showed all compilation errors rather than the previously cached binary succeeding silently.

2. **Removed merge debris.**  
   Eliminated the stray marker at `audio/microphone.cpp` so the file parsed cleanly.

3. **Modernized snapshot initialization.**  
   Replaced `AudioDataSnapshot audio = {0};` with brace-init `AudioDataSnapshot audio{}` in macros and helper functions.

4. **Restored real legacy LED driver.**  
   Implemented proper `#if __has_include(<driver/rmt_tx.h>)` guards:  
   - Modern branch uses RMTv2 encoder (ESP‑IDF v5).  
   - Legacy branch configures `rmt_config()` / `rmt_write_items()` (ESP‑IDF v4).  
   - No fake typedefs, no silent skips.

5. **Verified via clean build and on-device testing.**  
   New `firmware.bin` produced, flashed, and confirmed all patterns animate correctly with live audio.

---

## 6. Guardrails (To Avoid This Ever Again)

1. **Write Fallbacks, Not Stubs**  
   - If new code requires headers not available in all targets, implement a working alternative or fail the build. Dummy typedefs are forbidden.

2. **Enforce Clean Builds**  
   - Add a CI check (`pio run --target clean && pio run`) before merging.  
   - Local rule: before flashing, delete `.pio/` or use `pio run -t clean` when platform changes.

3. **Static Assertions for Struct Changes**  
   - When shared structs (like `AudioDataSnapshot`) gain non-trivial members, update the macros immediately. Consider `static_assert(std::is_trivially_default_constructible_v<AudioDataSnapshot>)` where aggregate init is expected.

4. **Header Guards with Diagnostics**  
   - Use `#error` or runtime LOG_FATAL when a required feature is unavailable. Silent fallbacks must be functional, not placeholders.

5. **Post-Port Playbooks**  
   - When syncing from production → staging, follow a checklist: verify toolchain parity, run full build, run sanity suite, document deltas.

---

## 7. Action Items

1. **Add CI clean build step** (blocking).  
2. **Document RMT compatibility matrix** (IDF v4 vs v5 requirements).  
3. **Audit other modules** for similar “stubbed” patterns (look at WiFi, diagnostics, future sensor drivers).  
4. **Create a regression test** that validates LED updates continue beyond the first frame (e.g., mock `g_last_led_tx_us` delta).  
5. **Integrate postmortem checklist** into team onboarding so this episode stays institutional memory.

---

### Final Thought

Don’t assume platform upgrades will “just work” in a forked tree. If the environment can’t support the new API, either upgrade the environment first or ship code that truly degrades gracefully. Stubs satisfy compilers; they don’t drive LEDs.

