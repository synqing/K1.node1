# Sequence Diagrams

The following Mermaid diagrams illustrate key runtime flows across HTTP and WebSocket interactions.

## Diagnostics Request Flow
```mermaid
sequenceDiagram
  participant UI as Web App UI
  participant API as Firmware HTTP API
  participant RL as RateLimiter
  participant ENG as Diagnostics Engine

  UI->>API: GET /api/diag
  API->>RL: checkWindow("/api/diag")
  RL-->>API: allowed
  API->>ENG: collectDiagnostics()
  ENG-->>API: diag payload
  API-->>UI: 200 OK JSON

  UI->>API: GET /api/diag (too soon)
  API->>RL: checkWindow("/api/diag")
  RL-->>API: denied
  API-->>UI: 429 Too Many Requests
```

## Realtime Toggle and Broadcast
```mermaid
sequenceDiagram
  participant UI as Web App UI
  participant API as Firmware HTTP API
  participant WS as AsyncWebSocket(/ws)
  participant RT as RealtimeService

  UI->>API: POST /api/realtime/config { interval_ms, enabled }
  API->>RT: applyConfig(interval, enabled)
  RT-->>API: ok
  API-->>UI: 200 OK

  RT->>WS: broadcast telemetry @interval
  WS-->>UI: telemetry frames

  UI-->>WS: close connection
  WS->>RT: decrement client count
```

## Parameter Update Flow
```mermaid
sequenceDiagram
  participant UI as Web App UI
  participant API as Firmware HTTP API
  participant RL as RateLimiter
  participant RND as Renderer

  UI->>API: POST /api/params { brightness, speed }
  API->>RL: checkWindow("/api/params")
  RL-->>API: allowed
  API->>RND: applyParams()
  RND-->>API: ok
  API-->>UI: 200 OK { ok: true }
```

