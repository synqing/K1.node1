#pragma once

#include <cstddef>
#include <cstring>
#if __has_include(<esp_dsp.h>)
#include <esp_dsp.h>
#endif

// Lightweight wrappers around ESP-DSP functions with safe fallbacks.
// These provide accelerated array operations used by patterns (Pitch, Bloom).

// Multiply array by constant in-place (length elements)
inline void dsps_mulc_f32_inplace(float* arr, int length, float multiplier) {
    if (!arr || length <= 0) return;
#if __has_include(<esp_dsp.h>)
    // Use ESP-DSP if available: dest = src * c
    // dsps_mulc_f32(src, dest, length, multiplier, stride_src, stride_dest)
    // In-place: src==dest is supported
    dsps_mulc_f32(arr, arr, length, multiplier, 1, 1);
#else
    for (int i = 0; i < length; ++i) {
        arr[i] *= multiplier;
    }
#endif
}

// Add src into dest (dest += src)
inline void dsps_add_f32_accum(float* dest, const float* src, int length) {
    if (!dest || !src || length <= 0) return;
#if __has_include(<esp_dsp.h>)
    // dsps_add_f32(a, b, c, length, str_a, str_b, str_c)
    // We want: dest = dest + src
    dsps_add_f32(dest, src, dest, length, 1, 1, 1);
#else
    for (int i = 0; i < length; ++i) {
        dest[i] += src[i];
    }
#endif
}

// Accelerated memcpy (falls back to std::memcpy)
inline void dsps_memcpy_accel(void* dest, const void* src, std::size_t bytes) {
    if (!dest || !src || bytes == 0) return;
#if __has_include(<esp_dsp.h>)
    // No direct DSP memcpy; use std::memcpy which is robust on ESP32
    std::memcpy(dest, src, bytes);
#else
    std::memcpy(dest, src, bytes);
#endif
}

// Accelerated memset for float arrays (sets to value)
inline void dsps_memset_f32(float* dest, int length, float value) {
    if (!dest || length <= 0) return;
    for (int i = 0; i < length; ++i) dest[i] = value;
}

// Dot-product: returns sum(src1[i] * src2[i]) over length
inline float dsps_dotprod_f32_sum(const float* a, const float* b, int length) {
    if (!a || !b || length <= 0) return 0.0f;
    float dest = 0.0f;
#if __has_include(<esp_dsp.h>)
    // Use optimized implementation when available
    // The API accumulates into *dest
    dsps_dotprod_f32(a, b, &dest, length);
#else
    for (int i = 0; i < length; ++i) dest += a[i] * b[i];
#endif
    return dest;
}
