// Async web server for runtime parameter control
// REST API endpoints for pattern switching and parameter updates

#pragma once

#include <ESPAsyncWebServer.h>

// Initialize web server on port 80
void init_webserver();

// Handle web server requests (call from loop() if needed)
// Note: AsyncWebServer is non-blocking, so this might be a no-op
void handle_webserver();

// Broadcast real-time data to all connected WebSocket clients
void broadcast_realtime_data();
