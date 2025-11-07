#include <unity.h>
#include <stdint.h>

#ifndef NOVELTY_HISTORY_LENGTH
#define NOVELTY_HISTORY_LENGTH 64
#endif

static float novelty_history[NOVELTY_HISTORY_LENGTH];

static uint16_t wrap_index_mod(uint16_t idx) {
  return idx % NOVELTY_HISTORY_LENGTH;
}

static uint16_t wrap_index_mask(uint16_t idx) {
  static_assert((NOVELTY_HISTORY_LENGTH & (NOVELTY_HISTORY_LENGTH-1)) == 0, "Po2 required");
  return (uint16_t)(idx & (NOVELTY_HISTORY_LENGTH - 1));
}

static float safe_read_mod(uint16_t idx) {
  return novelty_history[wrap_index_mod(idx)];
}

static float safe_read_mask(uint16_t idx) {
  return novelty_history[wrap_index_mask(idx)];
}

void setUp() {
  for (int i=0;i<NOVELTY_HISTORY_LENGTH;++i) novelty_history[i] = (float)i;
}

void tearDown() {}

void test_bounds_modulo() {
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.f, safe_read_mod(0));
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, NOVELTY_HISTORY_LENGTH-1, safe_read_mod(NOVELTY_HISTORY_LENGTH-1));
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.f, safe_read_mod(NOVELTY_HISTORY_LENGTH));
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 7.f, safe_read_mod(NOVELTY_HISTORY_LENGTH+7));
}

void test_bounds_mask() {
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.f, safe_read_mask(0));
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, NOVELTY_HISTORY_LENGTH-1, safe_read_mask(NOVELTY_HISTORY_LENGTH-1));
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.f, safe_read_mask(NOVELTY_HISTORY_LENGTH));
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 7.f, safe_read_mask(NOVELTY_HISTORY_LENGTH+7));
}

void test_random_fuzz() {
  uint32_t x = 123456789u;
  for (int i=0;i<100000;++i) {
    x = 1664525u * x + 1013904223u;
    uint16_t idx = (uint16_t)(x >> 16);
    (void)safe_read_mask(idx);
    (void)safe_read_mod(idx);
  }
  TEST_PASS();
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_bounds_modulo);
  RUN_TEST(test_bounds_mask);
  RUN_TEST(test_random_fuzz);
  return UNITY_END();
}

