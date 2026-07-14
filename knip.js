export default {
  // the exclamation mark suffix (!) indicates production file patterns
  entry: ['src/App/App.tsx!'],
  project: ['src/**/*.{js,ts,tsx}!'],
  ignore: ['src/test/**'], // folder for unit testing mocks and stubs
  ignoreBinaries: ['knip'],
  ignoreDependencies: [
    // dependencies
    '@grafana/lezer-logql',
    '@lezer/common',
    // devDependencies
    '@grafana/eslint-config',
    '@grafana/plugin-e2e',
    '@stylistic/eslint-plugin-ts',
    '@swc/helpers',
    '@testing-library/jest-dom',
    '@types/testing-library__jest-dom',
    '@rsdoctor/rspack-plugin',
    '@types/ws',
    'dotenv',
    'eslint-config-prettier',
    'eslint-plugin-deprecation',
    'eslint-plugin-jsdoc',
    'eslint-plugin-playwright',
    'eslint-plugin-react',
    'eslint-plugin-react-hooks',
    'eslint-webpack-plugin',
    'glob',
    'replace-in-file-webpack-plugin',
    'rspack-plugin-virtual-module',
    'terser-webpack-plugin',
    'ts-checker-rspack-plugin',
    'ts-node',
    'webpack',
    'ws',
    // unlisted dependencies
    '@jest/globals',
    'lodash',
    'webpack-merge',
  ],
};
