#include "tempo_enhanced.h"
#include <cmath>
#include <cstring>

bool ComplexODF::init() { prev_energy_ = 0.0f; std::memset(prev_bins_, 0, sizeof(prev_bins_)); return true; }
void ComplexODF::reset() { prev_energy_ = 0.0f; std::memset(prev_bins_, 0, sizeof(prev_bins_)); }

float ComplexODF::calculate_from_samples(float* samples, uint32_t num_samples) {
    // Simple energy-based novelty
    float e = 0.0f; for (uint32_t i = 0; i < num_samples; ++i) e += samples[i] * samples[i];
    float novelty = fmaxf(0.0f, e - prev_energy_);
    prev_energy_ = e * 0.9f + prev_energy_ * 0.1f;
    return novelty;
}

float ComplexODF::calculate_from_spectrum(const float* spectrum, uint32_t num_bins) {
    uint32_t n = (num_bins > 128) ? 128 : num_bins;
    float sum = 0.0f;
    for (uint32_t i = 0; i < n; ++i) {
        float d = spectrum[i] - prev_bins_[i];
        if (d > 0) sum += d;
        prev_bins_[i] = spectrum[i] * 0.7f + prev_bins_[i] * 0.3f;
    }
    return sum / fmaxf(1.0f, (float)n);
}

void AdaptiveAmplitudeGate::init() { adaptive_ = true; ema_ = 0.0f; }
void AdaptiveAmplitudeGate::reset() { ema_ = 0.0f; }
void AdaptiveAmplitudeGate::set_adaptive_mode(bool enabled) { adaptive_ = enabled; }
float AdaptiveAmplitudeGate::process(float x) {
    float ax = fabsf(x);
    ema_ = ema_ * 0.95f + ax * 0.05f; // slow floor estimate
    float floor = adaptive_ ? (ema_ * 0.5f) : 0.0f;
    float y = x;
    if (ax < floor) y = 0.0f;
    return y;
}

void EntropyConfidenceScorer::init() {}
void EntropyConfidenceScorer::reset() {}

static float safe_log(float x) { return x > 1e-9f ? logf(x) : -20.0f; }

ConfidenceBreakdown EntropyConfidenceScorer::calculate_confidence(const float* bins, int n,
                                                                  const float* /*history*/, int /*history_size*/) {
    ConfidenceBreakdown out{};
    float sum = 0.0f, peak = 0.0f; int peak_idx = 0;
    for (int i = 0; i < n; ++i) { sum += bins[i]; if (bins[i] > peak) { peak = bins[i]; peak_idx = i; } }
    float peak_ratio = (sum > 1e-6f) ? (peak / sum) : 0.0f;
    // Entropy
    float H = 0.0f; for (int i = 0; i < n; ++i) { float p = (sum > 0) ? bins[i] / sum : 0.0f; if (p > 1e-9f) H += -p * safe_log(p); }
    float Hmax = safe_log((float)n);
    float entropy_conf = (Hmax > 1e-6f) ? (1.0f - (H / Hmax)) : 0.0f;
    out.entropy = entropy_conf;
    out.periodicity = 0.5f; // placeholder
    out.stability = 0.5f;   // placeholder until history wired
    out.phase_coherence = 0.5f; // from tempogram later
    out.combined = fminf(1.0f, fmaxf(0.0f, peak_ratio * 0.7f + entropy_conf * 0.3f));
    (void)peak_idx;
    return out;
}

void MultiStageSmoother::init() { std::memset(state_, 0, sizeof(state_)); }
void MultiStageSmoother::reset() { std::memset(state_, 0, sizeof(state_)); }
float MultiStageSmoother::process(float v, int idx) {
    if (idx < 0 || idx >= ENHANCED_NUM_TEMPI) return v;
    float a = 0.2f; // mild EMA
    state_[idx] = state_[idx] * (1.0f - a) + v * a;
    return state_[idx];
}

// Utility helpers
float tempo_bin_to_bpm(int bin, int num_bins) {
    if (bin < 0) bin = 0; if (bin >= num_bins) bin = num_bins - 1;
    float progress = (float)bin / (float)(num_bins - 1);
    return ENHANCED_TEMPO_LOW + progress * (ENHANCED_TEMPO_HIGH - ENHANCED_TEMPO_LOW);
}

void compute_autocorrelation_tempogram(const float* novelty, int length,
                                       float* out_bins, int num_bins,
                                       float bpm_min, float bpm_max,
                                       float novelty_rate_hz) {
    // Very lightweight autocorrelation-based tempogram
    for (int i = 0; i < num_bins; ++i) out_bins[i] = 0.0f;
    for (int b = 0; b < num_bins; ++b) {
        float bpm = bpm_min + (float)b * (bpm_max - bpm_min) / (float)(num_bins - 1);
        float period_s = 60.0f / bpm;
        int lag = (int)(period_s * novelty_rate_hz);
        if (lag <= 1 || lag >= length) { out_bins[b] = 0.0f; continue; }
        float acc = 0.0f;
        int maxk = length - lag;
        for (int k = 0; k < maxk; ++k) {
            acc += novelty[k] * novelty[k + lag];
        }
        out_bins[b] = acc / (float)maxk;
    }
}

