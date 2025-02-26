import { LoadingState, type DataSourceInstanceSettings, type DataSourceJsonData } from '@grafana/data';
import { getBackendSrv, getDataSourceSrv } from '@grafana/runtime';
import { SceneQueryRunner } from '@grafana/scenes';

import { type MetricsLogsConnector } from '../Integrations/logs/base';
import { createLabelsCrossReferenceConnector } from '../Integrations/logs/labelsCrossReference';
import { lokiRecordingRulesConnector } from '../Integrations/logs/lokiRecordingRules';
import { type MetricScene } from '../MetricScene';

type DataSource = DataSourceInstanceSettings<DataSourceJsonData>;

/**
 * Manager class that handles the orchestration of related logs functionality.
 * This centralizes logs-related logic that was previously spread across multiple components.
 */
export class RelatedLogsOrchestrator {
  private readonly _logsConnectors: MetricsLogsConnector[];
  private readonly _metricScene: MetricScene;
  private readonly _changeHandlers = {
    lokiDataSources: [] as Array<(dataSources: DataSource[]) => void>,
    relatedLogsCount: [] as Array<(count: number) => void>,
  };
  /**
   * Internal state that powers public properties defined by getters and setters.
   */
  private readonly _internalState = {
    relatedLogsCount: 0,
    lokiDataSources: [] as DataSource[],
  };

  constructor(metricScene: MetricScene) {
    this._metricScene = metricScene;
    this._logsConnectors = [lokiRecordingRulesConnector, createLabelsCrossReferenceConnector(metricScene)];
  }

  get lokiDataSources() {
    return this._internalState.lokiDataSources;
  }

  set lokiDataSources(dataSources: DataSource[]) {
    this._internalState.lokiDataSources = dataSources;
    this._changeHandlers.lokiDataSources.forEach((handler) => handler(this._internalState.lokiDataSources));
  }

  set relatedLogsCount(count: number) {
    this._internalState.relatedLogsCount = count;
    this._changeHandlers.relatedLogsCount.forEach((handler) => handler(this._internalState.relatedLogsCount));
  }

  /**
   * Add a listener that will be called when the lokiDataSources change.
   */
  addLokiDataSourcesChangeHandler(handler: (dataSources: DataSource[]) => void) {
    this._changeHandlers.lokiDataSources.push(handler);
  }

  /**
   * Add a listener that will be called when the relatedLogsCount changes.
   */
  addRelatedLogsCountChangeHandler(handler: (count: number) => void) {
    this._changeHandlers.relatedLogsCount.push(handler);
  }

  /**
   * Initialize Loki datasources by fetching healthy ones and updating the MetricScene state.
   * If the Related Logs tab is active, it also updates the RelatedLogsScene.
   */
  public async initializeLokiDatasources(): Promise<void> {
    this.lokiDataSources = await findHealthyLokiDataSources();

    // Then check which ones have logs
    if (this.lokiDataSources.length) {
      this.checkLogsInDataSources(this.lokiDataSources);
    }
  }

  /**
   * Called when filters change to re-check for logs in datasources.
   */
  public handleFiltersChange(): void {
    if (!this.lokiDataSources) {
      return;
    }

    // When filters change, we need to reset our state to trigger updates in listeners
    // Setting to empty array (vs undefined) signals we're actively checking
    this.lokiDataSources = [];
    this.relatedLogsCount = 0;

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
      this.lokiDataSources = [];
      this.relatedLogsCount = 0;
    }
  }

  /**
   * Get the Loki queries for a given datasource.
   */
  public getLokiQueries(datasourceUid: string): Record<string, string> {
    const { metric } = this._metricScene.state;
    return this._logsConnectors.reduce<Record<string, string>>((acc, connector, idx) => {
      const lokiExpr = connector.getLokiQueryExpr(metric, datasourceUid);
      if (lokiExpr) {
        acc[connector.name ?? `connector-${idx}`] = lokiExpr;
      }
      return acc;
    }, {});
  }

  /**
   * Check each datasource for logs and update the MetricScene and RelatedLogsScene accordingly.
   */
  private checkLogsInDataSources(datasources: DataSource[]): void {
    // Check each datasource for logs
    const datasourcesWithLogs: DataSource[] = [];
    let totalLogsCount = 0;
    let totalChecked = 0;

    // If no datasources to check, update immediately
    if (datasources.length === 0) {
      this.lokiDataSources = [];
      this.relatedLogsCount = 0;
      return;
    }

    // Check each datasource for logs
    datasources.forEach((datasource) => {
      const queryRunner = new SceneQueryRunner({
        datasource: { uid: datasource.uid },
        queries: [],
        key: `related_logs_check_${datasource.uid}`,
      });

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
        if (state.data?.state === LoadingState.Done) {
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
            this.lokiDataSources = datasourcesWithLogs;
            this.relatedLogsCount = totalLogsCount;
          }
        }
      });

      // Activate query
      queryRunner.activate();
    });
  }

  /**
   * Ensures Loki datasources are initialized and appropriate UI state is set.
   * This handles the complete initialization flow with proper loading states.
   */
  public ensureLokiDatasources(): void {
    if (this.lokiDataSources === undefined) {
      // No datasources yet, need to initialize
      this.initializeLokiDatasources();
    }
  }
}

export async function findHealthyLokiDataSources() {
  const lokiDataSources = getDataSourceSrv().getList({
    logs: true,
    type: 'loki',
    filter: (ds) => ds.uid !== 'grafana',
  });
  const healthyLokiDataSources: DataSource[] = [];
  const unhealthyLokiDataSources: DataSource[] = [];

  await Promise.all(
    lokiDataSources.map((ds) =>
      getBackendSrv()
        .get(`/api/datasources/${ds.id}/health`, undefined, undefined, {
          showSuccessAlert: false,
          showErrorAlert: false,
        })
        .then((health) =>
          health?.status === 'OK' ? healthyLokiDataSources.push(ds) : unhealthyLokiDataSources.push(ds)
        )
        .catch(() => unhealthyLokiDataSources.push(ds))
    )
  );

  if (unhealthyLokiDataSources.length) {
    console.warn(
      `Found ${unhealthyLokiDataSources.length} unhealthy Loki data sources: ${unhealthyLokiDataSources
        .map((ds) => ds.name)
        .join(', ')}`
    );
  }

  return healthyLokiDataSources;
}
