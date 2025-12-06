// Light Guide Plate (LGP) Physics Simulation Patterns
// Ported from K1.Ambience project - advanced optical and physical phenomena
// Adapted for K1.node1 center-origin dual-strip topology (128 LEDs)

#ifndef LGP_PHYSICS_FAMILY_HPP
#define LGP_PHYSICS_FAMILY_HPP

#include "pattern_render_context.h"
#include "palettes.h"
#include "emotiscope_helpers.h"
#include <cmath>
#include <cstring>

// ============== GRAVITATIONAL LENSING ==============
// Light bends around invisible massive objects creating Einstein rings
// Theory: General relativity - light follows curved spacetime around mass
inline void draw_lgp_gravitational_lensing(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;

    // Static state for moving masses
    static float massPos[3] = {20.0f, 40.0f, 60.0f};
    static float massVel[3] = {0.5f, -0.3f, 0.4f};
    static float phase = 0.0f;

    phase += 0.01f * params.speed;

    // Mass parameters (K1.node1 has 64 LEDs per strip = half of K1.Ambience's 160)
    uint8_t massCount = 1 + (uint8_t)(params.custom_param_1 * 2);  // 1-3 masses (use custom_param_1)
    if (massCount > 3) massCount = 3;
    float massStrength = params.brightness;  // Gravitational field strength

    // Update mass positions (adapted for 64-LED half-strip)
    for (uint8_t m = 0; m < massCount; m++) {
        massPos[m] += massVel[m] * params.speed;

        // Bounce at edges (0 to NUM_LEDS/2)
        if (massPos[m] < 10 || massPos[m] > (NUM_LEDS/2 - 10)) {
            massVel[m] = -massVel[m];
        }
    }

    // Clear buffer
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = CRGBF(0.0f, 0.0f, 0.0f);
    }

    // Generate light rays from center (K1.node1 center-origin topology)
    for (int16_t ray = -20; ray <= 20; ray += 1) {
        // Rays go both left and right from center
        for (int8_t direction = -1; direction <= 1; direction += 2) {
            float rayPos = NUM_LEDS / 2.0f;  // Start from center
            float rayAngle = ray * 0.04f * direction;

            // Trace ray path
            for (uint8_t step = 0; step < 60; step++) {
                // Calculate gravitational deflection from all masses
                float totalDeflection = 0;

                for (uint8_t m = 0; m < massCount; m++) {
                    // Map mass position to full LED strip
                    float massLedPos = (direction > 0) ?
                        (NUM_LEDS/2 + massPos[m]) :
                        (NUM_LEDS/2 - massPos[m]);

                    float dist = fabsf(rayPos - massLedPos);
                    if (dist < 30 && dist > 0.5f) {
                        // Einstein deflection angle ≈ 4GM/rc²
                        float deflection = massStrength * 15.0f / (dist * dist);
                        if (rayPos > massLedPos) {
                            deflection = -deflection;
                        }
                        totalDeflection += deflection;
                    }
                }

                // Update ray angle based on gravitational field
                rayAngle += totalDeflection * 0.01f;

                // Update ray position along curved path
                rayPos += cosf(rayAngle) * 1.5f * direction;

                // Draw ray point with gravitational redshift coloring
                int16_t pixelPos = (int16_t)rayPos;
                if (pixelPos >= 0 && pixelPos < NUM_LEDS) {
                    // Color based on deflection amount (gravitational redshift)
                    float hue = fmodf(time * 0.1f + fabsf(totalDeflection) * 0.3f, 1.0f);
                    float brightness = (1.0f - step / 60.0f) * params.brightness;

                    // Einstein ring effect - maximum brightness at critical deflection angles
                    if (fabsf(totalDeflection) > 0.5f) {
                        brightness = params.brightness;
                    }

                    CRGBF color = color_from_palette(params.palette_id, hue, brightness);
                    leds[pixelPos].r += color.r;
                    leds[pixelPos].g += color.g;
                    leds[pixelPos].b += color.b;
                }

                // Stop tracing if ray exits the LED strip
                if (rayPos < 0 || rayPos >= NUM_LEDS) break;
            }
        }
    }

    // Apply mirror mode
    apply_mirror_mode(leds, true);
    apply_background_overlay(context);
}

// ============== SIERPINSKI TRIANGLES ==============
// Fractal triangle patterns through recursive interference
// Theory: Self-similar patterns at multiple scales using binary XOR
inline void draw_lgp_sierpinski(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;

    static uint16_t iteration = 0;
    iteration += (uint16_t)(params.speed * 10);

    // Fractal depth (3-7 levels based on custom_param_1)
    int maxDepth = 3 + (int)(params.custom_param_1 * 4);
    if (maxDepth > 7) maxDepth = 7;

    // Render for half strip, then mirror
    for (int i = 0; i < NUM_LEDS / 2; i++) {
        // Binary representation determines Sierpinski pattern
        uint16_t x = i;
        uint16_t y = iteration >> 4;

        // XOR creates Sierpinski triangle
        uint16_t pattern = x ^ y;

        // Count bits for fractal depth
        uint8_t bitCount = 0;
        for (int d = 0; d < maxDepth; d++) {
            if (pattern & (1 << d)) bitCount++;
        }

        // Create smooth transitions
        float smooth = sinf(bitCount * M_PI / maxDepth);
        float brightness = smooth * params.brightness;

        // Color varies with bit depth
        float hue = fmodf(time * 0.1f * params.speed + (bitCount * 0.1f), 1.0f);

        CRGBF color = color_from_palette(params.palette_id, hue, brightness);

        // Apply to center-origin positions
        int leftPos = (NUM_LEDS / 2) - 1 - i;
        int rightPos = (NUM_LEDS / 2) + i;

        leds[leftPos] = color;
        leds[rightPos] = color;
    }

    apply_background_overlay(context);
}

// ============== BEAM COLLISION EXPLOSION ==============
// Laser beams shoot from edges and EXPLODE when they meet
// Theory: Particle collision with energy conservation and explosion dynamics
inline void draw_lgp_beam_collision(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;

    // Beam structure
    struct LaserBeam {
        float position;
        float velocity;
        CRGBF color;
        bool active;
    };

    // Explosion particle structure
    struct Particle {
        float x;
        float velocity;
        CRGBF color;
        float life;
        bool active;
    };

    static LaserBeam beams1[2];  // From left edge
    static LaserBeam beams2[2];  // From right edge
    static Particle particles[50];
    static float lastSpawnTime = 0;
    static float explosionPhase = 0;
    static bool initialized = false;

    // Initialize on first run
    if (!initialized) {
        for (auto& beam : beams1) beam.active = false;
        for (auto& beam : beams2) beam.active = false;
        for (auto& particle : particles) particle.active = false;
        initialized = true;
    }

    // Fade background
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i].r *= 0.9f;
        leds[i].g *= 0.9f;
        leds[i].b *= 0.9f;
    }

    // Spawn new beams periodically
    if (time - lastSpawnTime > (1.0f - params.speed * 0.8f)) {
        // Spawn from left
        for (auto& beam : beams1) {
            if (!beam.active) {
                beam.position = 0;
                beam.velocity = 2.0f + params.speed * 3.0f;
                float hue = fmodf(time * 0.1f, 1.0f);
                beam.color = color_from_palette(params.palette_id, hue, 1.0f);
                beam.active = true;
                break;
            }
        }

        // Spawn from right
        for (auto& beam : beams2) {
            if (!beam.active) {
                beam.position = NUM_LEDS - 1;
                beam.velocity = -(2.0f + params.speed * 3.0f);
                float hue = fmodf(time * 0.1f + 0.5f, 1.0f);
                beam.color = color_from_palette(params.palette_id, hue, 1.0f);
                beam.active = true;
                break;
            }
        }

        lastSpawnTime = time;
    }

    // Update beams from left
    for (auto& beam : beams1) {
        if (!beam.active) continue;

        beam.position += beam.velocity;

        // Check collision with beams from right
        for (auto& beam2 : beams2) {
            if (!beam2.active) continue;

            if (fabsf(beam.position - beam2.position) < 3) {
                // COLLISION! Create explosion
                float explosionPos = (beam.position + beam2.position) / 2;

                // Spawn particles
                int particleCount = 10 + (int)(params.custom_param_1 * 20);
                for (int p = 0; p < particleCount && p < 50; p++) {
                    for (auto& particle : particles) {
                        if (!particle.active) {
                            particle.x = explosionPos;
                            particle.velocity = ((float)rand() / RAND_MAX - 0.5f) * 6.0f;
                            particle.life = 1.0f;

                            // Mix beam colors for explosion
                            float mix = (float)rand() / RAND_MAX;
                            particle.color.r = beam.color.r * mix + beam2.color.r * (1-mix);
                            particle.color.g = beam.color.g * mix + beam2.color.g * (1-mix);
                            particle.color.b = beam.color.b * mix + beam2.color.b * (1-mix);

                            particle.active = true;
                            break;
                        }
                    }
                }

                beam.active = false;
                beam2.active = false;
                explosionPhase = 1.0f;
            }
        }

        // Render beam
        if (beam.active) {
            int headPos = (int)beam.position;
            if (headPos >= 0 && headPos < NUM_LEDS) {
                leds[headPos] = beam.color;

                // Glow
                for (int g = -2; g <= 2; g++) {
                    int glowPos = headPos + g;
                    if (glowPos >= 0 && glowPos < NUM_LEDS && g != 0) {
                        float glowIntensity = 1.0f - fabsf(g) / 3.0f;
                        leds[glowPos].r += beam.color.r * glowIntensity * 0.5f;
                        leds[glowPos].g += beam.color.g * glowIntensity * 0.5f;
                        leds[glowPos].b += beam.color.b * glowIntensity * 0.5f;
                    }
                }
            }

            // Deactivate if off screen
            if (beam.position < -5 || beam.position > NUM_LEDS + 5) {
                beam.active = false;
            }
        }
    }

    // Update beams from right (same logic)
    for (auto& beam : beams2) {
        if (!beam.active) continue;

        beam.position += beam.velocity;

        if (beam.active) {
            int headPos = (int)beam.position;
            if (headPos >= 0 && headPos < NUM_LEDS) {
                leds[headPos] = beam.color;

                for (int g = -2; g <= 2; g++) {
                    int glowPos = headPos + g;
                    if (glowPos >= 0 && glowPos < NUM_LEDS && g != 0) {
                        float glowIntensity = 1.0f - fabsf(g) / 3.0f;
                        leds[glowPos].r += beam.color.r * glowIntensity * 0.5f;
                        leds[glowPos].g += beam.color.g * glowIntensity * 0.5f;
                        leds[glowPos].b += beam.color.b * glowIntensity * 0.5f;
                    }
                }
            }

            if (beam.position < -5 || beam.position > NUM_LEDS + 5) {
                beam.active = false;
            }
        }
    }

    // Update explosion particles
    for (auto& particle : particles) {
        if (!particle.active) continue;

        particle.x += particle.velocity;
        particle.life -= 0.03f;
        particle.velocity *= 0.97f;  // Drag

        if (particle.life <= 0 || particle.x < 0 || particle.x >= NUM_LEDS) {
            particle.active = false;
        } else {
            int pos = (int)particle.x;
            if (pos >= 0 && pos < NUM_LEDS) {
                leds[pos].r += particle.color.r * particle.life;
                leds[pos].g += particle.color.g * particle.life;
                leds[pos].b += particle.color.b * particle.life;
            }
        }
    }

    // Global explosion flash
    if (explosionPhase > 0) {
        explosionPhase -= 0.05f;
        float flashIntensity = explosionPhase * 0.3f;
        for (int i = 0; i < NUM_LEDS; i++) {
            leds[i].r += flashIntensity;
            leds[i].g += flashIntensity;
            leds[i].b += flashIntensity;
        }
    }

    apply_background_overlay(context);
}

// ============== QUANTUM TUNNELING ==============
// Particles tunnel through energy barriers with probability waves
// Theory: Quantum mechanics - wavefunction penetration through classically forbidden regions
inline void draw_lgp_quantum_tunneling(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;

    struct Particle {
        float pos;
        float energy;
        bool active;
        int8_t direction;
    };

    static Particle particles[10] = {0};
    static float barrierPositions[5] = {0};
    static bool initialized = false;

    if (!initialized) {
        for (auto& p : particles) p.active = false;
        initialized = true;
    }

    // Barrier parameters
    uint8_t barrierCount = 2 + (uint8_t)(params.custom_param_1 * 3);  // 2-5 barriers
    if (barrierCount > 5) barrierCount = 5;
    float tunnelProbability = params.custom_param_2 * 0.5f;  // 0-0.5

    // Initialize barrier positions
    for (uint8_t b = 0; b < barrierCount; b++) {
        barrierPositions[b] = (b + 1) * NUM_LEDS / (barrierCount + 1);
    }

    // Fade trails
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i].r *= 0.85f;
        leds[i].g *= 0.85f;
        leds[i].b *= 0.85f;
    }

    // Draw energy barriers (cyan)
    for (uint8_t b = 0; b < barrierCount; b++) {
        int barrierCenter = (int)barrierPositions[b];
        for (int8_t w = -10; w <= 10; w++) {
            int pos = barrierCenter + w;
            if (pos >= 0 && pos < NUM_LEDS) {
                float brightness = (1.0f - fabsf(w) / 15.0f) * 0.3f;
                leds[pos].r += 0.0f;
                leds[pos].g += brightness;
                leds[pos].b += brightness;
            }
        }
    }

    // Spawn particles periodically
    static float lastSpawn = 0;
    if (time - lastSpawn > (1.0f / params.speed)) {
        for (auto& p : particles) {
            if (!p.active) {
                p.pos = NUM_LEDS / 2.0f;
                p.energy = 0.5f + (rand() % 100) / 200.0f;
                p.active = true;
                p.direction = (rand() % 2) ? 1 : -1;
                lastSpawn = time;
                break;
            }
        }
    }

    // Update particles
    for (auto& p : particles) {
        if (!p.active) continue;

        // Check for barrier collision
        bool atBarrier = false;
        for (uint8_t b = 0; b < barrierCount; b++) {
            if (fabsf(p.pos - barrierPositions[b]) < 10) {
                atBarrier = true;

                // Quantum tunneling probability
                if ((rand() % 100) / 100.0f < tunnelProbability) {
                    // TUNNEL THROUGH!
                    p.pos += p.direction * 20;
                    // Flash effect
                    int flashPos = (int)p.pos;
                    if (flashPos >= 0 && flashPos < NUM_LEDS) {
                        leds[flashPos] = CRGBF(1.0f, 1.0f, 1.0f);
                    }
                } else {
                    // Reflect with energy loss
                    p.direction = -p.direction;
                    p.energy *= 0.8f;
                }
                break;
            }
        }

        if (!atBarrier) {
            p.pos += p.direction * 2.0f * params.speed;
        }

        // Deactivate at edges
        if (p.pos <= 0 || p.pos >= NUM_LEDS - 1 || p.energy < 0.1f) {
            p.active = false;
            continue;
        }

        // Draw particle wave packet (Gaussian)
        for (int8_t w = -10; w <= 10; w++) {
            int wavePos = (int)p.pos + w;
            if (wavePos >= 0 && wavePos < NUM_LEDS) {
                float waveBright = p.energy * expf(-fabsf(w) * 0.2f);
                float hue = fmodf(time * 0.05f + p.pos * 0.01f, 1.0f);
                CRGBF color = color_from_palette(params.palette_id, hue, waveBright);
                leds[wavePos].r += color.r;
                leds[wavePos].g += color.g;
                leds[wavePos].b += color.b;
            }
        }
    }

    apply_background_overlay(context);
}

// ============== TIME CRYSTAL OSCILLATOR ==============
// Perpetual motion patterns with non-repeating periods
// Theory: Time crystals - systems that break time-translation symmetry
inline void draw_lgp_time_crystal(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;

    static float phase1 = 0;
    static float phase2 = 0;
    static float phase3 = 0;

    // Non-commensurate frequencies for quasi-periodic behavior
    phase1 += 0.1f * params.speed;
    phase2 += 0.1618f * params.speed;  // Golden ratio
    phase3 += 0.2718f * params.speed;  // e

    // Crystal parameters
    uint8_t dimensions = 1 + (uint8_t)(params.custom_param_1 * 3);  // 1-4D
    if (dimensions > 4) dimensions = 4;

    for (int i = 0; i < NUM_LEDS; i++) {
        float distFromCenter = fabsf(i - NUM_LEDS/2.0f) / (NUM_LEDS/2.0f);

        // Multi-dimensional crystal oscillations
        float crystal = 0;

        // Dimension 1: Basic oscillation
        crystal += sinf(phase1 + i * 0.04f);

        if (dimensions >= 2) {
            // Dimension 2: Modulated by golden ratio
            crystal += sinf(phase2 + i * 0.065f) * 0.5f;
        }

        if (dimensions >= 3) {
            // Dimension 3: Modulated by e
            crystal += sinf(phase3 + i * 0.105f) * 0.33f;
        }

        if (dimensions >= 4) {
            // Dimension 4: Coupled oscillators with spatial decay
            float coupling = expf(-distFromCenter * 2.0f);
            crystal += sinf(phase1 + phase2 - i * 0.025f) * 0.25f * coupling;
        }

        // Normalize
        crystal = crystal / dimensions;
        float brightness = (0.5f + 0.5f * crystal) * params.brightness;

        // Time crystal refraction creates rainbow effects
        float hue = fmodf(time * 0.01f + crystal * 0.3f + i * 0.005f, 1.0f);

        // Phase-locked regions create structure
        if (fabsf(crystal) > 0.9f) {
            brightness = params.brightness;  // Lock brightness in resonant zones
        }

        leds[i] = color_from_palette(params.palette_id, hue, brightness);
    }

    apply_background_overlay(context);
}

// ============== SOLITON WAVES ==============
// Self-reinforcing wave packets that maintain shape
// Theory: Nonlinear physics - solitons maintain shape through balance of dispersion and nonlinearity
inline void draw_lgp_soliton_waves(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;

    struct Soliton {
        float pos;
        float vel;
        float amp;
        float hue;
    };

    static Soliton solitons[4] = {
        {20.0f, 1.0f, 1.0f, 0.0f},
        {40.0f, -0.8f, 0.85f, 0.25f},
        {60.0f, 1.2f, 0.95f, 0.5f},
        {80.0f, -1.1f, 0.75f, 0.75f}
    };

    // Soliton parameters
    uint8_t solitonCount = 2 + (uint8_t)(params.custom_param_1 * 2);  // 2-4 solitons
    if (solitonCount > 4) solitonCount = 4;
    float damping = 1.0f - (params.custom_param_2 * 0.04f);  // Energy conservation

    // Fade trails
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i].r *= 0.9f;
        leds[i].g *= 0.9f;
        leds[i].b *= 0.9f;
    }

    // Update solitons
    for (uint8_t s = 0; s < solitonCount; s++) {
        // Update position
        solitons[s].pos += solitons[s].vel * params.speed;

        // Boundary reflection
        if (solitons[s].pos < 0 || solitons[s].pos >= NUM_LEDS) {
            solitons[s].vel = -solitons[s].vel;
            solitons[s].pos = fmaxf(0.0f, fminf(solitons[s].pos, NUM_LEDS - 1.0f));
        }

        // Check for collisions with other solitons
        for (uint8_t other = s + 1; other < solitonCount; other++) {
            float dist = fabsf(solitons[s].pos - solitons[other].pos);
            if (dist < 10) {
                // Soliton collision - exchange velocities
                float tempVel = solitons[s].vel;
                solitons[s].vel = solitons[other].vel;
                solitons[other].vel = tempVel;

                // Energy flash at collision point
                int collisionPos = (int)((solitons[s].pos + solitons[other].pos) / 2);
                if (collisionPos >= 0 && collisionPos < NUM_LEDS) {
                    leds[collisionPos] = CRGBF(1.0f, 1.0f, 1.0f);
                }
            }
        }

        // Draw soliton - sech² profile with time-based width modulation
        float breathe = 1.0f + 0.2f * sinf(time * 0.1f);  // Subtle breathing effect
        for (int16_t dx = -20; dx <= 20; dx++) {
            int pos = (int)solitons[s].pos + dx;
            if (pos >= 0 && pos < NUM_LEDS) {
                // Hyperbolic secant squared profile with dynamic width
                float sech = 1.0f / coshf(dx * 0.15f * breathe);
                float profile = sech * sech;

                float brightness = solitons[s].amp * profile * params.brightness;
                CRGBF color = color_from_palette(params.palette_id, solitons[s].hue, brightness);

                leds[pos].r += color.r;
                leds[pos].g += color.g;
                leds[pos].b += color.b;
            }
        }

        // Apply damping
        solitons[s].amp *= damping;

        // Regenerate dead solitons
        if (solitons[s].amp < 0.2f) {
            solitons[s].pos = rand() % NUM_LEDS;
            solitons[s].vel = ((rand() % 2) ? 1 : -1) * (0.5f + (rand() % 100) / 100.0f);
            solitons[s].amp = 0.8f + (rand() % 20) / 100.0f;
            solitons[s].hue = (rand() % 100) / 100.0f;
        }
    }

    apply_background_overlay(context);
}

// ============== METAMATERIAL CLOAKING ==============
// Negative refractive index creates invisibility effects
// Theory: Metamaterials - engineered structures with negative index of refraction
inline void draw_lgp_metamaterial_cloaking(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;

    static float cloakPos = NUM_LEDS / 2.0f;
    static float cloakVel = 0.5f;

    // Cloak parameters
    float cloakRadius = 10.0f + params.custom_param_1 * 15.0f;  // 10-25 pixels
    float refractiveIndex = -1.0f - params.brightness;  // -1 to -2

    // Update cloak position
    cloakPos += cloakVel * params.speed;
    if (cloakPos < cloakRadius || cloakPos > NUM_LEDS - cloakRadius) {
        cloakVel = -cloakVel;
    }

    // Background wave pattern
    for (int i = 0; i < NUM_LEDS; i++) {
        // Plane waves
        float wave = sinf(i * 0.04f + time * 0.02f);
        float hue = fmodf(time * 0.01f + i * 0.002f, 1.0f);

        // Check if within cloak region
        float distFromCloak = fabsf(i - cloakPos);

        if (distFromCloak < cloakRadius) {
            // Inside metamaterial - negative refraction
            float bendAngle = (distFromCloak / cloakRadius) * M_PI;

            // Light bends backwards
            wave = sinf(i * 0.04f * refractiveIndex + time * 0.02f + bendAngle);

            // Phase shift creates invisibility
            if (distFromCloak < cloakRadius * 0.5f) {
                // Perfect cloaking region - destructive interference
                wave *= (distFromCloak / (cloakRadius * 0.5f));
            }

            // Edge glow from trapped surface waves
            if (fabsf(distFromCloak - cloakRadius) < 2) {
                wave = 1.0f;
                hue = 0.5f;  // Cyan edge
            }
        }

        float brightness = (wave * 0.5f + 0.5f) * params.brightness;
        leds[i] = color_from_palette(params.palette_id, hue, brightness);
    }

    // Apply mirror mode for center-origin topology
    apply_mirror_mode(leds, true);
    apply_background_overlay(context);
}

// ============== LASER DUEL ==============
// Opposing laser beams fight with deflections, sparks, and power struggles
// Theory: Competitive gameplay with energy conservation and particle physics
inline void draw_lgp_laser_duel(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;

    struct DuelLaser {
        float power;
        float position;
        float chargeRate;
        bool firing;
        float hitFlash;
    };

    struct Spark {
        float x;
        float vx;
        CRGBF color;
        float life;
        bool active;
    };

    static DuelLaser leftLaser = {0.5f, 0, 0.02f, false, 0};
    static DuelLaser rightLaser = {0.5f, NUM_LEDS - 1.0f, 0.02f, false, 0};
    static Spark sparks[50] = {0};
    static float clashPoint = NUM_LEDS / 2.0f;
    static float clashIntensity = 0;
    static float lastSparkTime = 0;
    static bool initialized = false;

    if (!initialized) {
        for (auto& s : sparks) s.active = false;
        initialized = true;
    }

    // Fade background
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i].r *= 0.85f;
        leds[i].g *= 0.85f;
        leds[i].b *= 0.85f;
    }

    // Charge lasers
    leftLaser.chargeRate = 0.01f + params.speed * 0.03f;
    rightLaser.chargeRate = 0.01f + params.speed * 0.03f;

    if (!leftLaser.firing) {
        leftLaser.power += leftLaser.chargeRate;
        if (leftLaser.power >= 1.0f) {
            leftLaser.power = 1.0f;
            leftLaser.firing = true;
            leftLaser.position = 0;
        }
    }

    if (!rightLaser.firing) {
        rightLaser.power += rightLaser.chargeRate;
        if (rightLaser.power >= 1.0f) {
            rightLaser.power = 1.0f;
            rightLaser.firing = true;
            rightLaser.position = NUM_LEDS - 1.0f;
        }
    }

    // Move laser beams
    if (leftLaser.firing) {
        leftLaser.position += (2.0f + leftLaser.power * 3.0f) * params.brightness;
    }

    if (rightLaser.firing) {
        rightLaser.position -= (2.0f + rightLaser.power * 3.0f) * params.brightness;
    }

    // Check for clash
    if (leftLaser.firing && rightLaser.firing &&
        fabsf(leftLaser.position - rightLaser.position) < 10) {

        // CLASH! Power struggle at meeting point
        clashPoint = (leftLaser.position + rightLaser.position) / 2;

        // Stronger laser pushes the clash point
        float powerDiff = leftLaser.power - rightLaser.power + ((rand() % 20) - 10) / 100.0f;
        clashPoint += powerDiff * 5;

        // Update positions
        leftLaser.position = clashPoint - 5;
        rightLaser.position = clashPoint + 5;

        // Drain power
        leftLaser.power -= 0.02f;
        rightLaser.power -= 0.02f;

        // Intense sparks at clash
        if (time - lastSparkTime > 0.05f) {
            int sparkCount = 5 + (int)(params.custom_param_1 * 10);
            for (int p = 0; p < sparkCount && p < 50; p++) {
                for (auto& spark : sparks) {
                    if (!spark.active) {
                        spark.x = clashPoint;
                        spark.vx = ((rand() % 100) - 50) / 10.0f;
                        spark.life = 1.0f;

                        // Mix colors for explosion
                        float mix = (rand() % 100) / 100.0f;
                        float hue = fmodf(time * 0.1f + mix, 1.0f);
                        spark.color = color_from_palette(params.palette_id, hue, 1.0f);

                        spark.active = true;
                        break;
                    }
                }
            }
            lastSparkTime = time;
            clashIntensity = 1.0f;
        }

        // End firing when power depleted
        if (leftLaser.power <= 0) {
            leftLaser.firing = false;
            leftLaser.power = 0;
        }
        if (rightLaser.power <= 0) {
            rightLaser.firing = false;
            rightLaser.power = 0;
        }
    }

    // Reset if beam reaches opposite end
    if (leftLaser.position >= NUM_LEDS - 5) {
        leftLaser.firing = false;
        leftLaser.power = 0;
        rightLaser.hitFlash = 1.0f;
    }
    if (rightLaser.position <= 5) {
        rightLaser.firing = false;
        rightLaser.power = 0;
        leftLaser.hitFlash = 1.0f;
    }

    // Render laser beams
    for (int i = 0; i < NUM_LEDS; i++) {
        // Left laser (red team)
        if (leftLaser.firing && i <= leftLaser.position) {
            float distance = leftLaser.position - i;
            float intensity = 1.0f;
            if (distance < 10) {
                intensity = 1.0f - distance / 20.0f;
            }

            CRGBF beamColor = color_from_palette(params.palette_id, 0.0f, intensity * leftLaser.power * params.brightness);
            leds[i].r += beamColor.r;
            leds[i].g += beamColor.g;
            leds[i].b += beamColor.b;
        }

        // Right laser (blue team)
        if (rightLaser.firing && i >= rightLaser.position) {
            float distance = i - rightLaser.position;
            float intensity = 1.0f;
            if (distance < 10) {
                intensity = 1.0f - distance / 20.0f;
            }

            CRGBF beamColor = color_from_palette(params.palette_id, 0.66f, intensity * rightLaser.power * params.brightness);
            leds[i].r += beamColor.r;
            leds[i].g += beamColor.g;
            leds[i].b += beamColor.b;
        }

        // Power charge visualization
        if (!leftLaser.firing && i < 10) {
            float chargeBright = leftLaser.power * 0.4f;
            leds[i].r += chargeBright;
        }

        if (!rightLaser.firing && i > NUM_LEDS - 10) {
            float chargeBright = rightLaser.power * 0.4f;
            leds[i].b += chargeBright;
        }
    }

    // Render clash point
    if (clashIntensity > 0) {
        clashIntensity -= 0.05f;

        for (int i = -10; i <= 10; i++) {
            int pos = (int)clashPoint + i;
            if (pos >= 0 && pos < NUM_LEDS) {
                float dist = fabsf(i) / 10.0f;
                float intensity = (1.0f - dist) * clashIntensity;

                leds[pos].r += intensity;
                leds[pos].g += intensity;
                leds[pos].b += intensity;
            }
        }
    }

    // Update and render sparks
    for (auto& spark : sparks) {
        if (!spark.active) continue;

        spark.x += spark.vx;
        spark.life -= 0.05f;

        if (spark.life <= 0 || spark.x < 0 || spark.x >= NUM_LEDS) {
            spark.active = false;
        } else {
            int pos = (int)spark.x;
            if (pos >= 0 && pos < NUM_LEDS) {
                leds[pos].r += spark.color.r * spark.life;
                leds[pos].g += spark.color.g * spark.life;
                leds[pos].b += spark.color.b * spark.life;
            }
        }
    }

    // Hit flash effects
    if (leftLaser.hitFlash > 0) {
        leftLaser.hitFlash -= 0.1f;
        for (int i = 0; i < 20; i++) {
            leds[i].r += leftLaser.hitFlash;
            leds[i].g += leftLaser.hitFlash * 0.4f;
            leds[i].b += leftLaser.hitFlash * 0.4f;
        }
    }

    if (rightLaser.hitFlash > 0) {
        rightLaser.hitFlash -= 0.1f;
        for (int i = NUM_LEDS - 20; i < NUM_LEDS; i++) {
            leds[i].r += rightLaser.hitFlash * 0.4f;
            leds[i].g += rightLaser.hitFlash * 0.4f;
            leds[i].b += rightLaser.hitFlash;
        }
    }

    apply_background_overlay(context);
}

// ============== SONIC BOOM SHOCKWAVES ==============
// Mach cone patterns with shock diamonds
// Theory: Supersonic fluid dynamics - shockwaves form when object exceeds sound speed
inline void draw_lgp_sonic_boom(const PatternRenderContext& context) {
    const float time = context.time;
    const PatternParameters& params = context.params;
    CRGBF* leds = context.leds;

    static float objectPos = NUM_LEDS / 2.0f;
    static float objectVel = 2.0f;
    static uint8_t shockHistory[NUM_LEDS] = {0};  // Must match LED count

    // Object parameters
    float machNumber = 1.0f + params.brightness * 3.0f;  // Mach 1-4
    uint8_t shockPersistence = 200 + (uint8_t)(params.custom_param_1 * 55);

    // Update object position
    objectPos += objectVel * machNumber * params.speed;

    // Bounce at edges
    if (objectPos < 10 || objectPos > NUM_LEDS - 10) {
        objectVel = -objectVel;
        objectPos = fmaxf(10.0f, fminf(objectPos, NUM_LEDS - 10.0f));
    }

    // Fade shock history
    for (int i = 0; i < NUM_LEDS; i++) {
        if (shockHistory[i] > 0) {
            shockHistory[i] = (uint8_t)((shockHistory[i] * shockPersistence) >> 8);
        }
    }

    // Create new shock at object position
    int objPixel = (int)objectPos;
    if (objPixel >= 0 && objPixel < NUM_LEDS) {
        shockHistory[objPixel] = 255;
    }

    // Render shockwaves
    for (int i = 0; i < NUM_LEDS; i++) {
        if (shockHistory[i] > 0) {
            // Calculate Mach cone angle
            float distFromObject = fabsf(i - objectPos);
            float coneAngle = asinf(1.0f / machNumber);

            // Mach cone effect - intensity stronger within the cone
            float coneWidth = coneAngle * 20.0f;  // Scale to LED units
            float coneEffect = distFromObject < coneWidth ? 1.0f : 0.5f;

            // Shock intensity with diamond pattern (periodic compressions)
            float diamondPhase = distFromObject * 0.3f - time * 0.1f;
            float diamondIntensity = 0.5f + 0.5f * sinf(diamondPhase);
            float shockIntensity = (shockHistory[i] / 255.0f) * diamondIntensity * coneEffect;

            // Color shift based on shock strength (hotter = bluer)
            float hue = 0.1f - (shockIntensity * 0.03f);  // Orange to blue
            float brightness = shockIntensity * params.brightness;

            leds[i] = color_from_palette(params.palette_id, hue, brightness);
        }
    }

    // Draw supersonic object (white)
    for (int8_t w = -3; w <= 3; w++) {
        int pos = objPixel + w;
        if (pos >= 0 && pos < NUM_LEDS) {
            leds[pos] = CRGBF(1.0f, 1.0f, 1.0f);
        }
    }

    apply_background_overlay(context);
}

#endif // LGP_PHYSICS_FAMILY_HPP
