#pragma once

#include <cmath>

// Easing Functions Library
// All functions take t in range [0.0, 1.0] and return transformed value in range [0.0, 1.0]
// Based on Lightwave TransitionEngine easing curves
// Performance target: <1µs per call on ESP32-S3 @ 240MHz

// ============================================================================
// LINEAR
// ============================================================================

// Linear: Constant rate, no acceleration
inline float ease_linear(float t) {
    return t;
}

// ============================================================================
// QUADRATIC (t²)
// ============================================================================

// Quadratic In: Accelerating from zero velocity
inline float ease_quad_in(float t) {
    return t * t;
}

// Quadratic Out: Decelerating to zero velocity
inline float ease_quad_out(float t) {
    return t * (2.0f - t);
}

// Quadratic InOut: Acceleration until halfway, then deceleration
inline float ease_quad_in_out(float t) {
    if (t < 0.5f) {
        return 2.0f * t * t;
    } else {
        return -1.0f + (4.0f - 2.0f * t) * t;
    }
}

// ============================================================================
// CUBIC (t³)
// ============================================================================

// Cubic In: Stronger acceleration from zero velocity
inline float ease_cubic_in(float t) {
    return t * t * t;
}

// Cubic Out: Stronger deceleration to zero velocity
inline float ease_cubic_out(float t) {
    float f = t - 1.0f;
    return f * f * f + 1.0f;
}

// Cubic InOut: Strong acceleration then deceleration
inline float ease_cubic_in_out(float t) {
    if (t < 0.5f) {
        return 4.0f * t * t * t;
    } else {
        float f = (2.0f * t - 2.0f);
        return 0.5f * f * f * f + 1.0f;
    }
}

// ============================================================================
// QUARTIC (t⁴)
// ============================================================================

// Quartic In: Very strong acceleration from zero velocity
inline float ease_quart_in(float t) {
    return t * t * t * t;
}

// Quartic Out: Very strong deceleration to zero velocity
inline float ease_quart_out(float t) {
    float f = t - 1.0f;
    return 1.0f - (f * f * f * f);
}

// Quartic InOut: Very strong acceleration then deceleration
inline float ease_quart_in_out(float t) {
    if (t < 0.5f) {
        return 8.0f * t * t * t * t;
    } else {
        float f = t - 1.0f;
        return 1.0f - 8.0f * f * f * f * f;
    }
}

// ============================================================================
// ELASTIC (oscillating with exponential decay)
// ============================================================================

// Elastic In: Elastic snap effect, oscillates before reaching start
inline float ease_elastic_in(float t) {
    if (t == 0.0f || t == 1.0f) return t;
    return sinf(13.0f * M_PI_2 * t) * powf(2.0f, 10.0f * (t - 1.0f));
}

// Elastic Out: Elastic snap effect, oscillates before settling at end
inline float ease_elastic_out(float t) {
    if (t == 0.0f || t == 1.0f) return t;
    return sinf(-13.0f * M_PI_2 * (t + 1.0f)) * powf(2.0f, -10.0f * t) + 1.0f;
}

// Elastic InOut: Elastic snap on both ends
inline float ease_elastic_in_out(float t) {
    if (t == 0.0f || t == 1.0f) return t;
    if (t < 0.5f) {
        return 0.5f * sinf(13.0f * M_PI_2 * (2.0f * t)) * powf(2.0f, 10.0f * ((2.0f * t) - 1.0f));
    } else {
        return 0.5f * (sinf(-13.0f * M_PI_2 * ((2.0f * t - 1.0f) + 1.0f)) * powf(2.0f, -10.0f * (2.0f * t - 1.0f)) + 2.0f);
    }
}

// ============================================================================
// BOUNCE (bouncing ball effect)
// ============================================================================

// Bounce Out: Bouncing ball settling down
inline float ease_bounce_out(float t) {
    const float n1 = 7.5625f;
    const float d1 = 2.75f;

    if (t < 1.0f / d1) {
        return n1 * t * t;
    } else if (t < 2.0f / d1) {
        t -= 1.5f / d1;
        return n1 * t * t + 0.75f;
    } else if (t < 2.5f / d1) {
        t -= 2.25f / d1;
        return n1 * t * t + 0.9375f;
    } else {
        t -= 2.625f / d1;
        return n1 * t * t + 0.984375f;
    }
}

// Bounce In: Inverted bounce out
inline float ease_bounce_in(float t) {
    return 1.0f - ease_bounce_out(1.0f - t);
}

// Bounce InOut: Bounce on both ends
inline float ease_bounce_in_out(float t) {
    if (t < 0.5f) {
        return 0.5f * ease_bounce_in(t * 2.0f);
    } else {
        return 0.5f * ease_bounce_out(t * 2.0f - 1.0f) + 0.5f;
    }
}

// ============================================================================
// BACK (overshoot/anticipation)
// ============================================================================

// Back In: Slight backward motion before forward (anticipation)
inline float ease_back_in(float t) {
    const float s = 1.70158f;
    return t * t * ((s + 1.0f) * t - s);
}

// Back Out: Overshoot then settle back (overshoot)
inline float ease_back_out(float t) {
    const float s = 1.70158f;
    float f = t - 1.0f;
    return f * f * ((s + 1.0f) * f + s) + 1.0f;
}

// Back InOut: Anticipation and overshoot
inline float ease_back_in_out(float t) {
    const float s = 1.70158f * 1.525f;
    if (t < 0.5f) {
        float f = 2.0f * t;
        return 0.5f * (f * f * ((s + 1.0f) * f - s));
    } else {
        float f = 2.0f * t - 2.0f;
        return 0.5f * (f * f * ((s + 1.0f) * f + s) + 2.0f);
    }
}
