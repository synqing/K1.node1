// Light Guide Plate (LGP) Geometric Pattern Effects
// Ported from K1.Ambience project - advanced shapes and interference patterns
// Adapted for K1.node1 center-origin dual-strip topology (128 LEDs)

#ifndef LGP_GEOMETRIC_FAMILY_HPP
#define LGP_GEOMETRIC_FAMILY_HPP

#include "pattern_render_context.h"
#include "palettes.h"
#include "emotiscope_helpers.h"
#include <cmath>
#include <cstring>

// ============== DIAMOND LATTICE ==============
// Creates diamond/rhombus patterns through angular interference
// Theory: Angled wave fronts create diamond patterns when they intersect
inline void draw_lgp_diamond_lattice(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;

    static float phase = 0;
    phase += params.speed * 0.02f;

    // Diamond size based on complexity
    float diamondFreq = 2.0f + (params.custom_param_1 * 8.0f);  // 2-10 diamonds

    for (int i = 0; i < NUM_LEDS; i++) {
        float pos = (float)i / NUM_LEDS;

        // Create crossing diagonal waves
        float wave1 = sinf((pos + phase) * diamondFreq * 2.0f * M_PI);
        float wave2 = sinf((pos - phase) * diamondFreq * 2.0f * M_PI);

        // Interference creates diamond nodes
        float diamond = fabsf(wave1 * wave2);

        // Edge sharpening
        diamond = powf(diamond, 0.5f);

        float brightness = diamond * params.brightness;

        // Opposing colors enhance the diamond effect
        float hue = fmodf(time * 0.01f + i * 0.002f, 1.0f);
        leds[i] = color_from_palette(params.palette_id, hue, brightness);
    }

    apply_background_overlay(context);
}

// ============== HEXAGONAL GRID ==============
// Creates honeycomb-like patterns using 3-wave interference
// Theory: Three waves at 120° create hexagonal interference patterns
inline void draw_lgp_hexagonal_grid(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;

    static float phase = 0;
    phase += params.speed * 0.01f;

    // Hexagon size
    float hexSize = 3.0f + (params.custom_param_1 * 12.0f);  // 3-15 hexagons

    for (int i = 0; i < NUM_LEDS; i++) {
        float pos = (float)i / NUM_LEDS;

        // Three waves at 120 degree angles
        float wave1 = sinf(pos * hexSize * 2.0f * M_PI + phase);
        float wave2 = sinf(pos * hexSize * 2.0f * M_PI + phase + 2.0f * M_PI / 3.0f);
        float wave3 = sinf(pos * hexSize * 2.0f * M_PI + phase + 4.0f * M_PI / 3.0f);

        float pattern;
        if (params.custom_param_2 < 0.5f) {
            // Additive - creates nodes
            pattern = (wave1 + wave2 + wave3) / 3.0f;
            pattern = fabsf(pattern);
        } else {
            // Multiplicative - creates cells
            pattern = fabsf(wave1 * wave2 * wave3);
            pattern = powf(pattern, 0.3f);
        }

        float brightness = pattern * params.brightness;

        // Chromatic shift for iridescence
        float hue = fmodf(time * 0.01f + pattern * 0.2f + i * 0.005f, 1.0f);

        leds[i] = color_from_palette(params.palette_id, hue, brightness);
    }

    apply_background_overlay(context);
}

// ============== SPIRAL VORTEX ==============
// Creates rotating spiral patterns using phase-shifted waves
// Theory: Helical phase fronts create spiral interference
inline void draw_lgp_spiral_vortex(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;

    static float vortexPhase = 0;
    vortexPhase += params.speed * 0.05f;

    // Number of spiral arms
    int spiralArms = 2 + (int)(params.custom_param_1 * 6);  // 2-8 arms

    for (int i = 0; i < NUM_LEDS; i++) {
        float distFromCenter = fabsf(i - NUM_LEDS/2.0f);
        float normalizedDist = distFromCenter / (NUM_LEDS/2.0f);

        // Spiral equation: r * theta
        float spiralAngle = normalizedDist * spiralArms * 2.0f * M_PI + vortexPhase;

        // Create spiral with different profiles
        float spiral;
        if (params.custom_param_2 < 0.33f) {
            // Archimedean spiral
            spiral = sinf(spiralAngle);
        } else if (params.custom_param_2 < 0.66f) {
            // Logarithmic spiral
            spiral = sinf(spiralAngle * (1.0f + normalizedDist));
        } else {
            // Fermat's spiral
            spiral = sinf(spiralAngle * sqrtf(normalizedDist + 0.1f));
        }

        // Radial fade
        spiral *= (1.0f - normalizedDist * 0.5f);

        float brightness = (0.5f + 0.5f * spiral) * params.brightness;

        // Color rotates with spiral
        float hue = fmodf(time * 0.01f + (spiralAngle / (2.0f * M_PI)), 1.0f);

        leds[i] = color_from_palette(params.palette_id, hue, brightness);
    }

    apply_background_overlay(context);
}

// ============== CHEVRON WAVES ==============
// Creates V-shaped patterns moving through the light guide
// Theory: Counter-propagating waves create chevron patterns
inline void draw_lgp_chevron_waves(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;

    static float wavePos = 0;
    wavePos += params.speed * 2.0f;

    // Chevron angle and count
    float chevronCount = 2.0f + (params.custom_param_1 * 8.0f);  // 2-10 chevrons
    float chevronAngle = 0.5f + (params.custom_param_2 * 2.0f);  // Angle steepness

    // Fade trails
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i].r *= 0.8f;
        leds[i].g *= 0.8f;
        leds[i].b *= 0.8f;
    }

    for (int i = 0; i < NUM_LEDS; i++) {
        float distFromCenter = fabsf(i - NUM_LEDS/2.0f);

        // Create V-shape from center
        float chevronPhase = distFromCenter * chevronAngle + wavePos;
        float chevron = sinf(chevronPhase * chevronCount * 0.1f);

        // Sharp edges
        chevron = tanhf(chevron * 3.0f) * 0.5f + 0.5f;

        float brightness = chevron * params.brightness;

        // Color gradient along chevron
        float hue = fmodf(time * 0.01f + distFromCenter * 0.002f + wavePos * 0.005f, 1.0f);

        CRGBF color = color_from_palette(params.palette_id, hue, brightness);
        leds[i].r += color.r;
        leds[i].g += color.g;
        leds[i].b += color.b;
    }

    apply_background_overlay(context);
}

// ============== CONCENTRIC RINGS ==============
// Creates concentric ring patterns through radial waves
// Theory: Radial standing waves create ring patterns
inline void draw_lgp_concentric_rings(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;

    static float ringPhase = 0;
    ringPhase += params.speed * 0.1f;

    // Ring density
    float ringCount = 3.0f + (params.custom_param_1 * 12.0f);  // 3-15 rings

    for (int i = 0; i < NUM_LEDS; i++) {
        float distFromCenter = fabsf(i - NUM_LEDS/2.0f);
        float normalizedDist = distFromCenter / (NUM_LEDS/2.0f);

        float rings;
        if (params.custom_param_2 < 0.33f) {
            // Simple concentric rings
            rings = sinf(distFromCenter * ringCount * 0.2f + ringPhase);
        } else if (params.custom_param_2 < 0.66f) {
            // Bessel function-like (more realistic)
            float bessel = sinf(distFromCenter * ringCount * 0.2f + ringPhase);
            bessel *= 1.0f / sqrtf(normalizedDist + 0.1f);  // J0 approximation
            rings = bessel;
        } else {
            // Fresnel zones
            float fresnel = sinf(sqrtf(distFromCenter) * ringCount + ringPhase);
            rings = fresnel;
        }

        // Sharp ring edges
        rings = tanhf(rings * 2.0f);

        float brightness = (0.5f + 0.5f * rings) * params.brightness;

        // Radial color gradient
        float hue = fmodf(time * 0.01f + normalizedDist * 0.3f, 1.0f);

        leds[i] = color_from_palette(params.palette_id, hue, brightness);
    }

    apply_background_overlay(context);
}

// ============== STAR BURST ==============
// Creates star-like patterns radiating from center
// Theory: Multiple radial waves with angular modulation
inline void draw_lgp_star_burst(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;

    static float starPhase = 0;
    starPhase += params.speed * 0.03f;

    // Number of star points
    int starPoints = 3 + (int)(params.custom_param_1 * 9);  // 3-12 points

    // Fade trails
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i].r *= 0.9f;
        leds[i].g *= 0.9f;
        leds[i].b *= 0.9f;
    }

    for (int i = 0; i < NUM_LEDS; i++) {
        float distFromCenter = fabsf(i - NUM_LEDS/2.0f);
        float normalizedDist = distFromCenter / (NUM_LEDS/2.0f);

        // Angular component (simulated based on position)
        float angle = (i > NUM_LEDS/2) ? 0.0f : M_PI;

        // Star equation
        float star = sinf(angle * starPoints + starPhase) *
                    expf(-normalizedDist * 2.0f);  // Radial decay

        // Pulsing
        star *= 0.5f + 0.5f * sinf(starPhase * 3.0f);

        float brightness = (0.5f + 0.5f * star) * params.brightness;

        // Color varies with angle and distance
        float hue = fmodf(time * 0.01f + distFromCenter * 0.005f + star * 0.2f, 1.0f);

        CRGBF color = color_from_palette(params.palette_id, hue, brightness);
        leds[i].r += color.r;
        leds[i].g += color.g;
        leds[i].b += color.b;
    }

    apply_background_overlay(context);
}

// ============== MESH NETWORK ==============
// Creates interconnected node patterns like neural networks
// Theory: Discrete nodes with connecting waves
inline void draw_lgp_mesh_network(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;

    static float networkPhase = 0;
    networkPhase += params.speed * 0.02f;

    // Node density
    int nodeCount = 5 + (int)(params.custom_param_1 * 15);  // 5-20 nodes

    // Fade background
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i].r *= 0.7f;
        leds[i].g *= 0.7f;
        leds[i].b *= 0.7f;
    }

    // Place nodes
    for (int n = 0; n < nodeCount; n++) {
        float nodePos = (float)n / nodeCount * NUM_LEDS;

        // Draw node
        for (int i = 0; i < NUM_LEDS; i++) {
            float distToNode = fabsf(i - nodePos);

            if (distToNode < 3) {
                // Node core
                float nodeBright = params.brightness;
                float hue = fmodf(time * 0.01f + n * 0.05f, 1.0f);
                CRGBF nodeColor = color_from_palette(params.palette_id, hue, nodeBright);
                leds[i] = nodeColor;
            } else if (distToNode < 20) {
                // Connections to nearby nodes
                float connection = sinf(distToNode * 0.5f + networkPhase + n);
                connection *= expf(-distToNode * 0.1f);  // Decay

                float connBright = fabsf(connection) * 0.5f * params.brightness;
                float hue = fmodf(time * 0.01f + n * 0.05f, 1.0f);
                CRGBF connColor = color_from_palette(params.palette_id, hue, connBright);

                leds[i].r += connColor.r;
                leds[i].g += connColor.g;
                leds[i].b += connColor.b;
            }
        }
    }

    apply_background_overlay(context);
}

// ============== MOIRÉ PATTERNS ==============
// Creates moiré interference patterns from overlapping grids
// Theory: Interference between two slightly misaligned periodic patterns
inline void draw_lgp_moire_patterns(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;

    static float offset = 0;
    offset += params.speed * 0.02f;

    // Grid frequencies
    float freq1 = 5.0f + params.custom_param_1 * 10.0f;  // 5-15
    float freq2 = freq1 * (1.0f + params.custom_param_2 * 0.2f);  // Slight difference creates moiré

    for (int i = 0; i < NUM_LEDS; i++) {
        // Two overlapping sine patterns
        float pattern1 = sinf(i * freq1 * 0.1f + offset);
        float pattern2 = sinf(i * freq2 * 0.1f - offset * 0.8f);

        // Moiré interference
        float moire = pattern1 * pattern2;

        // Enhance contrast
        moire = tanhf(moire * 2.0f);

        float brightness = (0.5f + 0.5f * moire) * params.brightness;

        // Color shifts with moiré beats
        float hue = fmodf(time * 0.01f + moire * 0.2f, 1.0f);

        leds[i] = color_from_palette(params.palette_id, hue, brightness);
    }

    apply_background_overlay(context);
}

#endif // LGP_GEOMETRIC_FAMILY_HPP
