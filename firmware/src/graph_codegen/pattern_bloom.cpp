
#include "graph_runtime.h"
#include "../stateful_nodes.h"
#include "../parameters.h"
#include "../pattern_audio_interface.h"
#include "../led_driver.h"
#include "../emotiscope_helpers.h"

struct HSV { float h, s, v; };

extern "C" void pattern_bloom_render(
    uint32_t frame_count,
    const AudioDataSnapshot& audio,
    const PatternParameters& params,
    PatternState& state,
    PatternOutput& out
) {
    // Constants
    static constexpr int PATTERN_NUM_LEDS = NUM_LEDS;

    // Buffers
    float tmp_f0[PATTERN_NUM_LEDS] = {0.0f};
    CRGBF tmp_rgb0[PATTERN_NUM_LEDS];
    CRGBF tmp_rgb1[PATTERN_NUM_LEDS];

    // Initialize RGB buffer to black
    
    
    
    // === Verbatim Bloom (ported from SensoryBridge light_mode_bloom) ===
    // Port notes:
    // - Replicates audio_vu smoothing, adaptive max_level, dot_pos mapping, smoothing mix,
    //   and mirrored dual-dot rendering.
    // - HSV to RGB implemented locally to match CRGBF output.


    // === Bloom (SensoryBridge light_mode_bloom) — exact algorithmal port ===
    // 1) Scroll previous frame outward with decay (sprite draw)
    // 2) Compute chroma-summed color at center from squared chroma bins
    // 3) Optionally enforce hue (chromatic off) [default: chromatic on]
    // 4) Apply tail fade and mirror symmetry

    // Helpers
    auto hsv_to_rgbf = [](float h, float s, float v) -> CRGBF {
        h = h - floorf(h);
        float r=0,g=0,b=0;
        float i = floorf(h * 6.0f);
        float f = h * 6.0f - i;
        float p = v * (1.0f - s);
        float q = v * (1.0f - f * s);
        float t = v * (1.0f - (1.0f - f) * s);
        switch (((int)i) % 6) {
            case 0: r=v; g=t; b=p; break;
            case 1: r=q; g=v; b=p; break;
            case 2: r=p; g=v; b=t; break;
            case 3: r=p; g=q; b=v; break;
            case 4: r=t; g=p; b=v; break;
            default: r=v; g=p; b=q; break;
        }
        return CRGBF{r,g,b};
    };
    auto rgbf_to_hsv = [](const CRGBF& c)->HSV{
        float r=c.r,g=c.g,b=c.b;
        float maxv=fmaxf(r,fmaxf(g,b)); float minv=fminf(r,fminf(g,b));
        float d=maxv-minv; float h=0.0f; float s=(maxv<=1e-6f?0.0f:(d/maxv)); float v=maxv;
        if(d>1e-6f){
            if(maxv==r){ h=fmodf(((g-b)/d),6.0f); if(h<0) h+=6.0f; h/=6.0f; }
            else if(maxv==g){ h=((b-r)/d)+2.0f; h/=6.0f; }
            else { h=((r-g)/d)+4.0f; h/=6.0f; }
        }
        return {h,s,v};
    };
    auto force_saturation_rgbf = [&](const CRGBF& c, float sat)->CRGBF{
        auto hsv = rgbf_to_hsv(c);
        hsv.s = fmaxf(0.0f, fminf(1.0f, sat));
        return hsv_to_rgbf(hsv.h, hsv.s, hsv.v);
    };

    // Persistent previous frame for sprite scroll
    static CRGBF prev_frame[PATTERN_NUM_LEDS];

    // Step 1: sprite-draw previous frame outward with decay
    float mood = fmaxf(0.0f, fminf(1.0f, params.custom_param_1));
    float position = 0.250f + 1.750f * mood; // original mapping 0..1 -> 0.25..2.0
    float decay = 0.99f;
    // Clear target then draw prev as sprite
    for (int i=0;i<PATTERN_NUM_LEDS;++i) tmp_rgb0[i] = CRGBF{0.0f,0.0f,0.0f};
    draw_sprite(tmp_rgb0, prev_frame, PATTERN_NUM_LEDS, PATTERN_NUM_LEDS, position, decay);

    // Step 2: compute chroma-summed color
    CRGBF sum_color = CRGBF{0.0f,0.0f,0.0f};
    float share = 1.0f/6.0f;
    for (int i = 0; i < 12; ++i) {
        float prog = (float)i / 12.0f;
        float bin = clip_float(audio.chromagram[i]);
        float v = bin * bin * share;
        CRGBF add = hsv_to_rgbf(prog, 1.0f, v);
        sum_color.r += add.r; sum_color.g += add.g; sum_color.b += add.b;
    }
    sum_color.r = fminf(1.0f, sum_color.r);
    sum_color.g = fminf(1.0f, sum_color.g);
    sum_color.b = fminf(1.0f, sum_color.b);

    // Square iter (legacy brightness shaping). Using 1 iteration as baseline.
    sum_color.r *= sum_color.r;
    sum_color.g *= sum_color.g;
    sum_color.b *= sum_color.b;

    // Force saturation like temp_col = force_saturation(temp_col, 255*CONFIG.SATURATION)
    sum_color = force_saturation_rgbf(sum_color, fmaxf(0.0f, fminf(1.0f, params.saturation)));

    // Optional non-chromatic override (chromatic_mode == false)
    bool chromatic_mode = (params.custom_param_3 >= 0.5f); // 1.0=true, 0.0=false by convention
    if (!chromatic_mode) {
        // Hue = chroma_val + hue_position + 0.05
        // chroma_val ~ dominant chroma hue
        int max_idx = 0; float max_val=-1.0f;
        for (int i=0;i<12;++i){ if(audio.chromagram[i]>max_val){ max_val=audio.chromagram[i]; max_idx=i; } }
        float chroma_val = (float)max_idx / 12.0f;
        float hue_position = params.color;
        float led_hue = chroma_val + hue_position + 0.05f;
        while (led_hue >= 1.0f) led_hue -= 1.0f;
        sum_color = hsv_to_rgbf(led_hue, 1.0f, fmaxf(sum_color.r, fmaxf(sum_color.g, sum_color.b)));
    }

    // Write center LEDs
    int mid_right = (PATTERN_NUM_LEDS/2);
    int mid_left = mid_right - 1;
    if (mid_left >= 0 && mid_left < PATTERN_NUM_LEDS) tmp_rgb0[mid_left] = sum_color;
    if (mid_right >= 0 && mid_right < PATTERN_NUM_LEDS) tmp_rgb0[mid_right] = sum_color;

    // Step 4: tail fade at far end and mirror symmetry
    int half_len = PATTERN_NUM_LEDS / 2;
    if (half_len > 1) {
        for (int i = 0; i < half_len; ++i) {
            float prog = (half_len>1) ? (float)i / (float)(half_len-1) : 0.0f;
            int idx = PATTERN_NUM_LEDS - 1 - i;
            CRGBF c = tmp_rgb0[idx];
            float scale = prog*prog;
            tmp_rgb0[idx] = CRGBF{c.r * scale, c.g * scale, c.b * scale};
        }
        for (int i = 0; i < half_len; ++i) {
            int idx_left = i;
            int idx_right = PATTERN_NUM_LEDS - 1 - i;
            tmp_rgb0[idx_left] = tmp_rgb0[idx_right];
        }
    }

    // Update prev_frame for next call
    for (int i=0;i<PATTERN_NUM_LEDS;++i) prev_frame[i] = tmp_rgb0[i];
// Terminal: LedOutput (clamp and write)
    const CRGBF* final_buf = tmp_rgb0;
    for (int i = 0; i < PATTERN_NUM_LEDS; ++i) {
        CRGBF c = clamped_rgb(final_buf[i]);
        out.leds[i][0] = (uint8_t)std::floor(c.r * 255.0f + 0.5f);
        out.leds[i][1] = (uint8_t)std::floor(c.g * 255.0f + 0.5f);
        out.leds[i][2] = (uint8_t)std::floor(c.b * 255.0f + 0.5f);
    }
}
