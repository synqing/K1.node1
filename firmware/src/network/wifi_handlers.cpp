/**
 * @file wifi_handlers.cpp
 * @brief WiFi event handlers implementation
 */

#include "wifi_handlers.h"
#include "connection_state.h"
#include "network/udp_echo.h"
#include "diagnostics/cpu_monitor.h"
#include "webserver.h"
#include "logging/logger.h"
#include <Arduino.h>     // Ensure Arduino core types/macros are available first
#include <WiFi.h>
#include <ArduinoOTA.h>
#include <ESPmDNS.h>

// Track whether network services have been initialized
static bool network_services_started = false;

void handle_wifi_connected() {
    connection_logf("INFO", "WiFi connected callback fired");
#if __has_include(<WiFi.h>) && __has_include(<ArduinoOTA.h>)
    LOG_INFO(TAG_WIFI, "Connected! IP: %s", WiFi.localIP().toString().c_str());

    // Ensure mDNS is started and advertise HTTP for browser discovery
    if (!MDNS.begin("k1-reinvented")) {
        LOG_WARN(TAG_WIFI, "mDNS start failed; .local hostname may not resolve");
    } else {
        MDNS.addService("http", "tcp", 80);
        MDNS.addService("arduino", "tcp", 3232); // OTA service
        LOG_INFO(TAG_WEB, "mDNS: http://k1-reinvented.local (http), OTA on _arduino._tcp");
    }

    ArduinoOTA.begin();

    if (!network_services_started) {
        LOG_INFO(TAG_WEB, "Initializing web server...");
        init_webserver();

        // Start UDP echo server for RTT diagnostics (port 9000)
        udp_echo_begin(9000);
        // Start secondary UDP echo for OSC correlation (port 9001)
        udp_echo_begin(9001);

        LOG_INFO(TAG_CORE0, "Initializing CPU monitor...");
        cpu_monitor.init();

        network_services_started = true;
    }

    // Variadic formatting requires a C string; normalize hostname accordingly
    String hostName(ArduinoOTA.getHostname());
    LOG_INFO(TAG_WEB, "Control UI: http://%s.local", hostName.c_str());
#else
    LOG_INFO(TAG_WIFI, "Connected (WiFi/OTA headers unavailable in this build)");
#endif
}

void handle_wifi_disconnected() {
    connection_logf("WARN", "WiFi disconnected callback");
    LOG_WARN(TAG_WIFI, "WiFi connection lost, attempting recovery...");
}
