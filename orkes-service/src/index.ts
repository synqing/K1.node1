/**
 * K1.node1 Orkes Service
 *
 * Express server providing REST API for Orkes Conductor workflow orchestration.
 * Handles pattern compilation, asset processing, CI/CD, and analytics workflows.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import workflowRoutes from './routes/workflows.js';
import { getOrkesClient, closeOrkesClient } from './config/orkes.js';
import { startPatternCompilerWorker } from './workers/index.js';

const app = express();
const PORT = process.env.PORT || 4002;

// ============================================================================
// Middleware
// ============================================================================

app.use(express.json());

// CORS configuration
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
  })
);

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================================================
// Routes
// ============================================================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'k1-orkes-service',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

// Orkes connection status
app.get('/api/status', async (req, res) => {
  try {
    const client = await getOrkesClient();
    res.json({
      connected: !!client,
      serverUrl: process.env.ORKES_SERVER_URL,
      authenticated: !!(process.env.ORKES_KEY_ID && process.env.ORKES_KEY_SECRET),
    });
  } catch (error) {
    res.status(500).json({
      connected: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Workflow management routes
app.use('/api/workflows', workflowRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Error]', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

// ============================================================================
// Server Lifecycle
// ============================================================================

// Initialize Orkes client on startup
async function startup() {
  try {
    console.log('[Service] Starting K1 Orkes Service...');
    console.log('[Service] Node version:', process.version);
    console.log('[Service] Environment:', process.env.NODE_ENV || 'development');

    // Initialize Orkes connection
    await getOrkesClient();
    console.log('[Service] Connected to Orkes Conductor');

    // Start pattern compiler worker
    console.log('[Service] Starting pattern compilation worker...');
    await startPatternCompilerWorker();

    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`[Service] Server listening on port ${PORT}`);
      console.log(`[Service] Health check: http://localhost:${PORT}/health`);
      console.log(`[Service] API status: http://localhost:${PORT}/api/status`);
    });
  } catch (error) {
    console.error('[Service] Startup failed:', error);
    process.exit(1);
  }
}

// Graceful shutdown
function shutdown() {
  console.log('[Service] Shutting down...');
  closeOrkesClient();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the server
startup();
