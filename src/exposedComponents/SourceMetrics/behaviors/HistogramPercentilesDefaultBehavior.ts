import { sceneGraph, SceneObjectBase, type SceneObjectState } from "@grafana/scenes";

import { GmdVizPanel } from "shared/GmdVizPanel/GmdVizPanel";
import { getMetricTypeSync } from "shared/GmdVizPanel/matchers/getMetricType";
import { PREF_KEYS } from "shared/user-preferences/pref-keys";
import { userStorage } from "shared/user-preferences/userStorage";

/**
 * Behavior that sets histogram metrics to use percentiles as the default visualization.
 * This leverages the existing histogram preset configuration to apply percentiles by default
 * for histogram metrics in the SourceMetrics context only.
 */
export class HistogramPercentilesDefaultBehavior extends SceneObjectBase<SceneObjectState> {
  private processedPanels = new WeakSet<GmdVizPanel>();

  public constructor() {
    super({});

    this.addActivationHandler(() => {
      const root = this.getRoot();
      
      const processPanels = () => {
        const panels = sceneGraph.findAllObjects(root, (obj) => obj instanceof GmdVizPanel) as GmdVizPanel[];
        
        for (const panel of panels) {
          // Skip if already processed
          if (this.processedPanels.has(panel)) {
            continue;
          }
          
          const { metric, panelConfig } = panel.state;
          const metricType = getMetricTypeSync(metric);
          
          // Check if user already has a preference for this metric
          const userPrefs = userStorage.getItem(PREF_KEYS.METRIC_PREFS) || {};
          const hasUserPreference = userPrefs[metric]?.config;
          
          // For histogram metrics without user preferences, apply percentiles preset
          if ((metricType === 'classic-histogram' || metricType === 'native-histogram') && 
              !hasUserPreference &&
              panelConfig.type === 'heatmap') {
            // Use the histogram percentiles preset configuration
            panel.update(
              {
                type: 'percentiles',
              },
              {
                queries: [{ fn: 'histogram_quantile', params: { percentiles: [99, 90, 50] } }],
              }
            );
          }
          
          this.processedPanels.add(panel);
        }
      };
      
      // Process existing panels immediately
      processPanels();
      
      // Subscribe to root state changes to detect when new panels are added
      // The WeakSet ensures we don't reprocess panels, making this efficient
      const subscription = root.subscribeToState(processPanels);
      
      return () => subscription.unsubscribe();
    });
  }
}
