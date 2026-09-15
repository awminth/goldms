import dotenv from 'dotenv';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

export default defineConfig(() => {
  const frontendPort = Number(process.env.FRONTEND_PORT) || 7020;
  const backendPort = Number(process.env.BACKEND_PORT) || 7021;

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: frontendPort,
      strictPort: true,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
