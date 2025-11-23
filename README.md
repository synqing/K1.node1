K1.PRISM.node - SB-Based Single-MCU K1-Lightwave
================================================

Scope
-----

- Single-MCU, SensoryBridge-based K1-Lightwave firmware.
- Preserves the K1.node1 pattern/runtime core and all HTTP/REST/WebSocket APIs.
- Rewrites the audio and visual pipeline from the ground up to match SensoryBridge behavior (no Emotiscope alignment, no background overlay).

Status
------

- Project scaffolded with PlatformIO firmware project under `firmware/`.
- Webserver/API headers and core pattern runtime context copied from `K1.node1` as the stable external contract to preserve.
- Audio pipeline, pattern implementations, and visual semantics are pending SB-based reimplementation.

