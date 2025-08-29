import { COMMON_LABELS } from './constants';

import type { LabelPriorityResult } from '../types';

/**
 * Prioritizes labels by separating common infrastructure labels from others
 * @param allLabels - All available labels
 * @returns Object with commonLabels and otherLabels arrays
 */
export function prioritizeLabels(allLabels: string[]): LabelPriorityResult {
  const commonLabels = COMMON_LABELS.filter(label => allLabels.includes(label));
  const otherLabels = allLabels.filter(label => !COMMON_LABELS.includes(label));

  return {
    // Include common labels first, then top 5 other labels
    commonLabels: [...commonLabels, ...otherLabels.slice(0, 5)],
    otherLabels: otherLabels.slice(5)
  };
}
