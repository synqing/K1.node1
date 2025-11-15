---
Title: Tab5 LVGL Implementation Guide - Quick Reference
Owner: K1 Development Team
Date: 2025-11-05
Status: published
Scope: Quick-start guide and code patterns for Tab5 LVGL UI development
Related:
  - docs/06-reference/tab5_lvgl_component_specifications.md
Tags: Tab5, LVGL, Implementation, C++, Quick Reference
---

# Tab5 LVGL Implementation Guide - Quick Reference

**Purpose:** Fast reference for common LVGL patterns used in Tab5 UI
**Format:** Copy-paste code snippets organized by component type
**Device:** M5Stack Tab5 (ESP32-P4, 1280×720 IPS display)

---

## 1. PROJECT SETUP

### 1.1 LVGL Configuration (lv_conf.h)

```cpp
// Minimal Tab5-specific configuration

#define LV_HOR_RES_MAX          1280
#define LV_VER_RES_MAX          720

#define LV_COLOR_DEPTH          32  // 32-bit RGBA
#define LV_USE_GPU              0   // No GPU acceleration on Tab5

#define LV_MEM_SIZE             (512 * 1024)  // 512 KB for LVGL internal buffers

// Enable required widgets
#define LV_USE_SLIDER           1
#define LV_USE_SWITCH           1
#define LV_USE_BTN              1
#define LV_USE_LABEL            1
#define LV_USE_TABVIEW          0   // Not needed for MVP
#define LV_USE_CHART            0   // Optional for performance graphs
#define LV_USE_METER            1   // For status gauges

// Font configuration
#define LV_FONT_DEFAULT         &lv_font_montserrat_14
#define LV_FONT_MONTSERRAT_14   1
#define LV_FONT_MONTSERRAT_12   1
#define LV_FONT_MONTSERRAT_11   1
#define LV_FONT_MONTSERRAT_16   1
#define LV_FONT_MONTSERRAT_20   1
#define LV_FONT_MONTSERRAT_28   1
#define LV_FONT_MONTSERRAT_36   1

// Animations
#define LV_USE_ANIM             1
#define LV_ANIM_SPEED_DEF       200  // Default animation speed (ms)

// Scrolling
#define LV_USE_SCROLL           1
#define LV_SCROLL_SNAP_ALIGN    1

// Input devices
#define LV_USE_TOUCHPAD         1
#define LV_INDEV_DEF_READ_PERIOD 30  // 30ms read interval
```

### 1.2 Display Driver Setup

```cpp
// In your main.cpp or display initialization file

#include "lvgl.h"
#include "esp_lcd_mipi_dsi.h"

// Display buffer (stored in PSRAM)
static uint8_t *disp_buf1 = NULL;
static uint8_t *disp_buf2 = NULL;

void display_init(void) {
    // Allocate display buffers in PSRAM (important: Tab5 has 32 MB PSRAM)
    disp_buf1 = (uint8_t *)heap_caps_malloc(1280 * 720 * sizeof(lv_color_t), MALLOC_CAP_SPIRAM);
    disp_buf2 = (uint8_t *)heap_caps_malloc(1280 * 720 * sizeof(lv_color_t), MALLOC_CAP_SPIRAM);

    if (!disp_buf1 || !disp_buf2) {
        ESP_LOGE("DISPLAY", "Failed to allocate display buffers");
        return;
    }

    // Initialize LVGL
    lv_init();

    // Create display driver
    static lv_disp_drv_t disp_drv;
    lv_disp_drv_init(&disp_drv);
    disp_drv.hor_res = 1280;
    disp_drv.ver_res = 720;
    disp_drv.flush_cb = flush_cb;  // Your display flush callback
    disp_drv.draw_buf = lv_mem_alloc(sizeof(lv_disp_draw_buf_t));

    lv_disp_draw_buf_t *draw_buf = (lv_disp_draw_buf_t *)disp_drv.draw_buf;
    lv_disp_draw_buf_init(draw_buf, disp_buf1, disp_buf2, 1280 * 720);

    lv_disp_drv_register(&disp_drv);
}

// Your display flush callback (sends pixels to LCD)
void flush_cb(lv_disp_drv_t *drv, const lv_area_t *area, lv_color_t *color_map) {
    // Implement DSI/display write here
    // This depends on your specific LCD driver

    // Call when done
    lv_disp_flush_ready(drv);
}
```

### 1.3 Touch Input Setup

```cpp
// Initialize GT911 touchscreen controller

#include "esp_lcd_touch_gt911.h"

static esp_lcd_touch_handle_t tp = NULL;

void touchpad_init(void) {
    // Configure I2C (GT911 is on I2C bus 0)
    i2c_master_bus_config_t i2c_conf = {
        .clk_source = I2C_CLK_SRC_DEFAULT,
        .i2c_port = I2C_NUM_0,
        .scl_io_num = GPIO_NUM_18,  // Adjust to your pinout
        .sda_io_num = GPIO_NUM_8,
        .glitch_ignore_cnt = 7,
    };
    i2c_master_bus_handle_t bus_handle;
    ESP_ERROR_CHECK(i2c_new_master_bus(&i2c_conf, &bus_handle));

    // GT911 touch controller
    esp_lcd_touch_config_t touch_config = {
        .x_max = 1280,
        .y_max = 720,
        .rst_gpio_num = GPIO_NUM_46,  // Reset pin
        .int_gpio_num = GPIO_NUM_3,   // Interrupt pin
        .levels = {
            .reset = 0,
            .interrupt = 0,
        },
        .flags = {
            .swap_xy = false,
            .mirror_x = false,
            .mirror_y = false,
        },
    };

    ESP_ERROR_CHECK(esp_lcd_touch_new_i2c_gt911(bus_handle, &touch_config, &tp));
}

// Register with LVGL
void register_touch_input(void) {
    static lv_indev_drv_t indev_drv;
    lv_indev_drv_init(&indev_drv);
    indev_drv.type = LV_INDEV_TYPE_POINTER;
    indev_drv.read_cb = touchpad_read;
    lv_indev_drv_register(&indev_drv);
}

static void touchpad_read(lv_indev_drv_t *drv, lv_indev_data_t *data) {
    uint16_t x, y;
    uint8_t pressed;

    if (esp_lcd_touch_read_data(tp) == ESP_OK &&
        esp_lcd_touch_get_coordinates(tp, &x, &y, &pressed, 1) == ESP_OK) {
        if (pressed) {
            data->point.x = x;
            data->point.y = y;
            data->state = LV_INDEV_STATE_PRESSED;
        } else {
            data->state = LV_INDEV_STATE_RELEASED;
        }
    }
}
```

---

## 2. COMMON COMPONENT PATTERNS

### 2.1 Create a Simple Slider

```cpp
// Quick slider creation (brightness example)

lv_obj_t *create_brightness_slider(lv_obj_t *parent) {
    // Container
    lv_obj_t *container = lv_obj_create(parent);
    lv_obj_set_size(container, 380, 60);
    lv_obj_set_style_bg_opa(container, 0, 0);
    lv_obj_set_style_border_width(container, 0, 0);

    // Label
    lv_obj_t *label = lv_label_create(container);
    lv_label_set_text(label, "Brightness");
    lv_obj_set_style_text_color(label, lv_color_hex(0xe6e9ef), 0);

    // Value display
    lv_obj_t *value = lv_label_create(container);
    lv_label_set_text(value, "50%");
    lv_obj_set_style_text_color(value, lv_color_hex(0x14b8a6), 0);
    lv_obj_set_width(value, 50);
    lv_obj_set_align(value, LV_ALIGN_TOP_RIGHT);

    // Slider
    lv_obj_t *slider = lv_slider_create(container);
    lv_obj_set_width(slider, 380);
    lv_slider_set_range(slider, 0, 100);
    lv_slider_set_value(slider, 50, LV_ANIM_OFF);

    // Style
    lv_obj_set_style_bg_color(slider, lv_color_hex(0x2f3849), LV_PART_MAIN);
    lv_obj_set_style_bg_color(slider, lv_color_hex(0x14b8a6), LV_PART_INDICATOR);
    lv_obj_set_style_bg_color(slider, lv_color_hex(0x14b8a6), LV_PART_KNOB);
    lv_obj_set_style_border_color(slider, lv_color_hex(0xffffff), LV_PART_KNOB);
    lv_obj_set_style_border_width(slider, 2, LV_PART_KNOB);
    lv_obj_set_style_radius(slider, 10, LV_PART_MAIN);
    lv_obj_set_style_radius(slider, LV_RADIUS_CIRCLE, LV_PART_KNOB);

    // Store references
    slider_brightness = slider;
    value_brightness = value;

    return container;
}
```

### 2.2 Create a Button

```cpp
// Quick button creation (primary: gold accent)

lv_obj_t *create_primary_button(lv_obj_t *parent, const char *text) {
    lv_obj_t *btn = lv_btn_create(parent);
    lv_obj_set_size(btn, 150, 150);
    lv_obj_set_style_bg_color(btn, lv_color_hex(0xffb84d), 0);  // Gold
    lv_obj_set_style_bg_opa(btn, 255, 0);
    lv_obj_set_style_border_width(btn, 0, 0);
    lv_obj_set_style_radius(btn, 12, 0);
    lv_obj_set_style_shadow_width(btn, 8, 0);
    lv_obj_set_style_shadow_color(btn, lv_color_hex(0x000000), 0);
    lv_obj_set_style_shadow_opa(btn, 100, 0);

    // Style: pressed state (darker gold)
    lv_obj_set_style_bg_color(btn, lv_color_hex(0xf59e0b), LV_STATE_PRESSED);
    lv_obj_set_style_transform_scale(btn, 950, LV_STATE_PRESSED);

    // Label
    lv_obj_t *label = lv_label_create(btn);
    lv_label_set_text(label, text);
    lv_obj_set_style_text_color(label, lv_color_hex(0x1c2130), 0);  // Dark text on gold
    lv_obj_set_style_text_font(label, &lv_font_montserrat_14, 0);
    lv_obj_center(label);

    return btn;
}

// Secondary button (teal accent)
lv_obj_t *create_secondary_button(lv_obj_t *parent, const char *text) {
    lv_obj_t *btn = lv_btn_create(parent);
    lv_obj_set_size(btn, 120, 50);
    lv_obj_set_style_bg_color(btn, lv_color_hex(0x14b8a6), 0);  // Teal
    lv_obj_set_style_border_width(btn, 2, 0);
    lv_obj_set_style_border_color(btn, lv_color_hex(0x0f766e), 0);
    lv_obj_set_style_radius(btn, 8, 0);

    lv_obj_set_style_bg_color(btn, lv_color_hex(0x0d9488), LV_STATE_PRESSED);
    lv_obj_set_style_transform_scale(btn, 950, LV_STATE_PRESSED);

    lv_obj_t *label = lv_label_create(btn);
    lv_label_set_text(label, text);
    lv_obj_set_style_text_color(label, lv_color_hex(0xffffff), 0);
    lv_obj_center(label);

    return btn;
}
```

### 2.3 Create a Label

```cpp
// Quick label creation

lv_obj_t *create_label_primary(lv_obj_t *parent, const char *text) {
    lv_obj_t *label = lv_label_create(parent);
    lv_label_set_text(label, text);
    lv_obj_set_style_text_color(label, lv_color_hex(0xe6e9ef), 0);
    lv_obj_set_style_text_font(label, &lv_font_montserrat_14, 0);
    return label;
}

lv_obj_t *create_label_secondary(lv_obj_t *parent, const char *text) {
    lv_obj_t *label = lv_label_create(parent);
    lv_label_set_text(label, text);
    lv_obj_set_style_text_color(label, lv_color_hex(0x9ca3af), 0);
    lv_obj_set_style_text_font(label, &lv_font_montserrat_12, 0);
    return label;
}

lv_obj_t *create_label_large(lv_obj_t *parent, const char *text) {
    lv_obj_t *label = lv_label_create(parent);
    lv_label_set_text(label, text);
    lv_obj_set_style_text_color(label, lv_color_hex(0xe6e9ef), 0);
    lv_obj_set_style_text_font(label, &lv_font_montserrat_bold_36, 0);
    lv_obj_set_style_text_align(label, LV_TEXT_ALIGN_CENTER, 0);
    return label;
}
```

### 2.4 Create a Toggle Switch

```cpp
// Quick toggle creation

lv_obj_t *create_toggle_switch(lv_obj_t *parent, const char *label_text) {
    lv_obj_t *container = lv_obj_create(parent);
    lv_obj_set_layout(container, LV_LAYOUT_COLUMN);
    lv_obj_set_style_bg_opa(container, 0, 0);
    lv_obj_set_style_border_width(container, 0, 0);

    // Toggle switch
    lv_obj_t *toggle = lv_switch_create(container);
    lv_obj_set_size(toggle, 80, 40);
    lv_obj_set_style_bg_color(toggle, lv_color_hex(0x2f3849), LV_PART_MAIN);
    lv_obj_set_style_bg_color(toggle, lv_color_hex(0x14b8a6), LV_PART_KNOB);
    lv_obj_set_style_radius(toggle, 20, 0);
    lv_obj_set_style_border_width(toggle, 2, LV_PART_MAIN);
    lv_obj_set_style_border_color(toggle, lv_color_hex(0x4b5563), LV_PART_MAIN);

    // Label
    lv_obj_t *label = lv_label_create(container);
    lv_label_set_text(label, label_text);
    lv_obj_set_style_text_color(label, lv_color_hex(0xe6e9ef), 0);

    return toggle;
}
```

---

## 3. NETWORK REQUEST PATTERNS

### 3.1 Simple HTTP GET with Callback

```cpp
// Using ESP32 HTTP client library

#include "esp_http_client.h"

typedef void (*http_callback_t)(int status, const char *response);

static http_callback_t current_callback = NULL;
static char http_response_buffer[2048];

static esp_err_t http_event_handler(esp_http_client_event_t *evt) {
    switch (evt->event_id) {
        case HTTP_EVENT_ON_DATA:
            if (evt->user_data) {
                strncat((char *)evt->user_data, (char *)evt->data, evt->data_len);
            }
            break;
        case HTTP_EVENT_ON_FINISH:
            if (current_callback) {
                int status = esp_http_client_get_status_code(evt->client);
                current_callback(status, http_response_buffer);
                current_callback = NULL;
            }
            break;
        case HTTP_EVENT_ERROR:
            if (current_callback) {
                current_callback(0, NULL);  // 0 = error
                current_callback = NULL;
            }
            break;
        default:
            break;
    }
    return ESP_OK;
}

void http_get(const char *url, http_callback_t callback) {
    current_callback = callback;
    memset(http_response_buffer, 0, sizeof(http_response_buffer));

    esp_http_client_config_t config = {
        .url = url,
        .event_handler = http_event_handler,
        .user_data = http_response_buffer,
        .timeout_ms = 5000,
    };

    esp_http_client_handle_t client = esp_http_client_init(&config);
    esp_http_client_perform(client);
    esp_http_client_cleanup(client);
}
```

### 3.2 HTTP POST with JSON Body

```cpp
void http_post_json(const char *url, const char *json_body, http_callback_t callback) {
    current_callback = callback;
    memset(http_response_buffer, 0, sizeof(http_response_buffer));

    esp_http_client_config_t config = {
        .url = url,
        .method = HTTP_METHOD_POST,
        .event_handler = http_event_handler,
        .user_data = http_response_buffer,
        .timeout_ms = 5000,
    };

    esp_http_client_handle_t client = esp_http_client_init(&config);
    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_post_field(client, json_body, strlen(json_body));
    esp_http_client_perform(client);
    esp_http_client_cleanup(client);
}

// Example usage
void send_brightness_update(float brightness) {
    char json[64];
    snprintf(json, sizeof(json), "{\"brightness\": %.2f}", brightness);
    http_post_json("http://192.168.1.100/api/params", json, params_update_cb);
}

static void params_update_cb(int status, const char *response) {
    if (status == 200) {
        // Success
        show_sync_complete();
    } else if (status == 429) {
        // Rate limited
        show_toast("Too many requests. Waiting...", TOAST_WARNING);
    } else {
        // Error
        show_toast("Failed to update parameter", TOAST_ERROR);
    }
}
```

---

## 4. STATE MANAGEMENT PATTERNS

### 4.1 Global State Structure

```cpp
// Define in header file

typedef struct {
    // Connection state
    bool is_connected;
    uint32_t last_sync_time;

    // Current values (from K1)
    float brightness;
    float speed;
    float color;
    float saturation;
    float warmth;

    // Audio state
    bool audio_enabled;
    float mic_gain;

    // Performance metrics
    int fps;
    float cpu_percent;
    float memory_percent;
    int wifi_rssi;
    int battery_percent;
} app_state_t;

static app_state_t app_state = {
    .is_connected = false,
    .brightness = 0.5f,
    .speed = 0.5f,
    .color = 0.5f,
    .fps = 0,
    .wifi_rssi = -100,
};

// Getter/setter functions
void set_brightness(float value) {
    app_state.brightness = CLAMP(value, 0.0f, 1.0f);
    update_brightness_slider_ui();
}

float get_brightness(void) {
    return app_state.brightness;
}
```

### 4.2 Debounce Timer Management

```cpp
// Debounce configuration per slider

typedef struct {
    lv_timer_t *timer;
    float pending_value;
    bool has_pending;
} debounce_state_t;

static debounce_state_t brightness_debounce = {0};
static debounce_state_t speed_debounce = {0};
static debounce_state_t color_debounce = {0};

void queue_debounced_update(debounce_state_t *state, float value,
                            lv_timer_cb_t callback, uint32_t delay_ms) {
    state->pending_value = value;
    state->has_pending = true;

    if (state->timer) {
        lv_timer_reset(state->timer);  // Reset existing timer
    } else {
        state->timer = lv_timer_create(callback, delay_ms, state);
        lv_timer_set_repeat_count(state->timer, 1);  // One-shot
    }
}

// Usage in slider event
static void slider_brightness_event_cb(lv_event_t *e) {
    if (lv_event_get_code(e) == LV_EVENT_VALUE_CHANGED) {
        lv_obj_t *slider = lv_event_get_target(e);
        int value = lv_slider_get_value(slider);
        float normalized = value / 100.0f;

        // Update UI immediately
        lv_label_set_text_fmt(value_brightness, "%d%%", value);

        // Queue network update (debounced)
        queue_debounced_update(&brightness_debounce, normalized,
                              brightness_debounce_cb, 100);
    }
}

static void brightness_debounce_cb(lv_timer_t *timer) {
    debounce_state_t *state = (debounce_state_t *)lv_timer_get_user_data(timer);

    if (state->has_pending) {
        state->has_pending = false;
        send_brightness_update(state->pending_value);
    }

    state->timer = NULL;
}
```

---

## 5. QUICK REFERENCE: COLOR CODES

```cpp
// PRISM color tokens (as hex codes)

#define COLOR_BG_CANVAS      0x252d3f
#define COLOR_BG_ELEVATED    0x2f3849
#define COLOR_BG_HIGHLIGHT   0x3a4457
#define COLOR_TEXT_PRIMARY   0xe6e9ef
#define COLOR_TEXT_SECONDARY 0x9ca3af
#define COLOR_BORDER         0x4b5563
#define COLOR_ACCENT         0x14b8a6  // Teal
#define COLOR_SUCCESS        0x10b981  // Green
#define COLOR_WARNING        0xf59e0b  // Amber
#define COLOR_ERROR          0xef4444  // Red
#define COLOR_GOLD           0xffb84d  // Gold (primary action)

// Quick color-set macro
#define APPLY_COLOR(obj, color) \
    lv_obj_set_style_bg_color(obj, lv_color_hex(color), 0)

#define APPLY_TEXT_COLOR(obj, color) \
    lv_obj_set_style_text_color(obj, lv_color_hex(color), 0)
```

---

## 6. DEBUGGING TIPS

### 6.1 Enable LVGL Logging

```cpp
// In lv_conf.h
#define LV_USE_LOG 1
#define LV_LOG_LEVEL LV_LOG_LEVEL_DEBUG

// In your code
#define MY_LOG_TAG "TAB5_UI"

void my_log_handler(const char *msg) {
    ESP_LOGI(MY_LOG_TAG, "%s", msg);
}

// Call during init
lv_log_register_print_cb(my_log_handler);
```

### 6.2 Memory Profiling

```cpp
void print_memory_stats(void) {
    multi_heap_info_t info;
    heap_caps_get_info(&info, MALLOC_CAP_SPIRAM);

    ESP_LOGI("MEM", "SPIRAM Free: %d bytes, Total: %d bytes",
             info.total_free_bytes, info.total_allocated_bytes);

    size_t lvgl_used = lv_mem_get_size() - lv_mem_get_free_size();
    ESP_LOGI("MEM", "LVGL Used: %d bytes", lvgl_used);
}
```

### 6.3 Frame Rate Monitoring

```cpp
static uint32_t frame_count = 0;
static uint32_t last_fps_time = 0;

void update_fps_display(void) {
    uint32_t now = lv_tick_get();
    frame_count++;

    if (now - last_fps_time >= 1000) {  // Every 1 second
        int fps = frame_count;
        frame_count = 0;
        last_fps_time = now;

        // Update UI
        lv_label_set_text_fmt(status_fps_value, "%d FPS", fps);

        // Log
        ESP_LOGI("FPS", "Current: %d", fps);
    }
}

// Call in your display refresh loop
// e.g., in app_main() or FreeRTOS task
```

---

## 7. TROUBLESHOOTING COMMON ISSUES

### Issue: Slider not responding to touch

**Solution:**
```cpp
// Ensure slider has proper size
lv_obj_set_width(slider, 300);  // Minimum width
lv_obj_set_height(slider, 50);

// Ensure touch is configured and GT911 working
// Check I2C pins are correct in touchpad_init()
// Verify INT and RST pins connected
```

### Issue: Text not visible (white on white or too small)

**Solution:**
```cpp
// Check text color
lv_obj_set_style_text_color(label, lv_color_hex(0xe6e9ef), 0);  // Light gray

// Check font size
lv_obj_set_style_text_font(label, &lv_font_montserrat_14, 0);  // At least 12px

// Check background contrast
lv_obj_set_style_bg_color(label, lv_color_hex(0x252d3f), 0);  // Dark background
```

### Issue: Network request timeout

**Solution:**
```cpp
// Increase timeout
esp_http_client_config_t config = {
    .timeout_ms = 10000,  // 10 seconds instead of 5
};

// Add retry logic
int max_retries = 3;
for (int i = 0; i < max_retries; i++) {
    int status = perform_request();
    if (status == 200) break;
    vTaskDelay(pdMS_TO_TICKS(1000 * (i + 1)));  // Exponential backoff
}
```

### Issue: Memory leak (heap grows over time)

**Solution:**
```cpp
// Ensure cleanup in callbacks
static void http_event_handler(esp_http_client_event_t *evt) {
    // ...
    case HTTP_EVENT_ON_FINISH:
        // ALWAYS clean up
        esp_http_client_cleanup(evt->client);
        break;
}

// Check LVGL object creation/deletion
// Every lv_obj_create() needs matching lv_obj_del()
// Check timer creation/deletion
// Every lv_timer_create() needs matching lv_timer_del()
```

---

## 8. PERFORMANCE TARGETS

| Metric | Target | How to Measure |
|---|---|---|
| Idle FPS | 60 | Enable FPS monitor (Section 6.3) |
| Idle CPU | <10% | Use `top` or ESP-IDF profiler |
| Idle RAM | <50 MB | Use memory profiler (Section 6.2) |
| Startup Time | <3 seconds | Measure from boot to first render |
| Slider Response | <16ms | Visual feedback on drag |
| Network Latency | <500ms | HTTP roundtrip time |
| Debounce Delay | 100ms | Prevent rate limiting |

---

## 9. CODE GENERATION SHORTCUTS

### Quick Screen Setup

```cpp
void create_main_screen(void) {
    // Create main screen container
    lv_obj_t *scr = lv_scr_act();
    lv_obj_set_style_bg_color(scr, lv_color_hex(COLOR_BG_CANVAS), 0);

    // Create header
    lv_obj_t *header = lv_obj_create(scr);
    lv_obj_set_size(header, 1280, 60);
    lv_obj_set_pos(header, 0, 0);
    lv_obj_set_style_bg_color(header, lv_color_hex(COLOR_BG_ELEVATED), 0);
    lv_obj_set_layout(header, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(header, LV_FLEX_FLOW_ROW);

    // Add status items to header
    create_status_item_wifi(header);
    create_status_item_battery(header);
    create_status_item_fps(header);

    // Create main content area
    lv_obj_t *content = lv_obj_create(scr);
    lv_obj_set_size(content, 1280, 660);  // 1280 - 60px header
    lv_obj_set_pos(content, 0, 60);
    lv_obj_set_style_bg_opa(content, 0, 0);  // Transparent
    lv_obj_set_layout(content, LV_LAYOUT_GRID);

    // Grid setup (for multi-column layout)
    static lv_coord_t col_dsc[] = {400, 250, 600, LV_GRID_TEMPLATE_LAST};
    static lv_coord_t row_dsc[] = {600, LV_GRID_TEMPLATE_LAST};
    lv_obj_set_grid_dsc_array(content, col_dsc, row_dsc);

    // Add controls to each grid cell
    // ...
}
```

---

## 10. NEXT STEPS

1. **Read the full specification:** `docs/06-reference/tab5_lvgl_component_specifications.md`
2. **Set up your project:** Follow Section 1 (Project Setup)
3. **Implement Phase 1:** Header + sliders (weeks 1-2)
4. **Test on device:** Use Section 6 (Debugging) to validate
5. **Iterate:** Refine based on testing, then move to Phase 2

---

**Last Updated:** 2025-11-05
**Quick Reference Version:** 1.0
