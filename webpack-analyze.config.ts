import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import { merge } from 'webpack-merge';

import projectConfig from './webpack.config';

import type { Configuration } from 'webpack';

const config = async (env): Promise<Configuration> => {
  const baseConfig = await projectConfig(env);

  return merge(baseConfig, {
    plugins: [new BundleAnalyzerPlugin({ analyzerMode: 'static' })],
  });
};

export default config;
