import { createContext, useContext } from 'react';

import { type DataTrail } from 'DataTrail';
import { newMetricsTrail } from 'utils';

interface MetricsAppContextState {
  trail: DataTrail;
}

export const defaultTrail = newMetricsTrail();

export const MetricsAppContext = createContext<MetricsAppContextState>({
  trail: defaultTrail,
});

export function useMetricsAppContext() {
  return useContext(MetricsAppContext);
}
