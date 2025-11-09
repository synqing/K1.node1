// Stateful Node System - Implementation
// Part of K1.node1 Graph Compilation Architecture (ADR-0006)
//
// This file contains helper functions and global registry management
// for the stateful node system.

#include "stateful_nodes.h"

// ============================================================================
// GLOBAL NODE REGISTRY
// ============================================================================

static StatefulNodeRegistry g_stateful_node_registry;
static uint8_t g_current_pattern_id = 255;  // Track pattern changes

// ============================================================================
// NODE LIFECYCLE MANAGEMENT
// ============================================================================

/**
 * Handle pattern change event - reset all nodes
 * Called when pattern changes or is manually reset
 */
void stateful_nodes_on_pattern_change(uint8_t new_pattern_id) {
    g_stateful_node_registry.reset_on_pattern_change(new_pattern_id);
    g_current_pattern_id = new_pattern_id;
}

/**
 * Validate all nodes integrity
 * Returns true if all nodes are valid, false if corruption detected
 */
bool stateful_nodes_validate() {
    return g_stateful_node_registry.validate_integrity();
}

/**
 * Get current memory usage of all stateful nodes
 * Useful for diagnostics and memory budgeting
 */
size_t stateful_nodes_get_memory_used() {
    return g_stateful_node_registry.get_total_memory_used();
}

/**
 * Reset all nodes to uninitialized state
 * Used during power-on or factory reset
 */
void stateful_nodes_reset_all() {
    stateful_nodes_on_pattern_change(255);  // Use invalid ID to force reset
}

// ============================================================================
// BUFFER_PERSIST NODE - SPECIALIZED HELPERS
// ============================================================================

/**
 * Create and initialize a buffer persist node with default decay
 * Decay factor typically 0.9-0.99 (higher = longer persistence)
 */
BufferPersistNode* stateful_nodes_create_buffer_persist(
    const char* id, size_t size, float decay)
{
    // In production, nodes are created statically in pattern functions
    // This is a helper for dynamic creation if needed
    return new BufferPersistNode(id, size, decay);
}

/**
 * Apply decay and clamp in one operation (common pattern)
 */
void stateful_nodes_buffer_decay_and_clamp(BufferPersistNode& node) {
    node.apply_decay();
    node.clamp();
}

// ============================================================================
// COLOR_PERSIST NODE - SPECIALIZED HELPERS
// ============================================================================

/**
 * Apply decay and clamp to color buffer (common pattern)
 */
void stateful_nodes_color_decay_and_clamp(ColorPersistNode& node) {
    node.apply_decay();
    node.clamp();
}

// ============================================================================
// PHASE_ACCUMULATOR NODE - SPECIALIZED HELPERS
// ============================================================================

/**
 * Get sine wave value from phase accumulator
 */
float stateful_nodes_phase_sine(const PhaseAccumulatorNode& node) {
    return sin(node.get_phase());
}

/**
 * Get cosine wave value from phase accumulator
 */
float stateful_nodes_phase_cosine(const PhaseAccumulatorNode& node) {
    return cos(node.get_phase());
}

/**
 * Get triangle wave value (0 to 1) from phase accumulator
 */
float stateful_nodes_phase_triangle(const PhaseAccumulatorNode& node) {
    float phase = node.get_phase() / TWO_PI;  // Normalize to [0, 1)
    return (phase < 0.5f) ? (2.0f * phase) : (2.0f * (1.0f - phase));
}

// ============================================================================
// BEAT_HISTORY NODE - SPECIALIZED HELPERS
// ============================================================================

/**
 * Detect if beat just occurred (confidence > threshold and rising edge)
 */
bool stateful_nodes_beat_is_new(const BeatHistoryNode& node, float threshold) {
    float current = node.read_beat(0);
    float previous = node.read_beat(1);
    return (current >= threshold) && (previous < threshold);
}

/**
 * Get beat strength as smoothed average over recent samples
 */
float stateful_nodes_beat_get_smooth_strength(BeatHistoryNode& node, size_t window) {
    return node.get_average(window);
}

// ============================================================================
// WAVE_POOL NODE - SPECIALIZED HELPERS
// ============================================================================

/**
 * Get amplitude (peak height) of wave
 */
float stateful_nodes_wave_get_amplitude(const WavePoolNode& node) {
    float max_val = 0.0f;
    for (size_t i = 0; i < node.size(); i++) {
        max_val = fmax(max_val, fabs(node.read(i)));
    }
    return max_val;
}

// ============================================================================
// MEMORY BOUNDS CHECKING
// ============================================================================

/**
 * Verify a buffer access is in bounds
 * Returns true if safe, false if out of bounds
 */
bool stateful_nodes_is_index_safe(size_t index, size_t buffer_size) {
    return index < buffer_size;
}

/**
 * Clamp index to valid range
 */
size_t stateful_nodes_clamp_index(size_t index, size_t buffer_size) {
    return (index >= buffer_size) ? (buffer_size - 1) : index;
}

// ============================================================================
// DIAGNOSTICS
// ============================================================================

/**
 * Check if node memory budget is exceeded
 * Returns true if usage is acceptable, false if out of budget
 */
bool stateful_nodes_check_memory_budget(size_t max_budget) {
    size_t used = g_stateful_node_registry.get_total_memory_used();
    return used <= max_budget;
}

/**
 * Get formatted string describing node memory usage
 * For REST API diagnostics endpoint
 */
void stateful_nodes_get_memory_summary(char* buffer, size_t buf_len) {
    size_t used = g_stateful_node_registry.get_total_memory_used();
    const size_t TOTAL_BUDGET = 200000;  // 200KB
    int percent = (used * 100) / TOTAL_BUDGET;

    snprintf(buffer, buf_len,
             "StatefulNodes: %zu/%zu bytes (%d%%)",
             used, TOTAL_BUDGET, percent);
}

// ============================================================================
// PATTERN INTEGRATION HELPERS
// ============================================================================

/**
 * Guard for stateful node initialization
 * Use at beginning of pattern to ensure all nodes are initialized
 */
void stateful_nodes_ensure_initialized(uint8_t pattern_id) {
    static uint8_t last_pattern_id = 255;

    if (pattern_id != last_pattern_id) {
        // Pattern changed - nodes should be reset by pattern code
        // This is just a safety check
        stateful_nodes_on_pattern_change(pattern_id);
        last_pattern_id = pattern_id;
    }
}

// ============================================================================
// ZERO-OVERHEAD INLINE HELPERS (For hot paths)
// ============================================================================

// These are declared in the header as inline for zero overhead in render loops

// ============================================================================
// TEST/VALIDATION HELPERS (Debug builds only)
// ============================================================================

#ifdef DEBUG_STATEFUL_NODES

/**
 * Self-test all node types (debug only)
 * Validates initialization, state management, and memory layout
 */
bool stateful_nodes_run_self_test() {
    // Test BufferPersistNode
    {
        BufferPersistNode node("test_buffer", 10, 0.9f);
        node.init();
        if (node.get_state() != StatefulNodeState::INITIALIZED) {
            return false;
        }
        node[0] = 1.0f;
        if (node[0] != 1.0f) {
            return false;
        }
        node.apply_decay();
        if (node[0] != 0.9f) {
            return false;
        }
    }

    // Test ColorPersistNode
    {
        ColorPersistNode node("test_color", 10, 0.9f);
        node.init();
        CRGBF color(100, 200, 50);
        node[0] = color;
        if (node[0].r != 100 || node[0].g != 200 || node[0].b != 50) {
            return false;
        }
    }

    // Test PhaseAccumulatorNode
    {
        PhaseAccumulatorNode node("test_phase");
        node.init();
        node.advance(PI / 2);
        float phase = node.get_phase();
        if (fabs(phase - PI / 2) > 0.01f) {
            return false;
        }
    }

    // Test EnergyGateNode
    {
        EnergyGateNode node("test_gate", 0.5f);
        node.init();
        node.update(0.3f);
        if (node.is_open()) {
            return false;
        }
        node.update(0.7f);
        if (!node.is_open()) {
            return false;
        }
    }

    // Test BeatHistoryNode
    {
        BeatHistoryNode node("test_beat");
        node.init();
        node.write_beat(0.5f);
        if (node.read_beat(0) != 0.5f) {
            return false;
        }
    }

    // Test WavePoolNode
    {
        WavePoolNode node("test_wave", 10);
        node.init();
        node.inject_center(0.5f);
        if (node.read(5) == 0.0f) {
            // Center should have energy
            return false;
        }
    }

    // Test GaussianBlurNode
    {
        GaussianBlurNode node("test_blur", 10);
        node.init();
        float input[10] = {1.0f, 1.0f, 1.0f, 1.0f, 1.0f, 0.0f, 0.0f, 0.0f, 0.0f, 0.0f};
        float output[10] = {0.0f};
        node.blur(input, output, 10);
        if (output[3] == 0.0f) {
            // Blur should have smoothed the edge
            return false;
        }
    }

    // Test SpriteScrollNode
    {
        SpriteScrollNode node("test_sprite", 10, SpriteScrollNode::Direction::OUTWARD, 1.0f, 0.9f);
        node.init();
        CRGBF center(100, 100, 100);
        node.write_center(center);
        if (node[5].r != 100) {
            return false;
        }
    }

    return true;
}

#endif  // DEBUG_STATEFUL_NODES

// ============================================================================
// END OF IMPLEMENTATION
// ============================================================================
