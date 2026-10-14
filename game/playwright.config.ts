import { defineConfig } from '@playwright/test';

// Play tests drive the real game in Chromium against the Vite dev server.
export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  workers: 2,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5179',
    viewport: { width: 960, height: 540 },
    launchOptions: { args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'npx vite --port 5179 --strictPort',
    port: 5179,
    reuseExistingServer: true,
  },
});
