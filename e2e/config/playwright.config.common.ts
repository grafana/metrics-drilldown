import path, { dirname, resolve } from 'node:path';

import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';
import { config as loadDotEnv } from 'dotenv';

import { CHROMIUM_VIEWPORT } from './constants';

import type { PluginOptions, User } from '@grafana/plugin-e2e';

const pluginE2eAuth = `${dirname(require.resolve('@grafana/plugin-e2e'))}/auth`;

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
loadDotEnv({ path: resolve(process.cwd(), '.env') });

function getGrafanaUrl() {
  if (process.env.GRAFANA_URL) {
    return process.env.GRAFANA_URL;
  }

  const grafanaPort = process.env.GRAFANA_PORT || 3000;
  return `http://localhost:${grafanaPort}`;
}

function getGrafanaUser(): User {
  return {
    user: process.env.GRAFANA_USER || 'admin',
    password: process.env.GRAFANA_PASSWORD || 'admin',
  };
}

type CustomEnvConfig = {
  reporter: PlaywrightTestConfig['reporter'];
  timeout?: number;
  retries?: number;
  forbidOnly?: boolean;
  workers?: number;
};

export function config(config: CustomEnvConfig) {
  return defineConfig<PluginOptions>({
    // Custom config
    reporter: config.reporter,
    expect: {
      timeout: Number(config.timeout) > 0 ? config.timeout : 5000,
      toHaveScreenshot: { maxDiffPixelRatio: 0.01 }, // tweak me with experience
    },
    retries: config.retries && config.retries > 0 ? config.retries : 0,
    forbidOnly: config.forbidOnly || false,
    workers: config.workers || 1,
    // Look for test files in the "tests" directory, relative to this configuration file.
    testDir: path.join(process.cwd(), 'e2e', 'tests'),
    // Folder for test artifacts such as screenshots, videos, traces, etc.
    outputDir: '../test-results',
    /* Run tests in files in parallel */
    fullyParallel: true,
    /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
    use: {
      user: getGrafanaUser(),
      grafanaAPICredentials: getGrafanaUser(),
      /* Base URL to use in actions like `await page.goto('/')`. */
      baseURL: getGrafanaUrl(),
      // Record trace only when retrying a test for the first time.
      screenshot: 'only-on-failure',
      // Record video only when retrying a test for the first time.
      video: 'on-first-retry',
      /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
      trace: 'on-first-retry',
    },
    /* Configure projects for major browsers */
    projects: [
      // 1. Login to Grafana and store the cookie on disk for use in other tests.
      {
        name: 'auth',
        testDir: pluginE2eAuth,
        testMatch: [/.*\.js/],
      },
      // 2. Run tests in Google Chrome. Every test will start authenticated as admin user.
      {
        name: 'chromium',
        use: {
          ...devices['Desktop Chrome'],
          viewport: CHROMIUM_VIEWPORT,
        },
        dependencies: ['auth'],
      },
    ],
  });
}
