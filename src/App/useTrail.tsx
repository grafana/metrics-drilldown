import { locationService } from '@grafana/runtime';
import { createContext, useEffect, useState } from 'react';

import { type DataTrail } from 'DataTrail';
import { getUrlForTrail, newMetricsTrail } from 'utils';

import { navigationEvents } from '../WingmanDataTrail/SideBar/sections/BookmarksList';

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

  // Subscribe to navigation events from BookmarksList
  useEffect(() => {
    const handleNavigation = (trail: DataTrail) => {
      goToUrlForTrail(trail);
    };

    // Subscribe to navigation events
    const unsubscribe = navigationEvents.subscribe(handleNavigation);

    // Clean up subscription
    return () => unsubscribe();
  }, []);

  return { trail, goToUrlForTrail };
}
