import { LoadingState } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  CustomVariable,
  PanelBuilders,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  sceneGraph,
  SceneObjectBase,
  SceneQueryRunner,
  SceneReactObject,
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
import { NoRelatedLogs } from './NoRelatedLogsFound';
import { type RelatedLogsOrchestrator } from './RelatedLogsOrchestrator';
import { isCustomVariable } from '../utils/utils.variables';

interface RelatedLogsSceneProps {
  orchestrator: RelatedLogsOrchestrator;
}

export interface RelatedLogsSceneState extends SceneObjectState, RelatedLogsSceneProps {
  controls: SceneObject[];
  body: SceneCSSGridLayout;
}

const LOGS_PANEL_CONTAINER_KEY = 'related_logs/logs_panel_container';
const RELATED_LOGS_QUERY_KEY = 'related_logs/logs_query';

export class RelatedLogsScene extends SceneObjectBase<RelatedLogsSceneState> {
  private _queryRunner?: SceneQueryRunner;

  constructor(props: RelatedLogsSceneProps) {
    super({
      controls: [],
      body: new SceneCSSGridLayout({
        templateColumns: '1fr',
        autoRows: 'minmax(300px, 1fr)',
        children: [
          new SceneCSSGridItem({
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
    this.state.orchestrator.addLokiDataSourcesChangeHandler(() => this.setupLogsPanel());

    // If data sources have already been loaded, we don't need to fetch them again
    if (!this.state.orchestrator.lokiDataSources.length) {
      this.state.orchestrator.findAndCheckAllDatasources();
    } else {
      this.setupLogsPanel();
    }
  }

  private showNoLogsFound() {
    const logsPanelContainer = sceneGraph.findByKeyAndType(this, LOGS_PANEL_CONTAINER_KEY, SceneCSSGridItem);
    logsPanelContainer.setState({
      body: new SceneReactObject({ component: NoRelatedLogs }),
    });
    this.setState({
      controls: undefined,
    });
    this.state.orchestrator.relatedLogsCount = 0;
  }

  private setupLogsPanel(): void {
    if (!this.state.orchestrator.lokiDataSources.length) {
      this.showNoLogsFound();
      return;
    }

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
    this._subs.add(
      this._queryRunner.subscribeToState((state) => {
        // Only process completed query results
        if (state.data?.state === LoadingState.Done) {
          const totalRows = state.data.series
            ? state.data.series.reduce((sum: number, frame) => sum + frame.length, 0)
            : 0;

          // Show NoRelatedLogs if no logs found
          if (totalRows === 0 || !state.data.series?.length) {
            this.showNoLogsFound();
          }
        }
      })
    );

    // Set up UI for logs panel
    const logsPanelContainer = sceneGraph.findByKeyAndType(this, LOGS_PANEL_CONTAINER_KEY, SceneCSSGridItem);
    logsPanelContainer.setState({
      body: PanelBuilders.logs().setTitle('Logs').setData(this._queryRunner).build(),
    });

    // Set up variables for datasource selection
    const logsDataSourceVariable = new CustomVariable({
      name: VAR_LOGS_DATASOURCE,
      label: 'Logs data source',
      query: this.state.orchestrator.lokiDataSources.map((ds) => `${ds.name} : ${ds.uid}`).join(','),
    });
    this.setState({
      $variables: new SceneVariableSet({ variables: [logsDataSourceVariable] }),
      controls: [new VariableValueSelectors({ layout: 'vertical' })],
    });
    this._subs.add(
      logsDataSourceVariable.subscribeToState((newState, prevState) => {
        if (newState.value !== prevState.value) {
          reportExploreMetrics('related_logs_action_clicked', { action: 'logs_data_source_changed' });
        }
      })
    );

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
      this.showNoLogsFound();
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
      <Stack gap={1} direction={'column'} grow={1}>
        <Stack gap={1} direction={'row'} justifyContent={'space-between'} alignItems={'start'}>
          <Stack gap={1}>
            {controls?.map((control) => (
              <control.Component key={control.state.key} model={control} />
            ))}
          </Stack>

          <LinkButton
            href={`${config.appSubUrl}/a/grafana-lokiexplore-app`} // We prefix with the appSubUrl for environments that don't host grafana at the root.
            target="_blank"
            tooltip="Navigate to the Logs Drilldown app"
            variant="secondary"
            size="sm"
            onClick={() => reportExploreMetrics('related_logs_action_clicked', { action: 'open_logs_drilldown' })}
          >
            Open Logs Drilldown
          </LinkButton>
        </Stack>
        <body.Component model={body} />
      </Stack>
    );
  };
}

export function buildRelatedLogsScene(props: RelatedLogsSceneProps) {
  return new RelatedLogsScene(props);
}
