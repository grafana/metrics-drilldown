import { createContext, useContext } from 'react';

import { type DataTrail } from 'AppDataTrail/DataTrail';
import { newMetricsTrail } from 'utils';

interface AppContextState {
  trail: DataTrail;
}

export const defaultTrail = newMetricsTrail();

export const AppContext = createContext<AppContextState>({
  trail: defaultTrail,
});

export function useMetricsAppContext() {
  return useContext(AppContext);
}
