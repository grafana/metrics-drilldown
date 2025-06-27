import { useEffect, useRef } from 'react';

import { reportExploreMetrics, type ViewName } from 'interactions';

export function useReportAppInitialized() {
  const initRef = useRef(false);

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;

      const view: ViewName = new URL(window.location.href).searchParams.get('metric')
        ? 'metric-details'
        : 'metrics-reducer';

      reportExploreMetrics('app_initialized', { view });
    }
  }, []);
}
