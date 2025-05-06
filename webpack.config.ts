import path from 'path';

import { NormalModuleReplacementPlugin, type Configuration } from 'webpack';
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
        // helps working with @grafana/prometheus
        'semver/preload': path.resolve(__dirname, 'node_modules/semver/preload.js'),
      },
    },
    plugins: [
      new NormalModuleReplacementPlugin(/monaco-editor/, path.resolve(__dirname, 'src/stubs/monaco-editor.ts')),
      new NormalModuleReplacementPlugin(
        /@grafana\/plugin-ui/,
        path.resolve(__dirname, 'src/stubs/grafana-plugin-ui.ts')
      ),
      new NormalModuleReplacementPlugin(/moment-timezone/, path.resolve(__dirname, 'src/stubs/moment-timezone.ts')),
    ],
  });
};

export default config;
