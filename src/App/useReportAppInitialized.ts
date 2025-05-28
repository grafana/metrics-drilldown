import { useEffect, useState } from 'react';

import { reportExploreMetrics, type ViewName } from 'interactions';

export function useReportAppInitialized() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized) {
      setInitialized(true);

      const view: ViewName = new URL(window.location.href).searchParams.get('metric')
        ? 'metric-details'
        : 'metrics-reducer';

      reportExploreMetrics('app_initialized', { view });
    }
  }, [initialized]);
}
