import grafanaI18nPlugin from '@grafana/i18n/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import jestPlugin from 'eslint-plugin-jest';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import playwrightPlugin from 'eslint-plugin-playwright';
import sonarjsPlugin from 'eslint-plugin-sonarjs';

import baseConfig from './.config/eslint.config.mjs';

export default [
  {
    ignores: [
      '**/logs',
      '**/*.log',
      '**/npm-debug.log*',
      '**/yarn-debug.log*',
      '**/yarn-error.log*',
      '**/.pnpm-debug.log*',
      '**/node_modules/',
      '.yarn/cache',
      '.yarn/unplugged',
      '.yarn/build-state.yml',
      '.yarn/install-state.gz',
      '**/.pnp.*',
      '**/pids',
      '**/*.pid',
      '**/*.seed',
      '**/*.pid.lock',
      '**/lib-cov',
      '**/coverage',
      '**/dist/',
      '**/artifacts/',
      '**/work/',
      '**/ci/',
      'test-results/',
      'playwright-report/',
      'blob-report/',
      'playwright/.cache/',
      'playwright/.auth/',
      '**/.idea',
      '**/.eslintcache',
      '**/.config/',
      '**/compiled/',
    ],
  },
  ...baseConfig,
  {
    rules: {
      // Downgrade to warning - pre-existing issues in Grafana Scenes components
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    plugins: {
      import: importPlugin,
    },
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
    rules: {
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
    },
  },
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    plugins: {
      'jsx-a11y': jsxA11yPlugin,
    },
    rules: {
      ...jsxA11yPlugin.flatConfigs.recommended.rules,
    },
  },
  {
    plugins: {
      sonarjs: sonarjsPlugin,
    },
    rules: {
      'sonarjs/cognitive-complexity': ['error', 11],
      'sonarjs/todo-tag': ['warn'],
      'sonarjs/fixme-tag': ['warn'],
      'sonarjs/prefer-regexp-exec': ['off'],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}'],
    plugins: {
      jest: jestPlugin,
    },
    rules: {
      'jest/expect-expect': ['error'],
    },
  },
  {
    files: ['e2e/**/*.{ts,tsx}'],
    plugins: {
      playwright: playwrightPlugin,
    },
    rules: {
      ...playwrightPlugin.configs['flat/recommended'].rules,
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          fixStyle: 'inline-type-imports',
        },
      ],
      'no-unused-vars': ['error'],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='console']",
          message:
            "Avoid using console directly. Use the custom logger from 'src/tracking/logger/logger.ts' instead. Example: import { logger } from 'src/tracking/logger/logger'; logger.log('message');",
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      '**/*.test.{ts,tsx}',
      '**/__tests__/**/*.{ts,tsx}',
      '**/test/**/*.{ts,tsx}',
      '**/mocks/**/*.{ts,tsx}',
      '**/fixtures/**/*.{ts,tsx}',
    ],
    plugins: {
      '@grafana/i18n': grafanaI18nPlugin,
    },
    rules: {
      '@grafana/i18n/no-untranslated-strings': [
        'error',
        {
          calleesToIgnore: ['^css$', 'use[A-Z].*'],
        },
      ],
      '@grafana/i18n/no-translation-top-level': 'error',
    },
  },
  {
    files: ['jest.config.js'],
    rules: {
      'import/order': 'off',
    },
  },
];
