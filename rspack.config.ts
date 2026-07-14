import path from 'path';

import { type Configuration } from '@rspack/core';
import { merge } from 'webpack-merge';

import grafanaConfig from './.config/rspack/rspack.config';

const config = async (env): Promise<Configuration> => {
  const baseConfig = await grafanaConfig(env);

  return merge(baseConfig, {
    externals: ['react-router'],
    output: {
      asyncChunks: true,
    },
    resolve: {
      alias: {
        // Ensure single instances of these packages when using pnpm
        // This prevents module duplication issues with i18n state
        '@grafana/i18n': path.resolve(process.cwd(), 'node_modules/@grafana/i18n'),
        immutable: require.resolve('immutable/dist/immutable.js'),
      },
    },
  });
};

export default config;
