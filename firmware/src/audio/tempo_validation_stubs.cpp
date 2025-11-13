#include "audio/validation/tempo_validation.h"

// Minimal stub definitions to satisfy webserver linkage when Phase 3 validation is disabled.
TempoConfidenceMetrics tempo_confidence_metrics = {0};
TempoLockTracker tempo_lock_tracker = { TEMPO_UNLOCKED, 0, 0.0f };

const char* get_tempo_lock_state_string(TempoLockState state) {
    switch (state) {
        case TEMPO_UNLOCKED: return "unlocked";
        case TEMPO_LOCKING:  return "locking";
        case TEMPO_LOCKED:   return "locked";
        case TEMPO_DEGRADING:return "degrading";
        default:             return "unknown";
    }
}

