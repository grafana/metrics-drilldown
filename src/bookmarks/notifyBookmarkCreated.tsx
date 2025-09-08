import { LinkButton, Stack } from '@grafana/ui';
import React from 'react';

import { displaySuccess } from 'WingmanDataTrail/helpers/displayStatus';

import { ROUTES } from '../constants';
import { HOME_ROUTE } from '../shared';
import { currentPathIncludes } from '../utils';

export function notifyBookmarkCreated() {
  const isSidebarView = currentPathIncludes(ROUTES.Drilldown);
  const infoText = !isSidebarView ? <i>Drilldown &gt; Metrics</i> : <i>the Metrics Reducer sidebar</i>;

  displaySuccess([
    'Bookmark created',
    <Stack gap={2} direction="row" key="bookmark-notification">
      <div>You can view bookmarks under {infoText}</div>
      {!isSidebarView && (
        <LinkButton fill="solid" variant="secondary" href={HOME_ROUTE}>
          View bookmarks
        </LinkButton>
      )}
    </Stack>,
  ]);
}
