import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PLAYWRIGHT_PORT || 4174);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      VITE_FIREBASE_API_KEY: "e2e-local-api-key",
      VITE_FIREBASE_AUTH_DOMAIN: "e2e.localhost",
      VITE_FIREBASE_PROJECT_ID: "e2e-project",
      VITE_FIREBASE_STORAGE_BUCKET: "e2e-project.appspot.com",
      VITE_FIREBASE_MESSAGING_SENDER_ID: "100000000000",
      VITE_FIREBASE_APP_ID: "1:100000000000:web:e2e",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
