#pragma once

#include <Arduino.h>
#include <WiFi.h>
#include <vector>
#include <map>
#include <functional>
#include <memory>

/**
 * Network Security Module
 * Provides enterprise-grade security monitoring, threat detection, and access control
 */

// Forward declarations
class IntrusionDetectionSystem;
class AccessControlManager;
class CertificateManager;

/**
 * Security Configuration Structure
 */
struct SecurityConfig {
    // Authentication settings
    wifi_auth_mode_t auth_mode = WIFI_AUTH_WPA3_PSK;
    bool enable_wpa3 = true;
    bool enable_sae = true;              // Simultaneous Authentication of Equals
    bool enable_owe = true;              // Opportunistic Wireless Encryption
    
    // Enterprise authentication
    bool enable_802_1x = false;
    String radius_server_ip = "";
    uint16_t radius_auth_port = 1812;
    uint16_t radius_acct_port = 1813;
    String radius_shared_secret = "";
    uint32_t radius_timeout_ms = 5000;
    uint8_t radius_max_retries = 3;
    
    // Advanced security features
    bool enable_pmf = true;              // Protected Management Frames
    bool enable_beacon_protection = true;
    bool enable_group_rekey = true;
    uint16_t group_rekey_interval_sec = 3600;
    
    // Access control
    bool enable_mac_filtering = false;
    bool mac_filter_whitelist_mode = true;  // true = whitelist, false = blacklist
    std::vector<String> mac_filter_list;
    
    // Intrusion detection
    bool enable_ids = true;
    uint8_t ids_sensitivity = 5;        // 1-10 scale
    uint32_t ids_scan_interval_ms = 10000;
    
    // Rate limiting
    bool enable_rate_limiting = true;
    uint16_t max_auth_attempts_per_minute = 10;
    uint16_t max_probe_requests_per_minute = 100;
    uint32_t client_blacklist_duration_ms = 300000;  // 5 minutes
    
    // Monitoring settings
    bool enable_traffic_analysis = true;
    bool enable_anomaly_detection = true;
    uint32_t baseline_learning_period_ms = 604800000;  // 7 days
    
    // Logging and alerting
    bool enable_security_logging = true;
    uint8_t log_level = 3;               // 1=Critical, 2=Warning, 3=Info, 4=Debug
    bool enable_remote_logging = false;
    String syslog_server_ip = "";
    uint16_t syslog_port = 514;
};

/**
 * Security Event Types
 */
enum class SecurityEventType : uint8_t {
    // Authentication events
    AUTH_SUCCESS = 1,
    AUTH_FAILURE = 2,
    AUTH_TIMEOUT = 3,
    INVALID_CREDENTIALS = 4,
    
    // Attack detection
    DEAUTH_ATTACK = 10,
    DISASSOC_ATTACK = 11,
    EVIL_TWIN_DETECTED = 12,
    ROGUE_AP_DETECTED = 13,
    BEACON_FLOOD = 14,
    PROBE_FLOOD = 15,
    
    // Traffic anomalies
    SUSPICIOUS_TRAFFIC = 20,
    BANDWIDTH_ABUSE = 21,
    PORT_SCAN_DETECTED = 22,
    DDoS_ATTEMPT = 23,
    MALFORMED_PACKETS = 24,
    
    // Access control
    MAC_FILTER_VIOLATION = 30,
    UNAUTHORIZED_ACCESS = 31,
    RATE_LIMIT_EXCEEDED = 32,
    BLACKLISTED_CLIENT = 33,
    
    // System events
    SECURITY_CONFIG_CHANGED = 40,
    CERTIFICATE_EXPIRED = 41,
    RADIUS_SERVER_UNREACHABLE = 42,
    SYSTEM_COMPROMISE_SUSPECTED = 43
};

/**
 * Security Event Structure
 */
struct SecurityEvent {
    SecurityEventType type;
    uint32_t timestamp;
    uint8_t source_mac[6];
    uint8_t target_mac[6];
    IPAddress source_ip;
    IPAddress target_ip;
    String description;
    uint8_t severity;                    // 1=Low, 5=Medium, 10=Critical
    uint32_t event_count;                // For repeated events
    bool acknowledged;
    String response_action;
};

/**
 * Client Security Profile
 */
struct ClientSecurityProfile {
    uint8_t mac_address[6];
    IPAddress ip_address;
    String hostname;
    
    // Authentication history
    uint32_t first_seen_timestamp;
    uint32_t last_seen_timestamp;
    uint16_t auth_success_count;
    uint16_t auth_failure_count;
    uint32_t last_auth_timestamp;
    
    // Behavioral analysis
    uint32_t average_session_duration_ms;
    uint32_t total_bytes_transmitted;
    uint32_t total_bytes_received;
    float average_throughput_kbps;
    
    // Risk assessment
    uint8_t risk_score;                  // 1-10 scale
    bool is_trusted;
    bool is_blacklisted;
    uint32_t blacklist_expiry_timestamp;
    
    // Traffic patterns
    std::map<uint16_t, uint32_t> port_usage;  // port -> packet count
    std::vector<IPAddress> contacted_ips;
    uint16_t dns_queries_per_hour;
    uint16_t http_requests_per_hour;
};

/**
 * Threat Intelligence Data
 */
struct ThreatIntelligence {
    struct MaliciousMAC {
        uint8_t mac[6];
        String description;
        uint8_t threat_level;
        uint32_t last_updated;
    };
    
    struct MaliciousIP {
        IPAddress ip;
        String description;
        uint8_t threat_level;
        uint32_t last_updated;
    };
    
    std::vector<MaliciousMAC> malicious_macs;
    std::vector<MaliciousIP> malicious_ips;
    uint32_t last_update_timestamp;
};

/**
 * Network Security Module Class
 */
class NetworkSecurityModule {
public:
    // Callback function types
    using SecurityEventCallback = std::function<void(const SecurityEvent&)>;
    using ThreatDetectedCallback = std::function<void(const String& threat_type, const String& details)>;
    using AccessDeniedCallback = std::function<void(const uint8_t* mac, const String& reason)>;
    
    // Constructor/Destructor
    NetworkSecurityModule();
    ~NetworkSecurityModule();
    
    // Initialization and configuration
    bool initialize(const SecurityConfig& config);
    void updateConfig(const SecurityConfig& config);
    SecurityConfig getConfig() const;
    
    // Main processing loop
    void loop();
    
    // Authentication and access control
    bool authenticateClient(const uint8_t* mac, const String& credentials);
    bool authorizeClient(const uint8_t* mac, const IPAddress& ip);
    void revokeClientAccess(const uint8_t* mac, const String& reason);
    
    // MAC filtering
    void addToMACFilter(const String& mac, bool is_whitelist = true);
    void removeFromMACFilter(const String& mac);
    bool isMACAllowed(const uint8_t* mac);
    std::vector<String> getMACFilterList() const;
    
    // Client management
    void registerClient(const uint8_t* mac, const IPAddress& ip);
    void updateClientActivity(const uint8_t* mac, uint32_t bytes_tx, uint32_t bytes_rx);
    ClientSecurityProfile getClientProfile(const uint8_t* mac) const;
    std::vector<ClientSecurityProfile> getAllClientProfiles() const;
    
    // Threat detection
    void analyzePacket(const uint8_t* packet, size_t length);
    void detectAnomalies();
    void checkForKnownThreats();
    bool isIPMalicious(const IPAddress& ip) const;
    bool isMACMalicious(const uint8_t* mac) const;
    
    // Intrusion detection
    void enableIntrusionDetection(bool enable = true);
    void setIDSSensitivity(uint8_t sensitivity);  // 1-10 scale
    void scanForRogueAPs();
    void detectDeauthAttacks();
    void monitorProbeRequests();
    
    // Rate limiting
    bool checkRateLimit(const uint8_t* mac, const String& action);
    void resetRateLimits();
    void blacklistClient(const uint8_t* mac, uint32_t duration_ms, const String& reason);
    void removeFromBlacklist(const uint8_t* mac);
    
    // Event management
    void logSecurityEvent(const SecurityEvent& event);
    std::vector<SecurityEvent> getSecurityEvents(uint32_t since_timestamp = 0) const;
    void acknowledgeEvent(uint32_t event_id);
    void clearEvents();
    uint32_t getEventCount(SecurityEventType type, uint32_t time_window_ms = 3600000) const;
    
    // Threat intelligence
    void updateThreatIntelligence(const ThreatIntelligence& intel);
    ThreatIntelligence getThreatIntelligence() const;
    void downloadThreatIntelligence(const String& url);
    
    // Certificate management (for enterprise auth)
    bool loadCertificate(const uint8_t* cert_data, size_t cert_length);
    bool validateCertificate(const uint8_t* cert_data, size_t cert_length);
    void setCertificateExpiryWarning(uint32_t days_before_expiry);
    
    // RADIUS authentication
    bool configureRADIUS(const String& server_ip, uint16_t port, const String& secret);
    bool authenticateWithRADIUS(const String& username, const String& password);
    void startRADIUSAccounting(const String& session_id, const uint8_t* mac);
    void stopRADIUSAccounting(const String& session_id);
    
    // Monitoring and reporting
    String generateSecurityReport() const;
    void exportSecurityLog(String& output) const;
    void resetSecurityStatistics();
    
    // Callback registration
    void onSecurityEvent(SecurityEventCallback callback);
    void onThreatDetected(ThreatDetectedCallback callback);
    void onAccessDenied(AccessDeniedCallback callback);
    
    // Configuration persistence
    bool saveConfigToNVS();
    bool loadConfigFromNVS();
    
    // Emergency functions
    void enableLockdownMode(bool enable = true);
    void disconnectAllClients();
    void enableEmergencyAccess(const String& emergency_key);
    
private:
    // Internal state
    SecurityConfig config_;
    std::vector<SecurityEvent> security_events_;
    std::map<String, ClientSecurityProfile> client_profiles_;  // MAC -> Profile
    ThreatIntelligence threat_intel_;
    
    // Rate limiting tracking
    struct RateLimitEntry {
        uint32_t count;
        uint32_t window_start_ms;
    };
    std::map<String, std::map<String, RateLimitEntry>> rate_limits_;  // MAC -> Action -> Entry
    
    // Blacklist management
    struct BlacklistEntry {
        uint32_t expiry_timestamp;
        String reason;
    };
    std::map<String, BlacklistEntry> blacklisted_clients_;  // MAC -> Entry
    
    // Callback storage
    SecurityEventCallback security_event_callback_;
    ThreatDetectedCallback threat_detected_callback_;
    AccessDeniedCallback access_denied_callback_;
    
    // Timing variables
    uint32_t last_ids_scan_ms_;
    uint32_t last_anomaly_check_ms_;
    uint32_t last_threat_intel_update_ms_;
    uint32_t last_rate_limit_cleanup_ms_;
    
    // Internal modules
    std::unique_ptr<IntrusionDetectionSystem> ids_;
    std::unique_ptr<AccessControlManager> acm_;
    std::unique_ptr<CertificateManager> cert_manager_;
    
    // Internal methods
    void processSecurityEvent(const SecurityEvent& event);
    void updateClientRiskScore(const String& mac);
    void performAnomalyDetection(const ClientSecurityProfile& profile);
    void checkCertificateExpiry();
    void cleanupExpiredEntries();
    
    // Packet analysis
    struct PacketInfo {
        uint8_t src_mac[6];
        uint8_t dst_mac[6];
        IPAddress src_ip;
        IPAddress dst_ip;
        uint16_t src_port;
        uint16_t dst_port;
        uint8_t protocol;
        size_t payload_length;
        bool is_encrypted;
    };
    
    PacketInfo parsePacket(const uint8_t* packet, size_t length);
    bool isPacketSuspicious(const PacketInfo& info);
    void analyzeTrafficPattern(const String& mac, const PacketInfo& info);
    
    // Attack detection algorithms
    bool detectDeauthFlood(const uint8_t* packet, size_t length);
    bool detectBeaconFlood();
    bool detectEvilTwin(const String& ssid, const uint8_t* bssid);
    bool detectPortScan(const IPAddress& source_ip);
    bool detectDDoS(const IPAddress& target_ip);
    
    // Utility functions
    String macToString(const uint8_t* mac) const;
    bool stringToMAC(const String& mac_str, uint8_t* mac) const;
    uint8_t calculateRiskScore(const ClientSecurityProfile& profile) const;
    bool isInTimeWindow(uint32_t timestamp, uint32_t window_ms) const;
    
    // NVS key constants
    static constexpr const char* NVS_NAMESPACE = "net_security";
    static constexpr const char* NVS_CONFIG_KEY = "config";
    static constexpr const char* NVS_EVENTS_KEY = "events";
    static constexpr const char* NVS_PROFILES_KEY = "profiles";
    static constexpr const char* NVS_THREAT_INTEL_KEY = "threat_intel";
};

/**
 * Global instance accessor
 */
NetworkSecurityModule& getNetworkSecurityModule();

/**
 * Security utility functions
 */
namespace SecurityUtils {
    // Encryption utilities
    String hashPassword(const String& password, const String& salt);
    bool verifyPassword(const String& password, const String& hash, const String& salt);
    String generateRandomKey(size_t length);
    
    // Certificate utilities
    bool parseCertificate(const uint8_t* cert_data, size_t length, String& subject, uint32_t& expiry);
    bool verifyCertificateChain(const uint8_t* cert_data, size_t length);
    
    // Network utilities
    bool isPrivateIP(const IPAddress& ip);
    bool isMulticastMAC(const uint8_t* mac);
    bool isBroadcastMAC(const uint8_t* mac);
    
    // Threat analysis
    uint8_t calculateThreatScore(const std::vector<SecurityEvent>& events, uint32_t time_window_ms);
    bool isKnownAttackPattern(const std::vector<SecurityEvent>& events);
    
    // Logging utilities
    String formatSecurityEvent(const SecurityEvent& event);
    void sendToSyslog(const String& message, const String& server_ip, uint16_t port);
}