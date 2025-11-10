#pragma once

#include <stdint.h>
#include <stddef.h>

// Initialize WiFi monitor with SSID and password
void wifi_monitor_init(const char* ssid, const char* pass);

// Run monitor loop; call frequently from main loop
void wifi_monitor_loop();

// Query current WiFi connection state
bool wifi_monitor_is_connected();

// Register callbacks for connect/disconnect events
typedef void (*wifi_connect_callback_t)();
void wifi_monitor_on_connect(wifi_connect_callback_t callback);
void wifi_monitor_on_disconnect(wifi_connect_callback_t callback);

// Force immediate reassociation with a brief, non-blocking pause before disconnect
// The disconnect is scheduled in the main loop to prevent blocking and reduce packet loss.
void wifi_monitor_reassociate_now(const char* reason);

// Configurable WiFi link options
struct WifiLinkOptions {
    bool force_bg_only; // true: 11b/g only; false: 11b/g/n
    bool force_ht20;    // true: HT20; false: HT40
};

// Link options API
void wifi_monitor_set_link_options(const WifiLinkOptions& options);
void wifi_monitor_get_link_options(WifiLinkOptions& out_options);
void wifi_monitor_update_link_options(const WifiLinkOptions& options);
bool wifi_monitor_save_link_options_to_nvs(const WifiLinkOptions& options);
bool wifi_monitor_load_link_options_from_nvs(WifiLinkOptions& out_options);

// Runtime credential management (persist to NVS and trigger reassociation)
// Save credentials to NVS under namespace "wifi_creds"
bool wifi_monitor_save_credentials_to_nvs(const char* ssid, const char* pass);
// Load credentials from NVS; returns true if values exist (ssid non-empty)
bool wifi_monitor_load_credentials_from_nvs(char* ssid_out, size_t ssid_len,
                                            char* pass_out, size_t pass_len);
// Update in-memory credentials and schedule reassociation
void wifi_monitor_update_credentials(const char* ssid, const char* pass);
// Read current in-memory credentials (may be different from WiFi.SSID when disconnected)
void wifi_monitor_get_credentials(char* ssid_out, size_t ssid_len,
                                  char* pass_out, size_t pass_len);

// Secondary network credential management (used as fallback after primary fails)
bool wifi_monitor_save_secondary_credentials_to_nvs(const char* ssid, const char* pass);
bool wifi_monitor_load_secondary_credentials_from_nvs(char* ssid_out, size_t ssid_len,
                                                      char* pass_out, size_t pass_len);

// AP fallback (captive portal) status
bool wifi_monitor_is_ap_mode_enabled();

// Credentials cooldown/backoff status
bool wifi_monitor_credentials_in_cooldown();
uint32_t wifi_monitor_credentials_cooldown_remaining_ms();

// WiFi Network Scanning for Diagnostics
// Initiates an asynchronous WiFi network scan
void wifi_monitor_scan_available_networks();
// Logs the results of a completed WiFi scan (call after wifi_monitor_scan_available_networks)
void wifi_monitor_log_scan_results();
