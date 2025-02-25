import { config, getBackendSrv, getDataSourceSrv } from '@grafana/runtime';
import {
  CustomVariable,
  PanelBuilders,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneQueryRunner,
  SceneVariableSet,
  VariableDependencyConfig,
  VariableValueSelectors,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
  type SceneVariable,
} from '@grafana/scenes';
import { LinkButton, Stack } from '@grafana/ui';
import React from 'react';

import { createLabelsCrossReferenceConnector } from '../Integrations/logs/labelsCrossReference';
import { lokiRecordingRulesConnector } from '../Integrations/logs/lokiRecordingRules';
import { reportExploreMetrics } from '../interactions';
import { MetricScene } from '../MetricScene';
import { VAR_FILTERS, VAR_LOGS_DATASOURCE, VAR_LOGS_DATASOURCE_EXPR, VAR_METRIC } from '../shared';
import { NoRelatedLogsScene } from './NoRelatedLogsFoundScene';
import pluginJson from '../plugin.json';
import { isConstantVariable, isCustomVariable } from '../utils/utils.variables';

import type { MetricsLogsConnector } from '../Integrations/logs/base';
import type { DataSourceInstanceSettings, DataSourceJsonData } from '@grafana/data';

export interface RelatedLogsSceneState extends SceneObjectState {
  controls: SceneObject[];
  body: SceneFlexLayout;
  connectors: MetricsLogsConnector[];
  lokiDataSources?: Array<DataSourceInstanceSettings<DataSourceJsonData>>;
  onLogsCountChange?: (count: number, scene: SceneObject) => void;
}

const LOGS_PANEL_CONTAINER_KEY = 'related_logs/logs_panel_container';
const RELATED_LOGS_QUERY_KEY = 'related_logs/logs_query';

export class RelatedLogsScene extends SceneObjectBase<RelatedLogsSceneState> {
  private _queryRunner?: SceneQueryRunner;

  constructor(state: Partial<RelatedLogsSceneState>) {
    super({
      controls: [],
      body: new SceneFlexLayout({
        direction: 'column',
        height: '400px',
        children: [
          new SceneFlexItem({
            key: LOGS_PANEL_CONTAINER_KEY,
            body: undefined,
          }),
        ],
      }),
      connectors: [],
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private _onActivate() {
    // Set up connectors once
    if (!this.state.connectors.length) {
      this.setState({
        connectors: [lokiRecordingRulesConnector, createLabelsCrossReferenceConnector(this)],
      });
    }

    // Set up cleanup
    this._subs.add(() => {
      if (this._queryRunner) {
        this._queryRunner.setState({ queries: [] });
      }
    });

    this.setupLogsPanel();
  }

  private setupLogsPanel(): void {
    const logsPanelContainer = sceneGraph.findByKeyAndType(this, LOGS_PANEL_CONTAINER_KEY, SceneFlexItem);
    const { lokiDataSources } = this.state;

    if (!lokiDataSources?.length) {
      logsPanelContainer.setState({
        body: new NoRelatedLogsScene({}),
      });
      this.setState({ $variables: undefined, controls: undefined });
      this.state.onLogsCountChange?.(0, this);
      return;
    }

    // Initialize query runner once
    if (!this._queryRunner) {
      this._queryRunner = new SceneQueryRunner({
        datasource: { uid: VAR_LOGS_DATASOURCE_EXPR },
        queries: [],
        key: RELATED_LOGS_QUERY_KEY,
      });

      // Only set up subscription once
      this._queryRunner.subscribeToState((state) => {
        if (state.data?.series) {
          const totalRows = state.data.series.reduce((sum: number, frame) => sum + frame.length, 0);
          this.state.onLogsCountChange?.(totalRows, this);
        }
      });

      // Initialize the UI once
      logsPanelContainer.setState({
        body: PanelBuilders.logs().setTitle('Logs').setData(this._queryRunner).build(),
      });

      this.setState({
        $variables: new SceneVariableSet({
          variables: [
            new CustomVariable({
              name: VAR_LOGS_DATASOURCE,
              label: 'Logs data source',
              query: lokiDataSources?.map((ds) => `${ds.name} : ${ds.uid}`).join(','),
            }),
          ],
        }),
        controls: [new VariableValueSelectors({ layout: 'vertical' })],
      });
    }

    // Update Loki query (safe to call multiple times)
    this.updateLokiQuery();
  }

  // Only update query when necessary to prevent loops
  private updateLokiQuery() {
    const selectedDatasourceVar = sceneGraph.lookupVariable(VAR_LOGS_DATASOURCE, this);
    const selectedMetricVar = sceneGraph.lookupVariable(VAR_METRIC, this);

    if (!isCustomVariable(selectedDatasourceVar) || !isConstantVariable(selectedMetricVar)) {
      return;
    }

    const selectedMetric = selectedMetricVar.getValue();
    const selectedDatasourceUid = selectedDatasourceVar.getValue();

    if (typeof selectedMetric !== 'string' || typeof selectedDatasourceUid !== 'string') {
      return;
    }

    // Only generate queries if we have a query runner
    if (!this._queryRunner) {
      return;
    }

    const lokiQueries = this.state.connectors.reduce<Record<string, string>>((acc, connector, idx) => {
      const lokiExpr = connector.getLokiQueryExpr(selectedMetric, selectedDatasourceUid);
      if (lokiExpr) {
        acc[connector.name ?? `connector-${idx}`] = lokiExpr;
      }
      return acc;
    }, {});

    // Update queries
    this._queryRunner.setState({
      queries: Object.keys(lokiQueries).map((connectorName) => ({
        refId: `RelatedLogs-${connectorName}`,
        expr: lokiQueries[connectorName],
        maxLines: 100,
        supportingQueryType: pluginJson.id,
      })),
    });
  }

  // Simplify variable dependency to avoid update loops
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_LOGS_DATASOURCE, VAR_FILTERS],
    onReferencedVariableValueChanged: (variable: SceneVariable) => {
      // Only update if scene is active to prevent loops
      if (this.isActive) {
        this.updateLokiQuery();
      }
    },
  });

  static readonly Component = ({ model }: SceneComponentProps<RelatedLogsScene>) => {
    const { controls, body } = model.useState();

    return (
      <div>
        <Stack gap={1} direction={'column'} grow={1}>
          <Stack gap={1} direction={'row'} grow={1} justifyContent={'space-between'} alignItems={'start'}>
            <Stack gap={1}>
              {controls?.map((control) => (
                <control.Component key={control.state.key} model={control} />
              ))}
            </Stack>

            <LinkButton
              href={`${config.appSubUrl}/a/grafana-lokiexplore-app`} // We prefix with the appSubUrl for environments that don't host grafana at the root.
              target="_blank"
              tooltip="Navigate to the Explore Logs app"
              variant="secondary"
              size="sm"
              onClick={() => reportExploreMetrics('related_logs_action_clicked', { action: 'open_explore_logs' })}
            >
              Open Explore Logs
            </LinkButton>
          </Stack>
          <body.Component model={body} />
        </Stack>
      </div>
    );
  };
}

export function buildRelatedLogsScene(props?: Partial<RelatedLogsSceneState>) {
  return new RelatedLogsScene({
    ...props,
    onLogsCountChange: (count: number, scene: SceneObject) => {
      const metricScene = sceneGraph.getAncestor(scene, MetricScene);
      if (metricScene && metricScene.state.relatedLogsCount !== count) {
        metricScene.setState({ relatedLogsCount: count });
      }
    },
  });
}

export async function findHealthyLokiDataSources() {
  const lokiDataSources = getDataSourceSrv().getList({
    logs: true,
    type: 'loki',
    filter: (ds) => ds.uid !== 'grafana',
  });
  const healthyLokiDataSources: Array<DataSourceInstanceSettings<DataSourceJsonData>> = [];
  const unhealthyLokiDataSources: Array<DataSourceInstanceSettings<DataSourceJsonData>> = [];

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
