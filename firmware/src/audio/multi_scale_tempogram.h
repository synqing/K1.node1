#pragma once

#include <stdint.h>

#ifndef NUM_SCALES
#define NUM_SCALES 3
#endif

static constexpr float SCALE_RATIOS[NUM_SCALES] = { 0.5f, 1.0f, 2.0f };

class MultiScaleTemplogram {
public:
    MultiScaleTemplogram();
    ~MultiScaleTemplogram();

    bool init(int num_bins, float bpm_min, float bpm_max);
    void reset();

    // Processing
    void process_novelty_curve(const float* novelty, int length);
    void get_combined_tempogram(float* output);

    // Queries
    float get_phase_at_tempo(int tempo_idx) const;
    float get_coherence_at_tempo(int tempo_idx) const;
    void get_scale_tempogram(int scale_idx, float* output);
    void find_tempo_peaks(int* peak_indices, float* peak_values, int max_peaks);
    bool check_harmonic_relation(int tempo_idx1, int tempo_idx2, float tolerance);
    float get_tempo_stability(int tempo_idx, int history_frames);

private:
    void init_comb_filters(int scale_idx);
    void decimate_signal(const float* input, int input_length,
                         float* output, int& output_length, float ratio);
    void apply_comb_filter(const float* signal, int length,
                           int tempo_idx, int scale_idx,
                           float& magnitude_out, float& phase_out);
    void calculate_harmonic_relationships();
    void combine_scales_with_coherence();
    float calculate_phase_coherence_score(int tempo_idx);

private:
    int num_tempo_bins;
    float min_bpm;
    float max_bpm;
    float** tempogram;
    float* combined_tempogram;
    float** phase_matrix;
    float* phase_coherence;

    struct CombFilterBank {
        int* periods;
        float* weights;
        struct Filter { float a, b; }* filters;
    }* comb_banks[NUM_SCALES];

    float* decimated_signals[NUM_SCALES];
    int decimated_lengths[NUM_SCALES];

    float** harmonic_matrix;
};

