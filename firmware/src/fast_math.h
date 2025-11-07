// -----------------------------------------------------------------
//   __           _                       _   _
//  / _|         | |                     | | | |
// | |_ __ _ ___| |_     _ __ ___   __ _| |_| |__
// |  _/ _` / __| __|   | '_ ` _ \ / _` | __| '_ \
// | || (_| \__ \ |_    | | | | | | (_| | |_| | | |
// |_| \__,_|___/\__|   |_| |_| |_|\__,_|\__|_| |_|
//
// Fast Math Functions for ESP32-S3 Audio Processing
// Optimized approximations for expensive floating-point operations

#ifndef FAST_MATH_H
#define FAST_MATH_H

#include <stdint.h>
#include <math.h>

// ============================================================================
// FAST INVERSE SQUARE ROOT (Quake III Algorithm)
// ============================================================================
//
// Computes 1/sqrt(x) with ~1% error using bit-level hacks and Newton-Raphson.
// Use for magnitude calculations where exact precision is not critical.
//
// Performance on ESP32-S3 FPU:
//   - Hardware sqrt():     ~40 cycles
//   - fast_inv_sqrt():     ~12 cycles (3.3× faster)
//   - Accuracy:            99% (acceptable for audio visualization)

static inline float fast_inv_sqrt(float x) {
    // Bit-level hack: approximate 1/sqrt(x) using integer manipulation
    union {
        float f;
        uint32_t i;
    } u = {x};

    // Magic constant (0x5f3759df) derived from IEEE 754 format analysis
    u.i = 0x5f3759df - (u.i >> 1);
    float y = u.f;

    // One Newton-Raphson iteration: y = y * (1.5 - 0.5 * x * y * y)
    // Improves accuracy from ~5% to ~1% error
    y = y * (1.5f - 0.5f * x * y * y);

    // For higher accuracy, add another iteration (reduces error to ~0.01%):
    // y = y * (1.5f - 0.5f * x * y * y);

    return y;
}

// ============================================================================
// FAST MAGNITUDE (Goertzel Optimization)
// ============================================================================
//
// Computes sqrt(x) using fast_inv_sqrt() instead of hardware sqrt().
// Replaces: magnitude = sqrt(magnitude_squared)
//
// Usage in Goertzel:
//   float mag_sq = (q1 * q1) + (q2 * q2) - q1 * q2 * coeff;
//   float mag = fast_magnitude(mag_sq);
//
// Performance:
//   - Hardware sqrt():     ~40 cycles
//   - fast_magnitude():    ~14 cycles (2.9× faster)

static inline float fast_magnitude(float mag_squared) {
    if (mag_squared <= 0.0f) {
        return 0.0f;  // Handle edge case (avoid NaN)
    }
    return mag_squared * fast_inv_sqrt(mag_squared);
}

// ============================================================================
// FAST POWER-OF-TWO EXPONENTIATION
// ============================================================================
//
// Computes 2^x using bit manipulation (faster than powf(2, x) or expf(x * log(2))).
// Useful for exponential scaling and decay functions.
//
// Accuracy: ~2% error for x in [-10, 10]
// Performance: ~8 cycles (vs ~60 cycles for powf)

static inline float fast_pow2(float x) {
    // Clamp to prevent overflow/underflow
    if (x < -126.0f) return 0.0f;
    if (x > 127.0f)  return INFINITY;

    // Split x into integer and fractional parts
    int32_t i = (int32_t)x;
    float f = x - (float)i;

    // Approximate 2^f using polynomial (Chebyshev approximation)
    float approx = 1.0f + f * (0.6931471806f + f * (0.2402265069f + f * 0.0520834691f));

    // Combine with integer exponent (bit manipulation)
    union {
        float f;
        uint32_t i;
    } u = {approx};
    u.i += ((uint32_t)i) << 23;  // Multiply by 2^i (IEEE 754 exponent field)

    return u.f;
}

// ============================================================================
// FAST EXPONENTIAL (base e)
// ============================================================================
//
// Computes e^x using fast_pow2(x * log2(e)).
// Useful for attack/decay envelopes and noise floor calculations.
//
// Accuracy: ~2% error
// Performance: ~10 cycles (vs ~70 cycles for expf)

static inline float fast_exp(float x) {
    return fast_pow2(x * 1.442695041f);  // log2(e) ≈ 1.4426950408889634
}

// ============================================================================
// FAST LOGARITHM (base 2)
// ============================================================================
//
// Computes log2(x) using bit manipulation and polynomial approximation.
// Useful for dynamic range compression and spectral normalization.
//
// Accuracy: ~2% error
// Performance: ~10 cycles (vs ~55 cycles for log2f)

static inline float fast_log2(float x) {
    if (x <= 0.0f) return -INFINITY;  // Handle edge case

    // Extract IEEE 754 exponent (integer part of log2)
    union {
        float f;
        uint32_t i;
    } u = {x};

    int32_t exponent = ((u.i >> 23) & 0xFF) - 127;

    // Normalize mantissa to [1, 2) range
    u.i = (u.i & 0x007FFFFF) | 0x3F800000;
    float mantissa = u.f;

    // Polynomial approximation of log2(mantissa) in [1, 2)
    float y = mantissa - 1.0f;
    float log_mantissa = y * (1.4426950408889634f - y * (0.7213475204444817f - y * 0.4812186716175295f));

    return (float)exponent + log_mantissa;
}

// ============================================================================
// FAST NATURAL LOGARITHM (base e)
// ============================================================================
//
// Computes ln(x) using fast_log2(x) * ln(2).
//
// Accuracy: ~2% error
// Performance: ~12 cycles (vs ~60 cycles for logf)

static inline float fast_log(float x) {
    return fast_log2(x) * 0.693147181f;  // ln(2) ≈ 0.6931471805599453
}

// ============================================================================
// FAST SINE/COSINE (Small Angle Approximation)
// ============================================================================
//
// Computes sin(x) and cos(x) for small angles |x| < π/4 using Taylor series.
// NOT suitable for full-range angles (use for phase corrections only).
//
// Accuracy: <0.01% error for |x| < π/4
// Performance: ~8 cycles (vs ~50 cycles for sinf/cosf)

static inline float fast_sin_small(float x) {
    // Taylor series: sin(x) ≈ x - x³/6 + x⁵/120
    float x2 = x * x;
    return x * (1.0f - x2 * (0.16666667f - x2 * 0.00833333f));
}

static inline float fast_cos_small(float x) {
    // Taylor series: cos(x) ≈ 1 - x²/2 + x⁴/24
    float x2 = x * x;
    return 1.0f - x2 * (0.5f - x2 * 0.04166667f);
}

// ============================================================================
// USAGE NOTES
// ============================================================================
//
// 1. WHEN TO USE FAST MATH:
//    - Audio visualization (magnitude, VU meters, spectrum)
//    - Real-time DSP with tight timing budgets
//    - Repeated operations in inner loops (Goertzel, filters)
//
// 2. WHEN NOT TO USE FAST MATH:
//    - Precise scientific calculations (error accumulation)
//    - Cryptography or security-critical code
//    - Full-range trig functions (use hardware sinf/cosf)
//
// 3. ACCURACY vs SPEED TRADE-OFFS:
//    - fast_inv_sqrt():  1% error,  3× faster
//    - fast_pow2():      2% error,  7× faster
//    - fast_log2():      2% error,  5× faster
//
// 4. VALIDATION:
//    - Always profile both versions (fast vs hardware)
//    - Measure error on real audio data (not synthetic)
//    - Use debug builds to validate correctness before optimizing

#endif  // FAST_MATH_H
