#pragma once

#include <Arduino.h>
#include <WiFi.h>
#include <esp_wifi.h>
#include <vector>
#include <memory>
#include <functional>

// Forward declarations
class SecurityModule;
class QoSModule;
class AnalyticsModule;
class RoamingManager;

/**
 * Advanced WiFi Configuration Structure
 * Supports Wi-Fi 6E/7 features and enterprise-grade settings
 */
struct AdvancedWifiConfig {
    // Protocol support
    bool enable_wifi7 = false;          // Future: Wi-Fi 7 support
    bool enable_6ghz_band = false;      // Future: 6 GHz band support
    bool enable_mlo = false;            // Future: Multi-Link Operation
    
    // Current ESP32 compatible settings
    bool force_bg_only = true;          // 802.11b/g only mode
    bool force_ht20 = true;             // 20 MHz channel width
    
    // Channel configuration
    uint8_t primary_channel_2_4ghz = 6;
    uint8_t primary_channel_5ghz = 36;
    uint8_t primary_channel_6ghz = 5;   // Future use
    
    // Power management
    wifi_power_t tx_power = WIFI_POWER_19_5dBm;
    bool enable_power_save = false;
    
    // Security configuration
    wifi_auth_mode_t auth_mode = WIFI_AUTH_WPA2_PSK;
    bool enable_pmf = false;            // Protected Management Frames
    bool enable_enterprise_auth = false; // 802.1X authentication
    
    // QoS settings
    bool enable_wmm = true;             // Wi-Fi Multimedia
    uint8_t voice_queue_priority = 3;   // Highest priority
    uint8_t video_queue_priority = 2;
    uint8_t data_queue_priority = 1;
    uint8_t background_queue_priority = 0;
    
    // Roaming settings
    bool enable_fast_roaming = false;   // 802.11r support
    int8_t roaming_threshold_dbm = -70;
    uint16_t roaming_scan_interval_ms = 30000;
};

/**
 * Network Performance Metrics
 */
struct NetworkMetrics {
    // Throughput metrics
    uint32_t rx_throughput_kbps = 0;
    uint32_t tx_throughput_kbps = 0;
    uint32_t total_throughput_kbps = 0;
    
    // Latency metrics
    uint16_t avg_latency_ms = 0;
    uint16_t min_latency_ms = 0;
    uint16_t max_latency_ms = 0;
    uint16_t jitter_ms = 0;
    
    // Quality metrics
    float packet_loss_percent = 0.0f;
    int8_t signal_strength_dbm = 0;
    uint8_t signal_quality_percent = 0;
    uint8_t noise_floor_dbm = 0;
    
    // Connection metrics
    uint32_t connection_uptime_ms = 0;
    uint16_t reconnection_count = 0;
    uint32_t bytes_transmitted = 0;
    uint32_t bytes_received = 0;
    
    // Channel utilization
    float channel_utilization_percent = 0.0f;
    uint8_t interfering_networks = 0;
};

/**
 * Security Event Structure
 */
struct SecurityEvent {
    enum Type {
        UNAUTHORIZED_ACCESS_ATTEMPT,
        SUSPICIOUS_TRAFFIC_PATTERN,
        DEAUTH_ATTACK_DETECTED,
        WEAK_SIGNAL_ATTACK,
        ROGUE_AP_DETECTED,
        EXCESSIVE_PROBE_REQUESTS
    };
    
    Type type;
    uint32_t timestamp;
    uint8_t source_mac[6];
    String description;
    uint8_t severity;  // 1-10 scale
};

/**
 * QoS Traffic Classification
 */
enum class TrafficClass : uint8_t {
    VOICE = 0,      // Highest priority (VoIP, real-time audio)
    VIDEO = 1,      // High priority (streaming, video calls)
    DATA = 2,       // Normal priority (web browsing, file transfer)
    BACKGROUND = 3  // Lowest priority (backups, updates)
};

/**
 * QoS Policy Configuration
 */
struct QoSPolicy {
    TrafficClass traffic_class;
    uint32_t min_bandwidth_kbps;
    uint32_t max_bandwidth_kbps;
    uint16_t max_latency_ms;
    float packet_loss_threshold;
    uint8_t dscp_marking;  // Differentiated Services Code Point
};

/**
 * Advanced WiFi Manager Class
 * Provides enterprise-grade wireless management with future-proofing
 */
class AdvancedWiFiManager {
public:
    // Callback function types
    using MetricsCallback = std::function<void(const NetworkMetrics&)>;
    using SecurityCallback = std::function<void(const SecurityEvent&)>;
    using StateChangeCallback = std::function<void(wifi_event_id_t, const String&)>;
    
    // Constructor/Destructor
    AdvancedWiFiManager();
    ~AdvancedWiFiManager();
    
    // Core functionality
    bool initialize(const AdvancedWifiConfig& config);
    bool connect(const String& ssid, const String& password);
    bool disconnect();
    void loop();  // Call from main loop for periodic tasks
    
    // Configuration management
    void updateConfig(const AdvancedWifiConfig& config);
    AdvancedWifiConfig getConfig() const;
    bool saveConfigToNVS();
    bool loadConfigFromNVS();
    
    // Network monitoring
    NetworkMetrics getMetrics() const;
    void startMetricsCollection(uint32_t interval_ms = 1000);
    void stopMetricsCollection();
    
    // Security features
    void enableSecurityMonitoring(bool enable = true);
    std::vector<SecurityEvent> getSecurityEvents() const;
    void clearSecurityEvents();
    
    // QoS management
    bool setQoSPolicy(const QoSPolicy& policy);
    std::vector<QoSPolicy> getQoSPolicies() const;
    void classifyTraffic(const uint8_t* packet, size_t length, TrafficClass& out_class);
    
    // Channel management
    void scanChannels();
    uint8_t selectOptimalChannel(wifi_band_t band);
    void setChannel(uint8_t channel, wifi_band_t band);
    
    // Power management
    void setPowerSaveMode(bool enable);
    void setTxPower(wifi_power_t power);
    wifi_power_t getTxPower() const;
    
    // Roaming support (future enhancement)
    void enableFastRoaming(bool enable = true);
    void scanForRoamingCandidates();
    bool shouldInitiateRoaming();
    
    // Callback registration
    void onMetricsUpdate(MetricsCallback callback);
    void onSecurityEvent(SecurityCallback callback);
    void onStateChange(StateChangeCallback callback);
    
    // Diagnostic functions
    String getDiagnosticInfo() const;
    void exportMetricsToJSON(String& output) const;
    void resetStatistics();
    
    // Enterprise features (future enhancement)
    bool configureEnterpriseAuth(const String& identity, const String& password);
    bool configureCertificateAuth(const uint8_t* cert_data, size_t cert_length);
    
    // Advanced features
    void enableBandSteering(bool enable = true);
    void setLoadBalancingThreshold(uint8_t threshold_percent);
    void enableIntelligentChannelSelection(bool enable = true);
    
private:
    // Internal state
    AdvancedWifiConfig config_;
    NetworkMetrics current_metrics_;
    std::vector<SecurityEvent> security_events_;
    
    // Callback storage
    MetricsCallback metrics_callback_;
    SecurityCallback security_callback_;
    StateChangeCallback state_callback_;
    
    // Timing variables
    uint32_t last_metrics_update_ms_;
    uint32_t metrics_interval_ms_;
    uint32_t last_channel_scan_ms_;
    uint32_t last_security_check_ms_;
    
    // Internal modules (future enhancement)
    std::unique_ptr<SecurityModule> security_module_;
    std::unique_ptr<QoSModule> qos_module_;
    std::unique_ptr<AnalyticsModule> analytics_module_;
    std::unique_ptr<RoamingManager> roaming_manager_;
    
    // Internal methods
    void updateMetrics();
    void checkSecurity();
    void optimizePerformance();
    void handleWiFiEvent(wifi_event_id_t event, wifi_event_info_t info);
    
    // Channel analysis
    struct ChannelInfo {
        uint8_t channel;
        int8_t rssi_dbm;
        uint8_t utilization_percent;
        uint8_t interference_count;
        bool dfs_required;
    };
    
    std::vector<ChannelInfo> analyzeChannels(wifi_band_t band);
    uint8_t calculateChannelScore(const ChannelInfo& channel);
    
    // Traffic analysis
    void analyzeTrafficPatterns();
    bool detectAnomalousTraffic(const uint8_t* packet, size_t length);
    
    // Performance optimization
    void adjustTxPowerBasedOnConditions();
    void optimizeChannelWidth();
    void balanceLoadAcrossBands();
    
    // NVS key constants
    static constexpr const char* NVS_NAMESPACE = "adv_wifi";
    static constexpr const char* NVS_CONFIG_KEY = "config";
    static constexpr const char* NVS_METRICS_KEY = "metrics";
};

/**
 * Global instance accessor (singleton pattern)
 */
AdvancedWiFiManager& getAdvancedWiFiManager();

/**
 * Utility functions for network analysis
 */
namespace WiFiUtils {
    // Channel utilities
    bool isChannelValid(uint8_t channel, wifi_band_t band);
    uint16_t channelToFrequency(uint8_t channel, wifi_band_t band);
    uint8_t frequencyToChannel(uint16_t frequency_mhz);
    
    // Signal quality utilities
    uint8_t rssiToQuality(int8_t rssi_dbm);
    String qualityToString(uint8_t quality_percent);
    
    // Security utilities
    String authModeToString(wifi_auth_mode_t auth_mode);
    bool isSecurityModeSecure(wifi_auth_mode_t auth_mode);
    
    // Performance utilities
    uint32_t calculateThroughput(uint32_t bytes, uint32_t time_ms);
    float calculatePacketLoss(uint32_t sent, uint32_t received);
    
    // MAC address utilities
    String macToString(const uint8_t* mac);
    bool stringToMac(const String& mac_str, uint8_t* mac);
    
    // Network scanning utilities
    struct ScanResult {
        String ssid;
        uint8_t bssid[6];
        int8_t rssi;
        uint8_t channel;
        wifi_auth_mode_t auth_mode;
        bool hidden;
    };
    
    std::vector<ScanResult> scanNetworks(bool show_hidden = false);
    ScanResult findStrongestNetwork(const std::vector<ScanResult>& results);
}