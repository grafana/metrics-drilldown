import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import jestPlugin from 'eslint-plugin-jest';
import playwrightPlugin from 'eslint-plugin-playwright';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactPlugin from 'eslint-plugin-react';
import sonarjsPlugin from 'eslint-plugin-sonarjs';

import grafanaI18nPlugin from '@grafana/i18n/eslint-plugin';
import grafanaEslintConfig from '@grafana/eslint-config/flat.js';

export default [
  // 1. Global ignores
  {
    ignores: [
      'dist/',
      'artifacts/',
      'work/',
      'ci/',
      'coverage/',
      'node_modules/',
      '.eslintcache',
      'e2e/test-results/',
      'e2e/test-reports/',
      'playwright/',
    ],
  },

  // 2. Base Grafana configuration
  ...grafanaEslintConfig,

  // 3. Main source files configuration (TypeScript files)
  {
    name: 'metrics-drilldown/main',
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      import: importPlugin,
      sonarjs: sonarjsPlugin,
      jest: jestPlugin,
      '@grafana/i18n': grafanaI18nPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
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
      // Import plugin rules
      ...importPlugin.configs.recommended.rules,
      ...importPlugin.configs.typescript.rules,
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

      // SonarJS rules
      ...sonarjsPlugin.configs.recommended.rules,
      'sonarjs/cognitive-complexity': ['error', 11],
      'sonarjs/todo-tag': ['warn'],
      'sonarjs/fixme-tag': ['warn'],
      'sonarjs/prefer-regexp-exec': ['off'],
      'sonarjs/slow-regex': ['off'],

      // Jest rules
      ...jestPlugin.configs.recommended.rules,
      'jest/expect-expect': ['error'],

      // TypeScript rules
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-deprecated': 'warn',
      '@typescript-eslint/no-unused-vars': ['error'],

      // Custom rules
      'no-unused-vars': 'off',
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='console']",
          message:
            "Avoid using console directly. Use the custom logger from 'src/tracking/logger/logger.ts' instead. Example: import { logger } from 'src/tracking/logger/logger'; logger.log('message');",
        },
      ],

      // Grafana i18n rules (NO namespace prefix)
      '@grafana/i18n/no-untranslated-strings': [
        'error',
        {
          basePaths: ['src'],
          calleesToIgnore: ['^css$', 'use[A-Z].*'],
        },
      ],
      '@grafana/i18n/no-translation-top-level': 'error',
    },
  },

  // 4. Jest config file override
  {
    name: 'metrics-drilldown/jest-config',
    files: ['jest.config.js'],
    rules: {
      'import/order': 'off',
    },
  },

  // 5. Test files configuration
  {
    name: 'metrics-drilldown/tests',
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', 'tests/**/*', 'src/test/**/*'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      '@grafana/i18n/no-untranslated-strings': 'off',
      '@grafana/i18n/no-translation-top-level': 'off',
    },
  },

  // 6. E2E Playwright configuration
  {
    name: 'metrics-drilldown/e2e',
    files: ['e2e/**/*.{ts,tsx,js,jsx}'],
    plugins: {
      playwright: playwrightPlugin,
    },
    languageOptions: {
      globals: {
        // Disable Jest globals
        test: 'off',
        expect: 'off',
        describe: 'off',
        it: 'off',
        beforeEach: 'off',
        afterEach: 'off',
        beforeAll: 'off',
        afterAll: 'off',
        // Enable needed globals
        window: true,
        require: true,
        process: true,
        URLSearchParams: true,
      },
    },
    rules: {
      ...playwrightPlugin.configs['flat/recommended'].rules,
      'no-undef': 'error',
      'sonarjs/no-nested-functions': 'off',
      // Disable Jest rules
      'jest/no-standalone-expect': 'off',
      'jest/valid-expect': 'off',
      'jest/expect-expect': 'off',
      'jest/valid-describe-callback': 'off',
      'jest/no-done-callback': 'off',
      // Disable React hooks rules for Playwright fixtures
      'react-hooks/rules-of-hooks': 'off',
    },
  },
];
