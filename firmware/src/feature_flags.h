#pragma once

#include <stdint.h>

// Defines phased feature reintroduction toggles to ensure controlled rollout.

enum class FeaturePhase : uint8_t {
	Baseline = 0,
	GuardedHooks = 1,
	EnhancedTempoRehab = 2,
	VisualFeatures = 3,
	FullIntegration = 4,
};

struct FeatureFlags {
	bool enhanced_tempo;          // Allow enhanced tempo detector to drive beats
	bool background_overlay;      // Enable optional ambient background overlay
	bool transitions;             // Enable visual transitions between patterns
	bool auto_palette_cycle;      // Enable automatic palette cycling
	bool visual_effects;          // Enable optional visual extras (screensaver, etc.)
};

extern FeatureFlags g_feature_flags;

void set_feature_phase(FeaturePhase phase);
FeaturePhase get_feature_phase();
