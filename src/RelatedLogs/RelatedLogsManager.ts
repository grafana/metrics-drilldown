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
  public readonly logsConnectors: MetricsLogsConnector[];
  private _activeQueryRunners: SceneQueryRunner[] = [];

  constructor(metricScene: MetricScene) {
    this._metricScene = metricScene;
    this.logsConnectors = [lokiRecordingRulesConnector, createLabelsCrossReferenceConnector(metricScene)];
  }

  /**
   * Get the connectors for the scene.
   * This allows the scene to use the same connector instances as the manager.
   */
  public getConnectorsForScene(scene: RelatedLogsScene): MetricsLogsConnector[] {
    // For the label cross reference connector, we need to create a new instance
    // since it's tied to a specific scene
    return [lokiRecordingRulesConnector, createLabelsCrossReferenceConnector(scene)];
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
    this.activeRelatedLogsScene?.setState({ lokiDataSources });

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

    // Update the scene to indicate new data is being loaded
    // This approach sets lokiDataSources to an empty array which will
    // trigger the appropriate UI updates in the scene's state subscription
    this.activeRelatedLogsScene?.setState({ lokiDataSources: [] });

    // Check all available datasources for logs after filter changes
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
      this.updateState([], 0);
    }
  }

  /**
   * Get the Loki queries for a given datasource.
   */
  public getLokiQueries(datasourceUid: string): Record<string, string> {
    const { metric } = this._metricScene.state;
    return this.logsConnectors.reduce<Record<string, string>>((acc, connector, idx) => {
      const lokiExpr = connector.getLokiQueryExpr(metric, datasourceUid);
      if (lokiExpr) {
        acc[connector.name ?? `connector-${idx}`] = lokiExpr;
      }
      return acc;
    }, {});
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
  private get activeRelatedLogsScene(): RelatedLogsScene | undefined {
    const { actionView, body } = this._metricScene.state;

    if (actionView !== 'related_logs' || !body.state.selectedTab) {
      return undefined;
    }

    return body.state.selectedTab as RelatedLogsScene;
  }

  /**
   * Check each datasource for logs and update the MetricScene and RelatedLogsScene accordingly.
   */
  private checkLogsInDataSources(datasources: Array<DataSourceInstanceSettings<DataSourceJsonData>>): void {
    // Clean up existing query runners
    this.cleanupQueryRunners();

    // Check each datasource for logs
    const datasourcesWithLogs: Array<DataSourceInstanceSettings<DataSourceJsonData>> = [];
    let totalLogsCount = 0;
    let totalChecked = 0;

    // If no datasources to check, update immediately
    if (datasources.length === 0) {
      this.updateState([], 0);
      return;
    }

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
      const lokiQueries = this.getLokiQueries(datasource.uid);

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
            }
          }

          // When all datasources have been checked
          if (totalChecked === datasources.length) {
            // Update state with our findings
            this.updateState(datasourcesWithLogs, totalLogsCount);
          }
        }
      });

      // Activate query
      queryRunner.activate();
    });
  }

  /**
   * Helper method to update MetricScene and RelatedLogsScene state
   * to reduce code duplication
   */
  private updateState(
    datasourcesWithLogs: Array<DataSourceInstanceSettings<DataSourceJsonData>>,
    totalLogsCount: number
  ): void {
    // Update logs count
    this._metricScene.updateRelatedLogsCount(totalLogsCount);

    // Update MetricScene with datasources that have logs
    this._metricScene.setState({
      lokiDataSources: datasourcesWithLogs,
    });

    // Update the RelatedLogsScene if active
    this.activeRelatedLogsScene?.setState({
      lokiDataSources: datasourcesWithLogs,
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

    // If we have a logs count but no datasources with logs,
    // we need to re-check for logs
    if (relatedLogsCount && relatedLogsCount > 0 && (!lokiDataSources || lokiDataSources.length === 0)) {
      // Re-initialize datasources
      this.initializeLokiDatasources();
    } else if (lokiDataSources && lokiDataSources.length > 0) {
      // We have datasources with logs, ensure the active scene is updated
      this.activeRelatedLogsScene?.setState({ lokiDataSources });
    }
  }
}
