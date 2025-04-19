import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { LinkButton, Stack } from '@grafana/ui';
import React from 'react';

import { ROUTES } from '../constants';
import { HOME_ROUTE } from '../shared';
import { currentPathIncludes } from '../utils';

export function createBookmarkSavedNotification() {
  const appEvents = getAppEvents();
  const isSidebarView = currentPathIncludes(ROUTES.TrailWithSidebar);

  const infoText = !isSidebarView ? <i>Explore &gt; Metrics</i> : <i>the Metrics Reducer sidebar</i>;

  appEvents.publish({
    type: AppEvents.alertSuccess.name,
    payload: [
      'Bookmark created',
      <Stack gap={2} direction="row" key="bookmark-notification">
        <div>You can view bookmarks under {infoText}</div>
        {!isSidebarView && (
          <LinkButton fill="solid" variant="secondary" href={HOME_ROUTE}>
            View bookmarks
          </LinkButton>
        )}
      </Stack>,
    ],
  });
}
