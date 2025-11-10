# Firmware Module Architecture

This document outlines the proposed modular architecture for the firmware, designed to improve separation of concerns, reduce coupling, and enhance testability.

## Proposed Modules

| Module | Responsibilities | Key Public Interfaces |
|---|---|---|
| **`audio_input`** | Manages microphone input, audio processing (DFT, beat detection), and provides an interface for patterns to access audio data. | `get_audio_snapshot()`, `is_beat_detected()` |
| **`pattern_runtime`** | The core pattern execution engine. Manages the lifecycle of patterns, calls their `draw` functions, and handles parameter updates. | `register_pattern()`, `select_pattern()`, `update_parameters()` |
| **`render_pipeline`** | Responsible for taking the output of a pattern (the LED buffer) and applying post-processing effects. | `apply_post_processing()` |
| **`led_hw`** | The low-level driver for the LEDs. It takes a buffer of LED data and sends it to the hardware. | `transmit_leds()` |
| **`codegen_patterns`** | The generated patterns. These should only depend on the `pattern_runtime` and a stable `pattern_helpers` API. | (Varies by pattern) |
| **`pattern_helpers`** | A new module to house shared utility functions currently scattered throughout the codebase. | `apply_background_overlay()`, `hsv_to_rgb()` |
| **`shared_math`** | For general-purpose math functions that are not specific to any domain. | `clip_float()`, `lerp()` |

## Dependency Rules

*   `codegen_patterns` may consume `pattern_helpers` and `audio_input`, but never `led_hw` directly.
*   The `render_pipeline` sits between the `pattern_runtime` and `led_hw`.
*   `shared_math` can be used by any module.

## Migration Roadmap

This is a living document that will be updated as the refactoring progresses.

| Priority | Task | Description | Acceptance Criteria |
|---|---|---|---|
| 1 | Relocate `apply_background_overlay` | Move this function from `generated_patterns.h` to a new `pattern_helpers` module. | All patterns that use this function are updated to call the new version, and all build variants pass. |
| 2 | Relocate HSV functions | Move the `hsv2rgb` and related functions to the `pattern_helpers` module. | **Done.** All callers are updated, and all build variants pass. |
| 3 | Abstract LED buffer access | Create a `PatternRenderContext` struct that provides patterns with a reference to the LED buffer, rather than having them access it directly. | **Done.** All patterns are updated to use the new context, and all build variants pass. |
| 4 | Refactor `get_pattern_buffer` | Move this function into the `pattern_runtime` and provide a clean interface for patterns to access the buffer. | **Done.** This was made obsolete by the `PatternRenderContext`, which provides direct buffer access. |

## Dependency Injection Opportunities

*   **`PatternRenderContext`**: Instead of patterns accessing global state directly, we will introduce a `PatternRenderContext` struct. This will be passed to each pattern's `draw` function and will contain:
    *   A reference to the LED buffer.
    *   The current audio snapshot.
    *   The current time.
    *   Any other relevant context.
*   **Constructor/Init Pathways**: We will design constructor or `init` pathways for these contexts to be created and passed down to the patterns.

The `PatternRenderContext` has been implemented and is now passed to all pattern `draw` functions. It serves as a central data structure that provides patterns with all the necessary information for rendering, including the LED buffer, audio data, and pattern parameters. This change has allowed us to remove the global `leds` array dependency from `pattern_helpers.h` and is a major step towards a more modular and testable architecture.

## Conclusion

This document outlines the initial phase of a major firmware refactoring. The key accomplishments of this phase are:
- The creation of a new `pattern_helpers` module to house shared utilities.
- The migration of high-risk helpers (`apply_background_overlay`, HSV functions) into this new module.
- The introduction of a `PatternRenderContext` to provide a clean, dependency-injected interface for all pattern rendering.

All tasks in the initial migration roadmap are now complete. The firmware is now in a more modular state, with clearer dependencies and a solid foundation for future development.

For the next phase of refactoring, which focuses on consolidating duplicated helper functions, please refer to the [Helper Function Consolidation Plan](../04-planning/RFC_HELPER_CONSOLIDATION.md).
