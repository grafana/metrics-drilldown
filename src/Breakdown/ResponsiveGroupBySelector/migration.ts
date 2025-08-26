import { config } from '@grafana/runtime';

/**
 * Utility functions for managing the migration to ResponsiveGroupBySelector
 */

/**
 * Checks if the responsive breakdown selector feature is enabled
 * @returns boolean indicating if the feature flag is active
 */
export function isResponsiveBreakdownEnabled(): boolean {
  return (config.featureToggles as any).responsiveBreakdownSelector ?? false;
}

/**
 * Gets the current stage of the responsive breakdown selector feature
 * @returns string indicating the feature stage (alpha, beta, stable)
 */
export function getResponsiveBreakdownStage(): string {
  // This would typically come from the feature flag configuration
  return 'alpha';
}

/**
 * Logs migration analytics for tracking adoption
 * @param event - The migration event type
 * @param data - Additional event data
 */
export function logMigrationEvent(event: string, data?: Record<string, any>) {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', `responsive_breakdown_${event}`, {
      feature_stage: getResponsiveBreakdownStage(),
      ...data,
    });
  }
}
