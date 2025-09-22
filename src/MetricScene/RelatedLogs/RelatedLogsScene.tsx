import { LoadingState } from '@grafana/data';
import {
  CustomVariable,
  PanelBuilders,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneQueryRunner,
  SceneReactObject,
  SceneVariableSet,
  VariableDependencyConfig,
  VariableValueSelectors,
  type QueryRunnerState,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
  type SceneVariable,
} from '@grafana/scenes';
import { Spinner, Stack } from '@grafana/ui';
import React from 'react';

import { NoRelatedLogs } from './NoRelatedLogsFound';
import { OpenInLogsDrilldownButton, type LogsDrilldownLinkContext } from './OpenInLogsDrilldownButton';
import { type RelatedLogsOrchestrator } from './RelatedLogsOrchestrator';
import { reportExploreMetrics } from '../../interactions';
import { VAR_FILTERS, VAR_LOGS_DATASOURCE, VAR_LOGS_DATASOURCE_EXPR } from '../../shared';
import { isCustomVariable } from '../../utils/utils.variables';

interface RelatedLogsSceneProps {
  orchestrator: RelatedLogsOrchestrator;
}

interface RelatedLogsSceneState extends SceneObjectState, RelatedLogsSceneProps {
  loading: boolean;
  controls: SceneObject[];
  body: SceneFlexLayout;
  logsDrilldownLinkContext: LogsDrilldownLinkContext;
}

const LOGS_PANEL_CONTAINER_KEY = 'related_logs/logs_panel_container';
const RELATED_LOGS_QUERY_KEY = 'related_logs/logs_query';

export class RelatedLogsScene extends SceneObjectBase<RelatedLogsSceneState> {
  private _queryRunner?: SceneQueryRunner;

  constructor(props: RelatedLogsSceneProps) {
    super({
      loading: false,
      controls: [],
      body: new SceneFlexLayout({
        direction: 'column',
        height: '100%',
        minHeight: 500,
        children: [
          new SceneFlexItem({
            key: LOGS_PANEL_CONTAINER_KEY,
            body: undefined,
          }),
        ],
      }),
      orchestrator: props.orchestrator,
      logsDrilldownLinkContext: {
        targets: [],
      },
    });

    this.addActivationHandler(() => {
      this._onActivate();
    });
  }

  private async _onActivate() {
    // Register handler for future changes to lokiDataSources
    this.state.orchestrator.addLokiDataSourcesChangeHandler(() => this.setupLogsPanel());

    // If data sources have already been loaded, we don't need to fetch them again
    if (!this.state.orchestrator.lokiDataSources.length) {
      this.setState({ loading: true });
      await this.state.orchestrator.findAndCheckAllDatasources();
      this.setState({ loading: false });
    } else {
      this.setupLogsPanel();
    }
  }

  private showNoLogsFound() {
    const logsPanelContainer = sceneGraph.findByKeyAndType(this, LOGS_PANEL_CONTAINER_KEY, SceneFlexItem);
    logsPanelContainer.setState({
      body: new SceneReactObject({ component: NoRelatedLogs }),
    });
    this.setState({
      controls: undefined,
    });
    this.state.orchestrator.relatedLogsCount = 0;
  }

  private _buildQueryRunner(): void {
    this._queryRunner = new SceneQueryRunner({
      datasource: { uid: VAR_LOGS_DATASOURCE_EXPR },
      queries: [],
      key: RELATED_LOGS_QUERY_KEY,
    });
    this._constructLogsDrilldownLinkContext(this._queryRunner.state);

    // Set up subscription to query results
    this._subs.add(
      this._queryRunner.subscribeToState((state) => {
        if (state.data?.state !== LoadingState.Done) {
          // Only process completed query results
          return;
        }

        const logLinesCount = this.state.orchestrator.countLogsLines(state);

        if (logLinesCount === 0) {
          // Show NoRelatedLogs if no logs found
          this.showNoLogsFound();
        }

        this._constructLogsDrilldownLinkContext(state);
      })
    );
  }

  private setupLogsPanel(): void {
    // Initialize query runner
    this._buildQueryRunner();

    // If no datasources can provide related logs given the current conditions, show the NoRelatedLogsScene
    if (!this.state.orchestrator.lokiDataSources.length) {
      this.showNoLogsFound();
      return;
    }

    // Set up UI for logs panel
    const logsPanelContainer = sceneGraph.findByKeyAndType(this, LOGS_PANEL_CONTAINER_KEY, SceneFlexItem);
    logsPanelContainer.setState({
      body: PanelBuilders.logs()
        .setTitle('Logs')
        .setOption('showLogContextToggle', true)
        .setOption('showTime', true)
        .setOption('showControls', true)
        // See https://github.com/grafana/logs-drilldown/blob/5225d621bbf24756559a15ce68d71437be8ca83e/src/services/store.ts#L243
        .setOption('controlsStorageKey', 'grafana.explore.logs')
        .setData(this._queryRunner)
        .build(),
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
   * Construct the Logs Drilldown link context based on the query runner state
   * @param state - The query runner state.
   */
  private _constructLogsDrilldownLinkContext(state: QueryRunnerState) {
    const dsUid = (sceneGraph.lookupVariable(VAR_LOGS_DATASOURCE, this)?.getValue() ?? '') as string;
    const queries = state.queries;
    const targets: LogsDrilldownLinkContext['targets'] = [];

    if (dsUid && queries.length) {
      queries.forEach((query) => {
        targets.push({
          ...query,
          datasource: {
            uid: dsUid,
            type: 'loki',
          },
        });
      });
    }

    this.setState({
      logsDrilldownLinkContext: { targets, timeRange: sceneGraph.getTimeRange(this).state },
    });
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
    const { controls, body, logsDrilldownLinkContext, loading } = model.useState();

    if (loading) {
      return <Spinner />;
    }

    return (
      <Stack gap={1} direction={'column'} grow={1} height="100%">
        <Stack gap={1} direction={'row'} justifyContent={'space-between'} alignItems={'start'}>
          <Stack gap={1}>
            {controls?.map((control) => (
              <control.Component key={control.state.key} model={control} />
            ))}
          </Stack>
          <OpenInLogsDrilldownButton context={logsDrilldownLinkContext} />
        </Stack>
        <body.Component model={body} />
      </Stack>
    );
  };
}
