import { type Configuration } from 'webpack';
import LiveReloadPlugin from 'webpack-livereload-plugin';
import { merge } from 'webpack-merge';

import grafanaConfig from './.config/webpack/webpack.config';

const config = async (env): Promise<Configuration> => {
  const baseConfig = await grafanaConfig(env);

  // Get the live reload port from environment variable or use default
  const liveReloadPort = process.env.WEBPACK_LIVERELOAD_PORT
    ? parseInt(process.env.WEBPACK_LIVERELOAD_PORT, 10)
    : 35729;

  // Filter out the original LiveReloadPlugin from base config to avoid conflicts
  if (baseConfig.plugins && env.development) {
    baseConfig.plugins = baseConfig.plugins.filter((plugin) => !(plugin instanceof LiveReloadPlugin));
  }

  return merge(baseConfig, {
    externals: ['react-router'],
    experiments: {
      // Required to load WASM modules.
      asyncWebAssembly: true,
    },
    output: {
      asyncChunks: true,
    },
    plugins: [
      new LiveReloadPlugin({
        port: liveReloadPort,
        hostname: 'localhost',
      }),
    ],
  });
};

export default config;
