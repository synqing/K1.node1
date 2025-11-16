import { defineConfig, loadEnv } from 'vite';
import path from 'node:path';
import react from '@vitejs/plugin-react-swc';

// Vite dev config: serve frontend on 3003 and proxy API to backend on 3001
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_DEVICE_PROXY_TARGET || 'http://localhost:8800';
  return {
  plugins: [
    react(),
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
  },
  optimizeDeps: {
    include: ["react", "react-dom"],
  },
  server: {
    port: 3003,
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
};
});
