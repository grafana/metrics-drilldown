import { Alert } from '@grafana/ui';
import React from 'react';

const HP_BANNER_KEY = 'homepageDeprecationBanner';

export const HomepageDeprecationBanner = () => {
  if (bannerHasBeenShown()) {
    return null;
  }

  const onBannerRemove = () => {
    bannerHasBeenShown();
  };

  return (
    <Alert title="Homepage deprecation warning" severity="warning" elevated onRemove={onBannerRemove}>
      This page will be removed soon. Bookmarks will move alongside your list of metrics.
    </Alert>
  );
};

export function setBannerHasBeenShown() {
  localStorage.setItem(HP_BANNER_KEY, 'true');
}

export function bannerHasBeenShown() {
  return localStorage.getItem(HP_BANNER_KEY) ?? false;
}
