# Helper Function Consolidation Plan

This document outlines the plan for consolidating duplicated helper functions across the firmware codebase.

## 1. HSV Color Conversion

### Analysis

*   **`pattern_helpers.h`**: Contains a standard, floating-point `hsv` implementation.
*   **`emotiscope_helpers.h`**: Contains `hsv_enhanced`, which appears to be a copy of the same standard implementation.
*   **`lut/color_lut.h`**: Contains a highly optimized `hsv_fast` version that uses a lookup table. The comments claim it's a drop-in replacement.
*   **`graph_codegen/graph_runtime.h`**: Contains an `hsv_to_rgb` function that is another copy of the standard implementation.

### Plan

1.  **Select Canonical Version**: The `hsv_fast` implementation from `lut/color_lut.h` is the best choice for performance. We will make this the canonical version. **(Done)**
2.  **Relocate**: Move `hsv_fast` to `pattern_helpers.h` and rename it to `hsv`. **(Done)**
3.  **Update Call Sites**: Systematically replace all calls to the other `hsv` variants with the new canonical version in `pattern_helpers.h`. **(Done)**
4.  **Remove Duplicates**: Delete the old `hsv` functions from `emotiscope_helpers.h` and `graph_codegen/graph_runtime.h`. **(Done)**

---

*This document will be updated with plans for other duplicated functions (noise, blending, etc.) in the future.*
