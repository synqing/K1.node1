import { defineConfig } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react-swc';

// Vite dev config: serve frontend on 3003 and proxy API to backend on 3001
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@backend': path.resolve(__dirname, 'src/backend'),
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom"],
  },
  server: {
    port: 3003,
    // Dev-only middleware to stub performance endpoint when backend is offline
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.method === 'GET' && req.url.startsWith('/api/device/performance')) {
          const payload = {
            fps: 60,
            frame_time_us: 16667,
            cpu_percent: 18.5,
            memory_percent: 42.1,
            memory_free_kb: 128000,
            memory_total_kb: 256000,
            fps_history: Array.from({ length: 30 }, () => 58 + Math.floor(Math.random() * 4)),
          };
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(payload));
          return;
        }
        next();
      });
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8800',
        changeOrigin: true,
        secure: false,
        bypass(req, res) {
          if (req.url && req.method === 'GET' && req.url.startsWith('/api/device/performance')) {
            const payload = {
              fps: 60,
              frame_time_us: 16667,
              cpu_percent: 18.5,
              memory_percent: 42.1,
              memory_free_kb: 128000,
              memory_total_kb: 256000,
              fps_history: Array.from({ length: 30 }, () => 58 + Math.floor(Math.random() * 4)),
            };
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(payload));
            return true; // Do not proxy
          }
          return false;
        },
      },
    },
  },
});
