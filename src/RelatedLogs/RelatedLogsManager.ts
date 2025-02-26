import { type DataSourceInstanceSettings, type DataSourceJsonData } from '@grafana/data';
import { SceneQueryRunner } from '@grafana/scenes';

import { type MetricsLogsConnector } from '../Integrations/logs/base';
import { createLabelsCrossReferenceConnector } from '../Integrations/logs/labelsCrossReference';
import { lokiRecordingRulesConnector } from '../Integrations/logs/lokiRecordingRules';
import { type MetricScene } from '../MetricScene';
import { findHealthyLokiDataSources, type RelatedLogsScene } from './RelatedLogsScene';

/**
 * Manager class that handles the orchestration of related logs functionality.
 * This centralizes logs-related logic that was previously spread across multiple components.
 */
export class RelatedLogsManager {
  private _metricScene: MetricScene;
  private _logsConnectors: MetricsLogsConnector[];
  private _activeQueryRunners: SceneQueryRunner[] = [];

  constructor(metricScene: MetricScene) {
    this._metricScene = metricScene;
    this._logsConnectors = [lokiRecordingRulesConnector, createLabelsCrossReferenceConnector(metricScene)];
  }

  /**
   * Initialize Loki datasources by fetching healthy ones and updating the MetricScene state.
   * If the Related Logs tab is active, it also updates the RelatedLogsScene.
   */
  public async initializeLokiDatasources(): Promise<void> {
    const lokiDataSources = await findHealthyLokiDataSources();

    // Update MetricScene state
    this._metricScene.setState({
      lokiDataSources,
      relatedLogsCount: 0,
    });

    // If the Related logs tab is active, update it directly
    const relatedLogsScene = this.getActiveRelatedLogsScene();
    if (relatedLogsScene) {
      relatedLogsScene.setState({
        lokiDataSources: lokiDataSources,
      });
    }

    // Then check which ones have logs
    if (lokiDataSources.length > 0) {
      this.checkLogsInDataSources(lokiDataSources);
    }
  }

  /**
   * Called when filters change to re-check for logs in datasources.
   */
  public handleFiltersChange(): void {
    const { lokiDataSources } = this._metricScene.state;
    if (!lokiDataSources) {
      return;
    }

    // Reset logs count immediately to avoid showing stale counts
    this._metricScene.updateRelatedLogsCount(0);

    // Get the active RelatedLogsScene
    const relatedLogsScene = this.getActiveRelatedLogsScene();

    // Instead of directly setting isLoading or calling a private method,
    // we'll update the scene's state in a way that triggers the loading UI
    // This is more idiomatic for @grafana/scenes
    if (relatedLogsScene) {
      // Set lokiDataSources to an empty array to trigger the loading UI
      // The RelatedLogsScene will handle this appropriately in its state subscription
      relatedLogsScene.setState({
        lokiDataSources: [],
      });
    }

    // Always use all available datasources when filters change
    // This ensures we check all possible datasources for logs after filter changes
    this.findAndCheckAllDatasources();
  }

  /**
   * Find all available datasources and check them for logs.
   * This is used when filters change to ensure we're checking all possible datasources.
   */
  private async findAndCheckAllDatasources(): Promise<void> {
    // Get all available Loki datasources
    const allLokiDatasources = await findHealthyLokiDataSources();

    // Check all datasources for logs
    if (allLokiDatasources.length > 0) {
      this.checkLogsInDataSources(allLokiDatasources);
    } else {
      // No datasources available
      this._metricScene.updateRelatedLogsCount(0);
      this._metricScene.setState({
        lokiDataSources: [],
      });

      // Update the RelatedLogsScene if active
      const relatedLogsScene = this.getActiveRelatedLogsScene();
      if (relatedLogsScene) {
        relatedLogsScene.setState({
          lokiDataSources: [],
        });
      }
    }
  }

  /**
   * Release resources used by this manager.
   */
  public dispose(): void {
    this.cleanupQueryRunners();
  }

  /**
   * Get the active RelatedLogsScene if Related Logs tab is selected.
   */
  private getActiveRelatedLogsScene(): RelatedLogsScene | undefined {
    const { actionView, body } = this._metricScene.state;
    if (actionView === 'related_logs' && body.state.selectedTab) {
      return body.state.selectedTab as RelatedLogsScene;
    }
    return undefined;
  }

  /**
   * Check each datasource for logs and update the MetricScene and RelatedLogsScene accordingly.
   */
  private checkLogsInDataSources(datasources: Array<DataSourceInstanceSettings<DataSourceJsonData>>): void {
    // Clean up existing query runners
    this.cleanupQueryRunners();

    // Get metric name
    const { metric } = this._metricScene.state;

    // Check each datasource for logs
    const datasourcesWithLogs: Array<DataSourceInstanceSettings<DataSourceJsonData>> = [];
    let totalLogsCount = 0;
    let totalChecked = 0;

    // If no datasources to check, update immediately
    if (datasources.length === 0) {
      this._metricScene.updateRelatedLogsCount(0);
      this._metricScene.setState({
        lokiDataSources: [],
      });

      // Update the RelatedLogsScene if active
      const relatedLogsScene = this.getActiveRelatedLogsScene();
      if (relatedLogsScene) {
        relatedLogsScene.setState({
          lokiDataSources: [],
        });
      }
      return;
    }

    // Get the active RelatedLogsScene once to avoid repeated lookups
    const relatedLogsScene = this.getActiveRelatedLogsScene();

    // Check each datasource for logs
    datasources.forEach((datasource) => {
      const queryRunner = new SceneQueryRunner({
        datasource: { uid: datasource.uid },
        queries: [],
        key: `logs_check_${datasource.uid}`,
      });

      // Track this query runner for later cleanup
      this._activeQueryRunners.push(queryRunner);

      // Build queries for this datasource
      const lokiQueries = this._logsConnectors.reduce<Record<string, string>>((acc, connector, idx) => {
        const lokiExpr = connector.getLokiQueryExpr(metric, datasource.uid);
        if (lokiExpr) {
          acc[connector.name ?? `connector-${idx}`] = lokiExpr;
        }
        return acc;
      }, {});

      // Set queries
      queryRunner.setState({
        queries: Object.keys(lokiQueries).map((connectorName) => ({
          refId: `RelatedLogs-${connectorName}`,
          expr: lokiQueries[connectorName],
          maxLines: 100,
        })),
      });

      // Subscribe to results
      queryRunner.subscribeToState((state) => {
        if (state.data?.state === 'Done') {
          totalChecked++;

          // Check if we found logs in this datasource
          if (state.data?.series) {
            const rowCount = state.data.series.reduce((sum: number, frame) => sum + frame.length, 0);
            if (rowCount > 0) {
              // This datasource has logs
              datasourcesWithLogs.push(datasource);
              totalLogsCount += rowCount;
              // Don't update the count here, wait until all datasources are checked
            }
          }

          // When all datasources have been checked
          if (totalChecked === datasources.length) {
            // Update the logs count once all datasources have been checked
            this._metricScene.updateRelatedLogsCount(totalLogsCount);

            // Store the datasources with logs in the MetricScene state
            // This ensures that when the RelatedLogsScene is created, it gets the correct datasources
            this._metricScene.setState({
              lokiDataSources: datasourcesWithLogs.length > 0 ? datasourcesWithLogs : [],
            });

            // Update the RelatedLogsScene if active
            if (relatedLogsScene) {
              relatedLogsScene.setState({
                lokiDataSources: datasourcesWithLogs.length > 0 ? datasourcesWithLogs : [],
              });
            }
          }
        }
      });

      // Activate query
      queryRunner.activate();
    });
  }

  /**
   * Clean up all active query runners.
   */
  private cleanupQueryRunners(): void {
    this._activeQueryRunners.forEach((runner) => {
      runner.setState({ queries: [] });
    });
    this._activeQueryRunners = [];
  }

  /**
   * Called when the Related Logs tab is activated to ensure it has the latest data.
   * This is particularly important when the tab is activated after filters have changed.
   */
  public refreshLogsData(): void {
    const { lokiDataSources, relatedLogsCount } = this._metricScene.state;

    // If we have a logs count but no datasources with logs in the scene,
    // we need to re-check for logs
    if (relatedLogsCount && relatedLogsCount > 0 && (!lokiDataSources || lokiDataSources.length === 0)) {
      // Initialize datasources if needed
      this.initializeLokiDatasources();
    } else if (lokiDataSources && lokiDataSources.length > 0) {
      // We have datasources with logs, update the RelatedLogsScene
      const relatedLogsScene = this.getActiveRelatedLogsScene();
      if (relatedLogsScene) {
        relatedLogsScene.setState({
          lokiDataSources: lokiDataSources,
        });
      }
    }
  }
}
