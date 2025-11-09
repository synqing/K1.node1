import { defineConfig } from 'vite';
import path from 'node:path';
import react from '@vitejs/plugin-react-swc';

// Vite dev config: serve frontend on 3003 and proxy API to backend on 3001
export default defineConfig({
  plugins: [
    react(),
    // Note: rollup-plugin-visualizer is optional; install with: npm install rollup-plugin-visualizer
    // Then uncomment below to enable bundle size visualization in dist/stats.html
    // visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true, template: 'treemap' }),
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
    // Proxy API to backend on 8800; provides mock data for performance endpoint when backend is offline
    proxy: {
      '/api': {
        target: 'http://localhost:8800',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
