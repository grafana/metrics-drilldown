// force timezone to UTC to allow tests to work regardless of local timezone
// generally used by snapshots, but can affect specific tests
process.env.TZ = 'UTC';

const baseConfig = require('./.config/jest.config'); // Jest configuration provided by Grafana scaffolding
const { nodeModulesToTransform, grafanaESModules } = require('./.config/jest/utils');
const esModules = [
  ...grafanaESModules,
  '@bsull/augurs',
  'monaco-promql',
  'tsqtsq',
  'p-limit',
  'yocto-queue',
  'marked',
  'react-calendar',
  'get-user-locale',
  'memoize',
  'mimic-function',
  '@wojtekmaj/date-utils',
  'leven',
];

module.exports = {
  ...baseConfig,
  transformIgnorePatterns: [nodeModulesToTransform(esModules)],
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    '\\.svg$': '<rootDir>/src/test/mocks/svgMock.js',
    '^.+/logger/logger$': '<rootDir>/src/test/mocks/loggerMock.ts',
    '^.+/interactions$': '<rootDir>/src/test/mocks/interactionsMock.ts',
    '^.+/userStorage$': '<rootDir>/src/test/mocks/userStorage.ts',
  },
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        sourceMaps: 'inline',
        jsc: {
          parser: {
            syntax: 'typescript',
            tsx: true,
            decorators: false,
            dynamicImport: true,
          },
          target: 'es2022',
          // Add these options for proper property descriptors
          keepClassNames: true,
          preserveAllComments: true,
          transform: {
            legacyDecorator: true,
            decoratorMetadata: true,
          },
        },
        module: {
          type: 'commonjs',
          strict: true,
          strictMode: true,
          noInterop: false,
        },
      },
    ],
  },
  resetMocks: true,
  clearMocks: true,
  resetModules: true,
  collectCoverageFrom: ['./src/**'],
  coverageReporters: ['json-summary', 'text', 'text-summary'],
};
