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

interface GetGrafanaUrlOptions {
  withScopes?: boolean;
}

type VersionType = 'major' | 'minor' | 'patch';

export function getGrafanaVersion(versionType: VersionType = 'patch') {
  if (versionType === 'major') {
    return process.env.GRAFANA_VERSION?.split('.')[0];
  }
  if (versionType === 'minor') {
    return process.env.GRAFANA_VERSION?.split('.').slice(0, 2).join('-');
  }

  return process.env.GRAFANA_VERSION?.split('.').join('-');
}

export function getGrafanaUrl(options: GetGrafanaUrlOptions = {}) {
  const port = options.withScopes ? process.env.GRAFANA_SCOPES_PORT : process.env.GRAFANA_PORT;
  return `http://localhost:${port}`;
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
  testDir?: string;
  baseURL?: string;
};

export function config(config: CustomEnvConfig) {
  return defineConfig<PluginOptions>({
    reporter: config.reporter,
    expect: {
      timeout: Number(config.expectTimeout) > 0 ? config.expectTimeout : 5000,
      toHaveScreenshot: {
        // tweak me with experience ;)
        maxDiffPixelRatio: 0.005, // 0.5% of the screenshot size in pixels
      },
    },
    retries: config.retries && config.retries > 0 ? config.retries : 0,
    forbidOnly: config.forbidOnly || false,
    workers: config.workers || 1,
    // Look for test files in the "tests" directory, relative to this configuration file.
    testDir: config.testDir || path.join(process.cwd(), 'e2e', 'tests'),
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
      baseURL: config.baseURL || getGrafanaUrl(),
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
