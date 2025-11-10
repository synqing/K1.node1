# API Specification: Frontend ↔ Backend

## Orkes Workflow Service
- Base URL: `VITE_ORKES_SERVICE_BASE_URL` (default `http://localhost:4002/api/workflows`)

- Endpoints:
  - `POST /execute`
    - Request: `{ workflowName: string; input: any; correlationId?: string; priority?: number; tags?: Record<string,string> }`
    - Response: `{ workflowId: string; status: 'RUNNING' }`
  - `GET /:workflowId`
    - Response: `WorkflowStatusResponse`
  - `POST /:workflowId/pause`
    - Response: `{ success: true, workflowId, status: 'PAUSED' }`
  - `POST /:workflowId/resume`
    - Response: `{ success: true, workflowId, status: 'RUNNING' }`
  - `POST /:workflowId/retry`
    - Request: `{ resumeSubworkflowTasks?: boolean }`
    - Response: `{ success: true, workflowId, status: 'RUNNING' }`
  - `DELETE /:workflowId`
    - Request: `{ reason?: string }`
    - Response: `{ success: true, workflowId }`

- Workflow `k1_pattern_compilation` input:
```json
{
  "patternName": "string",
  "patternCode": "string",
  "targetDevice": "string?",
  "optimizationLevel": "O0|O1|O2|O3?"
}
```

## Firmware Device API
- Base URL: `http://<device-ip>:80/api`
- Endpoints and contracts (selected):
  - `GET /patterns` → `{ patterns: FirmwarePattern[]; current_pattern: number } | FirmwarePattern[]`
  - `POST /select` → Body `{ id?: string; index?: number }`, Response `{ ok: boolean }`
  - `GET /params` → `FirmwareParams`
  - `POST /params` → Partial `FirmwareParams`, Response: `FirmwareParams | { ok: boolean }`
  - `GET /palettes` → `FirmwarePalette[] | { palettes: FirmwarePalette[] }`
  - `POST /config/restore` → any bundle payload, Response `{ ok?: boolean }`
  - `GET /device/performance` → `FirmwarePerformanceMetrics`
  - `GET /test-connection` → `{ status: 'ok' }`

## Auth & Headers
- Orkes: JSON only; CORS origins configured in service. No cookie/JWT in dev.
- Device: Prefer JSON POST with `Content-Type: application/json`. On failure, fallback to `no-cors` opaque POST.

