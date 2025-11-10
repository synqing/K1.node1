
# C++ Debugger Setup (VS Code + ESP32-S3)

This guide configures full‑scope C++ debugging for generated patterns and firmware using OpenOCD + GDB in VS Code.

Prerequisites
- ESP‑IDF toolchain (or PlatformIO) installed with xtensa‑esp32s3‑elf‑gdb on PATH
- OpenOCD installed with ESP32‑S3 support
- VS Code with C/C++ extension and (optional) Espressif IDF extension
- JTAG wiring to your ESP32‑S3 (ESP‑Prog or equivalent)
  - TMS, TCK, TDO, TDI, GND; recommended adapter speed 20000

Build (Debug)
- Ensure your firmware builds with debug symbols (e.g., `-Og -g`).
- PlatformIO default debug ELF path (example):
  - `firmware/.pio/build/esp32-s3-devkitc-1/firmware.elf`

VS Code Configurations
- Launch configs added in `.vscode/launch.json`:
  - "ESP32-S3: OpenOCD + GDB (attach)"
    - Attaches to a running OpenOCD on `localhost:3333`
    - Use input prompt to specify the ELF path
  - "ESP32-S3: OpenOCD + GDB (flash + debug)"
    - Loads the ELF, halts the target, and starts debugging
- Tasks added in `.vscode/tasks.json`:
  - "OpenOCD: esp32-s3 (start)": starts OpenOCD for ESP32‑S3
  - "OpenOCD: esp32-s3 (stop)": stops OpenOCD process

Typical Session
1. Connect JTAG probe to ESP32‑S3 and power the device.
2. Set `elfPath` when prompted (e.g., `firmware/.pio/build/esp32-s3-devkitc-1/firmware.elf`).
3. Start: `ESP32-S3: OpenOCD + GDB (attach)` (or `flash + debug`).
4. Set breakpoints in:
   - `firmware/src/graph_codegen/pattern_*.cpp` (generated patterns)
   - `firmware/src/visual_scheduler.cpp`
   - `firmware/src/led_driver.cpp`
5. Start debugging; step through pattern code on device.

Notes & Tips
- If OpenOCD config differs, edit `.vscode/tasks.json` args to match your board (interface + target).
- Espressif IDF extension can generate launch/tasks automatically; this manual setup works with or without it.
- If breakpoints don’t bind, confirm ELF path and that the device is halted (`monitor reset halt`).
- To avoid flashing each run, use the "attach" config and only flash when the ELF changes materially.

Host‑Side (Optional, no hardware)
- You can create a small host “sim harness” to call generated `pattern_<name>_render()` for N frames and print a CRC for smoke; then use `cppdbg` to step locally.
- This does not validate RMT or real‑time behavior; use device debugging for final verification.

Troubleshooting
- Port 3333 busy: kill stray OpenOCD (`pkill -f openocd`).
- GDB target refused: check wiring, board power, and adapter speed.
- Symbols missing: rebuild firmware with `-Og -g` and ensure the correct ELF path.
