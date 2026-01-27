import path from 'path';

import { type Configuration } from 'webpack';
import { merge } from 'webpack-merge';

import grafanaConfig from './.config/webpack/webpack.config';

const config = async (env): Promise<Configuration> => {
  const baseConfig = await grafanaConfig(env);

  return merge(baseConfig, {
    externals: ['react-router'],
    experiments: {
      // Required to load WASM modules.
      asyncWebAssembly: true,
    },
    output: {
      asyncChunks: true,
    },
    resolve: {
      alias: {
        // Ensure single instances of these packages when using pnpm
        // This prevents module duplication issues with i18n state
        '@grafana/i18n': path.resolve(process.cwd(), 'node_modules/@grafana/i18n'),
      },
    },
  });
};

export default config;
