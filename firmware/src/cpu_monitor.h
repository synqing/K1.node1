#pragma once

#include <Arduino.h>

// CPU usage monitoring using FreeRTOS idle task statistics
// Calculates CPU load per core by tracking idle task runtime

class CPUMonitor {
private:
    struct CoreStats {
        uint32_t last_idle_time;
        uint32_t last_total_time;
        float cpu_percent;
    };
    
    CoreStats core_stats[2];  // ESP32 has 2 cores
    uint32_t last_update_ms;
    bool initialized;
    
    void updateCoreStats();
    bool parseTaskStats(const char* stats_buffer);
    
public:
    CPUMonitor();
    
    // Initialize CPU monitoring (call once in setup)
    void init();
    
    // Update CPU statistics (call periodically)
    void update();
    
    // Get CPU usage for specific core (0 or 1)
    float getCPUUsage(uint8_t core);
    
    // Get average CPU usage across both cores
    float getAverageCPUUsage();
    
    // Check if monitoring is ready
    bool isReady() const { return initialized; }
};

// Global CPU monitor instance
extern CPUMonitor cpu_monitor;