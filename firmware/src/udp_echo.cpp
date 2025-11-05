#include "udp_echo.h"
#include <Arduino.h>
#include <WiFiUdp.h>

static TaskHandle_t s_udp_task_handle = nullptr;
static uint16_t s_udp_port = 0;

static void udp_echo_task(void* param) {
    WiFiUDP udp;
    uint16_t port = s_udp_port;
    if (!udp.begin(port)) {
        Serial.printf("[udp_echo] Failed to bind UDP port %u\n", (unsigned)port);
        vTaskDelete(nullptr);
        return;
    }
    Serial.printf("[udp_echo] Listening on UDP port %u\n", (unsigned)port);

    // Simple loop: poll for packets, echo back payload
    char buf[1024];
    for (;;) {
        int packetSize = udp.parsePacket();
        if (packetSize > 0) {
            int len = udp.read(buf, sizeof(buf));
            if (len > 0) {
                buf[len] = '\0';
            }
            IPAddress remoteIp = udp.remoteIP();
            uint16_t remotePort = udp.remotePort();
            // Echo back the same payload (JSON recommended)
            udp.beginPacket(remoteIp, remotePort);
            udp.write((const uint8_t*)buf, len);
            udp.endPacket();
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
        3,
        &s_udp_task_handle,
        0  // Core 0 (render) side; low priority, tiny impact
    );
}

