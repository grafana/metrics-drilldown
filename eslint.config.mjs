import baseConfig from './.config/eslint.config.mjs';
// eslint-disable-next-line import/no-unresolved -- package.json exports field not recognized by import plugin
import grafanaI18nPlugin from '@grafana/i18n/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';
import oxlint from 'eslint-plugin-oxlint';

/**
 * @type {Array<import('eslint').Linter.Config>}
 */
export default [
  {
    ignores: [
      'node_modules/',
      'dist/',
      'artifacts/',
      'coverage/',
      '.config/',
      'e2e/',
      'playwright/',
      '*.log',
      '**/eslint.config.*',
    ],
  },
  ...baseConfig,
  importPlugin.flatConfigs.typescript,
  sonarjs.configs.recommended,
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
    name: 'metrics-drilldown/main',
    files: ['**/*.{ts,tsx,js,jsx}'],
    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
      },
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // Grafana Scenes uses a pattern where hooks are called inside static Component
      // functions on classes that extend SceneObjectBase. This is intentional and valid.
      // react-hooks v7 is stricter about detecting "class components" even when hooks
      // are used in static function properties. Disable these rules as they produce
      // false positives for the Scenes architecture.
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/static-components': 'off',
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='console']",
          message: "Avoid using console directly. Use the custom logger from 'src/tracking/logger/logger.ts' instead.",
        },
      ],
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling'], 'index', 'object', 'type'],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
          named: {
            enabled: true,
            types: 'types-last',
          },
        },
      ],
      'sonarjs/cognitive-complexity': 'off', // handled by oxlint
      'sonarjs/todo-tag': ['warn'],
      'sonarjs/fixme-tag': ['warn'],
      'sonarjs/prefer-regexp-exec': ['off'],
    },
  },
  {
    name: 'metrics-drilldown/typescript-deprecation',
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      '@typescript-eslint/no-deprecated': 'warn',
    },
  },
  ...oxlint.buildFromOxlintConfigFile('./.oxlintrc.json'),
];
