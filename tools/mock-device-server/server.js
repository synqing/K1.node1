// Minimal dependency-free mock device server.
// Serves core firmware endpoints with permissive CORS for local UI development.

const http = require('http');

const PORT = Number(process.env.MOCK_DEVICE_PORT || 8080);

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

