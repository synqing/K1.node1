// Bridge to route selected patterns to generated graph PoCs when enabled

#pragma once

// Apply overrides to the pattern registry so that "spectrum" and "bloom"
// use the generated implementations when USE_GENERATED_* flags are defined.
// Safe no-op when flags are not set.
void apply_codegen_overrides();

