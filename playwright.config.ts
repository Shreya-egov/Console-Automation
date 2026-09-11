import { defineConfig } from '@playwright/test';
import { config } from './src/config/env';
import type { TestOptions } from './src/fixtures/test';

/**
 * The console is a slow app to drive: a campaign has to be built step by step
 * before most screens can be reached, the mobile-app setup is eight save-and-
 * return round trips, and an uploaded template is validated server-side. The
 * timeouts below are sized for that, not for a typical web app.
 */
export default defineConfig<TestOptions>({
  testDir: './tests',
  outputDir: './test-results',

  /** A full flow test drives the whole wizard plus a server-side validation. */
  timeout: 30 * 60 * 1000,
  expect: { timeout: 30_000 },

  fullyParallel: true,
  workers: config.workers,
  retries: config.retries,
  forbidOnly: !!process.env.CI,

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['allure-playwright', { resultsDir: 'allure-results' }],
  ],

  use: {
    baseURL: config.baseUrl,
    headless: config.headless,

    // --start-maximized has no effect headless, where the viewport would
    // otherwise default to a size that collapses the header over the form fields.
    viewport: config.headless ? { width: 1920, height: 1080 } : null,

    // Matches the Java suite's 60s default: 30s was too tight, because the
    // campaign setup chain drives eight module screens and demo latency
    // intermittently pushed individual steps past the ceiling. Every wait that
    // actually gates a result is bounded explicitly in the page objects, so this
    // only caps how long a single step may take.
    actionTimeout: 60_000,
    navigationTimeout: 120_000,

    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',

    channel: config.browser === 'chromium' ? undefined : config.browser,
    launchOptions: {
      args: ['--disable-dev-shm-usage', '--no-sandbox', '--start-maximized'],
    },
  },

  /**
   * One project per campaign type. A spec is written once and runs for both, with
   * `campaignType` available as a fixture wherever the two types differ.
   */
  projects: [
    { name: 'bednet', use: { campaignType: 'BEDNET' } },
    { name: 'mrdn', use: { campaignType: 'MR-DN' } },
  ],
});
