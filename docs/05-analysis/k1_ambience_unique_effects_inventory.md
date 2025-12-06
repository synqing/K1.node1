# K1.Ambience Unique Effects Inventory

**Date:** 2025-12-06
**Purpose:** Identify K1.Ambience effects that are truly unique and worth porting
**Status:** Analysis Complete

---

## Methodology

1. Catalogued all K1.Ambience effects from source files
2. Compared against K1.node1 existing patterns
3. Identified unique physics simulations and visual algorithms
4. Excluded generic effects (rainbow, gradient, pulse, etc.) already in K1.node1

---

## K1.Ambience Unique Effect Categories

### Category 1: Light Guide Plate (LGP) Physics Simulations

These effects simulate advanced optical and physical phenomena specifically designed for edge-lit light guide plates. **K1.node1 has nothing like these.**

#### Quantum Effects (`LGPQuantumEffects.h`)
1. **Quantum Tunneling** - Particles tunnel through energy barriers with probability-based transmission
2. **Gravitational Lensing** - Light bends around massive objects (Einstein rings)
3. **Sonic Boom Shockwaves** - Mach cone patterns and shock diamonds
4. **Time Crystal Oscillator** - Non-repeating perpetual patterns with phase coupling
5. **Soliton Waves** - Self-reinforcing wave packets that maintain shape
6. **Metamaterial Cloaking** - Negative refractive index invisibility effects
7. **Gradient-Index Cloak** - Smooth GRIN lens cloaking with adjustable gradient
8. **Caustic Fan** - Virtual focusing with caustic envelope patterns
9. **Birefringent Shear** - Dual-mode interference with directional drift
10. **Anisotropic Cloak** - Directionally biased metamaterial cloaking
11. **Evanescent Skin** - Edge-bound shimmering waves with exponential decay

#### Physics Effects (`LGPPhysicsEffects.h`)
12. **Plasma Field** - Charged particle interactions with electric field lines
13. **Magnetic Field Lines** - Dipole field visualization with rotating magnets
14. **Particle Collider** - High-energy physics collision simulation
15. **Wave Tank** - Realistic water wave simulation with damping
16. **Energy Transfer** - Power flow visualization between edges with packet loss
17. **Quantum Fluctuations** - Virtual particle pairs with vacuum energy
18. **Liquid Crystal Flow** - Organic color transitions with wave layering
19. **Prism Cascade** - Spectral dispersion effects with wavelength spread
20. **Silk Waves** - Smooth flowing waves like silk fabric
21. **Beam Collision Explosion** - Laser beams shoot from edges and EXPLODE when they meet
22. **Laser Duel** - Opposing lasers fight with power struggles and sparks
23. **Tidal Forces** - Massive waves crash from both sides with splash particles

#### Geometric Effects (`LGPGeometricEffects.h`)
24. **Box Wave** - Rectangular wavefronts propagating from center
25. **Diamond Lattice** - Crystalline pattern with rotating diamond cells
26. **Hexagonal Grid** - Honeycomb pattern with pulsing cells
27. **Spiral Vortex** - Logarithmic spiral with color rotation
28. **Sierpinski Triangles** - Fractal triangle pattern with self-similarity
29. **Chevron Waves** - V-shaped waves cascading from center
30. **Concentric Rings** - Expanding circular wavefronts
31. **Star Burst** - Radial explosion pattern with particle trails
32. **Mesh Network** - Dynamic node connection visualization

#### Color Science Effects (`LGPColorMixingEffects.h`)
33. **Color Temperature** - Blackbody radiation visualization (1000K-10000K)
34. **RGB Prism** - Primary color separation and recombination
35. **Complementary Mixing** - Opponent color theory visualization
36. **Additive/Subtractive** - RGB vs CMY mixing comparison
37. **Quantum Colors** - Discrete energy level transitions
38. **Doppler Shift** - Red/blue shift based on wave motion
39. **Chromatic Aberration** - Wavelength-dependent refraction
40. **HSV Cylinder** - 3D color space navigation
41. **Perceptual Blend** - CIE LAB color space interpolation
42. **Metameric Colors** - Context-dependent color appearance
43. **Color Accelerator** - Relativistic color shift effects
44. **DNA Helix** - Double helix with base pair colors
45. **Phase Transition** - Matter state changes with color mapping

#### Interference & Wave Effects (`LGPInterferenceEffects.h`)
46. **Interference Scanner** - Dual-wave interference patterns
47. **Holographic** - 3D hologram simulation with depth
48. **Modal Resonance** - Standing wave modes in waveguide
49. **Wave Collision** - Constructive/destructive interference

#### Organic Effects (`LGPOrganicEffects.h`)
50. **Organic Wave Patterns** - Natural flowing motion with multiple layers

### Category 2: Center-Origin Dual-Strip Effects

Effects specifically designed for dual-strip center-origin topology (matching K1.node1's geometry):

51. **Heartbeat** - Synchronized pulse from center
52. **Breathing** - Smooth expansion/contraction
53. **Shockwave** - Impact ripple from center
54. **Vortex** - Spiral rotation around center
55. **Collision** - Particles collide at center
56. **Gravity Well** - Particles fall toward center

**Note:** K1.node1 has similar concepts (Bloom, Pulse) but these implementations may have unique algorithms worth comparing.

---

## Effects K1.node1 Already Has (DO NOT PORT)

- Rainbow/gradient sweeps
- Fire simulation
- Plasma noise
- BPM sync
- Confetti/sparkle
- Sinelon/juggle
- Basic pulse/breathing
- VU meter
- Spectrum analyzer

---

## Integration Priority Ranking

### Tier 1: Unique Physics Simulations (High Value)
**Effects that demonstrate advanced concepts K1.node1 lacks:**

1. Gravitational Lensing
2. Beam Collision Explosion
3. Laser Duel
4. Tidal Forces
5. Quantum Tunneling
6. Time Crystal Oscillator
7. Metamaterial Cloaking
8. Particle Collider
9. Magnetic Field Lines
10. Plasma Field

**Rationale:** Visually striking, educationally interesting, genuinely novel

### Tier 2: Geometric & Interference (Medium Value)
**Effects that add visual variety:**

11. Sierpinski Triangles
12. Hexagonal Grid
13. Diamond Lattice
14. Modal Resonance
15. Holographic
16. Caustic Fan
17. Wave Collision
18. Spiral Vortex

**Rationale:** Unique geometry, good for demo modes

### Tier 3: Color Science (Niche Value)
**Effects for color theory education/calibration:**

19. Color Temperature
20. Chromatic Aberration
21. Doppler Shift
22. HSV Cylinder
23. RGB Prism

**Rationale:** Less visually exciting but technically interesting

### Tier 4: Organic/Wave (Compare First)
**Effects that may overlap with K1.node1 patterns:**

24. Liquid Crystal Flow
25. Silk Waves
26. Organic Wave Patterns
27. Soliton Waves

**Rationale:** Need side-by-side comparison with existing patterns before porting

---

## Technical Considerations

### All Effects Require:
1. **LED topology adaptation** - K1.Ambience uses 320 linear LEDs, K1.node1 uses 128 center-origin
2. **Parameter mapping** - VisualParams → PatternParameters
3. **Audio removal** - Strip out broken AudioSystem calls
4. **Timing adjustments** - ESP32 vs ESP32-S3 performance differences

### Physics Simulation Challenges:
- Particle systems need efficient data structures
- Wavefront propagation needs spatial indexing
- Field simulations need optimized math (lookup tables, CORDIC)

### Memory Budget:
- Each effect should target <10KB RAM overhead
- Shared buffers preferred over per-effect allocation
- Consider effect complexity vs available SRAM (320KB total, 207KB currently used)

---

## Recommended Integration Path

### Phase 1: Proof of Concept (3 Effects)
Pick 3 effects spanning different simulation types:

1. **Gravitational Lensing** (field simulation)
2. **Sierpinski Triangles** (geometric/fractal)
3. **Beam Collision Explosion** (particle system)

**Goal:** Validate porting workflow, topology transformation, performance

### Phase 2: Tier 1 Batch (7 Effects)
Complete remaining Tier 1 physics simulations

### Phase 3: Tier 2 Batch (8 Effects)
Add geometric and interference patterns

### Phase 4: Selective Tier 3/4 (Optional)
Only port if user requests or demos look compelling

---

## Success Criteria

For each ported effect:
- ✅ Compiles without errors
- ✅ Runs at >60 FPS sustained
- ✅ Visually matches or exceeds K1.Ambience quality
- ✅ Parameters map intuitively to web UI
- ✅ No memory leaks or crashes
- ✅ Works correctly with center-origin mirroring

---

## Next Steps

**Waiting for user approval to:**
1. Port 3 proof-of-concept effects (Gravitational Lensing, Sierpinski, Beam Collision)
2. Create `/firmware/src/patterns/lgp_physics_family.hpp`
3. Validate workflow before committing to full Tier 1 batch

---

**Total Unique Effects Identified:** 56 (excluding overlaps with K1.node1)
**High-Priority Effects:** 10 (Tier 1)
**Recommended First Batch:** 3 (proof of concept)
