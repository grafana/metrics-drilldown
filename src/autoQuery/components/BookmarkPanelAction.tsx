import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button, Icon } from '@grafana/ui';
import React from 'react';

import { useBookmarkState } from '../../TrailStore/useBookmarkState';
import { getTrailFor } from '../../utils';

interface BookmarkPanelActionState extends SceneObjectState {}

export class BookmarkPanelAction extends SceneObjectBase<BookmarkPanelActionState> {
  constructor() {
    super({
      key: 'bookmark-action',
    });
  }

  public static readonly Component = ({ model }: SceneComponentProps<BookmarkPanelAction>) => {
    const trail = getTrailFor(model);
    const [isBookmarked, toggleBookmark] = useBookmarkState(trail);

    return (
      <Button
        variant="secondary"
        fill="text"
        size="sm"
        onClick={toggleBookmark}
        icon={
          isBookmarked ? (
            <Icon name={'favorite'} type={'mono'} size={'lg'} />
          ) : (
            <Icon name={'star'} type={'default'} size={'lg'} />
          )
        }
        tooltip="Bookmark this metric scene"
        tooltipPlacement="top"
      />
    );
  };
}
