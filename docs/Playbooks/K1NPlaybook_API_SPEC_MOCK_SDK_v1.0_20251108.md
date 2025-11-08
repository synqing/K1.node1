# API Spec, Mock Server, and TS SDK

## Mindset

- Contract-first: the API is the single source of truth (OpenAPI). UI and firmware agree on one document.
- Tooling-driven: generate types and clients from the spec; validate requests/responses in dev.
- Safety nets: mock server for offline UI and CI; schema validation to catch drift; rate-limit aware UX.
- Observability: expose health/telemetry endpoints and keep a build signature visible to diagnose version mismatches fast.

---

## OpenAPI 3.0 Specification (YAML)

Paste into `openapi.yaml` (or keep here and generate from this block). This captures core endpoints we use today and those Webapp needs for control and diagnostics.

```yaml
openapi: 3.0.3
info:
  title: K1.reinvented Firmware API
  version: 1.0.0
  description: REST contract for device control, telemetry, and diagnostics.
servers:
  - url: http://device.local
    description: Device
  - url: http://localhost:8080
    description: Mock server
paths:
  /api/params:
    get:
      summary: Get current pattern parameters
      operationId: getParams
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PatternParameters'
    post:
      summary: Update parameters (partial update supported)
      operationId: postParams
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PatternParametersPartial'
      responses:
        '200':
          description: Updated params
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PatternParameters'

  /api/select:
    post:
      summary: Select pattern by index or id
      operationId: postSelect
      requestBody:
        required: true
        content:
          application/json:
            schema:
              oneOf:
                - type: object
                  properties:
                    index:
                      type: integer
                      minimum: 0
                  required: [index]
                - type: object
                  properties:
                    id:
                      type: string
                  required: [id]
      responses:
        '200':
          description: Current selection
          content:
            application/json:
              schema:
                type: object
                properties:
                  current_pattern:
                    type: integer
                  id:
                    type: string
                  name:
                    type: string

  /api/reset:
    post:
      summary: Reset parameters to defaults
      operationId: postReset
      responses:
        '200':
          description: Defaults applied
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PatternParameters'

  /api/audio-config:
    get:
      summary: Get audio front-end configuration
      operationId: getAudioConfig
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AudioConfig'
    post:
      summary: Update audio configuration (partial)
      operationId: postAudioConfig
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AudioConfigPartial'
      responses:
        '200':
          description: Updated config
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AudioConfig'

  /api/rmt:
    get:
      summary: RMT telemetry
      operationId: getRmt
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/RmtTelemetry'

  /api/device/info:
    get:
      summary: Device info and build signature
      operationId: getDeviceInfo
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DeviceInfo'

  /api/device/performance:
    get:
      summary: Performance metrics
      operationId: getDevicePerformance
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DevicePerformance'

  /api/patterns:
    get:
      summary: List patterns
      operationId: getPatterns
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  patterns:
                    type: array
                    items:
                      $ref: '#/components/schemas/PatternMeta'
                  current_pattern:
                    type: integer

  /api/palettes:
    get:
      summary: List palettes
      operationId: getPalettes
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  palettes:
                    type: array
                    items:
                      $ref: '#/components/schemas/PaletteMeta'
                  count:
                    type: integer

components:
  schemas:
    PatternParameters:
      type: object
      properties:
        brightness: { type: number, minimum: 0, maximum: 1 }
        softness:   { type: number, minimum: 0, maximum: 1 }
        color:      { type: number, minimum: 0, maximum: 1 }
        color_range:{ type: number, minimum: 0, maximum: 1 }
        saturation: { type: number, minimum: 0, maximum: 1 }
        warmth:     { type: number, minimum: 0, maximum: 1 }
        background: { type: number, minimum: 0, maximum: 1 }
        dithering:  { type: number, minimum: 0, maximum: 1 }
        speed:      { type: number, minimum: 0, maximum: 1 }
        palette_id: { type: integer, minimum: 0 }
        custom_param_1: { type: number, minimum: 0, maximum: 1 }
        custom_param_2: { type: number, minimum: 0, maximum: 1 }
        custom_param_3: { type: number, minimum: 0, maximum: 1 }
        beat_threshold:    { type: number, minimum: 0, maximum: 1 }
        beat_squash_power: { type: number, minimum: 0.2, maximum: 1 }
        audio_gain:  { type: number, minimum: 0.1, maximum: 4 }
        audio_gamma: { type: number, minimum: 0.2, maximum: 3 }
      required: [brightness, softness, color, color_range, saturation, warmth, background, dithering, speed, palette_id, beat_threshold, beat_squash_power, audio_gain, audio_gamma]

    PatternParametersPartial:
      allOf:
        - $ref: '#/components/schemas/PatternParameters'
      description: Partial update; send only fields to change

    AudioConfig:
      type: object
      properties:
        microphone_gain:  { type: number, minimum: 0.5, maximum: 2 }
        vu_floor_pct:     { type: number, minimum: 0.5, maximum: 0.98 }
        vu_peak_decay_ms: { type: number, minimum: 10, maximum: 2000 }
      required: [microphone_gain, vu_floor_pct, vu_peak_decay_ms]

    AudioConfigPartial:
      allOf:
        - $ref: '#/components/schemas/AudioConfig'
      description: Partial update; send only fields to change

    RmtTelemetry:
      type: object
      properties:
        ch1:
          type: object
          properties:
            empty:     { type: integer, minimum: 0 }
            maxgap_us: { type: integer, minimum: 0 }
        ch2:
          type: object
          properties:
            empty:     { type: integer, minimum: 0 }
            maxgap_us: { type: integer, minimum: 0 }
      required: [ch1, ch2]

    DeviceInfo:
      type: object
      properties:
        device: { type: string }
        uptime_ms: { type: integer }
        ip: { type: string }
        mac: { type: string }
        build:
          type: object
          properties:
            arduino: { type: integer }
            arduino_release: { type: string }
            idf_ver: { type: string }
            platformio_platform: { type: string }
            framework: { type: string }

    DevicePerformance:
      type: object
      properties:
        fps: { type: number }
        frame_time_us: { type: number }
        render_avg_us: { type: number }
        quantize_avg_us: { type: number }
        rmt_wait_avg_us: { type: number }
        rmt_tx_avg_us: { type: number }
        cpu_percent: { type: number }
        memory_percent: { type: number }
        memory_free_kb: { type: integer }
        memory_total_kb: { type: integer }
        fps_history:
          type: array
          items: { type: number }

    PatternMeta:
      type: object
      properties:
        index: { type: integer }
        id: { type: string }
        name: { type: string }
        description: { type: string }
        is_audio_reactive: { type: boolean }

    PaletteMeta:
      type: object
      properties:
        id: { type: integer }
        name: { type: string }
        colors:
          type: array
          items:
            type: object
            properties:
              r: { type: integer, minimum: 0, maximum: 255 }
              g: { type: integer, minimum: 0, maximum: 255 }
              b: { type: integer, minimum: 0, maximum: 255 }
        num_keyframes: { type: integer }
```

---

## Mock Server (Node/Express) – Full Spec

The following example is a complete Express mock server (TypeScript or JS) with:
- CORS, JSON body parsing
- Simple in-memory state for /api/params and /api/audio-config
- Rate-limit simulation (HTTP 429) when requests come too fast
- Random jitter for telemetry fields to feel realistic
- AJV validation against the OpenAPI-derived schemas (optional, recommended)

Create `mock-server/package.json`:
```json
{
  "name": "k1-mock-server",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "ajv": "^8.12.0",
    "cors": "^2.8.5",
    "express": "^4.19.2"
  }
}
```

Create `mock-server/server.js`:
```js
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// --- State ---
let params = {
  brightness: 1.0, softness: 0.25, color: 0.33, color_range: 0.0, saturation: 0.75, warmth: 0.0,
  background: 0.0, dithering: 1.0, speed: 0.5, palette_id: 0,
  custom_param_1: 0.5, custom_param_2: 0.5, custom_param_3: 0.5,
  beat_threshold: 0.20, beat_squash_power: 0.50,
  audio_gain: 1.0, audio_gamma: 1.0
};

let audioConfig = { microphone_gain: 1.0, vu_floor_pct: 0.70, vu_peak_decay_ms: 150 };
let currentPattern = 0;
let lastRequestTimes = new Map();

function rateLimit(key, windowMs=300) {
  const now = Date.now();
  const last = lastRequestTimes.get(key) || 0;
  if (now - last < windowMs) return true;
  lastRequestTimes.set(key, now);
  return false;
}

function jitter(n, pct=0.05) {
  const delta = n * pct; return n + (Math.random()*2-1)*delta;
}

// --- Endpoints ---
app.get('/api/params', (req,res)=> res.json(params));
app.post('/api/params', (req,res)=>{
  if (rateLimit('params:post', 300)) return res.status(429).json({error:'rate_limited'});
  params = { ...params, ...req.body };
  return res.json(params);
});

app.post('/api/select', (req,res)=>{
  const { index, id } = req.body || {};
  if (typeof index === 'number') currentPattern = index;
  // id -> lookup omitted in mock
  return res.json({ current_pattern: currentPattern, id: 'pattern_'+currentPattern, name: 'Pattern '+currentPattern });
});

app.post('/api/reset', (req,res)=>{
  params = { ...params, brightness: 1.0, softness: 0.25, speed: 0.5 };
  res.json(params);
});

app.get('/api/audio-config', (req,res)=> res.json(audioConfig));
app.post('/api/audio-config', (req,res)=>{
  if (rateLimit('audio:post', 300)) return res.status(429).json({error:'rate_limited'});
  audioConfig = { ...audioConfig, ...req.body };
  res.json(audioConfig);
});

app.get('/api/rmt', (req,res)=>{
  res.json({
    ch1: { empty: Math.floor(Math.random()*10000), maxgap_us: Math.floor(jitter(90, 0.2)) },
    ch2: { empty: Math.floor(Math.random()*10000), maxgap_us: Math.floor(jitter(88, 0.2)) }
  });
});

app.get('/api/device/info', (req,res)=>{
  res.json({
    device: 'K1.reinvented', uptime_ms: Date.now() % 100000000,
    ip: '192.168.0.123', mac: 'AA:BB:CC:DD:EE:FF',
    build: { arduino: 10812, arduino_release: '3.0.0', idf_ver: 'v5.1.x', platformio_platform: 'espressif32@6.12.0', framework: 'arduino@3.20017' }
  });
});

app.get('/api/device/performance', (req,res)=>{
  res.json({
    fps: jitter(150, 0.1), frame_time_us: jitter(6400, 0.15),
    render_avg_us: jitter(50,0.3), quantize_avg_us: jitter(60,0.2), rmt_wait_avg_us: jitter(5000,0.2), rmt_tx_avg_us: jitter(900,0.2),
    cpu_percent: jitter(42,0.2), memory_percent: jitter(51,0.1), memory_free_kb: 128000, memory_total_kb: 320000,
    fps_history: Array.from({length:16}, ()=> jitter(150, 0.1))
  });
});

app.get('/api/patterns', (req,res)=>{
  res.json({ patterns: Array.from({length:16}, (_,i)=>({index:i,id:`p_${i}`,name:`Pattern ${i}`,description:'desc',is_audio_reactive:true})), current_pattern: currentPattern });
});

app.get('/api/palettes', (req,res)=>{
  res.json({ palettes: [ { id:0, name:'Default', colors:[{r:255,g:0,b:0},{r:0,g:255,b:0},{r:0,g:0,b:255}], num_keyframes:3 } ], count: 1 });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, ()=> console.log(`[mock] listening on http://localhost:${PORT}`));
```

Run:
```bash
cd mock-server
npm i
npm start
```

---

## TypeScript SDK (Types + Client)

Two options work well:

1) openapi-typescript (types only) + lightweight fetch client
```bash
npx openapi-typescript openapi.yaml -o webapp/src/api/types.ts
```

Create `webapp/src/api/client.ts`:
```ts
export class ApiClient {
  constructor(public baseUrl: string) {}
  async get<T>(path: string): Promise<T> {
    const r = await fetch(this.baseUrl + path, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error(`GET ${path} ${r.status}`);
    return r.json();
  }
  async post<T>(path: string, body: any): Promise<T> {
    const r = await fetch(this.baseUrl + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error(`POST ${path} ${r.status}`);
    return r.json();
  }
}
```

Usage (with generated types):
```ts
import { components } from './types';
type PatternParameters = components['schemas']['PatternParameters'];
type AudioConfig = components['schemas']['AudioConfig'];

const api = new ApiClient(import.meta.env.VITE_API_BASE || 'http://localhost:8080');

export async function getParams() {
  return api.get<PatternParameters>('/api/params');
}

export async function updateParams(patch: Partial<PatternParameters>) {
  return api.post<PatternParameters>('/api/params', patch);
}

export async function getAudioConfig() {
  return api.get<AudioConfig>('/api/audio-config');
}

export async function updateAudioConfig(patch: Partial<AudioConfig>) {
  return api.post<AudioConfig>('/api/audio-config', patch);
}
```

2) openapi-generator (full client)
```bash
openapi-generator-cli generate \
  -g typescript-fetch \
  -i openapi.yaml \
  -o webapp/src/api/sdk
```

Then import the generated client classes and use them directly.

---

## CI/Dev Routines

- Add npm scripts in webapp:
```json
{
  "scripts": {
    "dev:mock": "vite --port 5173",
    "dev:device": "VITE_API_BASE=http://device.local vite --port 5173",
    "api:types": "openapi-typescript ../docs/Playbooks/openapi.yaml -o src/api/types.ts"
  }
}
```

- Contract test idea:
  - In CI, run the mock server, then curl each endpoint and validate against JSON Schema (ajv) compiled from OpenAPI.

---

## Webapp UX Guidance (rate-limit aware)

- Debounce sliders ≥ 300 ms; coalesce quick changes to one POST.
- Handle 429: show “rate limited, retrying” with a backoff.
- Diagnostics panel (Developer Mode): live charts for `/api/rmt`, `/api/device/performance` (poll every 250 ms max in debug mode only).
- Surface build signature (from `/api/device/info`) prominently in a footer to catch environment mismatches fast.

---

## Hand-off Notes

- The YAML above is sufficient to generate types and clients. If you prefer a single source of truth, keep `openapi.yaml` at repo root or under `docs/Playbooks/` and point codegen to it.
- The mock server is intentionally minimal. For richer schema validation, use `openapi-backend` or compile JSON Schemas from the spec and validate requests and responses with `ajv`.
```

