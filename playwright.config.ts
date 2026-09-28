import { defineConfig, devices } from '@playwright/test'
import { e2ePort } from './e2e/port'

const PORT = e2ePort()

export default defineConfig({
  testDir: 'e2e',
  // Vitest owns the unit specs beside the smoke tests.
  testIgnore: '**/port.spec.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // The panes again as a browser without the Navigation API sees them, such as an older Safari or Firefox.
    { name: 'no-navigation-api', use: { ...devices['Desktop Chrome'] }, testMatch: 'panes.spec.ts' },
    // The playground's isolation rests on each engine's sandbox and policy, so its frame runs in all three.
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testMatch: 'playground-frame.spec.ts' },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testMatch: 'playground-frame.spec.ts' },
  ],
  // The production build behind the CSP proxy, on its own ports, stopped when the run ends.
  webServer: {
    command: 'bun run serve',
    url: `http://localhost:${PORT}/api/health`,
    env: { PORT: String(PORT), UPSTREAM_PORT: String(PORT + 1) },
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
