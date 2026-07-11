import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  envDir: '.',
  server: {
    // Avoid 3001 — another local Node app often owns IPv4 :3001.
    port: 3003,
    strictPort: true,
    host: '127.0.0.1',
    open: '/desktop/san-pham',
    hmr: {
      host: '127.0.0.1',
      port: 3003,
      protocol: 'ws',
    },
  },
  preview: {
    port: 3003,
    strictPort: true,
  },
});
