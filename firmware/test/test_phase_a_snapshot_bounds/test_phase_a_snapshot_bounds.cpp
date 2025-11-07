#include <unity.h>
#include <stdint.h>

struct AudioDataSnapshot {
  float beat_phase = 0.f;
  float energy     = 0.f;
  float spectral0  = 0.f;
  float spectral1  = 0.f;
};

#ifndef NUM_BINS
#define NUM_BINS 32
#endif

static inline float get_spectral_bin(const float* bins, int k) {
  if (k < 0 || k >= NUM_BINS) return 0.f;
  return bins[k];
}

void test_snapshot_defaults_zeroed() {
  AudioDataSnapshot s;
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.f, s.beat_phase);
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.f, s.energy);
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.f, s.spectral0);
}

void test_spectral_bounds() {
  float bins[NUM_BINS];
  for (int i=0;i<NUM_BINS;++i) bins[i] = (float)i;
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.f, get_spectral_bin(bins, -1));
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.f, get_spectral_bin(bins, NUM_BINS));
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 7.f, get_spectral_bin(bins, 7));
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, (float)(NUM_BINS-1), get_spectral_bin(bins, NUM_BINS-1));
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_snapshot_defaults_zeroed);
  RUN_TEST(test_spectral_bounds);
  return UNITY_END();
}

