import { useEffect, useState } from 'react';

import { type DataTrail } from '../DataTrail';
import { reportExploreMetrics } from '../interactions';
import { getTrailStore } from './TrailStore';

export function useBookmarkState(trail: DataTrail): [boolean, () => void] {
  const [bookmarkIndex, setBookmarkIndex] = useState<number | undefined>(getTrailStore().getBookmarkIndex(trail));

  useEffect(() => {
    const sub = trail.subscribeToState(() => {
      setBookmarkIndex(getTrailStore().getBookmarkIndex(trail));
    });

    return () => {
      sub.unsubscribe();
    };
  }, [trail]);

  const isBookmarked = bookmarkIndex != null;

  const toggleBookmark = () => {
    reportExploreMetrics('bookmark_changed', { action: isBookmarked ? 'toggled_off' : 'toggled_on' });
    if (isBookmarked) {
      let indexToRemove = getTrailStore().getBookmarkIndex(trail);
      while (indexToRemove != null) {
        // This loop will remove all indices that have an equivalent bookmark key
        getTrailStore().removeBookmark(indexToRemove);
        indexToRemove = getTrailStore().getBookmarkIndex(trail);
      }
    } else {
      getTrailStore().addBookmark(trail);
    }
    setBookmarkIndex(getTrailStore().getBookmarkIndex(trail));
  };

  return [isBookmarked, toggleBookmark];
}
