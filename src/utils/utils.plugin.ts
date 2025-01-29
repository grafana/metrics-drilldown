import { type AppRootProps } from '@grafana/data';
import { createContext, useContext } from 'react';

// This is used to be able to retrieve the root plugin props anywhere inside the app.
export const PluginPropsContext = createContext<AppRootProps | null>(null);

export const usePluginProps = () => {
  const pluginProps = useContext(PluginPropsContext);

  return pluginProps;
};

export const usePluginMeta = () => {
  const pluginProps = usePluginProps();

  return pluginProps?.meta;
};
