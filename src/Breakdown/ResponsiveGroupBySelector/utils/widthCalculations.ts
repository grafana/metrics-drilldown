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

  const { additionalWidthPerItem, widthOfDropdown, minContainerWidth } = RESPONSIVE_CONSTANTS;

  // If availableWidth is 0 or too small, assume a reasonable default
  const effectiveWidth = availableWidth > 0 ? availableWidth : 600;

  // Don't show any radio buttons if container is too small
  if (effectiveWidth < minContainerWidth) {
    return { visibleLabels: [], hiddenLabels: labels };
  }

  // Reserve space for dropdown only (All Labels is now part of radio group)
  const reservedWidth = widthOfDropdown;

  // Always include "All Labels" in the radio group width calculation
  const allLabelsWidth = measureText('All Labels') + additionalWidthPerItem;
  radioOptionsWidth += allLabelsWidth;

  for (const label of labels) {
    const textWidth = measureText(label);
    const totalItemWidth = textWidth + additionalWidthPerItem;

    if (radioOptionsWidth + totalItemWidth + reservedWidth < effectiveWidth) {
      radioOptionsWidth += totalItemWidth;
      visibleLabels.push(label);
    } else {
      hiddenLabels.push(label);
    }
  }

  return { visibleLabels, hiddenLabels };
}
