import { useEffect, useRef } from 'react';

import { reportExploreMetrics, type ViewName } from 'interactions';

export function useReportAppInitialized() {
  const initRef = useRef(false);

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;

      const url = new URL(window.location.href);
      const view: ViewName = url.searchParams.get('metric')
        ? 'metric-details'
        : 'metrics-reducer';
      const uel_epid = url.searchParams.get('uel_epid') ?? '';

      reportExploreMetrics('app_initialized', { view, uel_epid });
    }
  }, []);
}
