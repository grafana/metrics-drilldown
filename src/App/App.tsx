import { type AppRootProps } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import React, { createContext, useState } from 'react';

import { type DataTrail } from 'DataTrail';
import { getUrlForTrail, newMetricsTrail } from 'utils';

import { AppRoutes } from './Routes';
import { PluginPropsContext } from '../utils/utils.plugin';

interface MetricsAppContext {
  trail: DataTrail;
  goToUrlForTrail: (trail: DataTrail) => void;
}

export const MetricsContext = createContext<MetricsAppContext>({
  trail: newMetricsTrail(undefined, true),
  goToUrlForTrail: (trail: DataTrail) => {},
});

function App(props: AppRootProps) {
  const [trail, setTrail] = useState<DataTrail>(newMetricsTrail(undefined, true));
  const goToUrlForTrail = (trail: DataTrail) => {
    locationService.push(getUrlForTrail(trail));
    setTrail(trail);
  };

  return (
    <PluginPropsContext.Provider value={props}>
      <MetricsContext.Provider value={{ trail, goToUrlForTrail }}>
        <AppRoutes />
      </MetricsContext.Provider>
    </PluginPropsContext.Provider>
  );
}

export default App;
