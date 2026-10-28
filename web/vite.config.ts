import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // Listen on the LAN so the phone can open http://<laptop-ip>:5173/phone.html
    host: true,
    proxy: {
      '/ws': { target: 'ws://localhost:8787', ws: true },
      '/api': 'http://localhost:8787',
    },
  },
  build: {
    rollupOptions: {
      input: { viewer: 'index.html', phone: 'phone.html' },
    },
  },
});
