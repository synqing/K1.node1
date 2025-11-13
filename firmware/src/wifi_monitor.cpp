#include "wifi_monitor.h"

#include <WiFi.h>
#include <WiFiUdp.h>
#include <esp_wifi.h>
#include <Preferences.h>

#include "connection_state.h"

// Forward declarations for file-scope static functions used before definition
static bool is_device_provisioned();
static void mark_device_provisioned();

namespace {

constexpr uint32_t WIFI_ASSOC_TIMEOUT_MS = 20000;
constexpr uint32_t WIFI_RECONNECT_INTERVAL_MS = 5000;
constexpr uint8_t PRIMARY_RETRIES = 3;                // Retry primary network 3 times
constexpr uint8_t SECONDARY_RETRIES = 3;              // Retry secondary network 3 times
constexpr uint8_t AP_FALLBACK_THRESHOLD = 6;          // AP fallback after 3+3 = 6 total failures
constexpr uint32_t WIFI_KEEPALIVE_INTERVAL_MS = 30000;  // Send keepalive every 30 seconds
constexpr uint32_t NETWORK_PAUSE_DEFAULT_MS = 500;      // Short pause before disconnect

// Primary network (build defaults)
char primary_ssid[64] = {0};  // Load from secure NVS or provisioning
char primary_pass[64] = {0};  // Load from secure NVS or provisioning

// Fallback network (secondary)
char fallback_ssid[64] = {0};  // Load from secure NVS or provisioning
char fallback_pass[64] = {0};  // Load from secure NVS or provisioning

// Currently active credentials
char stored_ssid[64] = {0};
char stored_pass[64] = {0};
bool using_fallback = false;
uint8_t total_connection_failures = 0;  // Track failures across both networks

wifi_connect_callback_t on_connect_cb = nullptr;
wifi_connect_callback_t on_disconnect_cb = nullptr;

uint32_t next_retry_ms = 0;
uint32_t last_keepalive_ms = 0;  // Track last keepalive time
uint8_t reconnect_attempts = 0;
wl_status_t last_status = WL_NO_SHIELD;
bool connection_live = false;
uint32_t network_paused_until_ms = 0;   // When > now, suppress outbound activity
uint32_t pending_disconnect_at_ms = 0;  // If non-zero, perform disconnect at this time

// AP fallback and credentials cooldown
bool ap_mode_enabled = false;
char ap_ssid[32] = {0};
uint32_t credentials_last_update_ms = 0;
uint8_t credentials_failures_since_update = 0;
uint32_t credentials_cooldown_until_ms = 0; // millis until which POST /api/wifi/credentials is blocked (same creds)

// Translate WiFi disconnect reason codes to human-readable strings
static const char* get_disconnect_reason_string(uint8_t reason) {
    switch (reason) {
        case 1: return "UNSPECIFIED";
        case 2: return "AUTH_EXPIRE";
        case 3: return "AUTH_LEAVE";
        case 4: return "ASSOC_EXPIRE";
        case 5: return "ASSOC_TOOMANY";
        case 6: return "NOT_AUTHED";
        case 7: return "NOT_ASSOCED";
        case 8: return "ASSOC_LEAVE";
        case 9: return "ASSOC_NOT_AUTHED";
        case 10: return "DISASSOC_PWRCAP_BAD";
        case 11: return "DISASSOC_SUPCHAN_BAD";
        case 13: return "IE_INVALID";
        case 14: return "MIC_FAILURE";
        case 15: return "4WAY_HANDSHAKE_TIMEOUT";
        case 16: return "GROUP_KEY_UPDATE_TIMEOUT";
        case 17: return "IE_IN_4WAY_DIFFERS";
        case 18: return "GROUP_CIPHER_INVALID";
        case 19: return "PAIRWISE_CIPHER_INVALID";
        case 20: return "AKMP_INVALID";
        case 21: return "UNSUPP_RSN_IE_VERSION";
        case 22: return "INVALID_RSN_IE_CAP";
        case 23: return "802_1X_AUTH_FAILED";
        case 24: return "CIPHER_SUITE_REJECTED";
        case 200: return "BEACON_TIMEOUT";
        case 201: return "NO_AP_FOUND";
        case 202: return "AUTH_FAIL";
        case 203: return "ASSOC_FAIL";
        case 204: return "HANDSHAKE_TIMEOUT";
        case 205: return "CONNECTION_FAIL";
        case 206: return "AP_TSF_RESET";
        default: return "UNKNOWN";
    }
}

// Log WiFi events with disconnect reasons to diagnose link stability
static void on_wifi_event(arduino_event_id_t event, arduino_event_info_t info) {
    connection_logf("DEBUG", "WiFi Event Received: %d", static_cast<int>(event));
    
    switch (event) {
        case ARDUINO_EVENT_WIFI_STA_START:
            connection_logf("DEBUG", "Event: STA_START (%d)", static_cast<int>(event));
            break;
        case ARDUINO_EVENT_WIFI_STA_STOP:
            connection_logf("DEBUG", "Event: STA_STOP (%d)", static_cast<int>(event));
            break;
        case ARDUINO_EVENT_WIFI_STA_CONNECTED:
            connection_logf("INFO", "Event: STA_CONNECTED (%d) to %s", static_cast<int>(event), stored_ssid);
            break;
        case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
            {
                uint8_t reason = info.wifi_sta_disconnected.reason;
                connection_logf("WARN", "Event: STA_DISCONNECTED (%d) reason=%d (%s) RSSI=%ddBm",
                                static_cast<int>(event), static_cast<int>(reason), 
                                get_disconnect_reason_string(reason), WiFi.RSSI());
            }
            break;
        case ARDUINO_EVENT_WIFI_STA_AUTHMODE_CHANGE:
            connection_logf("DEBUG", "Event: STA_AUTHMODE_CHANGE (%d)", static_cast<int>(event));
            break;
        case ARDUINO_EVENT_WIFI_STA_GOT_IP:
            connection_logf("INFO", "Event: STA_GOT_IP (%d)", static_cast<int>(event));
            break;
        case ARDUINO_EVENT_WIFI_STA_LOST_IP:
            connection_logf("WARN", "Event: STA_LOST_IP (%d)", static_cast<int>(event));
            break;
        default:
            connection_logf("DEBUG", "Event: UNKNOWN (%d)", static_cast<int>(event));
            break;
    }
}

static void start_wifi_connect(const char* reason) {
    connection_state_transition(ConnectionState::WifiConnecting, reason);
    connection_watchdog_start(WIFI_ASSOC_TIMEOUT_MS, "WiFi association pending");
    WiFi.begin(stored_ssid, stored_pass);
    connection_logf("INFO", "Connecting to SSID '%s'", stored_ssid);
}

static void schedule_reconnect(const char* reason, uint32_t delay_ms) {
    connection_record_recovery();

    // Increment total failures
    total_connection_failures++;

    // Exponential backoff to reduce reconnect thrash; cap at 60s
    uint8_t backoff_exp = std::min<uint8_t>(reconnect_attempts, static_cast<uint8_t>(5));
    uint32_t factor = 1u << backoff_exp; // 1,2,4,8,16,32
    uint32_t effective_delay = std::min<uint32_t>(delay_ms * factor, static_cast<uint32_t>(60000));

    connection_logf("WARN", "Scheduling reconnect in %lums (attempt %d/%d) (%s)",
                    static_cast<unsigned long>(effective_delay),
                    reconnect_attempts + 1,
                    AP_FALLBACK_THRESHOLD,
                    reason);
    connection_state_transition(ConnectionState::Recovering, reason);

    // Do not force a disconnect; let stack handle state transitions
    next_retry_ms = millis() + effective_delay;
    reconnect_attempts = std::min<uint8_t>(reconnect_attempts + 1, UINT8_MAX);

    connection_watchdog_start(effective_delay + WIFI_ASSOC_TIMEOUT_MS, "Awaiting reconnect window");
}

static void attempt_scheduled_reconnect(uint32_t now_ms) {
    if (next_retry_ms == 0 || now_ms < next_retry_ms) {
        return;
    }

    next_retry_ms = 0;
    start_wifi_connect("Scheduled reconnect");
}

static void handle_watchdog(uint32_t now_ms) {
    char reason[64] = {0};
    if (connection_watchdog_check(now_ms, reason, sizeof(reason))) {
        if (reason[0] == '\0') {
            strncpy(reason, "watchdog timeout", sizeof(reason) - 1);
            reason[sizeof(reason) - 1] = '\0';
        }
        schedule_reconnect(reason, WIFI_RECONNECT_INTERVAL_MS);
    }
}

static void send_wifi_keepalive(uint32_t now_ms) {
    // Only send keepalive if we're connected and enough time has passed
    if (connection_live && WiFi.isConnected() && 
        (now_ms - last_keepalive_ms >= WIFI_KEEPALIVE_INTERVAL_MS) &&
        (now_ms >= network_paused_until_ms)) {
        
        // Send a simple ping to the gateway to keep the connection alive
        IPAddress gateway = WiFi.gatewayIP();
        if (gateway != IPAddress(0, 0, 0, 0)) {
            // Use a simple UDP packet to keep the connection active
            WiFiUDP udp;
            int ok = udp.beginPacket(gateway, 53);  // DNS port - most routers respond
            if (ok == 1) {
                static const char keepalive_msg[] = "keepalive";
                udp.write(reinterpret_cast<const uint8_t*>(keepalive_msg), sizeof(keepalive_msg) - 1);
                udp.endPacket();
            } else {
                connection_logf("WARN", "WiFi keepalive: beginPacket failed (%d)", ok);
            }
            udp.stop();
            
            connection_logf("DEBUG", "WiFi keepalive sent to gateway %s", gateway.toString().c_str());
        }
        
        last_keepalive_ms = now_ms;
    }
}

static void start_ap_fallback_if_needed() {
    // Start captive portal AP when credentials are empty or all networks exhausted
    if (ap_mode_enabled) return;
    if (stored_ssid[0] == '\0') {
        // No credentials configured; start AP immediately
    } else if (credentials_failures_since_update < AP_FALLBACK_THRESHOLD) {
        // Still have retries left (primary: 3, secondary: 3)
        return;
    }

    // Build AP SSID using MAC suffix for uniqueness
    String mac = WiFi.macAddress();
    // Use last 4 hex chars as suffix
    String suffix = mac.substring(mac.length() - 5); // e.g., ":AB" use last 5 including ':'
    suffix.replace(":", "");
    snprintf(ap_ssid, sizeof(ap_ssid), "K1-Setup-%s", suffix.c_str());

    WiFi.mode(WIFI_MODE_APSTA); // Serve AP while continuing STA attempts
    bool ok = WiFi.softAP(ap_ssid, "k1setup123");
    ap_mode_enabled = ok;
    if (ok) {
        IPAddress ip = WiFi.softAPIP();
        connection_logf("WARN", "AP fallback enabled: SSID '%s', IP %s (Primary: %d/%d, Secondary: %d/%d)",
                        ap_ssid, ip.toString().c_str(),
                        std::min(credentials_failures_since_update, (uint8_t)PRIMARY_RETRIES),
                        PRIMARY_RETRIES,
                        std::max((uint8_t)0, (uint8_t)(credentials_failures_since_update - PRIMARY_RETRIES)),
                        SECONDARY_RETRIES);
        connection_state_transition(ConnectionState::Recovering, "AP fallback active");
    } else {
        connection_logf("ERROR", "Failed to start AP fallback");
    }
}

static void try_switch_to_secondary_network() {
    // Switch from primary to secondary network after primary failures exceed threshold
    if (using_fallback || fallback_ssid[0] == '\0') {
        return; // Already using fallback or no secondary network configured
    }

    if (credentials_failures_since_update >= PRIMARY_RETRIES) {
        using_fallback = true;
        strncpy(stored_ssid, fallback_ssid, sizeof(stored_ssid) - 1);
        strncpy(stored_pass, fallback_pass, sizeof(stored_pass) - 1);
        credentials_failures_since_update = PRIMARY_RETRIES; // Track that we've exhausted primary

        connection_logf("INFO", "Primary network failed (%d/%d attempts). Switching to secondary: '%s'",
                        PRIMARY_RETRIES, PRIMARY_RETRIES, stored_ssid);

        wifi_monitor_reassociate_now("Switching to secondary network");
    }
}

static void stop_ap_fallback_if_active() {
    if (!ap_mode_enabled) return;
    WiFi.softAPdisconnect(true);
    ap_mode_enabled = false;
    // Return to STA-only to reduce RF interference once connected
    WiFi.mode(WIFI_STA);
    connection_logf("INFO", "AP fallback disabled");
}

} // namespace

// Link options (configurable via setter before init)
static bool opt_force_bg_only = false;  // DISABLED - Allow 802.11n for better compatibility
static bool opt_force_ht20 = false;     // DISABLED - Allow HT40 for better bandwidth

void wifi_monitor_set_link_options(const WifiLinkOptions& options) {
    opt_force_bg_only = options.force_bg_only;
    opt_force_ht20 = options.force_ht20;
}

void wifi_monitor_get_link_options(WifiLinkOptions& out_options) {
    out_options.force_bg_only = opt_force_bg_only;
    out_options.force_ht20 = opt_force_ht20;
}

void wifi_monitor_update_link_options(const WifiLinkOptions& options) {
    opt_force_bg_only = options.force_bg_only;
    opt_force_ht20 = options.force_ht20;

    // Apply immediately to the STA interface
    if (opt_force_bg_only) {
        esp_wifi_set_protocol(WIFI_IF_STA, WIFI_PROTOCOL_11B | WIFI_PROTOCOL_11G);
    } else {
        esp_wifi_set_protocol(WIFI_IF_STA, WIFI_PROTOCOL_11B | WIFI_PROTOCOL_11G | WIFI_PROTOCOL_11N);
    }

    if (opt_force_ht20) {
        esp_wifi_set_bandwidth(WIFI_IF_STA, WIFI_BW_HT20);
    } else {
        esp_wifi_set_bandwidth(WIFI_IF_STA, WIFI_BW_HT40);
    }

    connection_logf("DEBUG", "WiFi link options updated: protocol=%s, bandwidth=%s",
                    opt_force_bg_only ? "11b/g" : "11b/g/n",
                    opt_force_ht20 ? "HT20" : "HT40");
}

bool wifi_monitor_save_link_options_to_nvs(const WifiLinkOptions& options) {
    Preferences prefs;
    if (!prefs.begin("wifi_link", false)) {
        return false;
    }
    prefs.putBool("bg_only", options.force_bg_only);
    prefs.putBool("ht20", options.force_ht20);
    prefs.end();
    return true;
}

bool wifi_monitor_load_link_options_from_nvs(WifiLinkOptions& out_options) {
    Preferences prefs;
    if (!prefs.begin("wifi_link", true)) {
        // Use defaults if NVS is unavailable
        out_options.force_bg_only = true;
        out_options.force_ht20 = true;
        return false;
    }
    bool bg = prefs.getBool("bg_only", true);
    bool ht20 = prefs.getBool("ht20", true);
    prefs.end();
    out_options.force_bg_only = bg;
    out_options.force_ht20 = ht20;
    return true;
}

// Secondary network credential management
bool wifi_monitor_save_secondary_credentials_to_nvs(const char* ssid, const char* pass) {
    Preferences prefs;
    if (!prefs.begin("wifi_fallback", false)) {
        return false;
    }
    prefs.putString("ssid", ssid ? ssid : "");
    prefs.putString("pass", pass ? pass : "");
    prefs.end();
    return true;
}

bool wifi_monitor_load_secondary_credentials_from_nvs(char* ssid_out, size_t ssid_len,
                                                      char* pass_out, size_t pass_len) {
    Preferences prefs;
    if (!prefs.begin("wifi_fallback", true)) {
        ssid_out[0] = '\0';
        pass_out[0] = '\0';
        return false;
    }
    String ssid = prefs.getString("ssid", "");
    String pass = prefs.getString("pass", "");
    prefs.end();
    strncpy(ssid_out, ssid.c_str(), ssid_len - 1);
    ssid_out[ssid_len - 1] = '\0';
    strncpy(pass_out, pass.c_str(), pass_len - 1);
    pass_out[pass_len - 1] = '\0';
    return ssid.length() > 0;
}

// Check if device has been provisioned (completed first successful connection)
static bool is_device_provisioned() {
    Preferences prefs;
    if (!prefs.begin("device_state", true)) {
        return false;  // First boot
    }
    bool provisioned = prefs.getBool("provisioned", false);
    prefs.end();
    return provisioned;
}

// Mark device as provisioned (after first successful connection)
static void mark_device_provisioned() {
    Preferences prefs;
    if (!prefs.begin("device_state", false)) {
        connection_logf("WARN", "Failed to mark device as provisioned");
        return;
    }
    prefs.putBool("provisioned", true);
    prefs.end();
    connection_logf("INFO", "Device marked as provisioned");
}

void wifi_monitor_init(const char* ssid, const char* pass) {
    connection_state_init();

    memset(stored_ssid, 0, sizeof(stored_ssid));
    memset(stored_pass, 0, sizeof(stored_pass));

    // Initialize from build defaults first
    if (ssid != nullptr) {
        strncpy(stored_ssid, ssid, sizeof(stored_ssid) - 1);
    }
    if (pass != nullptr) {
        strncpy(stored_pass, pass, sizeof(stored_pass) - 1);
    }
    connection_logf("INFO", "Build default WiFi credentials: '%s'", stored_ssid);

    // FIRST-BOOT DETECTION: Only load from NVS if device has been provisioned
    bool provisioned = is_device_provisioned();

    if (provisioned) {
        // Device is provisioned: load LAST CONNECTED credentials from NVS
        char last_ssid[64] = {0};
        char last_pass[64] = {0};
        if (wifi_monitor_load_credentials_from_nvs(last_ssid, sizeof(last_ssid), last_pass, sizeof(last_pass)) && last_ssid[0] != '\0') {
            strncpy(stored_ssid, last_ssid, sizeof(stored_ssid) - 1);
            strncpy(stored_pass, last_pass, sizeof(stored_pass) - 1);
            connection_logf("INFO", "PRIMARY: Using provisioned WiFi credentials from NVS: '%s'", stored_ssid);
        }
    } else {
        // FIRST BOOT: Ignore any old NVS and use compiled defaults
        strncpy(stored_ssid, "VX220-013F", sizeof(stored_ssid) - 1);
        strncpy(stored_pass, "3232AA90E0F24", sizeof(stored_pass) - 1);
        connection_logf("INFO", "PRIMARY: FIRST BOOT detected; using compiled defaults: '%s' (3 retries)", stored_ssid);
    }

    // Load secondary (fallback) network credentials from NVS
    char fallback_ssid_nvs[64] = {0};
    char fallback_pass_nvs[64] = {0};
    if (wifi_monitor_load_secondary_credentials_from_nvs(fallback_ssid_nvs, sizeof(fallback_ssid_nvs),
                                                          fallback_pass_nvs, sizeof(fallback_pass_nvs))) {
        strncpy(fallback_ssid, fallback_ssid_nvs, sizeof(fallback_ssid) - 1);
        strncpy(fallback_pass, fallback_pass_nvs, sizeof(fallback_pass) - 1);
        connection_logf("INFO", "SECONDARY: WiFi network loaded from NVS: '%s' (3 retries)", fallback_ssid);
    } else {
        // No NVS secondary; use compiled defaults
        strncpy(fallback_ssid, "OPTUS_738CC0N", sizeof(fallback_ssid) - 1);
        strncpy(fallback_pass, "parrs45432vw", sizeof(fallback_pass) - 1);
        connection_logf("INFO", "SECONDARY: No NVS configured; using compiled defaults: '%s' (3 retries)", fallback_ssid);
    }

    // Ensure STA interface is enabled before attempting to connect
    WiFi.mode(WIFI_STA);

    // Set regulatory domain for US (enables channels 1-11)
    wifi_country_t country = {
        .cc = "US",           // United States country code
        .schan = 1,           // Start channel
        .nchan = 11,          // Number of channels (US: 1-11, EU: 1-13, JP: 1-14)
        .policy = WIFI_COUNTRY_POLICY_AUTO
    };
    esp_wifi_set_country(&country);
    connection_logf("DEBUG", "WiFi regulatory domain set to US (channels 1-11)");

    // Apply protocol settings based on options
    if (opt_force_bg_only) {
        esp_wifi_set_protocol(WIFI_IF_STA, WIFI_PROTOCOL_11B | WIFI_PROTOCOL_11G);
    } else {
        esp_wifi_set_protocol(WIFI_IF_STA, WIFI_PROTOCOL_11B | WIFI_PROTOCOL_11G | WIFI_PROTOCOL_11N);
    }

    // Apply bandwidth settings based on options
    if (opt_force_ht20) {
        esp_wifi_set_bandwidth(WIFI_IF_STA, WIFI_BW_HT20);
    } else {
        esp_wifi_set_bandwidth(WIFI_IF_STA, WIFI_BW_HT40);
    }

    connection_logf("DEBUG", "WiFi link options: protocol=%s, bandwidth=%s",
                    opt_force_bg_only ? "11b/g" : "11b/g/n",
                    opt_force_ht20 ? "HT20" : "HT40");

    // CRITICAL: Completely disable all power management to prevent ASSOC_LEAVE disconnects
    WiFi.setSleep(WIFI_PS_NONE);  // Use explicit WIFI_PS_NONE instead of false
    connection_logf("DEBUG", "WiFi power management disabled (WIFI_PS_NONE)");

    // Set explicit WiFi TX power to improve signal strength and stability
    WiFi.setTxPower(WIFI_POWER_19_5dBm);  // Maximum power for better stability
    connection_logf("DEBUG", "WiFi TX power set to 19.5dBm");

    // Let the core auto-reconnect between transient losses
    WiFi.setAutoReconnect(true);

    // Subscribe to WiFi events for comprehensive diagnostics
    WiFi.onEvent(on_wifi_event);
    connection_logf("DEBUG", "WiFi event handler registered");

    reconnect_attempts = 0;
    next_retry_ms = 0;
    last_keepalive_ms = 0;  // Initialize keepalive timer
    connection_live = false;
    last_status = WL_NO_SHIELD;
    network_paused_until_ms = 0;
    pending_disconnect_at_ms = 0;

    start_wifi_connect("Initial connect");
}

// -----------------------------
// Credential persistence & APIs
// -----------------------------

bool wifi_monitor_save_credentials_to_nvs(const char* ssid, const char* pass) {
    Preferences prefs;
    if (!prefs.begin("wifi_creds", false)) {
        return false;
    }
    // Store as strings; empty values allowed
    prefs.putString("ssid", ssid ? ssid : "");
    prefs.putString("pass", pass ? pass : "");
    prefs.end();
    return true;
}

bool wifi_monitor_load_credentials_from_nvs(char* ssid_out, size_t ssid_len,
                                            char* pass_out, size_t pass_len) {
    if (!ssid_out || ssid_len == 0 || !pass_out || pass_len == 0) {
        return false;
    }
    Preferences prefs;
    if (!prefs.begin("wifi_creds", true)) {
        // No credentials saved yet
        ssid_out[0] = '\0';
        pass_out[0] = '\0';
        return false;
    }
    String ssid = prefs.getString("ssid", "");
    String pass = prefs.getString("pass", "");
    prefs.end();
    // Copy into provided buffers
    strncpy(ssid_out, ssid.c_str(), ssid_len - 1);
    ssid_out[ssid_len - 1] = '\0';
    strncpy(pass_out, pass.c_str(), pass_len - 1);
    pass_out[pass_len - 1] = '\0';
    return ssid.length() > 0;
}

void wifi_monitor_update_credentials(const char* ssid, const char* pass) {
    // Update in-memory values
    memset(stored_ssid, 0, sizeof(stored_ssid));
    memset(stored_pass, 0, sizeof(stored_pass));
    if (ssid) {
        strncpy(stored_ssid, ssid, sizeof(stored_ssid) - 1);
    }
    if (pass) {
        strncpy(stored_pass, pass, sizeof(stored_pass) - 1);
    }

    connection_logf("INFO", "WiFi credentials updated: ssid='%s'", stored_ssid);

    // Reset failure counters and cooldown tracking on new credentials
    credentials_last_update_ms = millis();
    credentials_failures_since_update = 0;
    credentials_cooldown_until_ms = 0;

    // Persist to NVS and trigger reassociation
    wifi_monitor_save_credentials_to_nvs(stored_ssid, stored_pass);
    wifi_monitor_reassociate_now("credentials changed");
}

void wifi_monitor_get_credentials(char* ssid_out, size_t ssid_len,
                                  char* pass_out, size_t pass_len) {
    if (ssid_out && ssid_len > 0) {
        strncpy(ssid_out, stored_ssid, ssid_len - 1);
        ssid_out[ssid_len - 1] = '\0';
    }
    if (pass_out && pass_len > 0) {
        strncpy(pass_out, stored_pass, pass_len - 1);
        pass_out[pass_len - 1] = '\0';
    }
}

void wifi_monitor_loop() {
    uint32_t now_ms = millis();
    // Perform any scheduled disconnect after a short, non-blocking pause
    if (pending_disconnect_at_ms != 0 && now_ms >= pending_disconnect_at_ms) {
        pending_disconnect_at_ms = 0;
        connection_logf("WARN", "Performing scheduled WiFi disconnect for reassociation");
        // Force a disconnect but keep STA enabled and credentials intact
        WiFi.disconnect(false, false);
        reconnect_attempts = 0;
        start_wifi_connect("Reassociate after link option change");
    }
    
    // Handle scheduled reconnects
    attempt_scheduled_reconnect(now_ms);
    
    // Handle connection watchdog
    handle_watchdog(now_ms);
    
    // Send periodic keepalive to prevent router timeouts
    send_wifi_keepalive(now_ms);

    wl_status_t status = WiFi.status();
    if (status == last_status) {
        return;
    }

    switch (status) {
        case WL_CONNECTED:
            connection_logf("INFO", "Connected to %s @ %s", stored_ssid, WiFi.localIP().toString().c_str());
            connection_state_transition(ConnectionState::WifiConnected, "WiFi association complete");
            connection_watchdog_stop();
            reconnect_attempts = 0;
            next_retry_ms = 0;  // Cancel any scheduled reconnect since link is healthy
            connection_live = true;
            // Clear AP fallback and cooldown upon successful link
            credentials_failures_since_update = 0;
            credentials_cooldown_until_ms = 0;
            stop_ap_fallback_if_active();
            // Persist LAST connected credentials so we prefer them on next boot
            wifi_monitor_save_credentials_to_nvs(stored_ssid, stored_pass);
            // Mark device as provisioned on first successful connection (enables NVS loading on future boots)
            if (!is_device_provisioned()) {
                mark_device_provisioned();
            }
            if (on_connect_cb) {
                on_connect_cb();
            }
            break;

        case WL_DISCONNECTED:
            connection_logf("WARN", "WiFi disconnected from %s", stored_ssid);
            if (connection_live && on_disconnect_cb) {
                on_disconnect_cb();
            }
            connection_live = false;
            schedule_reconnect("WiFi disconnected", WIFI_RECONNECT_INTERVAL_MS);
            break;

        case WL_CONNECTION_LOST:
            connection_logf("ERROR", "WiFi connection lost (%s)", stored_ssid);
            if (connection_live && on_disconnect_cb) {
                on_disconnect_cb();
            }
            connection_live = false;
            schedule_reconnect("Connection lost", WIFI_RECONNECT_INTERVAL_MS);
            break;

        case WL_NO_SSID_AVAIL:
            connection_logf("ERROR", "SSID '%s' not found", stored_ssid);
            if (connection_live && on_disconnect_cb) {
                on_disconnect_cb();
            }
            connection_live = false;
            // Record failure against most recent credentials update
            if (credentials_last_update_ms != 0) {
                credentials_failures_since_update++;
                connection_logf("WARN", "SSID unavailable. Failures: %d/%d", credentials_failures_since_update, AP_FALLBACK_THRESHOLD);

                // Try secondary network after 3 primary failures
                try_switch_to_secondary_network();

                // Start AP fallback after 6 total failures (3 primary + 3 secondary)
                if (credentials_failures_since_update >= AP_FALLBACK_THRESHOLD && credentials_cooldown_until_ms == 0) {
                    credentials_cooldown_until_ms = millis() + 120000; // 2min cooldown
                    connection_logf("WARN", "Network exhaustion cooldown activated: %lu ms", (unsigned long)120000);
                }
            }
            start_ap_fallback_if_needed();
            schedule_reconnect("SSID unavailable", WIFI_RECONNECT_INTERVAL_MS);
            break;

        case WL_CONNECT_FAILED:
            connection_logf("ERROR", "Failed to connect to SSID '%s'", stored_ssid);
            if (connection_live && on_disconnect_cb) {
                on_disconnect_cb();
            }
            connection_live = false;
            // Record failure against most recent credentials update
            if (credentials_last_update_ms != 0) {
                credentials_failures_since_update++;
                connection_logf("WARN", "Connection failed. Failures: %d/%d", credentials_failures_since_update, AP_FALLBACK_THRESHOLD);

                // Try secondary network after 3 primary failures
                try_switch_to_secondary_network();

                // Start AP fallback after 6 total failures (3 primary + 3 secondary)
                if (credentials_failures_since_update >= AP_FALLBACK_THRESHOLD && credentials_cooldown_until_ms == 0) {
                    credentials_cooldown_until_ms = millis() + 120000; // 2min cooldown
                    connection_logf("WARN", "Network exhaustion cooldown activated: %lu ms", (unsigned long)120000);
                }
            }
            start_ap_fallback_if_needed();
            schedule_reconnect("Connection failed", WIFI_RECONNECT_INTERVAL_MS);
            break;

        case WL_IDLE_STATUS:
            connection_state_transition(ConnectionState::WifiConnecting, "WiFi idle");
            connection_logf("DEBUG", "WiFi idle, awaiting association");
            break;

        default:
            connection_logf("ERROR", "Unhandled WiFi status change: %d", static_cast<int>(status));
            if (connection_live && on_disconnect_cb) {
                on_disconnect_cb();
            }
            connection_live = false;
            // Proactively recover on unknown states (e.g., STA off or transient)
            schedule_reconnect("Unknown status", WIFI_RECONNECT_INTERVAL_MS);
            break;
    }

    last_status = status;
}

// WiFi Network Scanning for Diagnostics
void wifi_monitor_scan_available_networks() {
    connection_logf("INFO", "=== STARTING WiFi NETWORK SCAN ===");

    // Set STA mode to allow scanning
    WiFi.mode(WIFI_STA);

    // Start the scan in the background
    WiFi.scanNetworks(true);  // true = async (non-blocking)
    connection_logf("DEBUG", "WiFi scan initiated (async mode)");
}

void wifi_monitor_log_scan_results() {
    // Check if scan is complete
    int16_t scan_result = WiFi.scanComplete();

    if (scan_result == WIFI_SCAN_RUNNING) {
        connection_logf("DEBUG", "WiFi scan still in progress...");
        return;
    }

    if (scan_result < 0) {
        connection_logf("ERROR", "WiFi scan failed with code %d", static_cast<int>(scan_result));
        return;
    }

    int num_networks = scan_result;
    connection_logf("INFO", "=== WiFi SCAN RESULTS: %d networks found ===", num_networks);

    // Log each discovered network
    bool target_primary_found = false;
    bool target_fallback_found = false;

    for (int i = 0; i < num_networks; i++) {
        String ssid = WiFi.SSID(i);
        int32_t rssi = WiFi.RSSI(i);
        uint8_t channel = WiFi.channel(i);
        uint8_t sec = WiFi.encryptionType(i);

        const char* auth_mode = "UNKNOWN";
        switch (sec) {
            case WIFI_AUTH_OPEN: auth_mode = "OPEN"; break;
            case WIFI_AUTH_WEP: auth_mode = "WEP"; break;
            case WIFI_AUTH_WPA_PSK: auth_mode = "WPA-PSK"; break;
            case WIFI_AUTH_WPA2_PSK: auth_mode = "WPA2-PSK"; break;
            case WIFI_AUTH_WPA_WPA2_PSK: auth_mode = "WPA/WPA2-PSK"; break;
            case WIFI_AUTH_WPA2_ENTERPRISE: auth_mode = "WPA2-Enterprise"; break;
            case WIFI_AUTH_WPA3_PSK: auth_mode = "WPA3-PSK"; break;
            case WIFI_AUTH_WPA2_WPA3_PSK: auth_mode = "WPA2/WPA3-PSK"; break;
            default: auth_mode = "OTHER"; break;
        }

        connection_logf("INFO", "[%d] SSID: '%-32s' | Signal: %3d dBm | Channel: %2d | Auth: %s",
                        i, ssid.c_str(), static_cast<int>(rssi), static_cast<int>(channel), auth_mode);

        // Check if this is one of our target networks
        if (ssid == primary_ssid) {
            target_primary_found = true;
            connection_logf("WARN", "  ✓ FOUND TARGET PRIMARY NETWORK: '%s'", primary_ssid);
        }
        if (ssid == fallback_ssid) {
            target_fallback_found = true;
            connection_logf("WARN", "  ✓ FOUND TARGET FALLBACK NETWORK: '%s'", fallback_ssid);
        }
    }

    // Summary
    connection_logf("INFO", "=== SCAN SUMMARY ===");
    connection_logf("INFO", "Primary network '%s': %s", primary_ssid,
                    target_primary_found ? "FOUND ✓" : "NOT FOUND ✗");
    connection_logf("INFO", "Fallback network '%s': %s", fallback_ssid,
                    target_fallback_found ? "FOUND ✓" : "NOT FOUND ✗");

    // Clean up scan results to free memory
    WiFi.scanDelete();
    connection_logf("INFO", "=== END SCAN RESULTS ===");
}

bool wifi_monitor_is_ap_mode_enabled() {
    return ap_mode_enabled;
}

bool wifi_monitor_credentials_in_cooldown() {
    if (credentials_cooldown_until_ms == 0) return false;
    return millis() < credentials_cooldown_until_ms;
}

uint32_t wifi_monitor_credentials_cooldown_remaining_ms() {
    if (!wifi_monitor_credentials_in_cooldown()) return 0;
    uint32_t now = millis();
    return credentials_cooldown_until_ms > now ? (credentials_cooldown_until_ms - now) : 0;
}

bool wifi_monitor_is_connected() {
    return WiFi.status() == WL_CONNECTED;
}

void wifi_monitor_reassociate_now(const char* reason) {
    connection_logf("WARN", "Reassociating WiFi (%s)", reason ? reason : "unspecified");
    // Cancel any scheduled reconnect to avoid duplicate attempts
    next_retry_ms = 0;
    // Schedule a short network pause before disconnect to avoid packet loss
    uint32_t now_ms = millis();
    network_paused_until_ms = now_ms + NETWORK_PAUSE_DEFAULT_MS;
    pending_disconnect_at_ms = now_ms + NETWORK_PAUSE_DEFAULT_MS;
    connection_state_transition(ConnectionState::Recovering, "Scheduled reassociation");
}

void wifi_monitor_on_connect(wifi_connect_callback_t callback) {
    on_connect_cb = callback;
}

void wifi_monitor_on_disconnect(wifi_connect_callback_t callback) {
    on_disconnect_cb = callback;
}
