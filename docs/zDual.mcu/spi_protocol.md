# SPI Protocol & Timing

## Protocol Specification

```c
typedef struct {
    uint16_t sync_word;      // 0xAA55
    uint8_t  version;        // Protocol version
    uint8_t  feature_ver;    // Feature set version
    uint32_t frame_counter;  // Incrementing frame ID
    uint32_t timestamp;      // Optional: ms timestamp
    
    // Tier 0 Features (16 bytes)
    uint16_t overall_energy; // Q0.15 fixed point
    uint16_t peak_level;     // Q0.15 fixed point
    uint16_t crest_factor;   // Q4.11 (dB × 100)
    uint16_t band_energy[4]; // Q0.15 fixed point
    uint16_t envelope;       // Q0.15 fixed point
    
    // Tier 1 Features (12 bytes)
    uint16_t beat_intensity; // Q0.15 fixed point
    uint16_t tempo_bpm;      // BPM × 10
    uint16_t spectral_centroid; // Hz / 10
    uint16_t spectral_rolloff;  // Hz / 10
    uint16_t zero_crossing_rate; // Q0.15
    uint8_t  beat_phase;     // 0-255 (0-2π)
    uint8_t  reserved;       // Alignment
    
    uint16_t crc16;          // CRC16-CCITT
} AudioFeaturePacket;
```

## Timing Model
- Poll Rate: 125 Hz (8ms intervals)
- SPI Clock: 10 MHz (packet transfer < 0.5ms)
- Timeout: 16ms (2 frame periods)
- Jitter Budget: ±1ms acceptable

## Error Handling
- Missing Packet: Hold last valid frame, fade to 50% over 500ms
- CRC Error: Discard packet, increment error counter
- Timeout: Switch to demo/fallback mode
- Version Mismatch: Negotiate compatible subset