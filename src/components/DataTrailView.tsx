import { css } from '@emotion/css';
import { config } from '@grafana/runtime';
import { UrlSyncContextProvider } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React, { useEffect, useState } from 'react';

import { type DataTrail } from '../DataTrail';
import { getTrailStore } from '../TrailStore/TrailStore';
import { getMetricName } from '../utils';
import { ScopesSelector } from '../utils/utils.scopes';

interface Props {
  trail: DataTrail;
}

export function DataTrailView({ trail }: Props) {
  const styles = useStyles2(getStyles);
  const [isInitialized, setIsInitialized] = useState(false);
  const { metric } = trail.useState();

  useEffect(() => {
    if (!isInitialized) {
      if (trail.state.metric !== undefined) {
        getTrailStore().setRecentTrail(trail);
      }
      setIsInitialized(true);
    }
  }, [trail, isInitialized]);

  if (!isInitialized) {
    return null;
  }

  return (
    <UrlSyncContextProvider scene={trail}>
      <div>
        <div className={styles.header}>
          <h2>{getMetricName(metric)}</h2>
          {/* @ts-expect-error */}
          {config.featureToggles.enableScopesInMetricsExplore && (
            <div className={styles.topNavContainer}>
              <ScopesSelector />
            </div>
          )}
        </div>
        <trail.Component model={trail} />
      </div>
    </UrlSyncContextProvider>
  );
}

const getStyles = () => ({
  header: css({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
  }),
  topNavContainer: css({
    display: 'flex',
    flexDirection: 'row',
    justifyItems: 'flex-start',
  }),
});
