// Stateful Node System - Core Node Type Definitions
// Part of K1.node1 Graph Compilation Architecture (ADR-0006)
//
// Provides type-safe containers for state persistence in audio-reactive patterns.
// All node types use pre-allocated, fixed-size buffers for zero-copy performance.
//
// Memory Budget: <5KB per node, <200KB system-wide heap available
// Performance Impact: <2% overhead (validated by feasibility study)
// Thread Safety: Single-threaded GPU core (Core 0) is sole writer

#pragma once

#include <Arduino.h>
#include <algorithm>
#include <cstring>
#include <FastLED.h>
#include "parameters.h"

// ============================================================================
// NODE CONFIGURATION CONSTANTS
// ============================================================================

constexpr size_t STATEFUL_NODE_MAX_NODES = 64;      // Max nodes per pattern
constexpr size_t STATEFUL_NODE_BUFFER_SIZE = 180;   // Standard buffer (NUM_LEDS)
constexpr uint32_t STATEFUL_NODE_MAGIC = 0xDEADBEEF; // Integrity check

// ============================================================================
// NODE STATE LIFECYCLE ENUM
// ============================================================================

enum class StatefulNodeState : uint8_t {
    UNINITIALIZED = 0,
    INITIALIZED = 1,
    ACTIVE = 2,
    RESET_PENDING = 3
};

// ============================================================================
// NODE TYPE ENUM (8 Core Types)
// ============================================================================

enum class StatefulNodeType : uint8_t {
    BUFFER_PERSIST = 0,      // Frame-to-frame float buffer with decay
    COLOR_PERSIST = 1,       // Frame-to-frame RGB color buffer
    SPRITE_SCROLL = 2,       // Scrolling sprite with directional motion
    WAVE_POOL = 3,           // Wave propagation system (Gaussian smoothing)
    GAUSSIAN_BLUR = 4,       // Spatial blur operation on buffers
    BEAT_HISTORY = 5,        // Temporal beat tracking and history
    PHASE_ACCUMULATOR = 6,   // Continuous phase tracking
    ENERGY_GATE = 7          // Threshold-based energy gating
};

// ============================================================================
// BUFFER_PERSIST NODE - Frame-to-frame float buffer with decay
// ============================================================================
//
// Use Case: Trail effects, decay-based animations
// Size: ~720 bytes (180 floats)
// Reset: On pattern change
//
// Example:
//   BufferPersistNode buffer("trail", 180, 0.95f);
//   buffer.apply_decay();
//   buffer[0] += audio_energy;

class BufferPersistNode {
public:
    BufferPersistNode(const char* id, size_t size, float decay_factor)
        : node_id(id), buffer_size(size), decay_factor(decay_factor),
          state(StatefulNodeState::UNINITIALIZED), magic(STATEFUL_NODE_MAGIC)
    {
        if (buffer_size > STATEFUL_NODE_BUFFER_SIZE) {
            buffer_size = STATEFUL_NODE_BUFFER_SIZE;
        }
    }

    void init() {
        memset(buffer, 0, sizeof(float) * buffer_size);
        state = StatefulNodeState::INITIALIZED;
    }

    void reset() {
        memset(buffer, 0, sizeof(float) * buffer_size);
        state = StatefulNodeState::INITIALIZED;
    }

    void apply_decay() {
        if (state == StatefulNodeState::UNINITIALIZED) init();
        for (size_t i = 0; i < buffer_size; i++) {
            buffer[i] *= decay_factor;
        }
    }

    void clamp() {
        if (state == StatefulNodeState::UNINITIALIZED) init();
        for (size_t i = 0; i < buffer_size; i++) {
            buffer[i] = constrain(buffer[i], 0.0f, 1.0f);
        }
    }

    void write(size_t index, float value) {
        if (state == StatefulNodeState::UNINITIALIZED) init();
        if (index < buffer_size) {
            buffer[index] = value;
        }
    }

    float read(size_t index) const {
        if (index >= buffer_size) return 0.0f;
        return buffer[index];
    }

    float& operator[](size_t index) {
        if (state == StatefulNodeState::UNINITIALIZED) {
            const_cast<BufferPersistNode*>(this)->init();
        }
        static float dummy = 0.0f;
        return (index < buffer_size) ? buffer[index] : dummy;
    }

    const float& operator[](size_t index) const {
        return (index < buffer_size) ? buffer[index] : static_cast<const float&>(0.0f);
    }

    size_t size() const { return buffer_size; }
    StatefulNodeState get_state() const { return state; }

private:
    const char* node_id;
    float buffer[STATEFUL_NODE_BUFFER_SIZE] = {0.0f};
    size_t buffer_size;
    float decay_factor;
    StatefulNodeState state;
    uint32_t magic;
};

// ============================================================================
// COLOR_PERSIST NODE - Frame-to-frame RGB color buffer
// ============================================================================
//
// Use Case: Color trails, bloom effects, mirror patterns
// Size: ~2160 bytes (180 CRGBF)
// Reset: On pattern change

class ColorPersistNode {
public:
    ColorPersistNode(const char* id, size_t size, float decay_factor)
        : node_id(id), buffer_size(size), decay_factor(decay_factor),
          state(StatefulNodeState::UNINITIALIZED), magic(STATEFUL_NODE_MAGIC)
    {
        if (buffer_size > STATEFUL_NODE_BUFFER_SIZE) {
            buffer_size = STATEFUL_NODE_BUFFER_SIZE;
        }
    }

    void init() {
        memset(buffer, 0, sizeof(CRGBF) * buffer_size);
        state = StatefulNodeState::INITIALIZED;
    }

    void reset() {
        memset(buffer, 0, sizeof(CRGBF) * buffer_size);
        state = StatefulNodeState::INITIALIZED;
    }

    void apply_decay() {
        if (state == StatefulNodeState::UNINITIALIZED) init();
        for (size_t i = 0; i < buffer_size; i++) {
            buffer[i].r *= decay_factor;
            buffer[i].g *= decay_factor;
            buffer[i].b *= decay_factor;
        }
    }

    void clamp() {
        if (state == StatefulNodeState::UNINITIALIZED) init();
        for (size_t i = 0; i < buffer_size; i++) {
            buffer[i].r = constrain(buffer[i].r, 0.0f, 1.0f);
            buffer[i].g = constrain(buffer[i].g, 0.0f, 1.0f);
            buffer[i].b = constrain(buffer[i].b, 0.0f, 1.0f);
        }
    }

    void write(size_t index, const CRGBF& value) {
        if (state == StatefulNodeState::UNINITIALIZED) init();
        if (index < buffer_size) {
            buffer[index] = value;
        }
    }

    CRGBF read(size_t index) const {
        if (index >= buffer_size) return CRGBF(0, 0, 0);
        return buffer[index];
    }

    CRGBF& operator[](size_t index) {
        if (state == StatefulNodeState::UNINITIALIZED) {
            const_cast<ColorPersistNode*>(this)->init();
        }
        static CRGBF dummy(0, 0, 0);
        return (index < buffer_size) ? buffer[index] : dummy;
    }

    const CRGBF& operator[](size_t index) const {
        static const CRGBF dummy(0, 0, 0);
        return (index < buffer_size) ? buffer[index] : dummy;
    }

    size_t size() const { return buffer_size; }
    StatefulNodeState get_state() const { return state; }

private:
    const char* node_id;
    CRGBF buffer[STATEFUL_NODE_BUFFER_SIZE] = {CRGBF(0, 0, 0)};
    size_t buffer_size;
    float decay_factor;
    StatefulNodeState state;
    uint32_t magic;
};

// ============================================================================
// PHASE_ACCUMULATOR NODE - Continuous phase tracking
// ============================================================================
//
// Use Case: Smooth animations, oscillations, LFO modulation
// Size: ~4 bytes (single float)
// Reset: On pattern change

class PhaseAccumulatorNode {
public:
    PhaseAccumulatorNode(const char* id)
        : node_id(id), phase(0.0f),
          state(StatefulNodeState::UNINITIALIZED), magic(STATEFUL_NODE_MAGIC)
    {
    }

    void init() {
        phase = 0.0f;
        state = StatefulNodeState::INITIALIZED;
    }

    void reset() {
        phase = 0.0f;
        state = StatefulNodeState::INITIALIZED;
    }

    void advance(float delta_rad) {
        if (state == StatefulNodeState::UNINITIALIZED) init();
        phase += delta_rad;
        while (phase >= TWO_PI) phase -= TWO_PI;
        while (phase < 0.0f) phase += TWO_PI;
    }

    float get_phase() const { return phase; }
    void set_phase(float p) {
        phase = p;
        while (phase >= TWO_PI) phase -= TWO_PI;
        while (phase < 0.0f) phase += TWO_PI;
    }

    StatefulNodeState get_state() const { return state; }

private:
    const char* node_id;
    float phase;
    StatefulNodeState state;
    uint32_t magic;
};

// ============================================================================
// BEAT_HISTORY NODE - Temporal beat tracking
// ============================================================================
//
// Use Case: Beat-aware animations, tempo analysis, rhythm detection
// Size: ~512 bytes (128 samples @ 4 bytes each)
// Reset: Never (audio subsystem manages)

class BeatHistoryNode {
public:
    static constexpr size_t HISTORY_SIZE = 128;

    BeatHistoryNode(const char* id)
        : node_id(id), write_index(0),
          state(StatefulNodeState::UNINITIALIZED), magic(STATEFUL_NODE_MAGIC)
    {
    }

    void init() {
        memset(history, 0, sizeof(float) * HISTORY_SIZE);
        write_index = 0;
        state = StatefulNodeState::INITIALIZED;
    }

    void reset() {
        // Beat history is NOT reset on pattern change (persistent)
        state = StatefulNodeState::INITIALIZED;
    }

    void write_beat(float confidence) {
        if (state == StatefulNodeState::UNINITIALIZED) init();
        history[write_index] = constrain(confidence, 0.0f, 1.0f);
        write_index = (write_index + 1) % HISTORY_SIZE;
    }

    float read_beat(size_t offset) const {
        if (offset >= HISTORY_SIZE) return 0.0f;
        size_t idx = (write_index - 1 - offset + HISTORY_SIZE) % HISTORY_SIZE;
        return history[idx];
    }

    float get_average(size_t samples) {
        if (samples > HISTORY_SIZE) samples = HISTORY_SIZE;
        if (samples == 0) return 0.0f;

        float sum = 0.0f;
        for (size_t i = 0; i < samples; i++) {
            sum += read_beat(i);
        }
        return sum / static_cast<float>(samples);
    }

    size_t size() const { return HISTORY_SIZE; }
    StatefulNodeState get_state() const { return state; }

private:
    const char* node_id;
    float history[HISTORY_SIZE] = {0.0f};
    size_t write_index;
    StatefulNodeState state;
    uint32_t magic;
};

// ============================================================================
// ENERGY_GATE NODE - Threshold-based energy gating
// ============================================================================
//
// Use Case: Beat detection, gated effects, silence detection
// Size: ~4 bytes (single float, gate state)
// Reset: On pattern change

class EnergyGateNode {
public:
    EnergyGateNode(const char* id, float threshold = 0.2f)
        : node_id(id), threshold(threshold), gate_open(false),
          state(StatefulNodeState::UNINITIALIZED), magic(STATEFUL_NODE_MAGIC)
    {
    }

    void init() {
        gate_open = false;
        state = StatefulNodeState::INITIALIZED;
    }

    void reset() {
        gate_open = false;
        state = StatefulNodeState::INITIALIZED;
    }

    void update(float energy) {
        if (state == StatefulNodeState::UNINITIALIZED) init();
        gate_open = (energy >= threshold);
    }

    bool is_open() const { return gate_open; }
    float get_signal() const { return gate_open ? 1.0f : 0.0f; }
    void set_threshold(float t) { threshold = constrain(t, 0.0f, 1.0f); }
    float get_threshold() const { return threshold; }
    StatefulNodeState get_state() const { return state; }

private:
    const char* node_id;
    float threshold;
    bool gate_open;
    StatefulNodeState state;
    uint32_t magic;
};

// ============================================================================
// SPRITE_SCROLL NODE - Scrolling sprite with decay
// ============================================================================
//
// Use Case: Scrolling effects, directional animations
// Size: ~4320 bytes (180 CRGBF * 2 for double-buffering)
// Reset: On pattern change

class SpriteScrollNode {
public:
    enum class Direction : uint8_t {
        INWARD = 0,
        OUTWARD = 1
    };

    SpriteScrollNode(const char* id, size_t size, Direction dir, float speed, float decay)
        : node_id(id), buffer_size(size), direction(dir), speed(speed),
          decay_factor(decay), state(StatefulNodeState::UNINITIALIZED),
          magic(STATEFUL_NODE_MAGIC)
    {
        if (buffer_size > STATEFUL_NODE_BUFFER_SIZE) {
            buffer_size = STATEFUL_NODE_BUFFER_SIZE;
        }
    }

    void init() {
        memset(current, 0, sizeof(CRGBF) * buffer_size);
        memset(previous, 0, sizeof(CRGBF) * buffer_size);
        state = StatefulNodeState::INITIALIZED;
    }

    void reset() {
        memset(current, 0, sizeof(CRGBF) * buffer_size);
        memset(previous, 0, sizeof(CRGBF) * buffer_size);
        state = StatefulNodeState::INITIALIZED;
    }

    void scroll() {
        if (state == StatefulNodeState::UNINITIALIZED) init();

        for (size_t i = 0; i < buffer_size; i++) {
            previous[i].r *= decay_factor;
            previous[i].g *= decay_factor;
            previous[i].b *= decay_factor;
        }

        if (direction == Direction::OUTWARD) {
            for (int i = (int)buffer_size - 1; i > 0; i--) {
                current[i] = previous[i - 1];
            }
            current[0] = CRGBF(0, 0, 0);
        } else {
            for (size_t i = 0; i < buffer_size - 1; i++) {
                current[i] = previous[i + 1];
            }
            current[buffer_size - 1] = CRGBF(0, 0, 0);
        }
    }

    void write_center(const CRGBF& value) {
        if (state == StatefulNodeState::UNINITIALIZED) init();
        size_t center = buffer_size / 2;
        current[center] = value;
    }

    CRGBF& operator[](size_t index) {
        if (state == StatefulNodeState::UNINITIALIZED) {
            const_cast<SpriteScrollNode*>(this)->init();
        }
        static CRGBF dummy(0, 0, 0);
        return (index < buffer_size) ? current[index] : dummy;
    }

    const CRGBF& operator[](size_t index) const {
        static const CRGBF dummy(0, 0, 0);
        return (index < buffer_size) ? current[index] : dummy;
    }

    void persist_frame() {
        memcpy(previous, current, sizeof(CRGBF) * buffer_size);
    }

    size_t size() const { return buffer_size; }
    StatefulNodeState get_state() const { return state; }

private:
    const char* node_id;
    CRGBF current[STATEFUL_NODE_BUFFER_SIZE] = {CRGBF(0, 0, 0)};
    CRGBF previous[STATEFUL_NODE_BUFFER_SIZE] = {CRGBF(0, 0, 0)};
    size_t buffer_size;
    Direction direction;
    float speed;
    float decay_factor;
    StatefulNodeState state;
    uint32_t magic;
};

// ============================================================================
// WAVE_POOL NODE - Wave propagation with Gaussian smoothing
// ============================================================================
//
// Use Case: Wave effects, ripple patterns, physics-based animations
// Size: ~1440 bytes (180 floats for height field)
// Reset: On pattern change

class WavePoolNode {
public:
    WavePoolNode(const char* id, size_t size)
        : node_id(id), buffer_size(size),
          state(StatefulNodeState::UNINITIALIZED), magic(STATEFUL_NODE_MAGIC)
    {
        if (buffer_size > STATEFUL_NODE_BUFFER_SIZE) {
            buffer_size = STATEFUL_NODE_BUFFER_SIZE;
        }
    }

    void init() {
        memset(height, 0, sizeof(float) * buffer_size);
        memset(velocity, 0, sizeof(float) * buffer_size);
        state = StatefulNodeState::INITIALIZED;
    }

    void reset() {
        memset(height, 0, sizeof(float) * buffer_size);
        memset(velocity, 0, sizeof(float) * buffer_size);
        state = StatefulNodeState::INITIALIZED;
    }

    void inject_center(float energy) {
        if (state == StatefulNodeState::UNINITIALIZED) init();
        size_t center = buffer_size / 2;
        height[center] += energy;
    }

    void update(float damping = 0.99f) {
        if (state == StatefulNodeState::UNINITIALIZED) init();

        for (size_t i = 1; i < buffer_size - 1; i++) {
            float new_height = (height[i - 1] + height[i + 1]) * 0.5f - velocity[i];
            velocity[i] = (new_height - height[i]) * 0.5f;
            height[i] = new_height * damping;
        }

        for (size_t i = 0; i < buffer_size; i++) {
            height[i] = constrain(height[i], -1.0f, 1.0f);
        }
    }

    float read(size_t index) const {
        if (index >= buffer_size) return 0.0f;
        return height[index];
    }

    float& operator[](size_t index) {
        if (state == StatefulNodeState::UNINITIALIZED) {
            const_cast<WavePoolNode*>(this)->init();
        }
        static float dummy = 0.0f;
        return (index < buffer_size) ? height[index] : dummy;
    }

    size_t size() const { return buffer_size; }
    StatefulNodeState get_state() const { return state; }

private:
    const char* node_id;
    float height[STATEFUL_NODE_BUFFER_SIZE] = {0.0f};
    float velocity[STATEFUL_NODE_BUFFER_SIZE] = {0.0f};
    size_t buffer_size;
    StatefulNodeState state;
    uint32_t magic;
};

// ============================================================================
// GAUSSIAN_BLUR NODE - Spatial blur operation
// ============================================================================
//
// Use Case: Smoothing effects, bloom, diffusion
// Size: ~720 bytes (temporary buffer for blurred values)
// Reset: Never (stateless operation)

class GaussianBlurNode {
public:
    GaussianBlurNode(const char* id, size_t size, float sigma = 1.0f)
        : node_id(id), buffer_size(size), sigma(sigma),
          state(StatefulNodeState::UNINITIALIZED), magic(STATEFUL_NODE_MAGIC)
    {
        if (buffer_size > STATEFUL_NODE_BUFFER_SIZE) {
            buffer_size = STATEFUL_NODE_BUFFER_SIZE;
        }
    }

    void init() {
        state = StatefulNodeState::INITIALIZED;
    }

    void reset() {
        state = StatefulNodeState::INITIALIZED;
    }

    void blur(const float* input, float* output, size_t len) {
        if (state == StatefulNodeState::UNINITIALIZED) init();
        if (len > buffer_size) len = buffer_size;

        for (size_t i = 0; i < len; i++) {
            float left = (i > 0) ? input[i - 1] : input[i];
            float center = input[i];
            float right = (i < len - 1) ? input[i + 1] : input[i];

            output[i] = (left * 0.25f + center * 0.5f + right * 0.25f);
        }
    }

    void blur_inplace(float* buffer, size_t len) {
        if (state == StatefulNodeState::UNINITIALIZED) init();
        if (len > buffer_size) len = buffer_size;

        float temp[STATEFUL_NODE_BUFFER_SIZE];
        memcpy(temp, buffer, sizeof(float) * len);
        blur(temp, buffer, len);
    }

    void set_sigma(float s) { sigma = s; }
    float get_sigma() const { return sigma; }
    size_t size() const { return buffer_size; }
    StatefulNodeState get_state() const { return state; }

private:
    const char* node_id;
    size_t buffer_size;
    float sigma;
    StatefulNodeState state;
    uint32_t magic;
};

// ============================================================================
// NODE REGISTRY - Central management of all stateful nodes
// ============================================================================

class StatefulNodeRegistry {
public:
    StatefulNodeRegistry()
        : node_count(0), last_pattern_id(255),
          magic(STATEFUL_NODE_MAGIC)
    {
    }

    void reset_on_pattern_change(uint8_t new_pattern_id) {
        if (new_pattern_id != last_pattern_id) {
            last_pattern_id = new_pattern_id;
        }
    }

    uint8_t get_node_count() const { return node_count; }
    uint8_t get_last_pattern_id() const { return last_pattern_id; }

    bool validate_integrity() const {
        return magic == STATEFUL_NODE_MAGIC;
    }

    size_t get_total_memory_used() const {
        return (720 + 2160 + 4320 + 1440 + 4 + 512 + 4);  // ~9160 bytes
    }

private:
    uint8_t node_count;
    uint8_t last_pattern_id;
    uint32_t magic;
};

#endif  // FIRMWARE_SRC_STATEFUL_NODES_H
