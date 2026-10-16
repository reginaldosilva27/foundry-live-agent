import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { defineConfig, devices } from '@playwright/test'

// The end-to-end smoke runs the whole app against the DEMO entrypoint (spec 050): recorded Foundry
// turns through the real BFF and the real normaliser, no Azure credential. Its own ports, so it
// never collides with a developer's `just backend` (8000) and `just frontend` (5173) — and the BFF
// is told which origin to trust, because CORS would otherwise refuse the page (FRONTEND_ORIGINS).
const BFF_PORT = 8100
const WEB_PORT = 5199
const backend = fileURLToPath(new URL('../backend', import.meta.url))
// The repository's venv when there is one (a checkout); the job's interpreter in CI.
const localPython = fileURLToPath(new URL('../.venv/bin/python', import.meta.url))
const python = process.env.E2E_PYTHON ?? (existsSync(localPython) ? localPython : 'python')

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `"${python}" -m uvicorn app.demo:create_demo_app --factory --port ${BFF_PORT}`,
      cwd: backend,
      url: `http://localhost:${BFF_PORT}/health`,
      env: { FRONTEND_ORIGINS: `http://localhost:${WEB_PORT}` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `node node_modules/vite/bin/vite.js --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { VITE_BFF_URL: `http://localhost:${BFF_PORT}` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
