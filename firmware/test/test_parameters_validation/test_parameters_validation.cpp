/**
 * TEST SUITE: Parameter Validation & Clamping
 *
 * Validates validate_and_clamp() behavior across ranges, NaN/Inf, and palette bounds.
 */

#include <Arduino.h>
#include <unity.h>
#include "../test_utils/test_helpers.h"
#include "../../src/parameters.h"
#include "../../src/palettes.h"

// Forward decl from parameters.cpp
bool validate_and_clamp(PatternParameters& params);

static PatternParameters make_params() {
    PatternParameters p = get_default_params();
    return p;
}

void setUp(void) {
    init_params();
}

void tearDown(void) {
    vTaskDelay(pdMS_TO_TICKS(50));
}

void test_valid_values_no_clamp() {
    PatternParameters p = make_params();
    p.brightness = 0.75f;
    p.softness = 0.10f;
    p.color = 0.42f;
    p.color_range = 0.25f;
    p.saturation = 0.85f;
    p.warmth = 0.15f;
    p.background = 0.35f;
    p.speed = 0.60f;
    p.palette_id = NUM_PALETTES - 1;
    p.custom_param_1 = 0.55f;
    p.custom_param_2 = 0.05f;
    p.custom_param_3 = 0.95f;

    bool clamped = validate_and_clamp(p);
    TEST_ASSERT_FALSE(clamped);

    TEST_ASSERT_IN_RANGE(p.brightness, 0.0f, 1.0f);
    TEST_ASSERT_IN_RANGE(p.softness, 0.0f, 1.0f);
    TEST_ASSERT_IN_RANGE(p.color, 0.0f, 1.0f);
    TEST_ASSERT_IN_RANGE(p.color_range, 0.0f, 1.0f);
    TEST_ASSERT_IN_RANGE(p.saturation, 0.0f, 1.0f);
    TEST_ASSERT_IN_RANGE(p.warmth, 0.0f, 1.0f);
    TEST_ASSERT_IN_RANGE(p.background, 0.0f, 1.0f);
    TEST_ASSERT_IN_RANGE(p.speed, 0.0f, 1.0f);
    TEST_ASSERT_TRUE(p.palette_id < NUM_PALETTES);
}

void test_out_of_range_clamp() {
    PatternParameters p = make_params();
    p.brightness = -0.2f;  // below 0
    p.softness = 1.3f;     // above 1
    p.color = -1.0f;       // below 0
    p.color_range = 2.0f;  // above 1
    p.saturation = -0.01f; // below 0
    p.warmth = 1.01f;      // above 1
    p.background = 99.0f;  // way above 1
    p.speed = -5.0f;       // below 0
    p.custom_param_1 = 42.0f; // above 1
    p.custom_param_2 = -42.0f; // below 0
    p.custom_param_3 = 1000.0f; // above 1

    bool clamped = validate_and_clamp(p);
    TEST_ASSERT_TRUE(clamped);

    TEST_ASSERT_IN_RANGE(p.brightness, 0.0f, 1.0f);
    TEST_ASSERT_IN_RANGE(p.softness, 0.0f, 1.0f);
    TEST_ASSERT_IN_RANGE(p.color, 0.0f, 1.0f);
    TEST_ASSERT_IN_RANGE(p.color_range, 0.0f, 1.0f);
    TEST_ASSERT_IN_RANGE(p.saturation, 0.0f, 1.0f);
    TEST_ASSERT_IN_RANGE(p.warmth, 0.0f, 1.0f);
    TEST_ASSERT_IN_RANGE(p.background, 0.0f, 1.0f);
    TEST_ASSERT_IN_RANGE(p.speed, 0.0f, 1.0f);
    TEST_ASSERT_IN_RANGE(p.custom_param_1, 0.0f, 1.0f);
    TEST_ASSERT_IN_RANGE(p.custom_param_2, 0.0f, 1.0f);
    TEST_ASSERT_IN_RANGE(p.custom_param_3, 0.0f, 1.0f);
}

void test_nan_inf_defaults() {
    PatternParameters p = make_params();
    p.brightness = NAN;
    p.softness = INFINITY;
    p.color = -INFINITY;
    p.color_range = NAN;
    p.saturation = INFINITY;
    p.warmth = NAN;
    p.background = INFINITY;
    p.speed = NAN;

    bool clamped = validate_and_clamp(p);
    TEST_ASSERT_TRUE(clamped);

    // Check defaults applied from parameters.cpp
    TEST_ASSERT_FLOAT_WITHIN(0.0001f, 1.0f, p.brightness);
    TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.25f, p.softness);
    TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.33f, p.color);
    TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.0f, p.color_range);
    TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.75f, p.saturation);
    TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.0f, p.warmth);
    TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.25f, p.background);
    TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.5f, p.speed);
}

void test_palette_bounds() {
    PatternParameters p = make_params();
    p.palette_id = 255; // way out of range
    bool clamped = validate_and_clamp(p);
    TEST_ASSERT_TRUE(clamped);
    TEST_ASSERT_EQUAL_UINT8(0, p.palette_id);

    p.palette_id = NUM_PALETTES - 1; // max valid
    clamped = validate_and_clamp(p);
    TEST_ASSERT_FALSE(clamped);
    TEST_ASSERT_EQUAL_UINT8(NUM_PALETTES - 1, p.palette_id);
}

void test_update_params_safe_applies_values() {
    PatternParameters p = make_params();
    p.brightness = 1.5f; // will be clamped
    bool ok = update_params_safe(p); // returns false when clamped
    TEST_ASSERT_FALSE(ok);

    const PatternParameters &cur = get_params();
    TEST_ASSERT_FLOAT_WITHIN(0.0001f, 1.0f, cur.brightness);
}

void setup() {
    Serial.begin(2000000);
    delay(1500);

    Serial.println("\n\n========================================");
    Serial.println("PARAMETERS VALIDATION - TEST SUITE");
    Serial.println("========================================\n");

    UNITY_BEGIN();
    RUN_TEST(test_valid_values_no_clamp);
    RUN_TEST(test_out_of_range_clamp);
    RUN_TEST(test_nan_inf_defaults);
    RUN_TEST(test_palette_bounds);
    RUN_TEST(test_update_params_safe_applies_values);
    UNITY_END();

    TestResults::instance().print_summary();
}

void loop() {
    delay(1000);
}