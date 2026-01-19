const grafanaConfig = require('@grafana/eslint-config/flat');
const grafanaI18nPlugin = require('@grafana/i18n/eslint-plugin');
const jsxA11y = require('eslint-plugin-jsx-a11y');
const sonarjs = require('eslint-plugin-sonarjs');

/**
 * @type {Array<import('eslint').Linter.Config>}
 */
module.exports = [
  {
    ignores: ['node_modules/', 'dist/', 'artifacts/', 'coverage/', '.config/', 'e2e/', 'playwright/', '*.log'],
  },
  ...grafanaConfig,
  sonarjs.configs.recommended,
  jsxA11y.flatConfigs.recommended,
  {
    name: 'metrics-drilldown/i18n',
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', '**/__tests__/**', '**/test/**', '**/mocks/**'],
    plugins: {
      '@grafana/i18n': grafanaI18nPlugin,
    },
    rules: {
      '@grafana/i18n/no-untranslated-strings': [
        'error',
        {
          basePaths: ['src'],
          namespace: 'grafana-metricsdrilldown-app',
          calleesToIgnore: ['^css$', 'use[A-Z].*', '^get.*Styles$'],
        },
      ],
      '@grafana/i18n/no-translation-top-level': 'error',
    },
  },
  {
    name: 'metrics-drilldown/a11y',
    files: ['**/*.{ts,tsx,js,jsx}'],
    linterOptions: {
      // Disable warnings about unused eslint-disable directives since this config
      // disables many rules that are active in the main config
      reportUnusedDisableDirectives: 'off',
    },
    rules: {
      // Disable all non-a11y rules - this config only checks accessibility
      'react/prop-types': 'off',
      'no-restricted-syntax': 'off',
      'import/order': 'off',
      'import/no-unresolved': 'off',
      'import/named': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      'no-unused-vars': 'off',
      'sonarjs/cognitive-complexity': 'off',
      'sonarjs/todo-tag': 'off',
      'sonarjs/fixme-tag': 'off',
      'sonarjs/prefer-regexp-exec': 'off',
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/static-components': 'off',
    },
  },
];
