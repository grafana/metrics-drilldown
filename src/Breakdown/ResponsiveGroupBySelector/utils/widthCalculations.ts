import { RESPONSIVE_CONSTANTS } from './constants';

import type { VisibleRadioOptionsResult } from '../types';

/**
 * Calculates which radio button options can fit within the available width
 * @param labels - Array of label strings to evaluate
 * @param availableWidth - Total available width in pixels
 * @param measureText - Function to measure text width
 * @returns Object with visibleLabels and hiddenLabels arrays
 */
export function calculateVisibleRadioOptions(
  labels: string[],
  availableWidth: number,
  measureText: (text: string) => number
): VisibleRadioOptionsResult {
  let radioOptionsWidth = 0;
  const visibleLabels: string[] = [];
  const hiddenLabels: string[] = [];

  const { additionalWidthPerItem, widthOfDropdown, allButtonWidth } = RESPONSIVE_CONSTANTS;

  // Reserve space for dropdown and "All Labels" button
  const reservedWidth = widthOfDropdown + allButtonWidth;

  for (const label of labels) {
    const textWidth = measureText(label);
    const totalItemWidth = textWidth + additionalWidthPerItem;

    if (radioOptionsWidth + totalItemWidth + reservedWidth < availableWidth) {
      radioOptionsWidth += totalItemWidth;
      visibleLabels.push(label);
    } else {
      hiddenLabels.push(label);
    }
  }

  return { visibleLabels, hiddenLabels };
}
