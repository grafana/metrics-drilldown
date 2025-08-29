import type { SceneObjectState } from '@grafana/scenes';

export interface ResponsiveGroupBySelectorState extends SceneObjectState {
  availableWidth: number;
  commonLabels: string[];        // Frequently used labels for radio buttons
  allLabels: string[];          // All available labels
  selectedLabel: string | null;
  fontSize: number;
}

export interface LabelPriorityResult {
  commonLabels: string[];
  otherLabels: string[];
}

export interface VisibleRadioOptionsResult {
  visibleLabels: string[];
  hiddenLabels: string[];
}
