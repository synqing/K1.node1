#include <unity.h>
#include <atomic>
#include <string.h>

#ifndef NUM_BINS
#define NUM_BINS 32
#endif

static std::atomic<uint32_t> bins_seq{0};
static float shared_bins[NUM_BINS];

static void writer_update(const float* src) {
  bins_seq.fetch_add(1, std::memory_order_acq_rel);
  memcpy(shared_bins, src, sizeof(shared_bins));
  bins_seq.fetch_add(1, std::memory_order_acq_rel);
}

static bool reader_snapshot(float* out) {
  uint32_t s1 = bins_seq.load(std::memory_order_acquire);
  if (s1 & 1u) return false;
  memcpy(out, shared_bins, sizeof(shared_bins));
  uint32_t s2 = bins_seq.load(std::memory_order_acquire);
  return (s1 == s2) && ((s2 & 1u) == 0);
}

void setUp() {
  float init[NUM_BINS];
  for (int i=0;i<NUM_BINS;++i) init[i] = (float)i;
  writer_update(init);
}

void tearDown() {}

void test_snapshot_consistency_single_update() {
  float local[NUM_BINS];
  bool ok=false;
  for (int tries=0; tries<4 && !ok; ++tries) ok = reader_snapshot(local);
  TEST_ASSERT_TRUE(ok);
  for (int i=0;i<NUM_BINS;++i) TEST_ASSERT_FLOAT_WITHIN(0.0001f, (float)i, local[i]);
}

void test_concurrent_like_updates() {
  float src[NUM_BINS];
  for (int i=0;i<NUM_BINS;++i) src[i] = (float)(i*2);
  writer_update(src);

  int successes=0;
  float local[NUM_BINS];
  for (int n=0;n<10000;++n) {
    if (reader_snapshot(local)) successes++;
  }
  TEST_ASSERT_GREATER_THAN(0, successes);
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_snapshot_consistency_single_update);
  RUN_TEST(test_concurrent_like_updates);
  return UNITY_END();
}

