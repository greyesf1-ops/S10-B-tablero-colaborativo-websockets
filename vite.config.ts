import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
});
