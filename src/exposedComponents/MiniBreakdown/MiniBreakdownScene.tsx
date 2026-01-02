import { css } from '@emotion/css';
import { VariableHide, type AdHocVariableFilter, type GrafanaTheme2 } from '@grafana/data';
import {
  AdHocFiltersVariable,
  ConstantVariable,
  QueryVariable,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneObjectBase,
  SceneReactObject,
  SceneVariableSet,
  type SceneComponentProps,
  type SceneObjectState,
  type SceneTimeRange,
} from '@grafana/scenes';
import { Spinner, useStyles2 } from '@grafana/ui';
import React from 'react';

import { SceneByVariableRepeater } from 'MetricsReducer/components/SceneByVariableRepeater';
import { PANEL_HEIGHT } from 'shared/GmdVizPanel/config/panel-heights';
import { QUERY_RESOLUTION } from 'shared/GmdVizPanel/config/query-resolutions';
import { GmdVizPanel } from 'shared/GmdVizPanel/GmdVizPanel';
import { buildTimeseriesPanel } from 'shared/GmdVizPanel/types/timeseries/buildTimeseriesPanel';
import {
  trailDS,
  VAR_DATASOURCE,
  VAR_FILTERS,
  VAR_GROUP_BY,
  VAR_METRIC,
  VAR_METRIC_EXPR,
} from 'shared/shared';

// Sizing for tooltip (~3" x 3" = ~300px)
const MINI_MAIN_PANEL_HEIGHT = 80;
const MINI_LABEL_PANEL_HEIGHT = 60;
const CONTAINER_WIDTH = 280;
const MAX_LABELS = 3;

export interface MiniBreakdownSceneState extends SceneObjectState {
  metric: string;
  mainPanel?: GmdVizPanel;
  labelBreakdown?: SceneByVariableRepeater;
}

export interface MiniBreakdownSceneOptions {
  metric: string;
  dataSource: string;
  initialFilters: AdHocVariableFilter[];
  $timeRange: SceneTimeRange;
}

export class MiniBreakdownScene extends SceneObjectBase<MiniBreakdownSceneState> {
  constructor({ metric, dataSource, initialFilters, $timeRange }: MiniBreakdownSceneOptions) {
    // Hidden variables that enable existing code to work
    const $variables = new SceneVariableSet({
      variables: [
        // Data source variable - enables trailDS interpolation
        new ConstantVariable({
          name: VAR_DATASOURCE,
          value: dataSource,
          hide: VariableHide.hideVariable,
        }),
        // Metric variable - enables ${metric} interpolation
        new ConstantVariable({
          name: VAR_METRIC,
          value: metric,
          hide: VariableHide.hideVariable,
        }),
        // Filters variable - enables ${filters} interpolation
        new AdHocFiltersVariable({
          name: VAR_FILTERS,
          filters: initialFilters,
          hide: VariableHide.hideVariable,
          datasource: trailDS,
          applyMode: 'manual',
        }),
        // GroupBy variable - fetches labels for breakdown
        new QueryVariable({
          name: VAR_GROUP_BY,
          datasource: trailDS,
          includeAll: true,
          defaultToAll: true,
          query: `label_names(${VAR_METRIC_EXPR})`,
          hide: VariableHide.hideVariable,
        }),
      ],
    });

    // Main metric panel - small, no controls
    const mainPanel = new GmdVizPanel({
      metric,
      panelOptions: {
        height: PANEL_HEIGHT.S,
        title: metric,
        headerActions: () => [],
        menu: undefined,
        legend: { showLegend: false },
      },
      queryOptions: {
        resolution: QUERY_RESOLUTION.MEDIUM, // TODO: add LOW resoltion to enumerable
      },
    });

    // Label breakdown - max 3 labels, tiny panels
    const labelBreakdown = new SceneByVariableRepeater({
      variableName: VAR_GROUP_BY,
      initialPageSize: MAX_LABELS,
      pageSizeIncrement: 0,
      body: new SceneCSSGridLayout({
        children: [],
        isLazy: true,
        templateColumns: '1fr',
        autoRows: `${MINI_LABEL_PANEL_HEIGHT}px`,
        rowGap: 4,
      }),
      getLayoutLoading: () =>
        new SceneReactObject({
          reactNode: <Spinner size="sm" />,
        }),
      getLayoutEmpty: () =>
        new SceneReactObject({
          reactNode: <MiniMessage>No labels found</MiniMessage>,
        }),
      getLayoutError: () =>
        new SceneReactObject({
          reactNode: <MiniMessage error>Error loading labels</MiniMessage>,
        }),
      getLayoutChild: (option, index) => {
        const label = option.value as string;

        return new SceneCSSGridItem({
          body: buildTimeseriesPanel({
            metric: { name: metric, type: 'unknown' }, // TODO: add unknown type to metric OR get type asynchronously
            panelConfig: {
              type: 'timeseries',
              height: PANEL_HEIGHT.S,
              title: label,
              fixedColorIndex: index,
              headerActions: () => [],
              menu: undefined,
              legend: { showLegend: false },
              behaviors: [],
            },
            queryConfig: {
              resolution: QUERY_RESOLUTION.MEDIUM, // TODO: add LOW resoltion to enumerable
              groupBy: label,
              labelMatchers: [],
              addIgnoreUsageFilter: false,
            },
          }),
        });
      },
    });

    super({
      key: 'mini-breakdown-scene',
      metric,
      $variables,
      $timeRange,
      mainPanel,
      labelBreakdown,
    });
  }

  public static readonly Component = ({ model }: SceneComponentProps<MiniBreakdownScene>) => {
    const styles = useStyles2(getStyles);
    const { mainPanel, labelBreakdown } = model.useState();

    return (
      <div className={styles.content}>
        {mainPanel && (
          <div className={styles.mainPanel}>
            <mainPanel.Component model={mainPanel} />
          </div>
        )}
        {labelBreakdown && (
          <div className={styles.breakdownSection}>
            <div className={styles.sectionLabel}>Breakdown</div>
            <labelBreakdown.Component model={labelBreakdown} />
          </div>
        )}
      </div>
    );
  };
}

// Simple message component for loading/error/empty states
function MiniMessage({ children, error }: Readonly<{ children: React.ReactNode; error?: boolean }>) {
  return (
    <span
      style={{
        fontSize: 11,
        color: error ? '#f55' : '#999',
        padding: '8px',
        display: 'block',
      }}
    >
      {children}
    </span>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    content: css({
      width: `${CONTAINER_WIDTH}px`,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
    mainPanel: css({
      height: `${MINI_MAIN_PANEL_HEIGHT}px`,
    }),
    breakdownSection: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    }),
    sectionLabel: css({
      fontSize: 10,
      fontWeight: 500,
      color: theme.colors.text.secondary,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    }),
  };
}

