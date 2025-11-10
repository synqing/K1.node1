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
| 2 | Relocate HSV functions | Move the `hsv2rgb` and related functions to the `pattern_helpers` module. | All callers are updated, and all build variants pass. |
| 3 | Abstract LED buffer access | Create a `PatternRenderContext` struct that provides patterns with a reference to the LED buffer, rather than having them access it directly. | All patterns are updated to use the new context, and all build variants pass. |
| 4 | Refactor `get_pattern_buffer` | Move this function into the `pattern_runtime` and provide a clean interface for patterns to access the buffer. | All callers are updated, and all build variants pass. |

## Dependency Injection Opportunities

*   **`PatternRenderContext`**: Instead of patterns accessing global state directly, we will introduce a `PatternRenderContext` struct. This will be passed to each pattern's `draw` function and will contain:
    *   A reference to the LED buffer.
    *   The current audio snapshot.
    *   The current time.
    *   Any other relevant context.
*   **Constructor/Init Pathways**: We will design constructor or `init` pathways for these contexts to be created and passed down to the patterns.

## Next Steps

The next steps in this refactoring effort should focus on continuing the migration of high-risk helpers from `generated_patterns.h` to the new `pattern_helpers` module. The following tasks from the migration roadmap should be prioritized:

1.  **Relocate HSV functions**: Move the `hsv2rgb` and related functions to the `pattern_helpers` module.
2.  **Abstract LED buffer access**: Create a `PatternRenderContext` struct to provide patterns with a reference to the LED buffer, rather than having them access it directly.
3.  **Refactor `get_pattern_buffer`**: Move this function into the `pattern_runtime` and provide a clean interface for patterns to access the buffer.
