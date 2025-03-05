import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  PanelBuilders,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneObjectBase,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
} from '@grafana/scenes';
import { CollapsableSection, useStyles2 } from '@grafana/ui';
import React, { useState } from 'react';

// Add new component interface
interface MetricsGroupByRowState extends SceneObjectState {
  groupName: string;
  groupType: string;
  metricsList: string[];
  body: SceneObject;
}

export class MetricsGroupByRow extends SceneObjectBase<MetricsGroupByRowState> {
  public constructor(state: Partial<MetricsGroupByRowState>) {
    super({
      ...state,
      groupName: state.groupName || '',
      groupType: state.groupType || '',
      metricsList: state.metricsList || [],
      key: `${state.groupName || ''}-${state.groupType || ''}`,
      body: state.body || buildMetricsBody(state.groupName || '', state.groupType || '', state.metricsList || []),
    });
  }

  public static Component = ({ model }: SceneComponentProps<MetricsGroupByRow>) => {
    const styles = useStyles2(getStyles);

    const { groupName, groupType, body } = model.state;
    const [isCollapsed, setIsCollapsed] = useState(false);
    return (
      <>
        {/* for a custom label with buttons on the right, had to hack this above the collapsable section */}
        <div className={styles.container}>
          <span className={styles.groupName}>{`${groupName} ${groupType}`}</span>
          <div className={styles.buttons}>
            <button className="btn btn-sm btn-secondary">Include</button>
            <button className="btn btn-sm btn-secondary">Exclude</button>
          </div>
        </div>
        <CollapsableSection onToggle={() => setIsCollapsed(!isCollapsed)} label="" isOpen={!isCollapsed}>
          <body.Component model={body} />
        </CollapsableSection>
      </>
    );
  };
}

function buildMetricsBody(groupName: string, groupType: string, metricsList: string[]): SceneObject {
  const metricChildren: Array<SceneObject<SceneObjectState> | SceneCSSGridItem> = [];

  for (const metric of metricsList) {
    const metricPanel = createMetricPanel(metric);
    metricChildren.push(metricPanel);
  }

  const metricsRow = new SceneCSSGridLayout({
    children: metricChildren,
    isLazy: true,
    key: groupName + 'metrics',
  });

  const container = new SceneCSSGridLayout({
    children: [metricsRow],
    templateColumns: '1/-1',
    autoRows: 'auto',
    rowGap: 0.5,
    key: `${groupName}-${groupType}-container`,
  });

  return container;
}

function createMetricPanel(title: string) {
  return new SceneCSSGridItem({
    body: PanelBuilders.timeseries().setTitle(title).setOption('legend', { showLegend: false }).build(),
  });
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      width: '98%',
      marginBottom: '-42px',
    }),
    groupName: css({
      fontSize: (theme.typography.fontSize = 26),
    }),
    buttons: css({
      marginLeft: 'auto',
    }),
  };
}
