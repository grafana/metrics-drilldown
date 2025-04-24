import { css } from '@emotion/css';
import { Alert, useStyles2 } from '@grafana/ui';
import React, { useEffect, useState } from 'react';

const HP_BANNER_KEY = 'homepageDeprecationBanner';

export const HomepageDeprecationBanner = () => {
  const [showBanner, setShowBanner] = useState(false);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    setShowBanner(!bannerHasBeenShown());
  }, []);

  if (!showBanner || bannerHasBeenShown()) {
    return null;
  }

  const onBannerRemove = () => {
    setBannerHasBeenShown();
    setShowBanner(false);
  };

  return (
    <div className={styles.container}>
      <Alert title="Homepage deprecation" severity="info" elevated onRemove={onBannerRemove}>
        This page will be removed in Grafana Metrics Drilldown v1.0.0. Bookmarks will move alongside your list of
        metrics.
      </Alert>
    </div>
  );
};

function setBannerHasBeenShown() {
  localStorage.setItem(HP_BANNER_KEY, 'true');
}

function bannerHasBeenShown() {
  return localStorage.getItem(HP_BANNER_KEY) ?? false;
}

function getStyles() {
  return {
    container: css({
      maxWidth: '904px',
      width: '100%',
      margin: '0 auto',
      textAlign: 'center',
    }),
    banner: css({
      maxWidth: '500px',
      margin: '0 auto',
    }),
  };
}
