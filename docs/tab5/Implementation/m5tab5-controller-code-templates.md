# M5Stack Tab5 Controller: Code Templates & Reference

**Status:** draft
**Owner:** Claude Code Agent
**Date:** 2025-11-05
**Related:** m5stack-tab5-controller-research.md
**Tags:** code-templates, reference, embedded-development

---

## Quick Reference: Library Installation

### PlatformIO Complete platformio.ini

```ini
[platformio]
default_envs = m5stack-tab5

[env:m5stack-tab5]
platform = espressif32@^6.10.0
board = m5stack-tab5
framework = arduino
board_build.partitions = default_8MB.csv

; Upload settings
upload_speed = 1500000
monitor_speed = 115200
monitor_filters =
    esp32_exception_decoder
    default

; Build flags (critical for Tab5)
build_flags =
    -DBOARD_HAS_PSRAM=1
    -DCORE_DEBUG_LEVEL=2
    -DARDUINO_USB_CDC_ON_BOOT=1
    -DARDUINO_USB_MODE=1
    -DUSE_HSPI_PINS=1
    -O2

; Library dependencies
lib_deps =
    m5stack/M5Unified@^0.1.0
    m5stack/M5GFX@^0.1.0
    lvgl/lvgl@^9.3.0
    khoih-prog/AsyncHTTPRequest_Generic@^1.16.0
    khoih-prog/AsyncHTCP@^1.2.4
    bblanchon/ArduinoJson@^7.0.0
    ESP Async WebServer@^1.2.3
```

---

## Template 1: Basic WiFi + HTTP Status Polling

```cpp
// WiFiController.hpp
#pragma once
#include <WiFi.h>
#include <ESPmDNS.h>

class WiFiController {
private:
    const char *ssid;
    const char *password;
    unsigned long lastReconnectAttempt = 0;
    const unsigned long RECONNECT_INTERVAL = 5000;

    static void onWiFiEvent(WiFiEvent_t event);

public:
    WiFiController(const char *ssid, const char *password)
        : ssid(ssid), password(password) {}

    void setup() {
        WiFi.mode(WIFI_STA);
        WiFi.setAutoReconnect(true);
        WiFi.persistent(false);
        WiFi.onEvent(onWiFiEvent);
        WiFi.begin(ssid, password);

        Serial.println("[WiFi] Connecting...");
    }

    void loop() {
        if (WiFi.status() != WL_CONNECTED &&
            millis() - lastReconnectAttempt > RECONNECT_INTERVAL) {
            Serial.println("[WiFi] Attempting reconnect...");
            WiFi.reconnect();
            lastReconnectAttempt = millis();
        }
    }

    bool isConnected() const {
        return WiFi.status() == WL_CONNECTED;
    }

    String getLocalIP() const {
        return WiFi.localIP().toString();
    }

    String getSSID() const {
        return WiFi.SSID();
    }

    int getRSSI() const {
        return WiFi.RSSI();  // Signal strength (dBm)
    }
};

// WiFiController.cpp
void WiFiController::onWiFiEvent(WiFiEvent_t event) {
    switch (event) {
        case ARDUINO_EVENT_WIFI_STA_START:
            Serial.println("[WiFi] STA started");
            break;

        case ARDUINO_EVENT_WIFI_STA_CONNECTED:
            Serial.println("[WiFi] Connected to network");
            break;

        case ARDUINO_EVENT_WIFI_STA_GOT_IP:
            Serial.printf("[WiFi] Got IP: %s\n", WiFi.localIP().toString().c_str());
            if (!MDNS.begin("k1-controller")) {
                Serial.println("[mDNS] Failed to start mDNS responder");
            } else {
                Serial.println("[mDNS] Started, accessible as k1-controller.local");
            }
            break;

        case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
            Serial.println("[WiFi] Disconnected");
            MDNS.end();
            break;

        default:
            break;
    }
}
```

---

## Template 2: Async HTTP Status Requests

```cpp
// K1Client.hpp
#pragma once
#include <AsyncHTTPRequest_Generic.h>
#include <ArduinoJson.h>

typedef std::function<void(const JsonDocument &doc)> StatusCallback;
typedef std::function<void(int statusCode)> CommandCallback;

class K1Client {
private:
    String host;
    int port;
    AsyncHTTPRequest statusRequest;
    AsyncHTTPRequest commandRequest;

    StatusCallback statusCallback;
    CommandCallback commandCallback;

public:
    K1Client(const String &host, int port = 8080)
        : host(host), port(port) {
        setupCallbacks();
    }

    void setupCallbacks() {
        statusRequest.onReadyStatechange(
            [this](void *opt, AsyncHTTPRequest *req, int readyState) {
                this->onStatusResponse(req, readyState);
            }
        );

        commandRequest.onReadyStatechange(
            [this](void *opt, AsyncHTTPRequest *req, int readyState) {
                this->onCommandResponse(req, readyState);
            }
        );
    }

    void getStatus(StatusCallback callback) {
        statusCallback = callback;
        String url = "http://" + host + ":" + String(port) + "/api/status";
        statusRequest.open("GET", url.c_str());
        statusRequest.send();
    }

    void setPattern(const String &pattern, CommandCallback callback) {
        commandCallback = callback;
        String url = "http://" + host + ":" + String(port) + "/api/pattern";

        StaticJsonDocument<128> payload;
        payload["pattern"] = pattern;

        String json;
        serializeJson(payload, json);

        commandRequest.open("POST", url.c_str());
        commandRequest.addHeader("Content-Type", "application/json");
        commandRequest.send(json);
    }

    void setBrightness(float brightness, CommandCallback callback) {
        commandCallback = callback;
        String url = "http://" + host + ":" + String(port) + "/api/brightness";

        StaticJsonDocument<128> payload;
        payload["brightness"] = brightness;

        String json;
        serializeJson(payload, json);

        commandRequest.open("POST", url.c_str());
        commandRequest.addHeader("Content-Type", "application/json");
        commandRequest.send(json);
    }

private:
    void onStatusResponse(AsyncHTTPRequest *req, int readyState) {
        if (readyState != 4) return;  // Not complete

        if (req->responseHTTPcode() != 200) {
            Serial.printf("[K1] Status request failed: %d\n", req->responseHTTPcode());
            return;
        }

        StaticJsonDocument<512> doc;
        DeserializationError error = deserializeJson(doc, req->responseText());

        if (error) {
            Serial.printf("[K1] JSON parse error: %s\n", error.c_str());
            return;
        }

        if (statusCallback) {
            statusCallback(doc);
        }
    }

    void onCommandResponse(AsyncHTTPRequest *req, int readyState) {
        if (readyState != 4) return;

        int code = req->responseHTTPcode();
        if (commandCallback) {
            commandCallback(code);
        }
    }
};
```

**Usage:**

```cpp
K1Client k1Client("k1.local", 8080);

void setup() {
    // ... WiFi setup ...
    k1Client.getStatus([](const JsonDocument &doc) {
        const char *pattern = doc["pattern"] | "unknown";
        float brightness = doc["brightness"] | 0.5;
        Serial.printf("K1 Pattern: %s, Brightness: %.1f\n", pattern, brightness);
    });
}

void loop() {
    static unsigned long lastRequest = 0;
    if (millis() - lastRequest > 500) {
        k1Client.getStatus([](const JsonDocument &doc) {
            // Handle status update
        });
        lastRequest = millis();
    }
}
```

---

## Template 3: LVGL + SquareLine Integration

```cpp
// ui_config.h - Generated by SquareLine Studio
#ifndef UI_CONFIG_H
#define UI_CONFIG_H

#include <lvgl.h>

// Display buffer size (adjust based on available RAM)
#define LV_BUFFER_SIZE (320 * 720 / 4)

// Initialize LVGL and display
void ui_init(void);

// Create main screen
void ui_MainScreen_screen_init(void);

// Event handlers
void ui_event_PatternNextButton(lv_event_t *e);
void ui_event_BrightnessSlider(lv_event_t *e);

#endif

// ui_main.c - Implement your custom handlers
#include "ui_config.h"
#include "K1Client.hpp"

K1Client *g_k1Client = nullptr;

void ui_event_PatternNextButton(lv_event_t *e) {
    if (lv_event_get_code(e) == LV_EVENT_CLICKED) {
        if (g_k1Client) {
            g_k1Client->setPattern("next", [](int code) {
                Serial.printf("Pattern change response: %d\n", code);
            });
        }
    }
}

void ui_event_BrightnessSlider(lv_event_t *e) {
    if (lv_event_get_code(e) == LV_EVENT_VALUE_CHANGED) {
        lv_obj_t *slider = lv_event_get_target(e);
        int value = lv_slider_get_value(slider);
        float brightness = value / 100.0f;

        if (g_k1Client) {
            g_k1Client->setBrightness(brightness, [](int code) {
                Serial.printf("Brightness change response: %d\n", code);
            });
        }
    }
}

void ui_init(void) {
    // Basic LVGL initialization
    lv_init();

    // Create display buffer
    static lv_disp_draw_buf_t disp_buf;
    static lv_color_t buf[LV_BUFFER_SIZE];
    lv_disp_draw_buf_init(&disp_buf, buf, NULL, LV_BUFFER_SIZE);

    // Create display driver
    static lv_disp_drv_t disp_drv;
    lv_disp_drv_init(&disp_drv);

    disp_drv.draw_buf = &disp_buf;
    disp_drv.flush_cb = [](lv_disp_drv_t *disp_drv, const lv_area_t *area,
                           lv_color_t *color_p) {
        // Display update (implement via M5GFX)
        // M5.Display.pushImage(area->x1, area->y1, area->x2 - area->x1,
        //                      area->y2 - area->y1, (uint16_t *)color_p);
        lv_disp_flush_ready(disp_drv);
    };

    disp_drv.hor_res = 1280;
    disp_drv.ver_res = 720;
    lv_disp_drv_register(&disp_drv);

    // Create input device (touch)
    static lv_indev_drv_t indev_drv;
    lv_indev_drv_init(&indev_drv);
    indev_drv.type = LV_INDEV_TYPE_POINTER;

    indev_drv.read_cb = [](lv_indev_drv_t *drv, lv_indev_data_t *data) {
        // Read touch input from M5.Touch
        if (M5.Touch.isPressed()) {
            data->point.x = M5.Touch.getCursorX();
            data->point.y = M5.Touch.getCursorY();
            data->state = LV_INDEV_STATE_PRESSED;
        } else {
            data->state = LV_INDEV_STATE_RELEASED;
        }
    };

    lv_indev_drv_register(&indev_drv);
}
```

---

## Template 4: LVGL Task + Main Loop (Dual Core)

```cpp
// main.cpp
#include <M5Unified.h>
#include <WiFi.h>
#include <ESPmDNS.h>
#include <lvgl.h>

// External globals (use extern in header)
extern K1Client *g_k1Client;

WiFiController wifiCtrl("SSID", "PASSWORD");
K1Client k1Client("k1.local", 8080);

volatile bool lvgl_ready = false;

// LVGL task runs on core 1
void lvglTimerTask(void *param) {
    Serial.println("[LVGL] Task started on core 1");

    while (true) {
        lv_timer_handler();
        vTaskDelay(pdMS_TO_TICKS(5));  // 5ms = ~200 Hz update rate
    }
}

void setup() {
    M5.begin();
    Serial.begin(115200);
    delay(500);

    Serial.println("[Main] Starting K1 Tab5 Controller");

    // WiFi
    wifiCtrl.setup();

    // Display
    M5.Display.setTextSize(2);
    M5.Display.println("Initializing...");

    // LVGL
    ui_init();
    ui_MainScreen_screen_init();
    lvgl_ready = true;

    // K1 Client
    g_k1Client = &k1Client;

    // Start LVGL timer task on core 1
    xTaskCreatePinnedToCore(
        lvglTimerTask,           // Function
        "LVGL_Task",             // Name
        4096,                    // Stack size
        NULL,                    // Parameter
        5,                       // Priority
        NULL,                    // Task handle
        1                        // Core (core 1)
    );

    Serial.println("[Main] Setup complete");
}

void loop() {
    // Core 0: WiFi, HTTP, touch, business logic
    M5.update();

    // WiFi maintenance
    wifiCtrl.loop();

    // Handle WiFi status display
    static unsigned long lastWiFiCheck = 0;
    if (millis() - lastWiFiCheck > 1000) {
        if (!wifiCtrl.isConnected()) {
            Serial.println("[WiFi] Not connected");
        }
        lastWiFiCheck = millis();
    }

    // Poll K1 status periodically
    static unsigned long lastStatusPoll = 0;
    if (millis() - lastStatusPoll > 500 && wifiCtrl.isConnected()) {
        k1Client.getStatus([](const JsonDocument &doc) {
            // LVGL is safe to update from here (uses queue)
            // Update status label, etc.
        });
        lastStatusPoll = millis();
    }

    // Handle touch input (will be processed by LVGL on core 1)
    if (M5.Touch.isPressed()) {
        // LVGL handles touch via indev_cb
    }

    delay(10);  // Prevent watchdog timeout
}
```

---

## Template 5: Persistent WiFi Credentials with AP Fallback

```cpp
// WifiProvisioning.hpp
#pragma once
#include <WiFi.h>
#include <Preferences.h>
#include <ESPAsyncWebServer.h>

class WiFiProvisioning {
private:
    Preferences prefs;
    AsyncWebServer server{80};
    bool isProvisioningActive = false;

public:
    void setupWithFallback(const char *defaultSSID = nullptr,
                          const char *defaultPassword = nullptr) {
        // Try to load saved credentials
        String ssid, password;
        if (loadCredentials(ssid, password)) {
            Serial.printf("[Provisioning] Using saved credentials: %s\n", ssid.c_str());
            WiFi.mode(WIFI_STA);
            WiFi.begin(ssid.c_str(), password.c_str());

            // Wait up to 10 seconds for connection
            for (int i = 0; i < 100 && WiFi.status() != WL_CONNECTED; ++i) {
                delay(100);
            }
        }

        // If not connected, start provisioning AP
        if (WiFi.status() != WL_CONNECTED) {
            if (defaultSSID) {
                WiFi.begin(defaultSSID, defaultPassword);
            } else {
                startProvisioningAP();
            }
        }
    }

    bool loadCredentials(String &ssid, String &password) {
        prefs.begin("wifi", true);  // Read-only
        ssid = prefs.getString("ssid", "");
        password = prefs.getString("password", "");
        prefs.end();

        return ssid.length() > 0;
    }

    void saveCredentials(const String &ssid, const String &password) {
        prefs.begin("wifi", false);  // Read-write
        prefs.putString("ssid", ssid);
        prefs.putString("password", password);
        prefs.end();

        Serial.println("[Provisioning] Credentials saved");
    }

    void startProvisioningAP() {
        isProvisioningActive = true;

        WiFi.mode(WIFI_AP_STA);
        WiFi.softAP("K1-Controller-Setup", "12345678");

        Serial.println("[Provisioning] AP started: K1-Controller-Setup");
        Serial.printf("AP IP: %s\n", WiFi.softAPIP().toString().c_str());

        // Web form for WiFi credentials
        server.on("/", HTTP_GET, [this](AsyncWebServerRequest *request) {
            String html = R"(
                <html>
                <body>
                    <h1>K1 Controller WiFi Setup</h1>
                    <form method="post" action="/connect">
                        <label>SSID:</label>
                        <input type="text" name="ssid" required><br>
                        <label>Password:</label>
                        <input type="password" name="password" required><br>
                        <button type="submit">Connect</button>
                    </form>
                </body>
                </html>
            )";
            request->send(200, "text/html", html);
        });

        server.on("/connect", HTTP_POST, [this](AsyncWebServerRequest *request) {
            String ssid = request->getParam("ssid", true)->value();
            String password = request->getParam("password", true)->value();

            saveCredentials(ssid, password);

            request->send(200, "text/html",
                "<h1>Saved! Connecting to " + ssid + "...</h1>");

            WiFi.begin(ssid.c_str(), password.c_str());
        });

        server.begin();
        Serial.println("[Provisioning] Web server started on port 80");
    }

    bool isProvisioning() const {
        return isProvisioningActive;
    }

    void stopProvisioning() {
        if (isProvisioningActive) {
            server.end();
            WiFi.softAPdisconnect(true);
            WiFi.mode(WIFI_STA);
            isProvisioningActive = false;
            Serial.println("[Provisioning] AP stopped");
        }
    }
};
```

---

## Template 6: Performance Monitoring

```cpp
// PerformanceMonitor.hpp
#pragma once
#include <numeric>

class PerformanceMonitor {
private:
    struct FrameMetrics {
        uint32_t timestamp_ms;
        float cpu_usage_percent;
        float heap_free_bytes;
        float http_latency_ms;
    };

    static constexpr int MAX_FRAMES = 60;
    FrameMetrics frames[MAX_FRAMES];
    int frameIndex = 0;
    unsigned long lastCPUCheck = 0;

public:
    void recordFrame() {
        FrameMetrics &frame = frames[frameIndex];
        frame.timestamp_ms = millis();
        frame.heap_free_bytes = heap_caps_get_free_size(MALLOC_CAP_8BIT);
        frame.cpu_usage_percent = calculateCPUUsage();

        frameIndex = (frameIndex + 1) % MAX_FRAMES;
    }

    float getAverageFPS() const {
        if (frameIndex < 2) return 0;

        unsigned long firstTime = frames[0].timestamp_ms;
        unsigned long lastTime = frames[(frameIndex + MAX_FRAMES - 1) % MAX_FRAMES].timestamp_ms;

        return (frameIndex * 1000.0f) / (lastTime - firstTime);
    }

    float getAverageHeapFree() const {
        float sum = 0;
        for (int i = 0; i < MAX_FRAMES; ++i) {
            sum += frames[i].heap_free_bytes;
        }
        return sum / MAX_FRAMES;
    }

    void printStats() {
        Serial.printf("[Perf] FPS: %.1f, Heap: %.0f bytes, CPU: %.1f%%\n",
                     getAverageFPS(),
                     getAverageHeapFree(),
                     getAverageCPUUsage());
    }

private:
    float calculateCPUUsage() {
        // Simple heuristic: measure loop time
        static unsigned long lastLoop = millis();
        unsigned long now = millis();
        unsigned long loopTime = now - lastLoop;
        lastLoop = now;

        // If loop takes 10ms, CPU usage is higher
        return std::min(100.0f, (loopTime / 10.0f) * 100.0f);
    }

    float getAverageCPUUsage() const {
        float sum = 0;
        for (int i = 0; i < MAX_FRAMES; ++i) {
            sum += frames[i].cpu_usage_percent;
        }
        return sum / MAX_FRAMES;
    }
};
```

**Usage:**

```cpp
PerformanceMonitor perfMon;

void loop() {
    // ... main loop code ...

    perfMon.recordFrame();

    static unsigned long lastPrintTime = 0;
    if (millis() - lastPrintTime > 5000) {
        perfMon.printStats();
        lastPrintTime = millis();
    }

    delay(10);
}
```

---

## Library Comparison Matrix (Detailed)

### HTTP Clients

| Feature | HTTPClient | AsyncHTTPRequest_Generic | esp_http_client |
|---------|-----------|--------------------------|-----------------|
| Non-blocking | No | Yes | No |
| GET/POST/PUT | Yes | Yes | Yes |
| HTTPS | Yes | Yes (AsyncHTTPSRequest_Generic) | Yes |
| Concurrent requests | No | Yes (via callbacks) | No |
| Memory per request | 2-5 KB | 3-8 KB | 4-10 KB |
| Connection pooling | No | Yes (auto) | No |
| Code size | 20 KB | 40 KB | 50 KB |
| Learning curve | Easy | Moderate | Hard |
| **Recommended** | Simple apps | **Controllers** | Low-level |

### JSON Libraries

| Feature | ArduinoJson | nlohmann/json | cJSON |
|---------|------------|--------------|-------|
| RAM efficiency | ++ | + | + |
| Streaming parse | Yes | No | Yes |
| Static document | Yes | No | No |
| Flash size | 40 KB | 100 KB | 60 KB |
| Embedded-friendly | Yes | No | Yes |
| C++ API | Moderate | Excellent | N/A (C) |
| **Recommended** | **Tab5** | Desktop | Minimal |

### Graphics Libraries

| Feature | M5GFX | LVGL | Arduino GFX |
|---------|-------|------|-----------|
| Widgets | 3 | 30+ | 0 |
| Touch support | Basic | Full | No |
| Animations | No | Yes | No |
| Code size | 50 KB | 200 KB | 30 KB |
| FPS (simple) | 50-60 | 20-30 | 50+ |
| **Best for** | Status | **Dashboard** | Minimal |

---

## Common Build Issues & Solutions

### Issue: "Compilation hangs or takes >60s"

**Solution:** Enable parallel compilation in platformio.ini:
```ini
build_flags = -j4  ; Use 4 parallel jobs
```

### Issue: "LVGL: Memory exhausted"

**Solution:** Reduce LVGL buffer size or use PSRAM:
```cpp
#define LV_BUFFER_SIZE (320 * 360 / 4)  // Half resolution buffer
// OR use PSRAM buffer
#define LV_USE_MALLOC_LVGL 1
#define LV_ENABLE_GC 1
```

### Issue: "AsyncHTTPRequest: No response / timeout"

**Solution:** Ensure WiFi is connected before request:
```cpp
if (WiFi.status() == WL_CONNECTED) {
    request.open("GET", "http://k1.local:8080/api/status");
    request.send();
}
```

### Issue: "OTA fails after update"

**Solution:** Always include ArduinoOTA in every build:
```cpp
void setup() {
    // ... other setup ...
    ArduinoOTA.begin();
}

void loop() {
    ArduinoOTA.handle();  // MUST be here
    // ... rest of loop ...
}
```

---

## Performance Tuning Checklist

- [ ] Enable PSRAM: `#define BOARD_HAS_PSRAM 1`
- [ ] Set CPU frequency: 240 MHz (default; good balance)
- [ ] Enable DMA for SPI: M5GFX config
- [ ] Reduce LVGL refresh rate in idle: `lv_disp_set_refr_period(100)`
- [ ] Use connection pooling for HTTP
- [ ] Minimize JSON document size (use StaticJsonDocument)
- [ ] Profile heap usage with PerformanceMonitor
- [ ] Disable debug logs in production: `#define CORE_DEBUG_LEVEL 0`
- [ ] Test WiFi power consumption (modem sleep disabled by default)

---

## Deployment Checklist

- [ ] Test OTA update on hardware
- [ ] Verify WiFi auto-reconnect after network loss
- [ ] Test touch responsiveness with LVGL UI
- [ ] Confirm HTTP request latency < 100ms to K1
- [ ] Verify display brightness levels and responsiveness
- [ ] Test credential provisioning (AP mode)
- [ ] Monitor heap usage over 1 hour runtime
- [ ] Test mDNS discovery of K1 device
- [ ] Validate all UI elements render without flicker
- [ ] Document API contract with K1

