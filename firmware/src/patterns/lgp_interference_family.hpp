// Light Guide Plate (LGP) Interference Pattern Effects
// Ported from K1.Ambience project - advanced wave interference and modal resonance
// Adapted for K1.node1 center-origin dual-strip topology (160 LEDs)

#ifndef LGP_INTERFERENCE_FAMILY_HPP
#define LGP_INTERFERENCE_FAMILY_HPP

#include "pattern_render_context.h"
#include "palettes.h"
#include "emotiscope_helpers.h"
#include <cmath>

// ============== BOX WAVE CONTROLLER ==============
// Creates controllable standing wave boxes
inline void draw_lgp_box_wave(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;

    // Box count: 3-12 boxes based on complexity
    float boxesPerSide = 3.0f + (params.custom_param_1 * 9.0f);  // 3-12 boxes
    float spatialFreq = boxesPerSide * M_PI / STRIP_HALF_LENGTH;

    // Motion phase
    static float motionPhase = 0;
    motionPhase += params.speed * 0.05f;

    for(int i = 0; i < NUM_LEDS; i++) {
        float distFromCenter = fabsf(i - STRIP_CENTER_POINT);

        // Base box pattern
        float boxPhase = distFromCenter * spatialFreq;

        // Motion type based on variation (custom_param_2)
        float boxPattern;
        if (params.custom_param_2 < 0.33f) {
            // Standing waves (original box effect)
            boxPattern = sinf(boxPhase + motionPhase);
        } else if (params.custom_param_2 < 0.66f) {
            // Traveling waves
            float travelPhase = ((float)i / NUM_LEDS) * M_PI * 2.0f * boxesPerSide;
            boxPattern = sinf(travelPhase - motionPhase * 10.0f);
        } else {
            // Rotating/spiral pattern
            float spiralPhase = boxPhase + (i * 0.02f);
            boxPattern = sinf(spiralPhase + motionPhase) * cosf(spiralPhase - motionPhase * 0.5f);
        }

        // Sharpness control via custom_param_3
        if (params.custom_param_3 > 0.5f) {
            // Square wave shaping for sharper boxes
            float sharpness = (params.custom_param_3 - 0.5f) * 4.0f;  // 0-2 range
            boxPattern = tanhf(boxPattern * (1.0f + sharpness)) / tanhf(1.0f + sharpness);
        }

        // Convert to brightness
        float brightness = 0.5f + (0.5f * boxPattern * params.brightness);
        brightness = fmaxf(0.0f, fminf(1.0f, brightness));

        // Color wave overlay
        float hue = fmodf(time * 0.01f + distFromCenter * 0.002f, 1.0f);

        leds[i] = color_from_palette(params.palette_id, hue, brightness);
    }

    apply_background_overlay(context);
}

// ============== HOLOGRAPHIC SHIMMER ==============
// Creates depth illusion through multi-layer interference
inline void draw_lgp_holographic(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;

    static float phase1 = 0, phase2 = 0, phase3 = 0;
    phase1 += params.speed * 0.02f;
    phase2 += params.speed * 0.03f;
    phase3 += params.speed * 0.05f;

    int numLayers = 2 + (int)(params.custom_param_1 * 3);  // 2-5 layers

    for(int i = 0; i < NUM_LEDS; i++) {
        float dist = fabsf(i - STRIP_CENTER_POINT);
        float normalized = dist / STRIP_HALF_LENGTH;

        float layerSum = 0;

        // Layer 1 - Slow, wide pattern
        layerSum += sinf(dist * 0.05f + phase1) * (numLayers >= 1 ? 1.0f : 0);

        // Layer 2 - Medium pattern
        layerSum += sinf(dist * 0.15f + phase2) * 0.7f * (numLayers >= 2 ? 1.0f : 0);

        // Layer 3 - Fast, tight pattern
        layerSum += sinf(dist * 0.3f + phase3) * 0.5f * (numLayers >= 3 ? 1.0f : 0);

        // Layer 4 - Very fast shimmer
        if (numLayers >= 4) {
            layerSum += sinf(dist * 0.6f - phase1 * 3.0f) * 0.3f;
        }

        // Layer 5 - Chaos layer
        if (numLayers >= 5) {
            layerSum += sinf(dist * 1.2f + phase2 * 5.0f) * sinf(phase3) * 0.2f;
        }

        // Normalize and apply intensity
        layerSum = layerSum / numLayers;

        // Variation controls layer interaction (custom_param_2)
        if (params.custom_param_2 < 0.33f) {
            // Additive (bright)
            layerSum = tanhf(layerSum);
        } else if (params.custom_param_2 < 0.66f) {
            // Multiplicative (moiré-like)
            layerSum = layerSum * sinf(normalized * M_PI);
        } else {
            // Differential (edge enhance)
            float nextSum = sinf((dist + 1.0f) * 0.15f + phase2);
            layerSum = (layerSum - nextSum) * 5.0f;
        }

        float brightness = 0.5f + (0.5f * layerSum * params.brightness);
        brightness = fmaxf(0.0f, fminf(1.0f, brightness));

        // Chromatic dispersion effect
        float hue = fmodf(time * 0.01f + dist * 0.005f + layerSum * 0.2f, 1.0f);

        leds[i] = color_from_palette(params.palette_id, hue, brightness);
    }

    apply_background_overlay(context);
}

// ============== MODAL RESONANCE ==============
// Explores different optical cavity modes
inline void draw_lgp_modal_resonance(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;

    // Time-based phase for smooth animation
    float animPhase = time * params.speed * 0.5f;

    float baseMode;
    if (params.custom_param_1 < 0.5f) {
        // Low modes (1-10)
        baseMode = 1.0f + (params.custom_param_1 * 18.0f);  // 1-10
    } else {
        // High modes (10-20) with sweep
        baseMode = 10.0f + sinf(time * params.speed * 0.2f) * 10.0f * (params.custom_param_1 - 0.5f) * 2.0f;
    }

    for(int i = 0; i < NUM_LEDS; i++) {
        float position = (float)i / NUM_LEDS;

        float modalPattern;

        if (params.custom_param_2 < 0.25f) {
            // Pure mode with phase animation
            modalPattern = sinf(position * baseMode * M_PI * 2.0f + animPhase);
        } else if (params.custom_param_2 < 0.5f) {
            // Mode beating (two close modes)
            float mode1 = sinf(position * baseMode * M_PI * 2.0f + animPhase);
            float mode2 = sinf(position * (baseMode + 0.5f) * M_PI * 2.0f + animPhase * 1.1f);
            modalPattern = (mode1 + mode2) / 2.0f;
        } else if (params.custom_param_2 < 0.75f) {
            // Harmonic series
            modalPattern = sinf(position * baseMode * M_PI * 2.0f + animPhase) +
                          sinf(position * baseMode * 2.0f * M_PI * 2.0f + animPhase * 2.0f) * 0.5f +
                          sinf(position * baseMode * 3.0f * M_PI * 2.0f + animPhase * 3.0f) * 0.25f;
            modalPattern /= 1.75f;
        } else {
            // Chaotic mode mixing
            modalPattern = sinf(position * baseMode * M_PI * 2.0f + animPhase) *
                          cosf(position * (baseMode * 1.618f) * M_PI * 2.0f + animPhase * 0.7f) *
                          sinf(animPhase * 5.0f);
        }

        // Apply window function for smoother edges
        float window = sinf(position * M_PI);
        modalPattern *= window;

        float brightness = 0.5f + (0.5f * modalPattern * params.brightness);
        brightness = fmaxf(0.0f, fminf(1.0f, brightness));

        // Color based on mode number and position
        float hue = fmodf(time * 0.01f + baseMode * 0.1f + position * 0.5f, 1.0f);

        leds[i] = color_from_palette(params.palette_id, hue, brightness);
    }

    apply_background_overlay(context);
}

// ============== INTERFERENCE SCANNER ==============
// Creates scanning interference patterns
inline void draw_lgp_interference_scanner(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;

    static float scanPos = 0;
    scanPos += params.speed * 0.1f;

    // Number of interference sources (custom_param_1: 2-5)
    int numSources = 2 + (int)(params.custom_param_1 * 3);

    for(int i = 0; i < NUM_LEDS; i++) {
        float position = (float)i / NUM_LEDS;

        float interference = 0;

        // Generate interference from multiple moving sources
        for(int s = 0; s < numSources; s++) {
            float sourcePhase = (float)s / numSources * M_PI * 2.0f;
            float sourcePos = fmodf(scanPos + sourcePhase, M_PI * 2.0f) / (M_PI * 2.0f);

            // Distance from this source
            float dist = fabsf(position - sourcePos);

            // Wavefront from this source
            float wavelength = 0.1f + params.custom_param_2 * 0.2f;  // 0.1-0.3
            float wave = sinf(dist / wavelength * M_PI * 2.0f + time * 0.1f);

            // Decay with distance
            float decay = expf(-dist * 2.0f);

            interference += wave * decay;
        }

        // Normalize
        interference /= numSources;

        float brightness = 0.5f + (0.5f * interference * params.brightness);
        brightness = fmaxf(0.0f, fminf(1.0f, brightness));

        float hue = fmodf(time * 0.01f + position * 0.3f, 1.0f);

        leds[i] = color_from_palette(params.palette_id, hue, brightness);
    }

    apply_background_overlay(context);
}

// ============== WAVE COLLISION ==============
// Constructive/destructive interference visualization
inline void draw_lgp_wave_collision(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;

    static float phase1 = 0, phase2 = 0;
    phase1 += params.speed * 0.05f;
    phase2 += params.speed * 0.07f;

    // Wave frequency (custom_param_1)
    float freq = 1.0f + params.custom_param_1 * 5.0f;  // 1-6 waves

    for(int i = 0; i < NUM_LEDS; i++) {
        float position = (float)i / NUM_LEDS;

        // Two colliding waves from opposite directions
        float wave1 = sinf(position * freq * M_PI * 2.0f + phase1);
        float wave2 = sinf((1.0f - position) * freq * M_PI * 2.0f + phase2);

        // Interference pattern
        float interference;
        if (params.custom_param_2 < 0.5f) {
            // Additive (constructive + destructive)
            interference = (wave1 + wave2) / 2.0f;
        } else {
            // Multiplicative (envelope)
            interference = wave1 * wave2;
        }

        float brightness = 0.5f + (0.5f * interference * params.brightness);
        brightness = fmaxf(0.0f, fminf(1.0f, brightness));

        float hue = fmodf(time * 0.01f + interference * 0.2f, 1.0f);

        leds[i] = color_from_palette(params.palette_id, hue, brightness);
    }

    apply_background_overlay(context);
}

// ============== SOLITON EXPLORER ==============
// Self-reinforcing wave packets that maintain shape
inline void draw_lgp_soliton_explorer(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;

    static float solitonPos1 = 0, solitonPos2 = 0.5f;

    // Soliton velocities
    float v1 = params.speed * 0.02f;
    float v2 = params.speed * -0.015f;

    solitonPos1 = fmodf(solitonPos1 + v1, 1.0f);
    solitonPos2 = fmodf(solitonPos2 + v2 + 1.0f, 1.0f);

    // Soliton width (custom_param_1)
    float width = 0.05f + params.custom_param_1 * 0.15f;  // 0.05-0.2

    for(int i = 0; i < NUM_LEDS; i++) {
        float position = (float)i / NUM_LEDS;

        // Soliton 1 (sech² profile)
        float dist1 = fabsf(position - solitonPos1);
        if (dist1 > 0.5f) dist1 = 1.0f - dist1;  // Wrap around
        float sech1 = 1.0f / coshf(dist1 / width);
        float soliton1 = sech1 * sech1;

        // Soliton 2
        float dist2 = fabsf(position - solitonPos2);
        if (dist2 > 0.5f) dist2 = 1.0f - dist2;
        float sech2 = 1.0f / coshf(dist2 / width);
        float soliton2 = sech2 * sech2;

        // Combine solitons
        float combined;
        if (params.custom_param_2 < 0.5f) {
            // Pass through each other
            combined = soliton1 + soliton2;
        } else {
            // Interact (collision)
            combined = soliton1 + soliton2 + soliton1 * soliton2;
        }

        float brightness = combined * params.brightness;
        brightness = fmaxf(0.0f, fminf(1.0f, brightness));

        float hue = fmodf(time * 0.01f + combined * 0.3f, 1.0f);

        leds[i] = color_from_palette(params.palette_id, hue, brightness);
    }

    apply_background_overlay(context);
}

// ============== TURING PATTERN ENGINE ==============
// Reaction-diffusion pattern simulation
inline void draw_lgp_turing_patterns(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;

    // Time-based phase for evolving patterns
    float animPhase = time * params.speed * 0.3f;

    // Pattern wavelength (custom_param_1)
    float wavelength = 5.0f + params.custom_param_1 * 20.0f;  // 5-25

    for(int i = 0; i < NUM_LEDS; i++) {
        float dist = fabsf(i - STRIP_CENTER_POINT);

        // Base Turing pattern (simplified) with time evolution
        float pattern1 = sinf(dist / wavelength * M_PI * 2.0f + animPhase);
        float pattern2 = sinf(dist / (wavelength * 2.0f) * M_PI * 2.0f - animPhase * 1.5f);

        // Reaction term
        float reaction = pattern1 * pattern1 - pattern2;

        // Diffusion term (spatial derivative approximation)
        float diffusion = cosf(dist / wavelength * M_PI * 2.0f + animPhase);

        // Combine with varying emphasis (custom_param_2)
        float turingPattern = pattern1 + params.custom_param_2 * (reaction + diffusion * 0.5f);

        float brightness = 0.5f + (0.3f * turingPattern * params.brightness);
        brightness = fmaxf(0.0f, fminf(1.0f, brightness));

        float hue = fmodf(time * 0.01f + dist * 0.01f, 1.0f);

        leds[i] = color_from_palette(params.palette_id, hue, brightness);
    }

    apply_background_overlay(context);
}

// ============== KELVIN-HELMHOLTZ INSTABILITIES ==============
// Fluid vortex visualization
inline void draw_lgp_kelvin_helmholtz(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;

    static float flowPhase = 0;
    flowPhase += params.speed * 0.05f;

    // Vortex count (custom_param_1: 2-8)
    float vortexCount = 2.0f + params.custom_param_1 * 6.0f;

    for(int i = 0; i < NUM_LEDS; i++) {
        float position = (float)i / NUM_LEDS;

        // Shear layer position
        float shearPos = 0.5f;
        float distFromShear = position - shearPos;

        // Vortex pattern along the shear layer
        float vortexPhase = position * vortexCount * M_PI * 2.0f + flowPhase;
        float vortexStrength = sinf(vortexPhase);

        // Kelvin-Helmholtz rollup
        float rollup = distFromShear * vortexStrength;
        float instability = expf(-fabsf(distFromShear) * 5.0f) * sinf(rollup * 10.0f + flowPhase);

        // Add turbulence (custom_param_2)
        float turbulence = sinf(position * 20.0f + flowPhase * 2.0f) * params.custom_param_2;

        float pattern = instability + turbulence * 0.3f;

        float brightness = 0.5f + (0.5f * pattern * params.brightness);
        brightness = fmaxf(0.0f, fminf(1.0f, brightness));

        float hue = fmodf(time * 0.01f + vortexStrength * 0.3f, 1.0f);

        leds[i] = color_from_palette(params.palette_id, hue, brightness);
    }

    apply_background_overlay(context);
}

#endif // LGP_INTERFERENCE_FAMILY_HPP
