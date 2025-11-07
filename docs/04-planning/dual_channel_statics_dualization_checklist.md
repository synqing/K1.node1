---
author: Codex (ChatGPT)
date: 2025-11-06
status: draft
intent: Line-precise checklist of static pattern buffers to dualize for channel isolation
related:
  - firmware/src/generated_patterns.h
  - docs/04-planning/dual_channel_system_architecture_plan.md
---

# Dual-Channel Statics Dualization Checklist

Scope: convert single-instance static buffers to two-instance buffers indexed by `ch_idx ∈ {0,1}` to ensure pattern state isolation between channels. The minimal-change technique is to prepend a first dimension `[2]` (or `[NUM_CHANNELS]`) and thread `ch_idx` through render helpers.

Guidelines
- Change `static TYPE name[LEN];` → `static TYPE name[2][LEN];`
- Replace all references `name[i]` with `name[ch_idx][i]` in the pattern context.
- Where `*_prev` mirrors `*`, apply the same transformation.
- For half-array buffers (`NUM_LEDS/2`), keep sizes unchanged; only add the first dimension.

Targets (file:line)
- firmware/src/generated_patterns.h:517 — `static float bloom_trail[NUM_LEDS]`
- firmware/src/generated_patterns.h:518 — `static float bloom_trail_prev[NUM_LEDS]`
- firmware/src/generated_patterns.h:567 — `static CRGBF bloom_buffer[NUM_LEDS]`
- firmware/src/generated_patterns.h:568 — `static CRGBF bloom_buffer_prev[NUM_LEDS]`
- firmware/src/generated_patterns.h:983 — `static CRGBF beat_tunnel_variant_image[NUM_LEDS]`
- firmware/src/generated_patterns.h:984 — `static CRGBF beat_tunnel_variant_image_prev[NUM_LEDS]`
- firmware/src/generated_patterns.h:986 — `static CRGBF beat_tunnel_image[NUM_LEDS]`
- firmware/src/generated_patterns.h:987 — `static CRGBF beat_tunnel_image_prev[NUM_LEDS]`
- firmware/src/generated_patterns.h:1158 — `static float beat_perlin_noise_array[NUM_LEDS >> 2]`
- firmware/src/generated_patterns.h:1488 — `static CRGBF spectrum_buffer[NUM_LEDS / 2]`
- firmware/src/generated_patterns.h:1489 — `static float waveform_history[NUM_LEDS / 2]`
- firmware/src/generated_patterns.h:1609 — `static CRGBF snapwave_buffer[NUM_LEDS / 2]`

Notes
- After dualization, ensure symmetry copies and decay operations use the channel slice consistently (e.g., when copying `*_prev` → `*`).
- Validate memory usage: each CRGBF array adds 12 bytes per LED per channel; half-arrays add proportionally less. ESP32‑S3 has ample headroom for doubling these buffers.
- This checklist is exhaustive for statics detected via regex; if new statics are added later, apply the same pattern.

