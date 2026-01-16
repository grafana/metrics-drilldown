const baseConfig = require('../eslint.config.js');
const playwright = require('eslint-plugin-playwright');
const globals = require('globals');

/**
 * @type {Array<import('eslint').Linter.Config>}
 */
module.exports = [
  // Override ignores - don't ignore e2e directory in the e2e config
  {
    ignores: [
      'node_modules/',
      'test-results/',
      'test-reports/',
      'provisioning/prometheus/data*',
      '!provisioning/prometheus/data.zip',
    ],
  },
  // Base configs (excluding the ignores block which has e2e/ in it)
  ...baseConfig.slice(1),
  playwright.configs['flat/recommended'],
  {
    name: 'metrics-drilldown/e2e',
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
        window: true,
        require: true,
        process: true,
      },
    },
    rules: {
      'no-undef': 'error',
      'sonarjs/no-nested-functions': 'off',
      // Disable Jest rules since we're using Playwright for E2E tests
      'jest/no-standalone-expect': 'off',
      'jest/valid-expect': 'off',
      'jest/expect-expect': 'off',
      'jest/valid-describe-callback': 'off',
      'jest/no-done-callback': 'off',
    },
  },
];
