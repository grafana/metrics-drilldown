import { locationService } from '@grafana/runtime';
import { createContext, useState } from 'react';

import { type DataTrail } from 'DataTrail';
import { getUrlForTrail, newMetricsTrail } from 'utils';

interface MetricsAppContext {
  trail: DataTrail;
  goToUrlForTrail: (trail: DataTrail) => void;
}

export const MetricsContext = createContext<MetricsAppContext>({
  trail: newMetricsTrail(),
  goToUrlForTrail: () => {},
});

export function useTrail() {
  const [trail, setTrail] = useState<DataTrail>(newMetricsTrail());

  const goToUrlForTrail = (trail: DataTrail) => {
    locationService.push(getUrlForTrail(trail));
    setTrail(trail);
  };

  return { trail, goToUrlForTrail };
}
