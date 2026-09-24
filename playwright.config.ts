import { defineConfig, devices } from '@playwright/test'

const PORT = 4320

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // The production build behind the CSP proxy, on its own ports, stopped when the run ends.
  webServer: {
    command: 'bun run serve',
    url: `http://localhost:${PORT}/api/health`,
    env: { PORT: String(PORT), UPSTREAM_PORT: String(PORT + 1) },
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
