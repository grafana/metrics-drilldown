import { LoadingState } from '@grafana/data';
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
import { VAR_FILTERS, VAR_LOGS_DATASOURCE, VAR_LOGS_DATASOURCE_EXPR } from '../shared';
import { NoRelatedLogsScene } from './NoRelatedLogsFoundScene';
import { type RelatedLogsOrchestrator } from './RelatedLogsOrchestrator';
import { isCustomVariable } from '../utils/utils.variables';

interface RelatedLogsSceneProps {
  orchestrator: RelatedLogsOrchestrator;
}

export interface RelatedLogsSceneState extends SceneObjectState, RelatedLogsSceneProps {
  controls: SceneObject[];
  body: SceneFlexLayout;
}

const LOGS_PANEL_CONTAINER_KEY = 'related_logs/logs_panel_container';
const RELATED_LOGS_QUERY_KEY = 'related_logs/logs_query';

export class RelatedLogsScene extends SceneObjectBase<RelatedLogsSceneState> {
  private _queryRunner?: SceneQueryRunner;

  constructor(props: RelatedLogsSceneProps) {
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
      orchestrator: props.orchestrator,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private _onActivate() {
    // Register handler for future changes to lokiDataSources
    this.state.orchestrator.addLokiDataSourcesChangeHandler((dataSources) => {
      // Handle changes in the list of loki data sources that contain related logs
      if (dataSources.length) {
        this.setupLogsPanel();
      } else {
        this.showNoLogsScene();
      }
    });

    // Let the orchestrator handle initialization
    this.state.orchestrator.ensureLokiDatasources();

    // Check the current state and set up the panel accordingly
    // This ensures the panel is set up even when switching tabs after data is already loaded
    if (this.state.orchestrator.lokiDataSources?.length) {
      // We have datasources with logs, set up the panel
      this.setupLogsPanel();
    } else if (this.state.orchestrator.lokiDataSources !== undefined) {
      // We have an empty array, meaning we checked and found no logs
      this.showNoLogsScene();
    } else {
      // lokiDataSources is undefined, meaning we haven't checked yet
      this.showLoadingState();
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
    this.state.orchestrator.relatedLogsCount = 0;
  }

  private setupLogsPanel(): void {
    // Clean up existing query runner if it exists
    if (this._queryRunner) {
      this._queryRunner.setState({ queries: [] });
      this._queryRunner = undefined;
    }

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
            query: this.state.orchestrator.lokiDataSources.map((ds) => `${ds.name} : ${ds.uid}`).join(','),
          }),
        ],
      }),
      controls: [new VariableValueSelectors({ layout: 'vertical' })],
    });

    // Update Loki query
    this.updateLokiQuery();
  }

  /**
   * Updates the Loki query based on the configured connectors, selected datasource, and current filters.
   * This function is called when the selected datasource or filters change.
   */
  private updateLokiQuery() {
    if (!this._queryRunner) {
      return;
    }

    const selectedDatasourceVar = sceneGraph.lookupVariable(VAR_LOGS_DATASOURCE, this);

    let selectedDatasourceUid: string | undefined = undefined;

    if (isCustomVariable(selectedDatasourceVar)) {
      selectedDatasourceUid = selectedDatasourceVar.getValue() as string;
    }

    if (!selectedDatasourceUid) {
      return;
    }

    const queries = this.state.orchestrator.getLokiQueries(selectedDatasourceUid);

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
        this.state.orchestrator.handleFiltersChange();
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

export function buildRelatedLogsScene(props: RelatedLogsSceneProps) {
  return new RelatedLogsScene(props);
}
