import { LoadingState, type DataSourceInstanceSettings, type DataSourceJsonData } from '@grafana/data';
import { config } from '@grafana/runtime';
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

import { reportExploreMetrics } from '../interactions';
import { MetricScene } from '../MetricScene';
import { VAR_FILTERS, VAR_LOGS_DATASOURCE, VAR_LOGS_DATASOURCE_EXPR } from '../shared';
import { NoRelatedLogsScene } from './NoRelatedLogsFoundScene';
import { type RelatedLogsManager } from './RelatedLogsManager';
import { isCustomVariable } from '../utils/utils.variables';

export interface RelatedLogsSceneState extends SceneObjectState {
  controls: SceneObject[];
  body: SceneFlexLayout;
  lokiDataSources: Array<DataSourceInstanceSettings<DataSourceJsonData>>;
  manager: RelatedLogsManager;
  onLogsCountChange: (count: number, scene: SceneObject) => void;
}

const LOGS_PANEL_CONTAINER_KEY = 'related_logs/logs_panel_container';
const RELATED_LOGS_QUERY_KEY = 'related_logs/logs_query';

type RelatedLogsSceneProps = Pick<RelatedLogsSceneState, 'lokiDataSources' | 'manager' | 'onLogsCountChange'>;

export class RelatedLogsScene extends SceneObjectBase<RelatedLogsSceneState> {
  private _queryRunner?: SceneQueryRunner;

  constructor(state: RelatedLogsSceneProps) {
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
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private _onActivate() {
    this.subscribeToState((state, prevState) => {
      const currentSignature = state.lokiDataSources.map((ds) => ds.uid).join(',');
      const previousSignature = prevState.lokiDataSources.map((ds) => ds.uid).join(',');

      if (currentSignature === previousSignature) {
        return;
      }

      // Handle changes in the list of loki data sources that contain related logs
      if (state.lokiDataSources?.length) {
        this.setupLogsPanel();
      } else {
        this.showNoLogsScene();
      }
    });

    // Handle initial data loading and datasource setup
    if (this.state.lokiDataSources === undefined) {
      // No datasources yet, need to initialize
      this.state.manager.initializeLokiDatasources();
      // Show loading state while we wait
      this.showLoadingState();
    } else if (this.state.lokiDataSources.length) {
      // We already have datasources with logs, set up the panel
      this.setupLogsPanel();
    } else {
      // We know there are no datasources with logs
      this.showNoLogsScene();
    }
  }

  private showLoadingState() {
    const logsPanelContainer = sceneGraph.findByKeyAndType(this, LOGS_PANEL_CONTAINER_KEY, SceneFlexItem);
    logsPanelContainer.setState({
      body: new SceneFlexLayout({
        direction: 'column',
        children: [
          new SceneFlexItem({
            body: PanelBuilders.text()
              .setTitle('Searching for related logs...')
              .setOption(
                'content',
                "We're searching for logs related to your current metric and filters. This may take a moment..."
              )
              .build(),
          }),
        ],
      }),
    });
  }

  private showNoLogsScene() {
    const logsPanelContainer = sceneGraph.findByKeyAndType(this, LOGS_PANEL_CONTAINER_KEY, SceneFlexItem);
    logsPanelContainer.setState({
      body: new NoRelatedLogsScene({}),
    });
    this.setState({
      controls: undefined,
    });
    this.state.onLogsCountChange(0, this);
  }

  private setupLogsPanel(): void {
    const { lokiDataSources } = this.state;

    // Initialize query runner
    this._queryRunner = new SceneQueryRunner({
      datasource: { uid: VAR_LOGS_DATASOURCE_EXPR },
      queries: [],
      key: RELATED_LOGS_QUERY_KEY,
    });

    // Set up subscription to query results
    this._queryRunner.subscribeToState((state) => {
      // Only process completed query results
      if (state.data?.state === LoadingState.Done) {
        const totalRows = state.data.series
          ? state.data.series.reduce((sum: number, frame) => sum + frame.length, 0)
          : 0;

        // Update logs count
        this.state.onLogsCountChange(totalRows, this);

        // Show NoRelatedLogsScene if no logs found
        if (totalRows === 0 || !state.data.series?.length) {
          this.showNoLogsScene();
        }
      }
    });

    // Set up UI for logs panel
    const logsPanelContainer = sceneGraph.findByKeyAndType(this, LOGS_PANEL_CONTAINER_KEY, SceneFlexItem);
    logsPanelContainer.setState({
      body: PanelBuilders.logs().setTitle('Logs').setData(this._queryRunner).build(),
    });

    // Set up variables for datasource selection
    this.setState({
      $variables: new SceneVariableSet({
        variables: [
          new CustomVariable({
            name: VAR_LOGS_DATASOURCE,
            label: 'Logs data source',
            query: lokiDataSources.map((ds) => `${ds.name} : ${ds.uid}`).join(','),
          }),
        ],
      }),
      controls: [new VariableValueSelectors({ layout: 'vertical' })],
    });

    // Update Loki query
    this.updateLokiQuery();
  }

  // Update query when necessary
  private updateLokiQuery() {
    if (!this._queryRunner) {
      return;
    }

    const selectedDatasourceVar = sceneGraph.lookupVariable(VAR_LOGS_DATASOURCE, this);

    if (!isCustomVariable(selectedDatasourceVar)) {
      return;
    }

    const selectedDatasourceUid = selectedDatasourceVar.getValue();

    if (typeof selectedDatasourceUid !== 'string') {
      return;
    }

    const lokiQueries = this.state.manager.getLokiQueries(selectedDatasourceUid);
    const queries = Object.keys(lokiQueries).map((connectorName) => ({
      refId: `RelatedLogs-${connectorName}`,
      expr: lokiQueries[connectorName],
      maxLines: 100,
    }));

    // If no queries were generated, show the NoRelatedLogsScene
    if (queries.length === 0) {
      this.showNoLogsScene();
      return;
    }

    // Update queries - this will trigger the query runner to fetch new data
    // The query results will be processed in the subscription handler
    this._queryRunner.setState({ queries });
  }

  // Handle variable changes
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_LOGS_DATASOURCE, VAR_FILTERS],
    onReferencedVariableValueChanged: (variable: SceneVariable) => {
      if (variable.state.name === VAR_FILTERS) {
        this.state.manager.handleFiltersChange();
      } else if (variable.state.name === VAR_LOGS_DATASOURCE) {
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

export function buildRelatedLogsScene(props: Omit<RelatedLogsSceneProps, 'onLogsCountChange'>) {
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
