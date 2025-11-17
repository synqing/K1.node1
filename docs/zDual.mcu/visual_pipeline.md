# Visual Domain: End-to-End Data Flow (MCU-B)

## Visual Pipeline Stages

### Stage 1: Feature Ingestion & Smoothing
```cpp
class FeatureProcessor {
    // Temporal smoothing
    ExponentialSmoothing energy_smoothing;
    ExponentialSmoothing band_smoothing[4];
    
    // Derived features
    float bass_energy;      // Low band emphasis
    float mid_energy;       // Mid band balance
    float treble_energy;    // High band brightness
    float dynamics;         // Crest factor derivative
    
    // Beat tracking
    BeatPhaseTracker beat_tracker;
    TempoEstimator tempo_estimator;
};
```

### Stage 2: Scene & Effect Selection
```cpp
class SceneManager {
    // Scene selection based on features
    Scene select_scene(const AudioFeatures& features) {
        if (features.energy < 0.1) return Scene::AMBIENT;
        if (features.beat_intensity > 0.7) return Scene::BEAT_REACTIVE;
        if (features.spectral_centroid > 4000) return Scene::BRIGHT;
        return Scene::BALANCED;
    }
    
    // Effect blending
    Effect blend_effects(const Scene& scene, float intensity) {
        return lerp(scene.base_effect, scene.intense_effect, intensity);
    }
};
```

### Stage 3: Parameter Mapping
```cpp
class ParameterMapper {
    void map_parameters(const AudioFeatures& features, 
                       VisualParams& params) {
        params.speed = clamp(features.tempo_bpm / 120.0f, 0.5f, 2.0f);
        params.hue_offset = features.spectral_centroid / 8000.0f * 360.0f;
        params.brightness = sqrt(features.overall_energy);
        params.saturation = lerp(0.3f, 1.0f, features.dynamics);
        params.scale = lerp(0.5f, 2.0f, features.bass_energy);
    }
};
```

### Stage 4: Rendering Pipeline
```cpp
class RenderPipeline {
    void render_frame(const VisualParams& params) {
        render_base_layer(params);
        render_pattern_layer(params);
        if (params.beat_trigger) {
            render_beat_accents(params);
        }
        gamma_correct();
        color_calibrate();
        output_to_leds();
    }
};
```

### Stage 5: LED Output
- Target FPS: 60-120 Hz
- LED Count: 300+ addressable LEDs
- Color Depth: 24-bit RGB
- Refresh Method: RMT with DMA for jitter-free timing

## Visual-Side Error Handling

### LED Failure Detection
- Bus Monitoring: Check data line integrity
- Current Sensing: Detect short circuits, open circuits
- Thermal Monitoring: LED temperature protection
- Color Validation: Sanity-check output values

### Fallback Modes
- No Audio: Demo patterns, ambient cycling
- LED Failure: Reduce brightness, disable affected segments
- Overload: Drop to 30 FPS, reduce complexity
- Recovery: Gradual return to normal operation