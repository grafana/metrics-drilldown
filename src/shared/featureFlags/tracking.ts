import { featureFlagTrackingKeys, type FlagTrackingKey } from './openFeature';

import type { EvaluationDetails, FlagValue, Hook, HookContext } from '@openfeature/web-sdk';

export const TRACKED_FLAG_VALUES: Record<FlagTrackingKey, unknown> = {
  experiment_default_open_sidebar: null,
  experiment_hierarchical_prefix_filtering: null,
};

/**
 * A hook that tracks feature flag evaluations and stores the flag value in module scope.
 * This is used to report the flag value in analytics interactions.
 */
export class TrackingHook implements Hook {
  constructor() {}

  after(hookContext: HookContext, evaluationDetails: EvaluationDetails<FlagValue>): void {
    if (!featureFlagTrackingKeys[hookContext.flagKey]) {
      return;
    }

    // For tracking, all we need to do is store the flag value in module scope.
    // We'll use this value later when reporting corresponding interactions.
    TRACKED_FLAG_VALUES[featureFlagTrackingKeys[hookContext.flagKey]] = evaluationDetails.value;
  }
}

/**
 * Returns the analytics payload for a tracked feature flag.
 *
 * @param flagTrackingKey - The `trackingKey` of the feature flag to track, as defined in the `goffFeatureFlags` object.
 * @returns The analytics payload for the tracked flag, as a record with the flag tracking key as the key and the flag value as the value.
 */
export function getTrackedFlagPayload(flagTrackingKey: FlagTrackingKey): Partial<Record<FlagTrackingKey, unknown>> | null {
  const trackedFlagItem = TRACKED_FLAG_VALUES[flagTrackingKey];

  if (!trackedFlagItem) {
    return null;
  }

  return { [flagTrackingKey]: trackedFlagItem };
}
