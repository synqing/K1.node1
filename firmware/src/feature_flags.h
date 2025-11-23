#pragma once

#include <stdint.h>

// Defines phased feature reintroduction toggles to ensure controlled rollout.

enum class FeaturePhase : uint8_t {
	Baseline = 0,
	GuardedHooks = 1,
	VisualFeatures = 2,
	FullIntegration = 3,
};

struct FeatureFlags {
	bool background_overlay;      // Enable optional ambient background overlay
	bool transitions;             // Enable visual transitions between patterns
	bool auto_palette_cycle;      // Enable automatic palette cycling
	bool visual_effects;          // Enable optional visual extras (screensaver, etc.)
};

extern FeatureFlags g_feature_flags;

void set_feature_phase(FeaturePhase phase);
FeaturePhase get_feature_phase();
