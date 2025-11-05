#include "cpu_monitor.h"
#include "logging/logger.h"
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

// Global CPU monitor instance
CPUMonitor cpu_monitor;

CPUMonitor::CPUMonitor() : last_update_ms(0), initialized(false) {
    // Initialize core stats
    for (int i = 0; i < 2; i++) {
        core_stats[i].last_idle_time = 0;
        core_stats[i].last_total_time = 0;
        core_stats[i].cpu_percent = 0.0f;
    }
}

void CPUMonitor::init() {
    // Check if runtime stats are enabled
    #if configGENERATE_RUN_TIME_STATS == 1
        LOG_INFO(TAG_MEMORY, "CPU Monitor: Runtime stats enabled");
        initialized = true;
        last_update_ms = millis();
        
        // Initial update to set baseline
        update();
    #else
        LOG_WARN(TAG_MEMORY, "CPU Monitor: Runtime stats not enabled, using fallback method");
        // Use a simpler estimation method based on available heap
        initialized = true;
        last_update_ms = millis();
    #endif
}

void CPUMonitor::update() {
    if (!initialized) return;
    
    uint32_t current_ms = millis();
    
    // Update every 1000ms minimum to get meaningful statistics
    if (current_ms - last_update_ms < 1000) {
        return;
    }
    
    #if configGENERATE_RUN_TIME_STATS == 1
        updateCoreStats();
    #else
        // Fallback method: estimate CPU usage based on system responsiveness
        // This is a rough approximation
        uint32_t free_heap = ESP.getFreeHeap();
        uint32_t total_heap = ESP.getHeapSize();
        float heap_usage = 1.0f - ((float)free_heap / (float)total_heap);
        
        // Rough estimation: assume CPU usage correlates with heap usage
        // This is not accurate but provides some indication
        float estimated_cpu = heap_usage * 50.0f; // Scale to reasonable range
        if (estimated_cpu > 100.0f) estimated_cpu = 100.0f;
        
        core_stats[0].cpu_percent = estimated_cpu;
        core_stats[1].cpu_percent = estimated_cpu * 0.8f; // Assume core 1 is less loaded
    #endif
    
    last_update_ms = current_ms;
}

void CPUMonitor::updateCoreStats() {
    #if configGENERATE_RUN_TIME_STATS == 1
        // Get task statistics
        char* stats_buffer = (char*)malloc(2048);
        if (stats_buffer == nullptr) {
            LOG_ERROR(TAG_MEMORY, "Failed to allocate stats buffer");
            return;
        }
        
        vTaskGetRunTimeStats(stats_buffer);
        
        if (parseTaskStats(stats_buffer)) {
            // Successfully parsed stats
        } else {
            LOG_ERROR(TAG_MEMORY, "Failed to parse task stats");
        }
        
        free(stats_buffer);
    #endif
}

bool CPUMonitor::parseTaskStats(const char* stats_buffer) {
    #if configGENERATE_RUN_TIME_STATS == 1
        // Parse the task statistics to find IDLE tasks
        // Format: TaskName    Runtime    Percentage
        
        uint32_t idle_time[2] = {0, 0};
        uint32_t total_time = 0;
        
        const char* line = stats_buffer;
        while (line && *line) {
            // Find end of line
            const char* line_end = strchr(line, '\n');
            if (!line_end) line_end = line + strlen(line);
            
            // Extract task name and runtime
            char task_name[32];
            uint32_t runtime = 0;
            
            if (sscanf(line, "%31s %u", task_name, &runtime) == 2) {
                total_time += runtime;
                
                // Check if this is an IDLE task
                if (strstr(task_name, "IDLE") != nullptr) {
                    // Determine which core (IDLE0 or IDLE1)
                    if (strstr(task_name, "IDLE0") != nullptr) {
                        idle_time[0] = runtime;
                    } else if (strstr(task_name, "IDLE1") != nullptr) {
                        idle_time[1] = runtime;
                    }
                }
            }
            
            // Move to next line
            if (*line_end == '\n') line_end++;
            line = line_end;
        }
        
        // Calculate CPU usage for each core
        for (int core = 0; core < 2; core++) {
            uint32_t idle_delta = idle_time[core] - core_stats[core].last_idle_time;
            uint32_t total_delta = total_time - core_stats[core].last_total_time;
            
            if (total_delta > 0) {
                float idle_percent = (float)idle_delta / (float)total_delta * 100.0f;
                core_stats[core].cpu_percent = 100.0f - idle_percent;
                
                // Clamp to reasonable range
                if (core_stats[core].cpu_percent < 0.0f) core_stats[core].cpu_percent = 0.0f;
                if (core_stats[core].cpu_percent > 100.0f) core_stats[core].cpu_percent = 100.0f;
            }
            
            core_stats[core].last_idle_time = idle_time[core];
            core_stats[core].last_total_time = total_time;
        }
        
        return true;
    #else
        return false;
    #endif
}

float CPUMonitor::getCPUUsage(uint8_t core) {
    if (!initialized || core >= 2) return 0.0f;
    return core_stats[core].cpu_percent;
}

float CPUMonitor::getAverageCPUUsage() {
    if (!initialized) return 0.0f;
    return (core_stats[0].cpu_percent + core_stats[1].cpu_percent) / 2.0f;
}