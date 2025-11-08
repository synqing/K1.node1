# LUT Optimization Test Checklist

**Quick Reference**: Execution checklist for LUT validation testing
**Related**: `/Users/spectrasynq/Workspace_Management/Software/K1.node1/docs/09-implementation/K1NImpl_STRATEGY_LUT_OPTIMIZATION_TEST_v1.0_20251108.md`
**Date**: 2025-11-07

---

## Pre-Test Setup

- [ ] ESP32-S3 DevKit C-1 connected via USB
- [ ] Firmware uploaded: `pio run -e esp32-s3-devkitc-1 -t upload`
- [ ] Serial monitor verified: `pio device monitor -b 2000000`
- [ ] LED strip connected (for visual tests)
- [ ] Microphone connected (for audio timing tests)

---

## 1. Accuracy Validation Tests

**Command**: `pio test -e esp32-s3-devkitc-1 -f test_lut_accuracy`

### 1.1 Easing LUT Accuracy
- [ ] `test_easing_quad_in_accuracy`: Max error < 0.2%
- [ ] `test_easing_cubic_out_accuracy`: Max error < 0.2%
- [ ] `test_all_easing_functions_accuracy`: All 10 functions < 0.2%

**Expected Results**:
```
ease_quad_in: max error = 0.XXX%    (PASS if < 0.2%)
ease_cubic_out: max error = 0.XXX%  (PASS if < 0.2%)
linear: max error = 0.XXX%          (PASS if < 0.2%)
...
[ACCURACY] All easing functions within tolerance ✓
```

### 1.2 Color LUT Accuracy
- [ ] `test_color_lut_hue_accuracy`: Hue wheel error < 0.4%
- [ ] `test_color_lut_full_cube_accuracy`: Full HSV cube error < 0.4%

**Expected Results**:
```
HSV hue wheel: max error = 0.XXX%        (PASS if < 0.4%)
HSV full cube: max error = 0.XXX% at (H=X.XX, S=X.XX, V=X.XX)
[ACCURACY] Color LUT within tolerance ✓
```

### 1.3 Palette LUT Accuracy
- [ ] `test_palette_cache_accuracy`: Max error < 0.002 (0.2%)
- [ ] `test_palette_cache_varying_sizes`: All sizes < 0.002

**Expected Results**:
```
Palette cache: max error = 0.XXXXXX     (PASS if < 0.002)
Size 2: max error = 0.XXXXXX
Size 4: max error = 0.XXXXXX
...
[ACCURACY] Palette cache within tolerance ✓
```

---

## 2. Functional Tests

**Command**: `pio test -e esp32-s3-devkitc-1 -f test_lut_functional`

### 2.1 Easing Function Properties
- [ ] `test_easing_monotonicity`: All functions monotonic
- [ ] `test_easing_boundaries`: f(0)=0, f(1)=1 for all
- [ ] `test_easing_input_clamping`: Out-of-range inputs handled

**Expected Results**:
```
[MONOTONIC] ease_quad_in_fast ✓
[MONOTONIC] ease_cubic_in_fast ✓
...
[BOUNDARY] f(0) = 0.000 ✓
[BOUNDARY] f(1) = 1.000 ✓
[CLAMPING] Negative inputs: 0.000 ✓
[CLAMPING] Oversized inputs: 1.000 ✓
```

### 2.2 Color LUT Properties
- [ ] `test_color_lut_hue_wraparound`: H=0 vs H=1 error < 1%
- [ ] `test_color_lut_grayscale`: S=0 produces equal R,G,B
- [ ] `test_color_lut_black`: V=0 produces (0,0,0)

**Expected Results**:
```
Hue wraparound error: R=0.XXXXXX, G=0.XXXXXX, B=0.XXXXXX ✓
Grayscale test: R=G=B at S=0 ✓
Black test: RGB=(0,0,0) at V=0 ✓
```

### 2.3 Palette LUT Edge Cases
- [ ] `test_palette_cache_single_entry`: Size=1 handled
- [ ] `test_palette_cache_two_entry`: Size=2 linear gradient
- [ ] `test_palette_cache_large`: Size=64 handled
- [ ] `test_palette_cache_null_handling`: NULL pointer safe

**Expected Results**:
```
[EDGE CASE] Single entry: 0.750 at all positions ✓
[EDGE CASE] Two entry: linear 0.0 → 1.0 ✓
[EDGE CASE] Large (64): initialized ✓
[EDGE CASE] NULL: graceful failure ✓
```

---

## 3. Integration Tests

**Command**: `pio test -e esp32-s3-devkitc-1 -f test_lut_integration`

### 3.1 Boot and Initialization
- [ ] `test_lut_initialization`: Memory usage 8-12 KB
- [ ] `test_lut_no_crashes`: 100 iterations without crash

**Expected Results**:
```
LUT initialization used XXXX bytes          (8000 < X < 12000)
[INIT] No crashes during 100 iterations ✓
```

### 3.2 Pattern Rendering Stability
- [ ] `test_pattern_stability_30sec`: All patterns 30 sec each
- [ ] `test_pattern_fps_stability`: FPS > 90

**Expected Results**:
```
Pattern 1/20: OK
Pattern 2/20: OK
...
Measured FPS: XXX.X                         (PASS if > 90)
[STABILITY] All patterns stable ✓
```

### 3.3 Audio Beat Detection Timing
- [ ] `test_audio_beat_timing`: Latency < 20 ms

**Expected Results**:
```
Audio response latency: XX.XXX ms           (PASS if < 20)
[TIMING] Beat detection within spec ✓
```

---

## 4. Performance Tests

**Command**: `pio test -e esp32-s3-devkitc-1 -f test_lut_performance`

### 4.1 CPU Usage Measurement
- [ ] `test_cpu_usage_comparison`: Speedup ≥ 2x

**Expected Results**:
```
Original: XXXXXX us (100000 iterations)
LUT:      XXXXXX us (100000 iterations)
Speedup:  X.XXx                             (PASS if ≥ 2.0)
[PERFORMANCE] LUT optimization effective ✓
```

### 4.2 Frame Time Profiling
- [ ] `test_pattern_frame_time`: Frame time < 5 ms

**Expected Results**:
```
Avg frame time: X.XXX ms                    (PASS if < 5.0)
Max FPS: XXX.X                              (>200 expected)
[PERFORMANCE] Frame time within budget ✓
```

### 4.3 LUT Initialization Time
- [ ] `test_lut_init_time`: Total init < 50 ms

**Expected Results**:
```
Easing LUT init:  XX.XXX ms
Color LUT init:   XX.XXX ms
Palette cache init: X.XXX ms
Total init time:  XX.XXX ms                 (PASS if < 50)
[PERFORMANCE] Init time acceptable ✓
```

---

## 5. Visual Tests (Manual Inspection)

**Setup**: Connect LED strip, upload firmware with test patterns

### 5.1 Side-by-Side Output Comparison
- [ ] Pattern A (original): Visually inspect smoothness, colors
- [ ] Pattern B (LUT): Visually inspect smoothness, colors
- [ ] Comparison: No visible difference between A and B
- [ ] Frame capture (if available): < 5% different pixels

**Automated Test**: `test_visual_frame_comparison`
```
Different pixels: XX/256 (X.X%)             (PASS if < 5%)
Max difference: 0.XXXXXX
[VISUAL] Frame comparison passed ✓
```

### 5.2 Animation Smoothness Checklist
- [ ] Linear ease: Constant speed, no steps
- [ ] Quad ease: Smooth acceleration/deceleration
- [ ] Cubic ease: Smooth, no stuttering
- [ ] Quart ease: Smooth, no stuttering
- [ ] Hue wheel: Continuous color transitions
- [ ] Palette gradients: Smooth, no banding

### 5.3 Color Accuracy Checklist
- [ ] Red (H=0): Pure red, no orange/magenta tint
- [ ] Green (H=0.33): Pure green
- [ ] Blue (H=0.67): Pure blue
- [ ] Saturation gradient: Smooth from vibrant to pastel
- [ ] Brightness gradient: Smooth from bright to dim
- [ ] Grayscale (S=0): Neutral, no color tint

---

## Quality Gates Summary

**All gates must pass before merging:**

### Gate 1: Accuracy ✓
- [x] Easing max error < 0.2%
- [x] Color max error < 0.4%
- [x] Palette max error < 0.2%

### Gate 2: Functional ✓
- [x] Easing monotonicity verified
- [x] Easing boundaries correct
- [x] HSV wraparound < 1% error
- [x] Grayscale/black verified
- [x] Edge cases handled

### Gate 3: Integration ✓
- [x] Memory usage: 8-12 KB
- [x] 30-sec stability test passed
- [x] FPS > 90
- [x] Audio latency < 20 ms

### Gate 4: Performance ✓
- [x] Speedup ≥ 2x
- [x] Frame time < 5 ms
- [x] Init time < 50 ms

### Gate 5: Visual ✓
- [x] Frame comparison < 5% diff
- [x] Smooth animations
- [x] Correct colors

---

## Test Results Template

**Date**: _______________
**Tester**: _______________
**Firmware Version**: _______________

| Test Suite | Status | Notes |
|------------|--------|-------|
| Accuracy - Easing | PASS / FAIL | Max error: ____% |
| Accuracy - Color | PASS / FAIL | Max error: ____% |
| Accuracy - Palette | PASS / FAIL | Max error: ____% |
| Functional - Easing | PASS / FAIL | |
| Functional - Color | PASS / FAIL | |
| Functional - Palette | PASS / FAIL | |
| Integration - Init | PASS / FAIL | Memory: ____ bytes |
| Integration - Patterns | PASS / FAIL | FPS: ____ |
| Integration - Audio | PASS / FAIL | Latency: ____ ms |
| Performance - CPU | PASS / FAIL | Speedup: ____x |
| Performance - Frame | PASS / FAIL | Time: ____ ms |
| Performance - Init | PASS / FAIL | Time: ____ ms |
| Visual - Comparison | PASS / FAIL | Diff: ____% |
| Visual - Smoothness | PASS / FAIL | |
| Visual - Colors | PASS / FAIL | |

**Overall Result**: PASS / FAIL

**Issues Found**:
1. _______________________________________________________________
2. _______________________________________________________________
3. _______________________________________________________________

**Recommendations**:
1. _______________________________________________________________
2. _______________________________________________________________
3. _______________________________________________________________

---

## Troubleshooting

### Test Failures

**Accuracy test fails**:
- Check LUT initialization called in `setup()`
- Verify LUT table generation code is correct
- Increase sample resolution if near tolerance boundary

**Performance test fails**:
- Check compiler optimization flags (`-Os` or `-O2`)
- Verify LUT lookups are inlined
- Profile to identify bottlenecks

**Visual test fails**:
- Check quantization (8-bit RGB conversion)
- Verify dithering is enabled/disabled consistently
- Compare in low-light conditions (more sensitive)

### Build Issues

**Compilation errors**:
```bash
# Clean build
pio run -e esp32-s3-devkitc-1 -t clean
pio run -e esp32-s3-devkitc-1
```

**Upload failures**:
```bash
# Check port
ls /dev/tty.usb*

# Manual upload
pio run -e esp32-s3-devkitc-1 -t upload --upload-port /dev/tty.usbmodem212401
```

**Test framework issues**:
```bash
# Rebuild test framework
pio test -e esp32-s3-devkitc-1 --verbose
```

---

## Quick Command Reference

```bash
# Run all tests
pio test -e esp32-s3-devkitc-1 -f "test_lut_*"

# Run specific test
pio test -e esp32-s3-devkitc-1 -f test_lut_accuracy

# Upload and monitor
pio run -e esp32-s3-devkitc-1 -t upload && pio device monitor -b 2000000

# Clean build
pio run -e esp32-s3-devkitc-1 -t clean && pio run -e esp32-s3-devkitc-1
```

---

**Last Updated**: 2025-11-07
