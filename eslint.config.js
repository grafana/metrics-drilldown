const grafanaConfig = require('@grafana/eslint-config/flat');
const importPlugin = require('eslint-plugin-import');
const sonarjs = require('eslint-plugin-sonarjs');
const jest = require('eslint-plugin-jest');
const jsxA11y = require('eslint-plugin-jsx-a11y');
const globals = require('globals');

/**
 * @type {Array<import('eslint').Linter.Config>}
 */
module.exports = [
  {
    ignores: [
      'node_modules/',
      'dist/',
      'artifacts/',
      'coverage/',
      '.config/',
      'e2e/', // handled by separate config
      'playwright/',
      '*.log',
    ],
  },
  ...grafanaConfig,
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  sonarjs.configs.recommended,
  jest.configs['flat/recommended'],
  jsxA11y.flatConfigs.recommended,
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
      'react/prop-types': 'off',
      // Disallow console usage - suggests using the custom logger instead
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='console']",
          message:
            "Avoid using console directly. Use the custom logger from 'src/tracking/logger/logger.ts' instead. Example: import { logger } from 'src/tracking/logger/logger'; logger.log('message');",
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
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          fixStyle: 'inline-type-imports',
        },
      ],
      'jest/expect-expect': ['error'],
      'no-unused-vars': ['error'],
      'sonarjs/cognitive-complexity': ['error', 11],
      'sonarjs/todo-tag': ['warn'],
      'sonarjs/fixme-tag': ['warn'],
      'sonarjs/prefer-regexp-exec': ['off'],
    },
  },
  {
    name: 'metrics-drilldown/typescript-deprecation',
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-deprecated': 'warn',
    },
  },
  {
    name: 'metrics-drilldown/jest-config',
    files: ['jest.config.js'],
    rules: {
      'import/order': 'off',
    },
  },
  {
    name: 'metrics-drilldown/tests',
    files: ['./tests/**/*'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
];
