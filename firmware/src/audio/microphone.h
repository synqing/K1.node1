// -----------------------------------------------------------------------------------------
//              _                                 _                                  _
//             (_)                               | |                                | |
//  _ __ ___    _    ___   _ __    ___    _ __   | |__     ___    _ __     ___      | |__
// | '_ ` _ \  | |  / __| | '__|  / _ \  | '_ \  | '_ \   / _ \  | '_ \   / _ \     | '_ \ 
// | | | | | | | | | (__  | |    | (_) | | |_) | | | | | | (_) | | | | | |  __/  _  | | | |
// |_| |_| |_| |_|  \___| |_|     \___/  | .__/  |_| |_|  \___/  |_| |_|  \___| (_) |_| |_|
//                                       | |
//                                       |_|
//
// Functions for reading and storing data acquired by the I2S microphone

// Prefer ESP-IDF v5 I2S std header; fall back to lightweight editor-only stubs
#if __has_include(<driver/i2s_std.h>)
#  include <driver/i2s_std.h>
#  include <driver/gpio.h>
#else
#  include <stddef.h>
#  include <stdint.h>
#  include <stdbool.h>
   typedef int esp_err_t;
#  ifndef ESP_OK
#    define ESP_OK 0
#  endif
   typedef int gpio_num_t;

   typedef void* i2s_chan_handle_t;

   typedef enum { I2S_ROLE_MASTER = 0 } i2s_role_t;
   typedef struct {
       int id;
       i2s_role_t role;
   } i2s_chan_config_t;

#  ifndef I2S_NUM_AUTO
#    define I2S_NUM_AUTO (-1)
#  endif
#  define I2S_CHANNEL_DEFAULT_CONFIG(num, role) ((i2s_chan_config_t){ .id = (int)(num), .role = (role) })

   typedef enum { I2S_DATA_BIT_WIDTH_32BIT = 32 } i2s_data_bit_width_t;
   typedef enum { I2S_SLOT_BIT_WIDTH_32BIT = 32 } i2s_slot_bit_width_t;
   typedef enum { I2S_SLOT_MODE_STEREO = 2 } i2s_slot_mode_t;

#  ifndef I2S_STD_SLOT_RIGHT
#    define I2S_STD_SLOT_RIGHT (1u << 1)
#  endif
#  ifndef I2S_GPIO_UNUSED
#    define I2S_GPIO_UNUSED ((gpio_num_t)-1)
#  endif

   typedef struct {
       uint32_t sample_rate_hz;
   } i2s_std_clk_config_t;
#  define I2S_STD_CLK_DEFAULT_CONFIG(sr) ((i2s_std_clk_config_t){ .sample_rate_hz = (sr) })

   typedef struct {
       i2s_data_bit_width_t data_bit_width;
       i2s_slot_bit_width_t slot_bit_width;
       i2s_slot_mode_t      slot_mode;
       uint32_t             slot_mask;
       uint32_t             ws_width;
       bool                 ws_pol;
       bool                 bit_shift;
       bool                 left_align;
       bool                 big_endian;
       bool                 bit_order_lsb;
   } i2s_std_slot_config_t;

   typedef struct {
       int        mclk;
       gpio_num_t bclk;
       gpio_num_t ws;
       int        dout;
       gpio_num_t din;
       struct { bool mclk_inv; bool bclk_inv; bool ws_inv; } invert_flags;
   } i2s_std_gpio_config_t;

   typedef struct {
       i2s_std_clk_config_t  clk_cfg;
       i2s_std_slot_config_t slot_cfg;
       i2s_std_gpio_config_t gpio_cfg;
   } i2s_std_config_t;

   // Minimal prototypes for editor indexing
   esp_err_t i2s_new_channel(const i2s_chan_config_t* cfg, i2s_chan_handle_t* tx_handle, i2s_chan_handle_t* rx_handle);
   esp_err_t i2s_channel_init_std_mode(i2s_chan_handle_t handle, const i2s_std_config_t* std_cfg);
   esp_err_t i2s_channel_enable(i2s_chan_handle_t handle);
   esp_err_t i2s_channel_read(i2s_chan_handle_t handle, void* data, size_t size, size_t* bytes_read, uint32_t timeout_ticks);

#  ifndef portMAX_DELAY
#    define portMAX_DELAY 0xFFFFFFFFu
#  endif
#endif

#include "../logging/logger.h"
#include <string.h>

// Define I2S pins for SPH0645 microphone (standard I2S, NOT PDM)
#define I2S_BCLK_PIN  14  // BCLK (Bit Clock)
#define I2S_LRCLK_PIN 12  // LRCLK (Left/Right Clock / Word Select) - CRITICAL!
#define I2S_DIN_PIN   13  // DIN (Data In / DOUT from microphone)

// ============================================================================
// AUDIO CONFIGURATION: 16kHz, 128-chunk (8ms cadence)
// ============================================================================
// Chunk duration: 128 samples / 16000 Hz = 8ms
// This aligns with ring buffer and Goertzel FFT processing cadence
#define CHUNK_SIZE 128
#define SAMPLE_RATE 16000

#define SAMPLE_HISTORY_LENGTH 4096

// NOTE: sample_history is declared in goertzel.h - don't duplicate
// float sample_history[SAMPLE_HISTORY_LENGTH];
constexpr float recip_scale = 1.0 / 131072.0; // max 18 bit signed value

// Synchronization flags for microphone I2S ISR coordination
// Uses acquire/release ordering for ISR synchronization
#include <atomic>

// Globals (defined in microphone.cpp)
extern std::atomic<bool> waveform_locked;
extern std::atomic<bool> waveform_sync_flag;
extern i2s_chan_handle_t rx_handle;

// Public API
void init_i2s_microphone();
void acquire_sample_chunk();
