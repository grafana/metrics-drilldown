const tsParser = require('@typescript-eslint/parser');
const jsxA11y = require('eslint-plugin-jsx-a11y');

/**
 * @type {Array<import('eslint').Linter.Config>}
 */
module.exports = [
  jsxA11y.flatConfigs.recommended,
  {
    name: 'metrics-drilldown/a11y',
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
];
