# Real-Time Processing Requirements & Determinism

## End-to-End Latency Budget
- Audio Capture: 8ms (window size)
- Audio Processing: 4ms (feature extraction)
- SPI Transfer: 0.5ms
- Visual Processing: 4ms (render pipeline)
- LED Output: 2.5ms (300 LEDs @ 60 FPS)
- Total: 19ms (target < 25ms)

## Jitter Tolerance
- Audio Frame: ±0.1ms
- SPI Transfer: ±0.5ms
- Render Frame: ±1ms
- LED Refresh: ±0.1ms

## Scheduling Model (FreeRTOS)

### Audio MCU Tasks
```cpp
// Priority 4: Audio capture (highest)
Task_AudioCapture(void* pvParameters) {
    // I2S RX via DMA
    // Double buffering
    // vTaskDelayUntil for precise timing
}

// Priority 3: Feature extraction
Task_FeatureExtraction(void* pvParameters) {
    // Process audio windows
    // Update feature packet
    // Signal SPI task when ready
}

// Priority 2: SPI communication
Task_SPICommunication(void* pvParameters) {
    // Wait for feature ready signal
    // Transmit packet to render MCU
    // Handle error conditions
}

// Priority 1: Diagnostics (lowest)
Task_Diagnostics(void* pvParameters) {
    // CPU monitoring
    // Error logging
    // Telemetry reporting
}
```

### Render MCU Tasks
```cpp
// Priority 4: LED output (highest)
Task_LEDOutput(void* pvParameters) {
    // RMT DMA control
    // Precise timing critical
    // Double buffering
}

// Priority 3: SPI polling
Task_SPIPolling(void* pvParameters) {
    // Poll audio MCU for features
    // Update feature state
    // Handle timeouts
}

// Priority 2: Visual rendering
Task_VisualRendering(void* pvParameters) {
    // Process features
    // Generate LED colors
    // Prepare output buffer
}

// Priority 1: UI/Control (lowest)
Task_UIControl(void* pvParameters) {
    // Handle user input
    // Mode switching
    // Configuration updates
}
```