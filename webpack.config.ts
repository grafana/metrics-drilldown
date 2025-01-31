import { merge } from 'webpack-merge';

import grafanaConfig from './.config/webpack/webpack.config';

import type { Configuration } from 'webpack';

const config = async (env): Promise<Configuration> => {
  const baseConfig = await grafanaConfig(env);

  return merge(baseConfig, {
    externals: ['react-router', 'react-router-dom'],
    experiments: {
      // Required to load WASM modules.
      asyncWebAssembly: true,
    },
    output: {
      asyncChunks: true,
    },
  });
};

export default config;
