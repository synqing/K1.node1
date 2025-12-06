#pragma once

#include <Arduino.h>
#include <FastLED.h>
#include "../led_driver.h"

/**
 * K1.node1 Transition Engine
 *
 * Ported from LC_SelfContained with adaptations for:
 * - CRGBF (float RGB) buffer format instead of CRGB (uint8)
 * - 160 LEDs (dual 80 LED strips) instead of 320
 * - LED 79 as center point (STRIP_CENTER_POINT)
 * - K1.node1 center-origin topology
 *
 * Provides sophisticated transitions between patterns with:
 * - 12 transition types (all CENTER ORIGIN compliant)
 * - 15 easing curves for smooth animations
 * - Dual-strip aware rendering
 * - Memory-efficient implementation
 */

enum TransitionType {
    TRANSITION_FADE,          // CENTER ORIGIN crossfade - radiates from center
    TRANSITION_WIPE_OUT,      // Wipe from center outward
    TRANSITION_WIPE_IN,       // Wipe from edges inward
    TRANSITION_DISSOLVE,      // Random pixel transition
    TRANSITION_PHASE_SHIFT,   // Frequency-based morph
    TRANSITION_PULSEWAVE,     // Concentric energy pulses from center
    TRANSITION_IMPLOSION,     // Particles converge and collapse to center
    TRANSITION_IRIS,          // Mechanical aperture open/close from center
    TRANSITION_NUCLEAR,       // Chain reaction explosion from center
    TRANSITION_STARGATE,      // Event horizon portal effect at center
    TRANSITION_KALEIDOSCOPE,  // Symmetric crystal patterns from center
    TRANSITION_MANDALA,       // Sacred geometry radiating from center
    TRANSITION_COUNT
};

enum EasingCurve {
    EASE_LINEAR,
    EASE_IN_QUAD,
    EASE_OUT_QUAD,
    EASE_IN_OUT_QUAD,
    EASE_IN_CUBIC,
    EASE_OUT_CUBIC,
    EASE_IN_OUT_CUBIC,
    EASE_IN_ELASTIC,
    EASE_OUT_ELASTIC,
    EASE_IN_OUT_ELASTIC,
    EASE_IN_BOUNCE,
    EASE_OUT_BOUNCE,
    EASE_IN_BACK,
    EASE_OUT_BACK,
    EASE_IN_OUT_BACK
};

class TransitionEngine {
private:
    // Buffer pointers (CRGBF for K1.node1)
    CRGBF* m_sourceBuffer;
    CRGBF* m_targetBuffer;
    CRGBF* m_outputBuffer;
    uint16_t m_numLeds;

    // Transition state
    TransitionType m_type = TRANSITION_FADE;
    EasingCurve m_curve = EASE_IN_OUT_QUAD;
    uint32_t m_startTime = 0;
    uint32_t m_duration = 1000;
    float m_progress = 0.0f;
    bool m_active = false;

    // CENTER ORIGIN support (K1.node1 uses LED 79)
    uint16_t m_centerPoint;
    bool m_dualStripMode = true;  // K1.node1 always dual-strip

    // Effect-specific state
    struct TransitionState {
        // Dissolve effect
        uint8_t pixelOrder[NUM_LEDS];
        uint16_t dissolveIndex;

        // Phase shift
        float phaseOffset;

        // Pulsewave effect
        struct Pulse {
            float radius;
            float intensity;
            float velocity;
        } pulses[5];
        uint8_t pulseCount;
        uint32_t lastPulse;

        // Implosion effect
        struct ImplodeParticle {
            float radius;
            float angle;
            float velocity;
            uint8_t hue;
            uint8_t brightness;
        } implodeParticles[30];

        // Iris effect
        float irisRadius;
        uint8_t bladeCount;
        float bladeAngle;

        // Nuclear effect
        float shockwaveRadius;
        float radiationIntensity;
        uint8_t chainReactions[20];
        uint8_t reactionCount;

        // Stargate effect
        float eventHorizonRadius;
        float chevronAngle;
        uint8_t activeChevrons;
        float wormholePhase;

        // Kaleidoscope effect
        uint8_t symmetryFold;
        float rotationAngle;

        // Mandala effect
        float mandalaPhase;
        uint8_t ringCount;
        float ringRadii[8];
    } m_state;

public:
    TransitionEngine(uint16_t numLeds = NUM_LEDS)
        : m_numLeds(numLeds), m_centerPoint(STRIP_CENTER_POINT) {
        // Initialize state
        resetState();
    }

    // Start a new transition
    void startTransition(
        CRGBF* source,
        CRGBF* target,
        CRGBF* output,
        TransitionType type,
        uint32_t duration,
        EasingCurve curve = EASE_IN_OUT_QUAD
    );

    // Update transition (returns true while active)
    bool update();

    // Query state
    bool isActive() const { return m_active; }
    float getProgress() const { return m_progress; }
    TransitionType getCurrentType() const { return m_type; }
    uint32_t getDuration() const { return m_duration; }

    // Get a random transition type
    static TransitionType getRandomTransition();

private:
    // Reset transition state
    void resetState();

    // Easing functions
    float applyEasing(float t, EasingCurve curve);

    // Transition implementations - CENTER ORIGIN ONLY
    void applyFade();
    void applyWipe(bool outward);
    void applyDissolve();
    void applyPhaseShift();
    void applyPulsewave();
    void applyImplosion();
    void applyIris();
    void applyNuclear();
    void applyStargate();
    void applyKaleidoscope();
    void applyMandala();

    // Helper functions
    void initializeDissolve();
    void initializePulsewave();
    void initializeImplosion();
    void initializeIris();
    void initializeNuclear();
    void initializeStargate();
    void initializeKaleidoscope();
    void initializeMandala();

    // Utility functions
    CRGBF lerpColor(CRGBF from, CRGBF to, float progress);
    float getDistanceFromCenter(uint16_t index);
};

// Implementation
inline void TransitionEngine::startTransition(
    CRGBF* source,
    CRGBF* target,
    CRGBF* output,
    TransitionType type,
    uint32_t duration,
    EasingCurve curve
) {
    m_sourceBuffer = source;
    m_targetBuffer = target;
    m_outputBuffer = output;
    m_type = type;
    m_duration = duration;
    m_curve = curve;
    m_startTime = millis();
    m_active = true;
    m_progress = 0.0f;

    // Initialize transition-specific state
    resetState();

    switch (type) {
        case TRANSITION_DISSOLVE:
            initializeDissolve();
            break;
        case TRANSITION_PULSEWAVE:
            initializePulsewave();
            break;
        case TRANSITION_IMPLOSION:
            initializeImplosion();
            break;
        case TRANSITION_IRIS:
            initializeIris();
            break;
        case TRANSITION_NUCLEAR:
            initializeNuclear();
            break;
        case TRANSITION_STARGATE:
            initializeStargate();
            break;
        case TRANSITION_KALEIDOSCOPE:
            initializeKaleidoscope();
            break;
        case TRANSITION_MANDALA:
            initializeMandala();
            break;
        default:
            break;
    }
}

inline bool TransitionEngine::update() {
    if (!m_active) return false;

    // Calculate progress
    uint32_t elapsed = millis() - m_startTime;
    if (elapsed >= m_duration) {
        m_progress = 1.0f;
        m_active = false;

        // Copy final state
        memcpy(m_outputBuffer, m_targetBuffer, m_numLeds * sizeof(CRGBF));
        return false;
    }

    // Apply easing
    float rawProgress = (float)elapsed / m_duration;
    m_progress = applyEasing(rawProgress, m_curve);

    // Apply transition effect - CENTER ORIGIN ONLY
    switch (m_type) {
        case TRANSITION_FADE:
            applyFade();
            break;
        case TRANSITION_WIPE_OUT:
            applyWipe(true);
            break;
        case TRANSITION_WIPE_IN:
            applyWipe(false);
            break;
        case TRANSITION_DISSOLVE:
            applyDissolve();
            break;
        case TRANSITION_PHASE_SHIFT:
            applyPhaseShift();
            break;
        case TRANSITION_PULSEWAVE:
            applyPulsewave();
            break;
        case TRANSITION_IMPLOSION:
            applyImplosion();
            break;
        case TRANSITION_IRIS:
            applyIris();
            break;
        case TRANSITION_NUCLEAR:
            applyNuclear();
            break;
        case TRANSITION_STARGATE:
            applyStargate();
            break;
        case TRANSITION_KALEIDOSCOPE:
            applyKaleidoscope();
            break;
        case TRANSITION_MANDALA:
            applyMandala();
            break;
    }

    return true;
}

inline void TransitionEngine::applyFade() {
    // CENTER ORIGIN FADE - fade radiates from center outward
    for (uint16_t i = 0; i < m_numLeds; i++) {
        // Calculate distance from center (LED 79)
        float distFromCenter = getDistanceFromCenter(i);

        // Fade progress based on distance from center
        float localProgress = m_progress * 2.0f - distFromCenter;
        localProgress = constrain(localProgress, 0.0f, 1.0f);

        m_outputBuffer[i] = lerpColor(m_sourceBuffer[i], m_targetBuffer[i], localProgress);
    }
}

inline void TransitionEngine::applyWipe(bool outward) {
    float radius = m_progress * (float)STRIP_HALF_LENGTH;

    for (uint16_t i = 0; i < m_numLeds; i++) {
        float distFromCenter = getDistanceFromCenter(i) * STRIP_HALF_LENGTH;

        bool showTarget = outward ?
            (distFromCenter <= radius) :
            (distFromCenter >= (float)STRIP_HALF_LENGTH - radius);

        m_outputBuffer[i] = showTarget ? m_targetBuffer[i] : m_sourceBuffer[i];
    }
}

inline void TransitionEngine::applyDissolve() {
    uint16_t pixelsToShow = m_progress * m_numLeds;

    for (uint16_t i = 0; i < m_numLeds; i++) {
        uint16_t pixelIndex = m_state.pixelOrder[i];
        if (i < pixelsToShow) {
            m_outputBuffer[pixelIndex] = m_targetBuffer[pixelIndex];
        } else {
            m_outputBuffer[pixelIndex] = m_sourceBuffer[pixelIndex];
        }
    }
}

inline void TransitionEngine::applyPhaseShift() {
    // Frequency-based morphing
    m_state.phaseOffset += m_progress * 0.2f;

    for (uint16_t i = 0; i < m_numLeds; i++) {
        float position = (float)i / m_numLeds;
        float wave = sin(position * TWO_PI * 3 + m_state.phaseOffset);
        float blend = (wave + 1.0f) * 0.5f * m_progress;

        m_outputBuffer[i] = lerpColor(m_sourceBuffer[i], m_targetBuffer[i], blend);
    }
}

inline void TransitionEngine::applyPulsewave() {
    // Copy source as base
    memcpy(m_outputBuffer, m_sourceBuffer, m_numLeds * sizeof(CRGBF));

    // Generate new pulses periodically
    uint32_t now = millis();
    if (now - m_state.lastPulse > 200 && m_state.pulseCount < 5) {
        m_state.pulses[m_state.pulseCount].radius = 0;
        m_state.pulses[m_state.pulseCount].intensity = 1.0f;
        m_state.pulses[m_state.pulseCount].velocity = 2.0f + m_progress * 3.0f;
        m_state.pulseCount++;
        m_state.lastPulse = now;
    }

    // Update and render pulses
    for (uint8_t p = 0; p < m_state.pulseCount; p++) {
        auto& pulse = m_state.pulses[p];
        pulse.radius += pulse.velocity;
        pulse.intensity *= 0.98f; // Decay

        // Render pulse ring
        for (uint16_t i = 0; i < m_numLeds; i++) {
            float dist = getDistanceFromCenter(i) * STRIP_HALF_LENGTH;
            float ringDist = abs(dist - pulse.radius);

            if (ringDist < 5.0f) {
                float ringIntensity = (1.0f - ringDist / 5.0f) * pulse.intensity;
                float blendAmount = ringIntensity * m_progress;
                m_outputBuffer[i] = lerpColor(m_outputBuffer[i], m_targetBuffer[i], blendAmount);
            }
        }
    }
}

inline void TransitionEngine::applyImplosion() {
    // Start with target
    memcpy(m_outputBuffer, m_targetBuffer, m_numLeds * sizeof(CRGBF));

    // Update particles converging to center
    for (uint8_t i = 0; i < 30; i++) {
        auto& p = m_state.implodeParticles[i];

        // Move toward center with acceleration
        p.radius *= (0.95f - m_progress * 0.1f);
        p.velocity *= 1.05f;

        // Render particle
        if (p.radius > 1.0f) {
            for (uint16_t led = 0; led < m_numLeds; led++) {
                float dist = getDistanceFromCenter(led) * STRIP_HALF_LENGTH;
                if (abs(dist - p.radius) < 2.0f) {
                    CRGB particleColor = CHSV(p.hue, 255, p.brightness * (1.0f - m_progress));
                    CRGBF pColorF = CRGBF(particleColor.r / 255.0f, particleColor.g / 255.0f, particleColor.b / 255.0f);
                    m_outputBuffer[led] = lerpColor(m_outputBuffer[led], pColorF, 0.8f);
                }
            }
        }
    }

    // Flash at center on impact
    if (m_progress > 0.8f) {
        float flash = (m_progress - 0.8f) * 5.0f;
        float flashRadius = flash;
        CRGBF whiteF = CRGBF(1.0f, 1.0f, 1.0f);
        for (uint16_t i = 0; i < m_numLeds; i++) {
            if (getDistanceFromCenter(i) < flashRadius) {
                m_outputBuffer[i] = lerpColor(m_outputBuffer[i], whiteF, 1.0f - flash);
            }
        }
    }
}

inline void TransitionEngine::applyIris() {
    // Mechanical aperture effect
    float targetRadius = m_progress * STRIP_HALF_LENGTH;

    for (uint16_t i = 0; i < m_numLeds; i++) {
        float dist = getDistanceFromCenter(i) * STRIP_HALF_LENGTH;

        // Create hexagonal iris shape
        float angle = atan2(i - m_centerPoint, 1);
        float bladeDist = dist * (1.0f + 0.1f * sin(angle * m_state.bladeCount + m_state.bladeAngle));

        bool showTarget = bladeDist < targetRadius;

        // Smooth edge
        if (abs(bladeDist - targetRadius) < 2.0f) {
            float blend = (1.0f - abs(bladeDist - targetRadius) / 2.0f);
            m_outputBuffer[i] = lerpColor(m_sourceBuffer[i], m_targetBuffer[i], showTarget ? blend : 1.0f - blend);
        } else {
            m_outputBuffer[i] = showTarget ? m_targetBuffer[i] : m_sourceBuffer[i];
        }
    }
}

inline void TransitionEngine::applyNuclear() {
    // Copy source
    memcpy(m_outputBuffer, m_sourceBuffer, m_numLeds * sizeof(CRGBF));

    // Expanding shockwave
    m_state.shockwaveRadius = m_progress * STRIP_HALF_LENGTH * 1.5f;

    // Chain reactions
    for (uint8_t i = 0; i < m_state.reactionCount; i++) {
        uint16_t pos = m_state.chainReactions[i];
        float localRadius = (m_progress - i * 0.05f) * 20.0f;

        if (localRadius > 0) {
            for (uint16_t led = 0; led < m_numLeds; led++) {
                float dist = abs((int)led - (int)pos);
                if (dist < localRadius) {
                    float intensity = (1.0f - dist / localRadius) * (1.0f - m_progress);
                    CRGBF flash = CRGBF(1.0f, 0.78f, 0.39f);
                    m_outputBuffer[led] = lerpColor(m_outputBuffer[led], flash, intensity);
                }
            }
        }
    }

    // Main shockwave
    for (uint16_t i = 0; i < m_numLeds; i++) {
        float dist = getDistanceFromCenter(i) * STRIP_HALF_LENGTH;

        if (dist < m_state.shockwaveRadius) {
            // Inside shockwave - show target with radiation glow
            float radiation = sin(dist * 0.5f + m_progress * 10.0f) * 0.3f + 0.7f;
            CRGBF glowColor = lerpColor(m_targetBuffer[i], CRGBF(1.0f, 0.39f, 0), radiation * 0.4f);
            m_outputBuffer[i] = glowColor;
        } else if (dist < m_state.shockwaveRadius + 5) {
            // Shockwave edge
            float edge = 1.0f - (dist - m_state.shockwaveRadius) / 5.0f;
            CRGBF edgeColor = CRGBF(1.0f, 1.0f, 0.78f);
            m_outputBuffer[i] = lerpColor(m_sourceBuffer[i], edgeColor, edge);
        }
    }
}

inline void TransitionEngine::applyStargate() {
    // Event horizon effect
    float horizonRadius = m_progress * STRIP_HALF_LENGTH * (1.0f + 0.1f * sin(m_state.wormholePhase));

    for (uint16_t i = 0; i < m_numLeds; i++) {
        float dist = getDistanceFromCenter(i) * STRIP_HALF_LENGTH;

        if (dist < horizonRadius) {
            // Inside event horizon - swirling wormhole
            float swirl = sin(dist * 0.2f + m_state.wormholePhase + m_state.chevronAngle);
            uint8_t hue = (swirl * 30 + 160 + m_progress * 100); // Blue-purple
            CRGB wormholeColor = CHSV(hue, 255, 255);
            CRGBF wColorF = CRGBF(wormholeColor.r / 255.0f, wormholeColor.g / 255.0f, wormholeColor.b / 255.0f);
            m_outputBuffer[i] = lerpColor(m_targetBuffer[i], wColorF, 0.5f);
        } else if (dist < horizonRadius + 10) {
            // Event horizon edge
            float edgeDist = dist - horizonRadius;
            CRGBF edgeColor = CRGBF(0, 0.2f, 0.39f);
            float blend = 1.0f - edgeDist / 10.0f;
            m_outputBuffer[i] = lerpColor(m_sourceBuffer[i], edgeColor, blend);
        } else {
            m_outputBuffer[i] = m_sourceBuffer[i];
        }
    }

    // Update animation
    m_state.wormholePhase += 0.1f;
    m_state.chevronAngle += 0.02f;
}

inline void TransitionEngine::applyKaleidoscope() {
    // Crystal-like symmetric patterns
    for (uint16_t i = 0; i < m_numLeds; i++) {
        float dist = getDistanceFromCenter(i) * STRIP_HALF_LENGTH;
        float angle = atan2(i - m_centerPoint, dist + 1);

        // Apply symmetry fold
        float foldedAngle = fmod(abs(angle + m_state.rotationAngle), TWO_PI / m_state.symmetryFold);

        // Create kaleidoscope pattern
        float pattern = sin(dist * 0.1f + foldedAngle * 10) *
                       cos(foldedAngle * m_state.symmetryFold);

        // Blend based on pattern and progress
        float blendAmount = (pattern * 0.5f + 0.5f) * m_progress;

        // Add crystalline color shift
        CRGBF crystalColor = m_targetBuffer[i];
        crystalColor.r *= (0.78f + pattern * 0.22f);
        crystalColor.g *= (0.78f + pattern * 0.22f);

        m_outputBuffer[i] = lerpColor(m_sourceBuffer[i], crystalColor, blendAmount);
    }

    m_state.rotationAngle += 0.02f;
}

inline void TransitionEngine::applyMandala() {
    // Sacred geometry patterns
    for (uint16_t i = 0; i < m_numLeds; i++) {
        float dist = getDistanceFromCenter(i) * STRIP_HALF_LENGTH;

        // Calculate which ring this LED belongs to
        uint8_t ring = 0;
        float ringIntensity = 0;

        for (uint8_t r = 0; r < m_state.ringCount; r++) {
            float ringDist = abs(dist - m_state.ringRadii[r]);
            if (ringDist < 3.0f) {
                ring = r;
                ringIntensity = 1.0f - ringDist / 3.0f;
                break;
            }
        }

        // Apply mandala pattern
        if (ringIntensity > 0) {
            float angle = atan2(i - m_centerPoint, 1);
            float pattern = sin(angle * (ring + 3) + m_state.mandalaPhase * (ring + 1));

            uint8_t hue = (ring * 30 + pattern * 20 + m_progress * 100);
            CRGB mandalaColor = CHSV(hue, 200, 255 * ringIntensity);
            CRGBF mColorF = CRGBF(mandalaColor.r / 255.0f, mandalaColor.g / 255.0f, mandalaColor.b / 255.0f);

            float blend = m_progress * ringIntensity;
            CRGBF mixed = lerpColor(m_targetBuffer[i], mColorF, 0.5f);
            m_outputBuffer[i] = lerpColor(m_sourceBuffer[i], mixed, blend);
        } else {
            // Fade between source and target
            float fadeBlend = m_progress * m_progress;
            m_outputBuffer[i] = lerpColor(m_sourceBuffer[i], m_targetBuffer[i], fadeBlend);
        }
    }

    m_state.mandalaPhase += 0.05f;
}

inline float TransitionEngine::applyEasing(float t, EasingCurve curve) {
    switch (curve) {
        case EASE_LINEAR:
            return t;

        case EASE_IN_QUAD:
            return t * t;

        case EASE_OUT_QUAD:
            return t * (2 - t);

        case EASE_IN_OUT_QUAD:
            return t < 0.5f ? 2 * t * t : -1 + (4 - 2 * t) * t;

        case EASE_IN_CUBIC:
            return t * t * t;

        case EASE_OUT_CUBIC:
            return (--t) * t * t + 1;

        case EASE_IN_OUT_CUBIC:
            return t < 0.5f ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;

        case EASE_IN_ELASTIC:
            return t == 0 ? 0 : t == 1 ? 1 : -pow(2, 10 * (t - 1)) * sin((t - 1.1f) * 5 * PI);

        case EASE_OUT_ELASTIC:
            return t == 0 ? 0 : t == 1 ? 1 : pow(2, -10 * t) * sin((t - 0.1f) * 5 * PI) + 1;

        case EASE_IN_OUT_ELASTIC:
            if (t == 0) return 0;
            if (t == 1) return 1;
            t *= 2;
            if (t < 1) return -0.5f * pow(2, 10 * (t - 1)) * sin((t - 1.1f) * 5 * PI);
            return 0.5f * pow(2, -10 * (t - 1)) * sin((t - 1.1f) * 5 * PI) + 1;

        case EASE_IN_BOUNCE:
            return 1 - applyEasing(1 - t, EASE_OUT_BOUNCE);

        case EASE_OUT_BOUNCE:
            if (t < 1 / 2.75f) {
                return 7.5625f * t * t;
            } else if (t < 2 / 2.75f) {
                t -= 1.5f / 2.75f;
                return 7.5625f * t * t + 0.75f;
            } else if (t < 2.5 / 2.75f) {
                t -= 2.25f / 2.75f;
                return 7.5625f * t * t + 0.9375f;
            } else {
                t -= 2.625f / 2.75f;
                return 7.5625f * t * t + 0.984375f;
            }

        case EASE_IN_BACK:
            return t * t * (2.70158f * t - 1.70158f);

        case EASE_OUT_BACK:
            return 1 + (--t) * t * (2.70158f * t + 1.70158f);

        case EASE_IN_OUT_BACK:
            t *= 2;
            if (t < 1) return 0.5f * t * t * (3.5949095f * t - 2.5949095f);
            t -= 2;
            return 0.5f * (t * t * (3.5949095f * t + 2.5949095f) + 2);

        default:
            return t;
    }
}

inline CRGBF TransitionEngine::lerpColor(CRGBF from, CRGBF to, float progress) {
    progress = constrain(progress, 0.0f, 1.0f);
    return CRGBF(
        from.r + (to.r - from.r) * progress,
        from.g + (to.g - from.g) * progress,
        from.b + (to.b - from.b) * progress
    );
}

inline void TransitionEngine::resetState() {
    // Clear state
    memset(&m_state, 0, sizeof(m_state));
}

inline void TransitionEngine::initializeDissolve() {
    // Initialize random pixel order
    for (uint16_t i = 0; i < m_numLeds; i++) {
        m_state.pixelOrder[i] = i;
    }

    // Fisher-Yates shuffle
    for (uint16_t i = m_numLeds - 1; i > 0; i--) {
        uint16_t j = random16(i + 1);
        uint8_t temp = m_state.pixelOrder[i];
        m_state.pixelOrder[i] = m_state.pixelOrder[j];
        m_state.pixelOrder[j] = temp;
    }
}

inline void TransitionEngine::initializePulsewave() {
    m_state.pulseCount = 0;
    m_state.lastPulse = 0;
    // Initial pulse from center
    m_state.pulses[0].radius = 0;
    m_state.pulses[0].intensity = 1.0f;
    m_state.pulses[0].velocity = 3.0f;
    m_state.pulseCount = 1;
}

inline void TransitionEngine::initializeImplosion() {
    // Create particles at edges converging to center
    for (uint8_t i = 0; i < 30; i++) {
        auto& p = m_state.implodeParticles[i];
        p.radius = STRIP_HALF_LENGTH + random8(20, 40);
        p.angle = (i * TWO_PI / 30) + random8() * 0.1f;
        p.velocity = 1.0f + random8() * 0.02f;
        p.hue = random8();
        p.brightness = 200 + random8(55);
    }
}

inline void TransitionEngine::initializeIris() {
    m_state.irisRadius = 0;
    m_state.bladeCount = 6; // Hexagonal iris
    m_state.bladeAngle = 0;
}

inline void TransitionEngine::initializeNuclear() {
    m_state.shockwaveRadius = 0;
    m_state.radiationIntensity = 1.0f;
    m_state.reactionCount = 0;

    // Generate chain reaction points around center
    for (uint8_t i = 0; i < 5; i++) {
        m_state.chainReactions[i] = STRIP_CENTER_POINT + random16(40) - 20;
        m_state.reactionCount++;
    }
}

inline void TransitionEngine::initializeStargate() {
    m_state.eventHorizonRadius = 0;
    m_state.chevronAngle = 0;
    m_state.activeChevrons = 7;
    m_state.wormholePhase = 0;
}

inline void TransitionEngine::initializeKaleidoscope() {
    m_state.symmetryFold = 6; // 6-fold symmetry
    m_state.rotationAngle = 0;
}

inline void TransitionEngine::initializeMandala() {
    m_state.mandalaPhase = 0;
    m_state.ringCount = 5;

    // Create concentric rings
    for (uint8_t i = 0; i < m_state.ringCount; i++) {
        m_state.ringRadii[i] = (i + 1) * (float)STRIP_HALF_LENGTH / (m_state.ringCount + 1);
    }
}

inline TransitionType TransitionEngine::getRandomTransition() {
    // Weighted random selection for variety - CENTER ORIGIN ONLY
    uint8_t weights[] = {
        25,  // FADE
        20,  // WIPE_OUT - from center
        20,  // WIPE_IN - to center
        15,  // DISSOLVE
        5,   // PHASE_SHIFT
        10,  // PULSEWAVE - energy rings
        10,  // IMPLOSION - particles collapse
        8,   // IRIS - mechanical aperture
        7,   // NUCLEAR - chain reaction
        6,   // STARGATE - wormhole portal
        5,   // KALEIDOSCOPE - crystal patterns
        4    // MANDALA - sacred geometry
    };

    uint8_t total = 0;
    for (uint8_t w : weights) total += w;

    uint8_t r = random8(total);
    uint8_t sum = 0;

    for (uint8_t i = 0; i < TRANSITION_COUNT; i++) {
        sum += weights[i];
        if (r < sum) {
            return (TransitionType)i;
        }
    }

    return TRANSITION_FADE;  // Fallback
}

inline float TransitionEngine::getDistanceFromCenter(uint16_t index) {
    // K1.node1: Dual-strip with LED 79 as center
    // Calculate normalized distance (0.0 = center, 1.0 = edge)
    uint16_t distFromCenter = abs((int)index - (int)STRIP_CENTER_POINT);
    return (float)distFromCenter / STRIP_HALF_LENGTH;
}
