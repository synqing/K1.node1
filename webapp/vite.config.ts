import { defineConfig } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react-swc';
import { visualizer } from 'rollup-plugin-visualizer';

// Vite dev config: serve frontend on 3003 and proxy API to backend on 3001
export default defineConfig({
  plugins: [
    react(),
    visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true, template: 'treemap' }),
  ],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@backend': path.resolve(__dirname, 'src/backend'),
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('/react/') || id.includes('/react-dom/')) return 'react';
            if (id.includes('@radix-ui')) return 'radix';
            if (id.includes('@tanstack')) return 'tanstack';
            if (id.includes('recharts')) return 'charts';
            if (id.includes('framer-motion')) return 'motion';
            if (id.includes('lucide-react')) return 'icons';
            if (id.includes('class-variance-authority') || id.includes('clsx')) return 'ui-utils';
          }
        },
      },
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
