// Minimal dependency-free mock device server.
// Serves core firmware endpoints with permissive CORS for local UI development.

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.MOCK_DEVICE_PORT || 8080);
const UI_ROOT = path.resolve(__dirname, '../../firmware/data/ui');

function json(res, statusCode, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function ok(res, obj = { status: 'ok' }) {
  json(res, 200, obj);
}

function notFound(res) {
  json(res, 404, { error: 'Not Found' });
}

function methodNotAllowed(res) {
  json(res, 405, { error: 'Method Not Allowed' });
}

function handleOptions(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
  });
  res.end();
}

const server = http.createServer((req, res) => {
  const { method, url } = req;
  const path = (url || '').split('?')[0];

  // Basic request logging
  process.stdout.write(`[MockDevice] ${method} ${path}\n`);

  // CORS preflight
  if (method === 'OPTIONS') return handleOptions(res);

  // Static UI serving: /ui, /css, /js
  if (path === '/' || path === '/ui' || path === '/ui/') {
    const filePath = pathResolve('index.html');
    return serveFile(res, filePath, 'text/html');
  }
  if (path.startsWith('/ui/')) {
    const fileRel = path.replace(/^\/ui\//, '');
    const filePath = pathResolve(fileRel);
    const ctype = contentTypeFor(filePath);
    return serveFile(res, filePath, ctype);
  }
  if (path.startsWith('/css/')) {
    const filePath = pathResolve(path.replace(/^\//, ''));
    return serveFile(res, filePath, 'text/css');
  }
  if (path.startsWith('/js/')) {
    const filePath = pathResolve(path.replace(/^\//, ''));
    return serveFile(res, filePath, 'application/javascript');
  }

  // Routing
  if (path === '/api/test-connection') {
    if (method !== 'GET') return methodNotAllowed(res);
    return ok(res);
  }

  if (path === '/api/health') {
    if (method !== 'GET') return methodNotAllowed(res);
    return ok(res, { status: 'ok', uptime_seconds: Math.floor(process.uptime()) });
  }

  if (path === '/api/device/info') {
    if (method !== 'GET') return methodNotAllowed(res);
    return ok(res, {
      build_signature: 'mock-build-2025-11-10',
      platform: 'esp32-s3',
      free_heap: 123456,
      uptime_seconds: Math.floor(process.uptime()),
    });
  }
  if (path === '/api/device-info') {
    if (method !== 'GET') return methodNotAllowed(res);
    return ok(res, {
      build_signature: 'mock-build-2025-11-10',
      platform: 'esp32-s3',
      free_heap: 123456,
      uptime_seconds: Math.floor(process.uptime()),
    });
  }
  if (path === '/api/devices') {
    if (method !== 'GET') return methodNotAllowed(res);
    const items = [
      { id: 'mock-primary', name: 'Mock PRISM.node', ip: '127.0.0.1', port: PORT, firmware: 'mock-1.0.0', rssi: -45 },
      { id: 'mock-secondary', name: 'Studio Bridge', ip: '192.168.1.201', port: 80, firmware: 'mock-1.0.0', rssi: -60 },
      { id: 'mock-stage', name: 'Stage Rig', ip: '192.168.50.25', port: 80, firmware: 'mock-1.0.0', rssi: -70 },
    ];
    return ok(res, { items, total: items.length });
  }

  // Palettes: minimal set for UI validation
  if (path === '/api/palettes') {
    if (method !== 'GET') return methodNotAllowed(res);
    const palettes = [
      { id: 0, name: 'Aurora', colors: [ { position: 0, r: 32, g: 128, b: 255 }, { position: 128, r: 255, g: 64, b: 128 }, { position: 255, r: 16, g: 24, b: 64 } ] },
      { id: 1, name: 'Sunset', colors: [ { position: 0, r: 255, g: 128, b: 0 }, { position: 128, r: 255, g: 32, b: 64 }, { position: 255, r: 64, g: 0, b: 32 } ] },
      { id: 2, name: 'Ocean', colors: [ { position: 0, r: 0, g: 64, b: 192 }, { position: 128, r: 0, g: 128, b: 255 }, { position: 255, r: 0, g: 192, b: 255 } ] },
    ];
    return ok(res, { count: palettes.length, palettes });
  }

  // Params bounds for UI
  if (path === '/api/params/bounds') {
    if (method !== 'GET') return methodNotAllowed(res);
    return ok(res, {
      brightness: { min: 0, max: 1, step: 0.01 },
      softness: { min: 0, max: 1, step: 0.01 },
      color: { min: 0, max: 1, step: 0.01 },
      color_range: { min: 0, max: 1, step: 0.01 },
      saturation: { min: 0, max: 1, step: 0.01 },
      warmth: { min: 0, max: 1, step: 0.01 },
      background: { min: 0, max: 1, step: 0.01 },
      speed: { min: 0, max: 1, step: 0.01 },
      palette_id: { min: 0, max: 32, step: 1 },
      audio_sensitivity: { min: 0.5, max: 2.0, step: 0.05 },
      brightness_floor: { min: 0.0, max: 0.3, step: 0.01 },
      frame_min_period_ms: { min: 4.0, max: 20.0, step: 0.5 },
    });
  }

  // Audio config (GET/POST) with clamping
  if (path === '/api/audio-config') {
    global.__k1_audio_config = global.__k1_audio_config || { microphone_gain: 1.0, vu_floor_pct: 0.9, active: true };
    if (method === 'GET') {
      return ok(res, global.__k1_audio_config);
    }
    if (method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        try {
          const update = body ? JSON.parse(body) : {};
          if (typeof update.microphone_gain === 'number') {
            const g = Math.max(0.5, Math.min(2.0, update.microphone_gain));
            global.__k1_audio_config.microphone_gain = g;
          }
          if (typeof update.vu_floor_pct === 'number') {
            const v = Math.max(0.5, Math.min(0.98, update.vu_floor_pct));
            global.__k1_audio_config.vu_floor_pct = v;
          }
          if (typeof update.active === 'boolean') {
            global.__k1_audio_config.active = update.active;
          }
          return ok(res, global.__k1_audio_config);
        } catch (e) {
          return json(res, 400, { error: 'Bad Request' });
        }
      });
      return;
    }
    return methodNotAllowed(res);
  }

  // WiFi APIs alignment
  if (path === '/api/wifi/ap-mode') {
    if (method !== 'GET') return methodNotAllowed(res);
    return ok(res, { ap_mode: false });
  }
  if (path === '/api/wifi/reassociate') {
    if (method !== 'POST') return methodNotAllowed(res);
    return ok(res, { success: true });
  }
  if (path === '/api/wifi/scan/results/json') {
    if (method !== 'GET') return methodNotAllowed(res);
    const now = Date.now();
    if (global.__wifi_scan_until && now < global.__wifi_scan_until) {
      return ok(res, { status: 'pending' });
    }
    const results = [
      { ssid: 'HomeNet', rssi_dbm: -50 - Math.floor(Math.random()*10), auth_mode: 4 },
      { ssid: 'Studio', rssi_dbm: -60 - Math.floor(Math.random()*10), auth_mode: 3 },
      { ssid: 'Guest', rssi_dbm: -70 - Math.floor(Math.random()*10), auth_mode: 5 }
    ];
    return ok(res, { status: 'complete', count: results.length, results });
  }
  if (path === '/api/wifi/scan') {
    if (method !== 'POST') return methodNotAllowed(res);
    global.__wifi_scan_until = Date.now() + 2000;
    return ok(res, { status: 'scan_initiated' });
  }
  if (path === '/api/wifi/tx-power') {
    if (method !== 'POST') return methodNotAllowed(res);
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const j = body ? JSON.parse(body) : {};
        let dbm = typeof j.power_dbm === 'number' ? j.power_dbm : 19.5;
        if (dbm < 8.0) dbm = 8.0; if (dbm > 19.5) dbm = 19.5;
        global.__wifi_tx_power_dbm = dbm;
        return ok(res, { applied_dbm: dbm });
      } catch { return json(res, 400, { error: 'Bad Request' }); }
    });
    return;
  }
  if (path === '/api/wifi/power-save') {
    if (method !== 'POST') return methodNotAllowed(res);
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const j = body ? JSON.parse(body) : {};
        const en = !!j.enable;
        global.__wifi_power_save = en;
        return ok(res, { power_save: en });
      } catch { return json(res, 400, { error: 'Bad Request' }); }
    });
    return;
  }
  if (path === '/api/wifi/metrics') {
    if (method !== 'GET') return methodNotAllowed(res);
    const jitter = (Math.random()*6)|0; // 0..5
    const rssi = -55 - jitter;
    const txp = global.__wifi_tx_power_dbm || 19.5;
    return ok(res, { ssid: 'MockSSID', rssi_dbm: rssi, tx_power_dbm: txp, connected: true });
  }
  if (path === '/api/wifi/channel') {
    if (method !== 'POST') return methodNotAllowed(res);
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const j = body ? JSON.parse(body) : {};
        let ch = Number(j.channel || 6);
        if (ch < 1) ch = 1; if (ch > 13) ch = 13;
        global.__wifi_channel = ch;
        return ok(res, { channel: ch });
      } catch { return json(res, 400, { error: 'Bad Request' }); }
    });
    return;
  }
  if (path === '/api/wifi/band-steering') {
    if (method !== 'POST') return methodNotAllowed(res);
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const j = body ? JSON.parse(body) : {};
        const en = !!j.enable;
        global.__wifi_band_steering = en;
        return ok(res, { enabled: en });
      } catch { return json(res, 400, { error: 'Bad Request' }); }
    });
    return;
  }

  if (path === '/api/device/performance' || path === '/api/device-performance') {
    if (method !== 'GET') return methodNotAllowed(res);
    return ok(res, {
      fps: 60,
      frame_time_us: 16666,
      render_avg_us: 4000,
      quantize_avg_us: 1500,
      rmt_wait_avg_us: 3000,
      rmt_tx_avg_us: 2000,
      cpu_percent: 12.3,
      memory_percent: 40.1,
      memory_free_kb: 1234,
      memory_total_kb: 4096,
      beat_queue_depth: 0,
      beat_queue_capacity: 128,
      beat_overflows_total: 0,
      fps_history: [60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60]
    });
  }

  if (path === '/api/metrics') {
    if (method !== 'GET') return methodNotAllowed(res);
    const body = [
      'k1_fps 60',
      'k1_frame_time_us 16666',
      'k1_cpu_percent 12.3',
      'k1_memory_free_kb 1234',
      'k1_beat_events_count 0',
      'k1_tempo_confidence 0.75'
    ].join('\n')
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*'
    })
    return res.end(body)
  }
  // Mock parameters and pattern selection
  // Minimal in-memory store to exercise control flows
  if (!global.__k1_params) {
    global.__k1_params = {
      brightness: 1.0,
      softness: 0.25,
      color: 0.33,
      color_range: 0.0,
      saturation: 0.75,
      warmth: 0.0,
      background: 0.25,
      speed: 0.5,
      palette_id: 0,
    };
    global.__k1_current_pattern = { index: 0, id: 'pattern_0', name: 'Prototype', is_audio_reactive: false };
  }

  if (path === '/api/patterns') {
    if (method !== 'GET') return methodNotAllowed(res);
    const patterns = Array.from({ length: 20 }).map((_, i) => ({
      index: i,
      id: `pattern_${i}`,
      name: i === 0 ? 'Prototype' : `Pattern ${i}`,
      description: i % 2 === 0 ? 'Static' : 'Audio reactive',
      audio_reactive: i % 2 === 1,
    }));
    return ok(res, { patterns, current_pattern: global.__k1_current_pattern.index });
  }

  if (path === '/api/pattern/current') {
    if (method !== 'GET') return methodNotAllowed(res);
    return ok(res, global.__k1_current_pattern);
  }

  if (path === '/api/params') {
    if (method === 'GET') {
      return ok(res, global.__k1_params);
    }
    if (method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        try {
          const update = body ? JSON.parse(body) : {};
          global.__k1_params = { ...global.__k1_params, ...update };
          return ok(res, { ok: true, applied: global.__k1_params });
        } catch (e) {
          return json(res, 400, { error: 'Bad Request' });
        }
      });
      return; // Defer response to 'end'
    }
    return methodNotAllowed(res);
  }

  if (path === '/api/select') {
    if (method !== 'POST') return methodNotAllowed(res);
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const update = body ? JSON.parse(body) : {};
        if (typeof update.index === 'number') {
          global.__k1_current_pattern = { index: update.index, id: `pattern_${update.index}`, name: `Pattern ${update.index}`, is_audio_reactive: false };
          return ok(res, { ok: true, selected: { index: update.index, id: `pattern_${update.index}` } });
        }
        return json(res, 400, { error: 'Invalid target' });
      } catch (e) {
        return json(res, 400, { error: 'Bad Request' });
      }
    });
    return; // Defer response to 'end'
  }

  if (path === '/api/rmt/diag') {
    if (method !== 'GET') return methodNotAllowed(res);
    return ok(res, {
      tx_rate_hz: 40000,
      recent_errors: [],
      dma_busy_percent: 12.5,
    });
  }

  if (path === '/api/rmt/reset') {
    if (method === 'POST') return ok(res);
    return methodNotAllowed(res);
  }

  if (path === '/api/led-tx/info') {
    if (method !== 'GET') return methodNotAllowed(res);
    return ok(res, {
      driver: 'RMT',
      pixels: 300,
      color_order: 'GRB',
    });
  }

  if (path === '/api/led-tx/recent') {
    if (method !== 'GET') return methodNotAllowed(res);
    return ok(res, { frames: 5, last_ms: 42 });
  }

  // Default 404
  return notFound(res);
});

server.listen(PORT, () => {
  console.log(`[MockDevice] Listening on http://localhost:${PORT}`);
});

function pathResolve(rel) {
  return path.join(UI_ROOT, rel);
}

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') return notFound(res);
      return json(res, 500, { error: 'Static Serve Error', message: err.message });
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  });
}

function contentTypeFor(filePath) {
  if (filePath.endsWith('.html')) return 'text/html';
  if (filePath.endsWith('.css')) return 'text/css';
  if (filePath.endsWith('.js')) return 'application/javascript';
  if (filePath.endsWith('.json')) return 'application/json';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}
