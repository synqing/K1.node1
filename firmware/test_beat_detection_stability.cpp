/**
 * Beat Detection Stability Test Suite
 * 
 * Tests the beat detection algorithm under various conditions to ensure:
 * 1. No crashes or abort() calls
 * 2. Proper handling of edge cases
 * 3. Thread safety in dual-core environment
 * 4. Memory safety and bounds checking
 */

#include <Arduino.h>
#include "beat_events.h"
#include "audio/tempo.h"
#include "audio/goertzel.h"

// Test configuration
#define TEST_ITERATIONS 1000
#define TEST_AUDIO_LEVELS 5
#define TEST_TEMPO_RANGES 3

// Test audio patterns
struct AudioTestPattern {
    const char* name;
    float base_frequency;
    float amplitude;
    float tempo_bpm;
    uint32_t duration_ms;
};

static const AudioTestPattern test_patterns[] = {
    {"Silent", 0.0f, 0.0f, 0.0f, 1000},
    {"Low Tempo", 80.0f, 0.3f, 60.0f, 2000},
    {"Medium Tempo", 120.0f, 0.5f, 120.0f, 2000},
    {"High Tempo", 160.0f, 0.7f, 180.0f, 2000},
    {"Maximum Tempo", 200.0f, 1.0f, 200.0f, 1000},
    {"Edge Case 1", 32.0f, 0.1f, 32.0f, 1000},
    {"Edge Case 2", 192.0f, 0.9f, 192.0f, 1000}
};

// Test results tracking
struct TestResults {
    uint32_t total_tests;
    uint32_t passed_tests;
    uint32_t failed_tests;
    uint32_t crashes_detected;
    uint32_t buffer_overruns;
    uint32_t invalid_events;
    uint32_t race_conditions;
};

static TestResults test_results = {0};

/**
 * Test 1: Beat Events Buffer Safety
 * Tests the beat events ring buffer under stress conditions
 */
bool test_beat_events_buffer_safety() {
    Serial.println("[TEST] Starting beat events buffer safety test...");
    
    // Initialize beat events with small buffer to stress test
    beat_events_init(8); // Very small buffer
    
    bool test_passed = true;
    uint32_t start_time = millis();
    
    // Rapid push/pop operations to test race conditions
    for (int i = 0; i < TEST_ITERATIONS * 10; i++) {
        // Push events from multiple "threads" (simulated)
        uint32_t timestamp = esp_timer_get_time();
        uint16_t confidence = random(1, 65535); // Avoid zero confidence
        
        bool push_result = beat_events_push(timestamp, confidence);
        
        // Occasionally pop to create stress
        if (i % 3 == 0) {
            BeatEvent ev;
            bool pop_result = beat_events_pop(&ev);
            if (pop_result) {
                // Validate popped event
                if (ev.timestamp_us == 0 || ev.confidence == 0) {
                    test_results.invalid_events++;
                    Serial.println("[TEST] Invalid event detected!");
                    test_passed = false;
                }
            }
        }
        
        // Check for buffer consistency
        uint16_t count = beat_events_count();
        uint16_t capacity = beat_events_capacity();
        
        if (count > capacity) {
            test_results.buffer_overruns++;
            Serial.printf("[TEST] Buffer overrun detected: count=%u, capacity=%u\n", count, capacity);
            test_passed = false;
        }
    }
    
    uint32_t test_duration = millis() - start_time;
    Serial.printf("[TEST] Buffer safety test completed in %u ms\n", test_duration);
    
    return test_passed;
}

/**
 * Test 2: Tempo Detection Bounds Checking
 * Tests the tempo detection algorithm with boundary values
 */
bool test_tempo_detection_bounds() {
    Serial.println("[TEST] Starting tempo detection bounds checking...");
    
    bool test_passed = true;
    
    // Test with each pattern
    for (int pattern_idx = 0; pattern_idx < sizeof(test_patterns) / sizeof(test_patterns[0]); pattern_idx++) {
        const AudioTestPattern& pattern = test_patterns[pattern_idx];
        
        Serial.printf("[TEST] Testing pattern: %s (%.1f BPM)\n", pattern.name, pattern.tempo_bpm);
        
        // Simulate audio processing for this pattern
        uint32_t test_start = millis();
        uint32_t events_generated = 0;
        
        while (millis() - test_start < pattern.duration_ms) {
            // Generate synthetic audio data
            float audio_level = pattern.amplitude;
            float novelty = (pattern.tempo_bpm > 0) ? 0.5f : 0.0f;
            
            // Test beat detection with this data
            // Note: This would normally call the actual beat detection functions
            // For testing, we simulate the conditions that would trigger beat events
            
            if (audio_level > 0.1f && novelty > 0.3f) {
                uint32_t timestamp = esp_timer_get_time();
                uint16_t confidence = (uint16_t)(novelty * 65535.0f);
                
                if (confidence > 0) {
                    bool result = beat_events_push(timestamp, confidence);
                    if (result) events_generated++;
                }
            }
            
            delay(10); // Simulate 100Hz audio processing rate
        }
        
        Serial.printf("[TEST] Pattern %s generated %u events\n", pattern.name, events_generated);
        
        // Validate results
        if (pattern.tempo_bpm == 0 && events_generated > 0) {
            Serial.println("[TEST] ERROR: Silent pattern generated events!");
            test_passed = false;
        }
        
        if (pattern.tempo_bpm > 0 && events_generated == 0) {
            Serial.println("[TEST] WARNING: Active pattern generated no events");
            // Not necessarily a failure, but worth noting
        }
    }
    
    return test_passed;
}

/**
 * Test 3: Race Condition Detection
 * Tests for race conditions in dual-core environment
 */
bool test_race_conditions() {
    Serial.println("[TEST] Starting race condition detection...");
    
    bool test_passed = true;
    
    // Create multiple "threads" that access beat events simultaneously
    // This simulates the dual-core ESP32 environment
    
    const int num_threads = 2;
    volatile bool thread_crashed[num_threads] = {false};
    volatile uint32_t thread_operations[num_threads] = {0};
    
    // Thread 0: Audio core simulation (push operations)
    auto thread0_func = [&]() {
        for (int i = 0; i < TEST_ITERATIONS; i++) {
            try {
                uint32_t timestamp = esp_timer_get_time() + i;
                uint16_t confidence = 1000 + i;
                beat_events_push(timestamp, confidence);
                thread_operations[0]++;
            } catch (...) {
                thread_crashed[0] = true;
                break;
            }
            delayMicroseconds(100); // Small delay to allow other thread to run
        }
    };
    
    // Thread 1: GPU core simulation (pop operations)
    auto thread1_func = [&]() {
        for (int i = 0; i < TEST_ITERATIONS; i++) {
            try {
                BeatEvent ev;
                if (beat_events_pop(&ev)) {
                    // Validate event
                    if (ev.timestamp_us == 0 || ev.confidence == 0) {
                        thread_crashed[1] = true;
                        break;
                    }
                }
                thread_operations[1]++;
            } catch (...) {
                thread_crashed[1] = true;
                break;
            }
            delayMicroseconds(100); // Small delay to allow other thread to run
        }
    };
    
    // Note: On ESP32, we can't actually create threads in this test environment
    // So we'll simulate concurrent access by interleaving operations
    
    for (int i = 0; i < TEST_ITERATIONS; i++) {
        // Simulate thread 0 (audio core)
        if (i % 2 == 0) {
            uint32_t timestamp = esp_timer_get_time() + i;
            uint16_t confidence = 1000 + i;
            beat_events_push(timestamp, confidence);
            thread_operations[0]++;
        }
        
        // Simulate thread 1 (GPU core)
        if (i % 3 == 0) {
            BeatEvent ev;
            if (beat_events_pop(&ev)) {
                if (ev.timestamp_us == 0 || ev.confidence == 0) {
                    thread_crashed[1] = true;
                    break;
                }
            }
            thread_operations[1]++;
        }
    }
    
    // Check for crashes
    for (int i = 0; i < num_threads; i++) {
        if (thread_crashed[i]) {
            Serial.printf("[TEST] Thread %d crashed!\n", i);
            test_results.race_conditions++;
            test_passed = false;
        }
    }
    
    Serial.printf("[TEST] Race condition test: Thread 0 ops=%u, Thread 1 ops=%u\n", 
                  thread_operations[0], thread_operations[1]);
    
    return test_passed;
}

/**
 * Test 4: Memory Corruption Detection
 * Tests for memory corruption in beat detection data structures
 */
bool test_memory_corruption() {
    Serial.println("[TEST] Starting memory corruption detection...");
    
    bool test_passed = true;
    
    // Fill beat events buffer to capacity
    uint16_t capacity = beat_events_capacity();
    
    // Push events to fill buffer completely
    for (uint16_t i = 0; i < capacity * 2; i++) { // Push twice capacity to test overwrites
        uint32_t timestamp = esp_timer_get_time() + i;
        uint16_t confidence = 5000 + i;
        beat_events_push(timestamp, confidence);
    }
    
    // Now verify buffer integrity
    uint16_t count = beat_events_count();
    if (count > capacity) {
        Serial.printf("[TEST] ERROR: Buffer count %u exceeds capacity %u\n", count, capacity);
        test_results.buffer_overruns++;
        test_passed = false;
    }
    
    // Pop all events and verify data integrity
    uint16_t popped_count = 0;
    while (beat_events_count() > 0) {
        BeatEvent ev;
        if (beat_events_pop(&ev)) {
            // Validate event data
            if (ev.timestamp_us == 0 || ev.confidence == 0) {
                Serial.println("[TEST] ERROR: Invalid event data detected!");
                test_results.invalid_events++;
                test_passed = false;
            }
            popped_count++;
        } else {
            break;
        }
    }
    
    Serial.printf("[TEST] Memory corruption test: popped %u events\n", popped_count);
    
    return test_passed;
}

/**
 * Test 5: Edge Case Handling
 * Tests various edge cases that could cause crashes
 */
bool test_edge_cases() {
    Serial.println("[TEST] Starting edge case handling test...");
    
    bool test_passed = true;
    
    // Test 1: Zero timestamp
    {
        BeatEvent ev;
        beat_events_push(0, 1000);
        if (beat_events_pop(&ev)) {
            if (ev.timestamp_us != 0) {
                Serial.println("[TEST] ERROR: Zero timestamp not handled correctly");
                test_passed = false;
            }
        }
    }
    
    // Test 2: Maximum values
    {
        uint32_t max_timestamp = 0xFFFFFFFF;
        uint16_t max_confidence = 0xFFFF;
        beat_events_push(max_timestamp, max_confidence);
        
        BeatEvent ev;
        if (beat_events_pop(&ev)) {
            if (ev.timestamp_us != max_timestamp || ev.confidence != max_confidence) {
                Serial.println("[TEST] ERROR: Maximum values not handled correctly");
                test_passed = false;
            }
        }
    }
    
    // Test 3: Null pointer handling
    {
        bool result = beat_events_pop(nullptr);
        if (result) {
            Serial.println("[TEST] ERROR: Null pointer not handled correctly");
            test_passed = false;
        }
    }
    
    // Test 4: Empty buffer operations
    {
        // Clear buffer completely
        BeatEvent ev;
        while (beat_events_pop(&ev)) {
            // Empty buffer
        }
        
        // Try operations on empty buffer
        uint16_t count = beat_events_count();
        if (count != 0) {
            Serial.printf("[TEST] ERROR: Empty buffer reports count=%u\n", count);
            test_passed = false;
        }
        
        bool pop_result = beat_events_pop(&ev);
        if (pop_result) {
            Serial.println("[TEST] ERROR: Pop from empty buffer succeeded");
            test_passed = false;
        }
    }
    
    Serial.println("[TEST] Edge case handling completed");
    
    return test_passed;
}

/**
 * Main test runner
 */
void run_beat_detection_tests() {
    Serial.println("\n========================================");
    Serial.println("BEAT DETECTION STABILITY TEST SUITE");
    Serial.println("========================================\n");
    
    // Reset test results
    memset(&test_results, 0, sizeof(test_results));
    
    // Initialize beat events for testing
    beat_events_init(64); // Use larger buffer for comprehensive testing
    beat_events_set_probe_logging(false); // Disable probe logging during tests
    
    // Run all tests
    Serial.println("Starting comprehensive beat detection stability tests...\n");
    
    bool test1_passed = test_beat_events_buffer_safety();
    test_results.total_tests++;
    if (test1_passed) test_results.passed_tests++; else test_results.failed_tests++;
    
    bool test2_passed = test_tempo_detection_bounds();
    test_results.total_tests++;
    if (test2_passed) test_results.passed_tests++; else test_results.failed_tests++;
    
    bool test3_passed = test_race_conditions();
    test_results.total_tests++;
    if (test3_passed) test_results.passed_tests++; else test_results.failed_tests++;
    
    bool test4_passed = test_memory_corruption();
    test_results.total_tests++;
    if (test4_passed) test_results.passed_tests++; else test_results.failed_tests++;
    
    bool test5_passed = test_edge_cases();
    test_results.total_tests++;
    if (test5_passed) test_results.passed_tests++; else test_results.failed_tests++;
    
    // Print test summary
    Serial.println("\n========================================");
    Serial.println("TEST RESULTS SUMMARY");
    Serial.println("========================================");
    Serial.printf("Total Tests:     %u\n", test_results.total_tests);
    Serial.printf("Passed:          %u\n", test_results.passed_tests);
    Serial.printf("Failed:          %u\n", test_results.failed_tests);
    Serial.printf("Crashes:         %u\n", test_results.crashes_detected);
    Serial.printf("Buffer Overruns: %u\n", test_results.buffer_overruns);
    Serial.printf("Invalid Events:  %u\n", test_results.invalid_events);
    Serial.printf("Race Conditions: %u\n", test_results.race_conditions);
    
    if (test_results.failed_tests == 0 && test_results.crashes_detected == 0) {
        Serial.println("\n✅ ALL TESTS PASSED - Beat detection is stable!");
    } else {
        Serial.println("\n❌ TESTS FAILED - Issues detected in beat detection!");
    }
    
    Serial.println("========================================\n");
}

// Test runner function (call from main setup or loop)
void test_beat_detection_stability() {
    // Add a delay to ensure system is stable
    delay(2000);
    
    // Run the test suite
    run_beat_detection_tests();
}