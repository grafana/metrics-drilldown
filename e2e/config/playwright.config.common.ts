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

export function getGrafanaUrl() {
  if (process.env.GRAFANA_URL) {
    return process.env.GRAFANA_URL;
  }

  const grafanaPort = process.env.GRAFANA_PORT || 3001;
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
  expectTimeout?: number;
  actionTimeout?: number;
  retries?: number;
  forbidOnly?: boolean;
  workers?: number;
};

export function config(config: CustomEnvConfig) {
  return defineConfig<PluginOptions>({
    // Custom config
    reporter: config.reporter,
    expect: {
      timeout: Number(config.expectTimeout) > 0 ? config.expectTimeout : 5000,
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
      /* timeouts for each action, like clicks */
      actionTimeout: Number(config.actionTimeout) > 0 ? config.actionTimeout : 5000,
      /* user and credentials */
      user: getGrafanaUser(),
      grafanaAPICredentials: getGrafanaUser(),
      /* Base URL to use in actions like `await page.goto('/')`. */
      baseURL: getGrafanaUrl(),
      screenshot: 'only-on-failure',
      video: 'retain-on-failure',
      trace: 'retain-on-failure',
    },
    /* Configure projects for major browsers */
    projects: [
      // 1. Login to Grafana and store the cookie on disk for use in other tests.
      {
        name: 'auth',
        testDir: pluginE2eAuth,
        testMatch: [/.*\.js/], // eslint-disable-line sonarjs/slow-regex
      },
      // 2. Run tests in Google Chrome. Every test will start authenticated as admin user.
      {
        name: 'chromium',
        use: {
          ...devices['Desktop Chrome'],
          viewport: CHROMIUM_VIEWPORT,
          // Used by the Copy URL test
          permissions: ['clipboard-read', 'clipboard-write'],
        },
        dependencies: ['auth'],
      },
    ],
  });
}
