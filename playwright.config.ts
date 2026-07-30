import { defineConfig } from "playwright/test";

const baseURL = `${process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000"}/`.replace(
  /\/+$/,
  "/",
);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "tmp/e2e-report" }]],
  use: {
    baseURL,
    locale: "pt-BR",
    timezoneId: "America/Bahia",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  outputDir: "tmp/e2e-results",
});
