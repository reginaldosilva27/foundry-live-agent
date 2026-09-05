import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// The BFF is a separate origin in development (its CORS allow-list names :5173).
// Nothing here proxies it: keeping the two origins visible is part of what the
// project teaches — the browser talks to the BFF, never to Foundry.
export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.FRONTEND_PORT ?? 5173),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
