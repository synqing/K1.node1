// -----------------------------------------------------------------
//                      __ _ _
//    _ __  _ __ ___  / _(_) (_)_ __   __ _   _ __
//   | '_ \| '__/ _ \| |_| | | | '_ \ / _` | | '_ \
//   | |_) | | | (_) |  _| | | | | | | (_| |_| | | |
//   | .__/|_|  \___/|_| |_|_|_|_| |_|\__, (_)_| |_|
//   |_|                              |___/
//
// Lightweight Profiling Infrastructure for ESP32-S3
// Zero-cost when DEBUG_TELEMETRY is disabled (macro expands to no-op)

#ifndef PROFILING_H
#define PROFILING_H

#include <esp_timer.h>
#include <atomic>
#include <stdint.h>

// Configuration: Enable profiling only in debug builds
#ifdef DEBUG_TELEMETRY
    #define PROFILE_ENABLED 1
#else
    #define PROFILE_ENABLED 0
#endif

// ============================================================================
// MACRO API: Zero-cost when profiling is disabled
// ============================================================================

#if PROFILE_ENABLED
    #define PROFILE_SECTION(name) ProfileScope __prof_##__LINE__(name)
    #define PROFILE_FUNCTION()    ProfileScope __prof_##__LINE__(__func__)
#else
    #define PROFILE_SECTION(name) do {} while(0)
    #define PROFILE_FUNCTION()    do {} while(0)
#endif

// ============================================================================
// PROFILING STATISTICS (lock-free atomic updates)
// ============================================================================

struct ProfileStats {
    std::atomic<uint64_t> total_us{0};    // Cumulative time (microseconds)
    std::atomic<uint32_t> count{0};       // Number of calls
    std::atomic<uint32_t> max_us{0};      // Peak execution time (μs)
    const char* name;                     // Function/section name
};

// ============================================================================
// PROFILE SCOPE: RAII-style timer
// ============================================================================

#if PROFILE_ENABLED

class ProfileScope {
public:
    // Maximum number of tracked sections (fixed pool to avoid heap allocation)
    static constexpr uint8_t MAX_SECTIONS = 32;

    ProfileScope(const char* name);
    ~ProfileScope();

    // Get statistics by name (returns nullptr if not found)
    static ProfileStats* get_stats(const char* name);

    // Get average execution time (microseconds)
    static uint32_t get_avg_us(const char* name);

    // Get peak execution time (microseconds)
    static uint32_t get_max_us(const char* name);

    // Print all statistics to Serial (debug builds)
    static void print_all_stats();

    // Reset all counters (useful for benchmarking)
    static void reset_all();

private:
    const char* name_;
    uint64_t start_us_;
    uint8_t section_id_;

    // Static storage for all profile sections (lock-free allocation)
    static ProfileStats stats_pool_[MAX_SECTIONS];
    static std::atomic<uint8_t> next_section_id_;

    // Helper: Find or allocate section ID
    static uint8_t get_or_create_section_id(const char* name);
};

#endif  // PROFILE_ENABLED

// ============================================================================
// INLINE IMPLEMENTATIONS (header-only for zero-cost inlining)
// ============================================================================

#if PROFILE_ENABLED

// Static member initialization
inline ProfileStats ProfileScope::stats_pool_[MAX_SECTIONS];
inline std::atomic<uint8_t> ProfileScope::next_section_id_{0};

inline ProfileScope::ProfileScope(const char* name)
    : name_(name), start_us_(esp_timer_get_time()) {
    section_id_ = get_or_create_section_id(name);
}

inline ProfileScope::~ProfileScope() {
    if (section_id_ >= MAX_SECTIONS) {
        return;  // Overflow protection (shouldn't happen)
    }

    uint32_t elapsed = (uint32_t)(esp_timer_get_time() - start_us_);

    // Update statistics (lock-free atomic operations)
    stats_pool_[section_id_].total_us.fetch_add(elapsed, std::memory_order_relaxed);
    stats_pool_[section_id_].count.fetch_add(1, std::memory_order_relaxed);

    // Update max (compare-and-swap loop)
    uint32_t old_max = stats_pool_[section_id_].max_us.load(std::memory_order_relaxed);
    while (elapsed > old_max) {
        if (stats_pool_[section_id_].max_us.compare_exchange_weak(old_max, elapsed,
                                                                   std::memory_order_relaxed)) {
            break;  // Successfully updated max
        }
        // Retry if another thread updated max concurrently
    }
}

inline uint8_t ProfileScope::get_or_create_section_id(const char* name) {
    // First pass: check if section already exists (read-only, no lock)
    uint8_t num_sections = next_section_id_.load(std::memory_order_acquire);
    for (uint8_t i = 0; i < num_sections; i++) {
        if (stats_pool_[i].name == name) {  // Pointer comparison (same string literal)
            return i;
        }
    }

    // Second pass: allocate new section (lock-free)
    uint8_t new_id = next_section_id_.fetch_add(1, std::memory_order_acq_rel);
    if (new_id >= MAX_SECTIONS) {
        // Overflow: return MAX_SECTIONS to signal error (destructor will ignore)
        return MAX_SECTIONS;
    }

    stats_pool_[new_id].name = name;
    stats_pool_[new_id].total_us.store(0, std::memory_order_relaxed);
    stats_pool_[new_id].count.store(0, std::memory_order_relaxed);
    stats_pool_[new_id].max_us.store(0, std::memory_order_relaxed);

    return new_id;
}

inline ProfileStats* ProfileScope::get_stats(const char* name) {
    uint8_t num_sections = next_section_id_.load(std::memory_order_acquire);
    for (uint8_t i = 0; i < num_sections; i++) {
        if (stats_pool_[i].name == name) {
            return &stats_pool_[i];
        }
    }
    return nullptr;
}

inline uint32_t ProfileScope::get_avg_us(const char* name) {
    ProfileStats* stats = get_stats(name);
    if (!stats) return 0;

    uint32_t count = stats->count.load(std::memory_order_relaxed);
    if (count == 0) return 0;

    uint64_t total = stats->total_us.load(std::memory_order_relaxed);
    return (uint32_t)(total / count);
}

inline uint32_t ProfileScope::get_max_us(const char* name) {
    ProfileStats* stats = get_stats(name);
    if (!stats) return 0;
    return stats->max_us.load(std::memory_order_relaxed);
}

inline void ProfileScope::print_all_stats() {
    uint8_t num_sections = next_section_id_.load(std::memory_order_acquire);

    Serial.println("\n=== PROFILING STATISTICS ===");
    Serial.printf("%-30s  %8s  %8s  %8s  %8s\n",
                  "Section", "Calls", "Avg (μs)", "Max (μs)", "Total (ms)");
    Serial.println("----------------------------------------------------------------------");

    for (uint8_t i = 0; i < num_sections; i++) {
        uint32_t count = stats_pool_[i].count.load(std::memory_order_relaxed);
        uint64_t total = stats_pool_[i].total_us.load(std::memory_order_relaxed);
        uint32_t max = stats_pool_[i].max_us.load(std::memory_order_relaxed);

        if (count > 0) {
            uint32_t avg = (uint32_t)(total / count);
            uint32_t total_ms = (uint32_t)(total / 1000);

            Serial.printf("%-30s  %8u  %8u  %8u  %8u\n",
                          stats_pool_[i].name, count, avg, max, total_ms);
        }
    }
    Serial.println("======================================================================\n");
}

inline void ProfileScope::reset_all() {
    uint8_t num_sections = next_section_id_.load(std::memory_order_acquire);
    for (uint8_t i = 0; i < num_sections; i++) {
        stats_pool_[i].total_us.store(0, std::memory_order_relaxed);
        stats_pool_[i].count.store(0, std::memory_order_relaxed);
        stats_pool_[i].max_us.store(0, std::memory_order_relaxed);
    }
}

#endif  // PROFILE_ENABLED

// ============================================================================
// USAGE EXAMPLES
// ============================================================================
//
// 1. Profile entire function:
//    void my_function() {
//        PROFILE_FUNCTION();
//        // ... code ...
//    }
//
// 2. Profile code section:
//    void my_function() {
//        {
//            PROFILE_SECTION("initialization");
//            // ... initialization code ...
//        }
//        {
//            PROFILE_SECTION("processing");
//            // ... processing code ...
//        }
//    }
//
// 3. Query statistics:
//    uint32_t avg = ProfileScope::get_avg_us("my_function");
//    uint32_t max = ProfileScope::get_max_us("processing");
//
// 4. Print all stats:
//    ProfileScope::print_all_stats();
//
// 5. Reset counters (for benchmarking):
//    ProfileScope::reset_all();

#endif  // PROFILING_H
