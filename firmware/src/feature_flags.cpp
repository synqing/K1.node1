#include "feature_flags.h"

#include "logging/logger.h"

static FeaturePhase s_active_phase = FeaturePhase::Baseline;
FeatureFlags g_feature_flags{};

static void apply_phase_defaults(FeaturePhase phase) {
	switch (phase) {
		case FeaturePhase::Baseline:
			g_feature_flags = {
				.background_overlay = false,
				.transitions = false,
				.auto_palette_cycle = false,
				.visual_effects = false,
			};
			break;
		case FeaturePhase::GuardedHooks:
			g_feature_flags = {
				.background_overlay = true,
				.transitions = false,
				.auto_palette_cycle = false,
				.visual_effects = false,
			};
			break;
		case FeaturePhase::VisualFeatures:
			g_feature_flags = {
				.background_overlay = true,
				.transitions = true,
				.auto_palette_cycle = true,
				.visual_effects = true,
			};
			break;
		case FeaturePhase::FullIntegration:
		default:
			g_feature_flags = {
				.background_overlay = true,
				.transitions = true,
				.auto_palette_cycle = true,
				.visual_effects = true,
			};
			break;
	}
}

void set_feature_phase(FeaturePhase phase) {
	if (phase == s_active_phase) {
		return;
	}
	s_active_phase = phase;
	apply_phase_defaults(phase);
	LOG_INFO('F', "Feature phase set to %u (background=%d, transitions=%d, auto_palette=%d, visuals=%d)",
	         static_cast<unsigned>(phase),
	         (int)g_feature_flags.background_overlay,
	         (int)g_feature_flags.transitions,
	         (int)g_feature_flags.auto_palette_cycle,
	         (int)g_feature_flags.visual_effects);
}

FeaturePhase get_feature_phase() {
	return s_active_phase;
}
