import { type AppRootProps } from '@grafana/data';
import { createContext } from 'react';

// This is used to be able to retrieve the root plugin props anywhere inside the app.
export const PluginPropsContext = createContext<AppRootProps | null>(null);

// eslint-disable-next-line sonarjs/no-commented-code
// export const usePluginProps = () => {
//   const pluginProps = useContext(PluginPropsContext);
//   return pluginProps;
// };
