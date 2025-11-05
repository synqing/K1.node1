#pragma once

#include <stdint.h>

// Initialize a lightweight UDP echo server on the given port.
// Echoes back any received datagram payload to the sender.
// Runs in its own FreeRTOS task to avoid blocking render/audio.
void udp_echo_begin(uint16_t port);

