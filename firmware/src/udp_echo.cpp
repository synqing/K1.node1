#include "udp_echo.h"
#include <Arduino.h>
#include <WiFiUdp.h>
#include "logging/logger.h"

static TaskHandle_t s_udp_task_handle = nullptr;
static uint16_t s_udp_port = 0;

static void udp_echo_task(void* param) {
    WiFiUDP udp;
    uint16_t port = s_udp_port;
    if (!udp.begin(port)) {
        LOG_ERROR(TAG_WIFI, "UDP Echo: Failed to bind UDP port %u", (unsigned)port);
        vTaskDelete(nullptr);
        return;
    }
    LOG_INFO(TAG_WIFI, "UDP Echo: Listening on UDP port %u", (unsigned)port);

    // Simple loop: poll for packets, echo back payload
    // Keep buffer modest to avoid large pbuf allocations
    char buf[768];
    for (;;) {
        int packetSize = udp.parsePacket();
        if (packetSize > 0) {
            int len = udp.read(buf, sizeof(buf));
            if (len < 0) {
                // read failed; skip this packet
                vTaskDelay(pdMS_TO_TICKS(1));
                continue;
            }
            IPAddress remoteIp = udp.remoteIP();
            uint16_t remotePort = udp.remotePort();
            // Echo back the same payload (JSON recommended)
            int ok = udp.beginPacket(remoteIp, remotePort);
            if (ok == 1) {
                // clamp write to actual buffer size
                size_t to_write = (size_t)len;
                if (to_write > sizeof(buf)) to_write = sizeof(buf);
                udp.write(reinterpret_cast<const uint8_t*>(buf), to_write);
                udp.endPacket();
            } else {
                LOG_WARN(TAG_WIFI, "UDP Echo: beginPacket failed (%d)", ok);
            }
        }
        // Yield briefly to avoid CPU starvation
        vTaskDelay(pdMS_TO_TICKS(1));
    }
}

void udp_echo_begin(uint16_t port) {
    if (s_udp_task_handle) return; // already running
    s_udp_port = port;
    xTaskCreatePinnedToCore(
        udp_echo_task,
        "udp_echo",
        4096,
        nullptr,
        tskIDLE_PRIORITY,   // Yield to audio/GPU tasks and Wi-Fi handlers
        &s_udp_task_handle,
        0  // Core 0 alongside Wi-Fi stack
    );
}
