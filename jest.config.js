// force timezone to UTC to allow tests to work regardless of local timezone
// generally used by snapshots, but can affect specific tests
process.env.TZ = 'UTC';

const baseConfig = require('./.config/jest.config'); // Jest configuration provided by Grafana scaffolding
const { nodeModulesToTransform, grafanaESModules } = require('./.config/jest/utils');
const esModules = [...grafanaESModules, '@bsull/augurs', 'monaco-promql', 'tsqtsq'];

module.exports = {
  ...baseConfig,
  transformIgnorePatterns: [nodeModulesToTransform(esModules)],
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    '\\.svg$': '<rootDir>/src/mocks/svgMock.js',
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
};
