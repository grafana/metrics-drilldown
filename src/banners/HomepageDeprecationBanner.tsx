import { Alert } from '@grafana/ui';
import React, { useEffect, useState } from 'react';

const HP_BANNER_KEY = 'homepageDeprecationBanner';

export const HomepageDeprecationBanner = () => {
  const [showBanner, setShowBanner] = useState(false);

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
    <div>
      <Alert title="Homepage deprecation" severity="warning" elevated onRemove={onBannerRemove}>
        This page will be removed soon.
        <br />
        Bookmarks will move alongside your list of metrics.
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
