// Implementation for I2S microphone acquisition (moved from header)

#include "microphone.h"
#include "goertzel.h"

#include <atomic>
#include <cstring>

// Synchronization flags for microphone I2S ISR coordination
std::atomic<bool> waveform_locked{false};
std::atomic<bool> waveform_sync_flag{false};

// I2S RX channel handle
i2s_chan_handle_t rx_handle = nullptr;

void init_i2s_microphone() {
    // SPH0645LM4H is a standard I2S microphone (NOT PDM)
    // Requires: BCLK (clock input), LRCLK (word select), DIN (data output)

    i2s_chan_config_t chan_cfg = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_AUTO, I2S_ROLE_MASTER);
    i2s_new_channel(&chan_cfg, NULL, &rx_handle);

    // Standard I2S RX configuration for SPH0645
    i2s_std_config_t std_cfg = {
        .clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(SAMPLE_RATE),
        .slot_cfg = {
            .data_bit_width = I2S_DATA_BIT_WIDTH_32BIT,  // 32-bit data width
            .slot_bit_width = I2S_SLOT_BIT_WIDTH_32BIT,  // 32-bit slot width
            .slot_mode = I2S_SLOT_MODE_STEREO,           // STEREO mode (not mono!)
            .slot_mask = I2S_STD_SLOT_RIGHT,             // Read RIGHT channel (not left!)
            .ws_width = 32,                              // Word select width = 32 bits
            .ws_pol = true,                              // Word select polarity INVERTED
            .bit_shift = false,                          // No bit shift
            .left_align = true,                          // Left-aligned data
            .big_endian = false,                         // Little endian
            .bit_order_lsb = false,                      // MSB first
        },
        .gpio_cfg = {
            .mclk = I2S_GPIO_UNUSED,                     // No MCLK needed
            .bclk = (gpio_num_t)I2S_BCLK_PIN,            // GPIO 14 - bit clock
            .ws = (gpio_num_t)I2S_LRCLK_PIN,             // GPIO 12 - word select
            .dout = I2S_GPIO_UNUSED,                     // No output needed
            .din = (gpio_num_t)I2S_DIN_PIN,              // GPIO 13 - data input
            .invert_flags = {
                .mclk_inv = false,
                .bclk_inv = false,
                .ws_inv = false,
            },
        },
    };

    // Initialize as standard I2S RX mode
    i2s_channel_init_std_mode(rx_handle, &std_cfg);

    // Start the RX channel
    i2s_channel_enable(rx_handle);
}

void acquire_sample_chunk() {
    profile_function([&]() {
        // Buffer to hold audio samples
        uint32_t new_samples_raw[CHUNK_SIZE];
        float new_samples[CHUNK_SIZE];

        // Read audio samples into int32_t buffer, but only when Emotiscope is active
        if (EMOTISCOPE_ACTIVE == true) {
            size_t bytes_read = 0;

            // DIAGNOSTIC: Measure I2S blocking time
            uint32_t i2s_start_us = micros();
            esp_err_t i2s_result = i2s_channel_read(
                rx_handle,
                new_samples_raw,
                CHUNK_SIZE * sizeof(uint32_t),
                &bytes_read,
                portMAX_DELAY
            );
            uint32_t i2s_block_us = micros() - i2s_start_us;

            // Log if blocking takes longer than expected 8-10ms
            if (i2s_block_us > 10000) {
                LOG_DEBUG(TAG_I2S, "Block time: %lu us", i2s_block_us);
            }

            if (i2s_result != ESP_OK) {
                // I2S error - fill with silence and continue
                memset(new_samples_raw, 0, sizeof(uint32_t) * CHUNK_SIZE);
                LOG_ERROR(TAG_I2S, "Read failed with code %d, block_us=%lu", i2s_result, i2s_block_us);
            }
        } else {
            // Audio inactive - fill with silence
            memset(new_samples_raw, 0, sizeof(uint32_t) * CHUNK_SIZE);
        }

        // Clip the sample value if it's too large, cast to floats
        for (uint16_t i = 0; i < CHUNK_SIZE; i += 4) {
            new_samples[i + 0] = min(max((((int32_t)new_samples_raw[i + 0]) >> 14) + 7000, (int32_t)-131072), (int32_t)131072) - 360;
            new_samples[i + 1] = min(max((((int32_t)new_samples_raw[i + 1]) >> 14) + 7000, (int32_t)-131072), (int32_t)131072) - 360;
            new_samples[i + 2] = min(max((((int32_t)new_samples_raw[i + 2]) >> 14) + 7000, (int32_t)-131072), (int32_t)131072) - 360;
            new_samples[i + 3] = min(max((((int32_t)new_samples_raw[i + 3]) >> 14) + 7000, (int32_t)-131072), (int32_t)131072) - 360;
        }

        // Convert audio from "18-bit" float range to -1.0 to 1.0 range
        dsps_mulc_f32(new_samples, new_samples, CHUNK_SIZE, recip_scale, 1, 1);

        // Add new chunk to audio history
        waveform_locked = true;
        shift_and_copy_arrays(sample_history, SAMPLE_HISTORY_LENGTH, new_samples, CHUNK_SIZE);

        // If debug recording was triggered
        if (audio_recording_live == true) {
            int16_t out_samples[CHUNK_SIZE];
            for (uint16_t i = 0; i < CHUNK_SIZE; i += 4) {
                out_samples[i + 0] = new_samples[i + 0] * 32767;
                out_samples[i + 1] = new_samples[i + 1] * 32767;
                out_samples[i + 2] = new_samples[i + 2] * 32767;
                out_samples[i + 3] = new_samples[i + 3] * 32767;
            }
            memcpy(&audio_debug_recording[audio_recording_index], out_samples, sizeof(int16_t) * CHUNK_SIZE);
            audio_recording_index += CHUNK_SIZE;
            if (audio_recording_index >= MAX_AUDIO_RECORDING_SAMPLES) {
                audio_recording_index = 0;
                audio_recording_live = false;
                broadcast("debug_recording_ready");
                save_audio_debug_recording();
            }
        }

        // Used to sync GPU to this when needed
        waveform_locked = false;
        waveform_sync_flag = true;
    }, __func__);
}

