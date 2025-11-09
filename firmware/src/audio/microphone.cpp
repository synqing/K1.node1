#include "microphone.h"
#include "goertzel.h"
#include "../parameters.h"

#include <atomic>
#include <cstring>
#include <cmath>

// Synchronization flags for microphone I2S ISR coordination
std::atomic<bool> waveform_locked{false};
std::atomic<bool> waveform_sync_flag{false};

#if MICROPHONE_USE_NEW_I2S

// I2S RX channel handle (new ESP-IDF v5 API)
i2s_chan_handle_t rx_handle = nullptr;

void init_i2s_microphone() {
    i2s_chan_config_t chan_cfg = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_AUTO, I2S_ROLE_MASTER);
    ESP_ERROR_CHECK(i2s_new_channel(&chan_cfg, NULL, &rx_handle));

    i2s_std_config_t std_cfg = {
        .clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(SAMPLE_RATE),
        .slot_cfg = {
            .data_bit_width = I2S_DATA_BIT_WIDTH_32BIT,
            .slot_bit_width = I2S_SLOT_BIT_WIDTH_32BIT,
            .slot_mode = I2S_SLOT_MODE_STEREO,
            .slot_mask = I2S_STD_SLOT_RIGHT,   // SEL tied low
            .ws_width = 32,
            .ws_pol = true,
            .bit_shift = false,
            .left_align = true,
            .big_endian = false,
            .bit_order_lsb = false,
        },
        .gpio_cfg = {
            .mclk = I2S_GPIO_UNUSED,
            .bclk = (gpio_num_t)I2S_BCLK_PIN,
            .ws   = (gpio_num_t)I2S_LRCLK_PIN,
            .dout = I2S_GPIO_UNUSED,
            .din  = (gpio_num_t)I2S_DIN_PIN,
            .invert_flags = {
                .mclk_inv = false,
                .bclk_inv = false,
                .ws_inv   = false,
            },
        },
    };

    ESP_ERROR_CHECK(i2s_channel_init_std_mode(rx_handle, &std_cfg));
    ESP_ERROR_CHECK(i2s_channel_enable(rx_handle));
}

#else  // MICROPHONE_USE_NEW_I2S

static constexpr i2s_port_t I2S_PORT = I2S_NUM_0;

void init_i2s_microphone() {
    i2s_config_t i2s_config = {};
    i2s_config.mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX);
    i2s_config.sample_rate = SAMPLE_RATE;
    i2s_config.bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT;
    i2s_config.channel_format = I2S_CHANNEL_FMT_ONLY_RIGHT;
    #ifdef I2S_COMM_FORMAT_STAND_I2S
    i2s_config.communication_format = I2S_COMM_FORMAT_STAND_I2S;
    #else
    i2s_config.communication_format = (i2s_comm_format_t)(I2S_COMM_FORMAT_I2S | I2S_COMM_FORMAT_I2S_MSB);
    #endif
    i2s_config.intr_alloc_flags = ESP_INTR_FLAG_LEVEL1;
    i2s_config.dma_buf_count = 8;
    i2s_config.dma_buf_len = CHUNK_SIZE;
    i2s_config.use_apll = false;
    i2s_config.tx_desc_auto_clear = false;
    i2s_config.fixed_mclk = 0;
#ifdef I2S_MCLK_MULTIPLE_DEFAULT
    i2s_config.mclk_multiple = I2S_MCLK_MULTIPLE_DEFAULT;
#endif

    ESP_ERROR_CHECK(i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL));

    i2s_pin_config_t pin_cfg = {};
    pin_cfg.bck_io_num = I2S_BCLK_PIN;
    pin_cfg.ws_io_num = I2S_LRCLK_PIN;
    pin_cfg.data_out_num = I2S_PIN_NO_CHANGE;
    pin_cfg.data_in_num = I2S_DIN_PIN;
    ESP_ERROR_CHECK(i2s_set_pin(I2S_PORT, &pin_cfg));
    ESP_ERROR_CHECK(i2s_set_clk(I2S_PORT, SAMPLE_RATE, I2S_BITS_PER_SAMPLE_32BIT, I2S_CHANNEL_STEREO));
}

#endif  // MICROPHONE_USE_NEW_I2S

void acquire_sample_chunk() {
    profile_function([&]() {
        uint32_t new_samples_raw[CHUNK_SIZE];
        float new_samples[CHUNK_SIZE];

        if (EMOTISCOPE_ACTIVE) {
            size_t bytes_read = 0;
            esp_err_t i2s_result = ESP_FAIL;
            uint32_t i2s_start_us = micros();

#if MICROPHONE_USE_NEW_I2S
            i2s_result = i2s_channel_read(rx_handle,
                                          new_samples_raw,
                                          CHUNK_SIZE * sizeof(uint32_t),
                                          &bytes_read,
                                          pdMS_TO_TICKS(100));
#else
            i2s_result = i2s_read(I2S_PORT,
                                   new_samples_raw,
                                   CHUNK_SIZE * sizeof(uint32_t),
                                   &bytes_read,
                                   pdMS_TO_TICKS(100));
#endif
            uint32_t i2s_block_us = micros() - i2s_start_us;

            if (i2s_block_us > 10000) {
                LOG_DEBUG(TAG_I2S, "Block time: %lu us", i2s_block_us);
            }

            if (i2s_result != ESP_OK) {
                memset(new_samples_raw, 0, sizeof(new_samples_raw));
                LOG_ERROR(TAG_I2S, "Read failed with code %d, block_us=%lu", i2s_result, i2s_block_us);
            }
        } else {
            memset(new_samples_raw, 0, sizeof(new_samples_raw));
        }

        for (uint16_t i = 0; i < CHUNK_SIZE; i += 4) {
            new_samples[i + 0] = min(max((((int32_t)new_samples_raw[i + 0]) >> 14) + 7000, (int32_t)-131072), (int32_t)131072) - 360;
            new_samples[i + 1] = min(max((((int32_t)new_samples_raw[i + 1]) >> 14) + 7000, (int32_t)-131072), (int32_t)131072) - 360;
            new_samples[i + 2] = min(max((((int32_t)new_samples_raw[i + 2]) >> 14) + 7000, (int32_t)-131072), (int32_t)131072) - 360;
            new_samples[i + 3] = min(max((((int32_t)new_samples_raw[i + 3]) >> 14) + 7000, (int32_t)-131072), (int32_t)131072) - 360;
        }

        dsps_mulc_f32(new_samples, new_samples, CHUNK_SIZE, recip_scale, 1, 1);

        // Compute absolute-average VU for downstream consumers
        float chunk_vu = 0.0f;
        for (uint16_t i = 0; i < CHUNK_SIZE; ++i) {
            chunk_vu += fabsf(new_samples[i]);
        }
        chunk_vu /= static_cast<float>(CHUNK_SIZE);

        // Apply audio_responsiveness parameter (0=smooth, 1=instant)
        // Static variable persists between calls for smoothing
        static float smooth_audio_level = 0.0f;
        const PatternParameters& params = get_params();
        const float responsiveness = params.audio_responsiveness;
        smooth_audio_level = (responsiveness * chunk_vu) + ((1.0f - responsiveness) * smooth_audio_level);
        audio_level = smooth_audio_level;

        waveform_locked = true;
        shift_and_copy_arrays(sample_history, SAMPLE_HISTORY_LENGTH, new_samples, CHUNK_SIZE);

        waveform_locked = false;
        waveform_sync_flag = true;
    }, __func__);
}
