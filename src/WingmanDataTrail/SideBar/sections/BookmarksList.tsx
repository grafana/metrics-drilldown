import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { SceneObjectBase, type SceneComponentProps } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React, { useState } from 'react';

import { SectionTitle } from './SectionTitle';
import { type SideBarSectionState } from './types';
import { DataTrailCard } from '../../../DataTrailCard';
import { reportExploreMetrics } from '../../../interactions';
import { getBookmarkKey, getTrailStore } from '../../../TrailStore/TrailStore';

// Create a simple event-based system to avoid circular dependencies
export const navigationEvents = {
  listeners: new Set<(trail: any) => void>(),
  emit: function (trail: any) {
    this.listeners.forEach((listener) => listener(trail));
  },
  subscribe: function (listener: (trail: any) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
      return undefined; // Explicitly return void
    };
  },
};

// Simple function to navigate to a trail without using MetricsContext
function goToUrlForTrail(trail: any) {
  navigationEvents.emit(trail);
}

export interface BookmarksListState extends SideBarSectionState {}

export class BookmarksList extends SceneObjectBase<BookmarksListState> {
  constructor({
    key,
    title,
    description,
    icon,
    disabled,
  }: {
    key: BookmarksListState['key'];
    title: BookmarksListState['title'];
    description: BookmarksListState['description'];
    icon: BookmarksListState['icon'];
    disabled?: BookmarksListState['disabled'];
  }) {
    super({
      key,
      title,
      description,
      icon,
      disabled: disabled ?? false,
      active: false,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {}

  public static readonly Component = ({ model }: SceneComponentProps<BookmarksList>) => {
    const styles = useStyles2(getStyles);
    const { title, description } = model.useState();
    const { bookmarks } = getTrailStore();
    const [, setLastDelete] = useState(Date.now());

    const onSelect = (index: number) => {
      reportExploreMetrics('exploration_started', { cause: 'bookmark_clicked' });
      const trail = getTrailStore().getTrailForBookmark(bookmarks[index]);
      getTrailStore().setRecentTrail(trail);
      goToUrlForTrail(trail);
    };

    const onDelete = (index: number) => {
      reportExploreMetrics('bookmark_changed', { action: 'deleted' });
      getTrailStore().removeBookmark(index);
      setLastDelete(Date.now()); // trigger re-render
    };

    return (
      <div className={styles.container}>
        <SectionTitle title={title} description={description} data-testid="bookmarks-list-sidebar" />
        {bookmarks.length > 0 ? (
          <div className={styles.bookmarksList}>
            {bookmarks.map((bookmark, index) => (
              <DataTrailCard
                key={getBookmarkKey(bookmark)}
                bookmark={bookmark}
                onSelect={() => onSelect(index)}
                onDelete={() => onDelete(index)}
                wide={true}
                compactHeight={true}
              />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>No bookmarks yet</div>
        )}
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      height: '100%',
    }),
    bookmarksList: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1.5),
      overflowY: 'auto',
      paddingRight: theme.spacing(1),
    }),
    emptyState: css({
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100px',
      color: theme.colors.text.secondary,
      fontStyle: 'italic',
    }),
  };
}
