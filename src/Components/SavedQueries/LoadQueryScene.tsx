import React, { useCallback, useMemo } from 'react';

import { css } from '@emotion/css';

import { AppEvents, CoreApp, GrafanaTheme2 } from '@grafana/data';
import { getAppEvents, usePluginComponent } from '@grafana/runtime';
import { DataSourceVariable, SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { ToolbarButton, useStyles2 } from '@grafana/ui';

import { LoadQueryModal } from './LoadQueryModal';
import { DataTrail } from '../../AppDataTrail/DataTrail';
import { parsePrometheusQuery } from '../../services/parsePrometheusQuery';
import { PrometheusQuery, isQueryLibrarySupported, OpenQueryLibraryComponentProps, useHasSavedQueries } from '../../services/saveQuery';
import { getDataSourceVariable } from '../../services/variableGetters';
import { reportExploreMetrics } from '../../shared/tracking/interactions';
import { MetricSelectedEvent, VAR_DATASOURCE, VAR_FILTERS } from '../../shared/shared';

export interface LoadQuerySceneState extends SceneObjectState {
  dsName: string;
  dsUid: string;
  isOpen: boolean;
}

export class LoadQueryScene extends SceneObjectBase<LoadQuerySceneState> {
  constructor(state: Partial<LoadQuerySceneState> = {}) {
    super({
      dsUid: '',
      dsName: '',
      isOpen: false,
      ...state,
    });

    this.addActivationHandler(this.onActivate);
  }

  onActivate = () => {
    const dsVariable = getDataSourceVariable(this);
    this.setState({
      dsUid: dsVariable.getValue().toString(),
      dsName: dsVariable.state.text?.toString() || '',
    });

    this._subs.add(
      dsVariable.subscribeToState((newState) => {
        const dsVar = getDataSourceVariable(this);
        this.setState({
          dsUid: newState.value?.toString() || '',
          dsName: dsVar.state.text?.toString() || '',
        });
      })
    );
  };

  toggleOpen = () => {
    this.setState({
      isOpen: true,
    });
  };

  toggleClosed = () => {
    this.setState({
      isOpen: false,
    });
  };

  static Component = ({ model }: SceneComponentProps<LoadQueryScene>) => {
    const { dsName, dsUid, isOpen } = model.useState();
    const styles = useStyles2(getStyles);
    const hasSavedQueries = useHasSavedQueries(dsUid);

    const { component: OpenQueryLibraryComponent, isLoading: isLoadingExposedComponent } =
      usePluginComponent<OpenQueryLibraryComponentProps>('grafana/query-library-context/v1');

    const trail = useMemo(() => sceneGraph.getAncestor(model, DataTrail), [model]);

    const fallbackComponent = useMemo(
      () => (
        <>
          <ToolbarButton
            icon="folder-open"
            variant="canvas"
            disabled={!hasSavedQueries}
            onClick={model.toggleOpen}
            className={styles.button}
            tooltip={hasSavedQueries ? 'Load saved query' : 'No saved queries to load'}
          />
          {isOpen && <LoadQueryModal sceneRef={model} onClose={model.toggleClosed} />}
        </>
      ),
      [hasSavedQueries, isOpen, model, styles.button]
    );

    const onSelectQuery = useCallback(
      (query: PrometheusQuery) => {
        const appEvents = getAppEvents();

        if (query.datasource?.type !== 'prometheus') {
          appEvents.publish({
            payload: ['Please select a Prometheus query.'],
            type: AppEvents.alertError.name,
          });
          return;
        }

        // Parse the PromQL expression to extract metric and label matchers
        const { metric, labelMatchers } = parsePrometheusQuery(query.expr);

        if (!metric) {
          appEvents.publish({
            payload: ['Could not extract metric from saved query.'],
            type: AppEvents.alertError.name,
          });
          return;
        }

        // Build URL values for navigation
        const dsVariable = getDataSourceVariable(trail);
        const urlValues: Record<string, string | string[]> = {
          metric,
          [`var-${dsVariable.state.name}`]: query.datasource.uid,
        };

        // Convert label matchers to URL format
        if (labelMatchers.length > 0) {
          urlValues[`var-${VAR_FILTERS}`] = labelMatchers.map((m) => `${m.key}|${m.operator}|${m.value}`);
        }

        // Publish event to navigate to the metric
        trail.publishEvent(
          new MetricSelectedEvent({
            metric,
            urlValues,
          })
        );

        reportExploreMetrics('saved_query_loaded', {
          label_matcher_count: labelMatchers.length,
          storage_type: 'query_library',
        });
      },
      [trail]
    );

    if (trail.state.embedded) {
      return null;
    }

    if (!isQueryLibrarySupported()) {
      return fallbackComponent;
    } else if (isLoadingExposedComponent || !OpenQueryLibraryComponent) {
      return null;
    }

    return (
      <OpenQueryLibraryComponent
        className={styles.button}
        context={CoreApp.Explore}
        datasourceFilters={[dsName]}
        icon="folder-open"
        onSelectQuery={onSelectQuery}
        tooltip="Load saved query"
      />
    );
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  button: css({
    [theme.breakpoints.down('lg')]: {
      alignSelf: 'flex-start',
    },
    alignSelf: 'flex-end',
  }),
});
