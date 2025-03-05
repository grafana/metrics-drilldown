import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneObjectBase,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
} from '@grafana/scenes';
import { Button, CollapsableSection, useStyles2 } from '@grafana/ui';
import React, { useState } from 'react';

import { WithUsageDataPreviewPanel } from 'MetricSelect/WithUsageDataPreviewPanel';
import { getColorByIndex } from 'utils';
import { GRID_TEMPLATE_COLUMNS } from 'WingmanDataTrail/MetricsList/SimpleMetricsList';
import { METRICS_VIZ_PANEL_HEIGHT, MetricVizPanel } from 'WingmanDataTrail/MetricVizPanel/MetricVizPanel';

// Add new component interface
interface MetricsGroupByRowState extends SceneObjectState {
  groupName: string;
  groupType: string;
  metricsList: string[];
  body?: SceneObject;
}

export class MetricsGroupByRow extends SceneObjectBase<MetricsGroupByRowState> {
  public constructor(state: Partial<MetricsGroupByRowState>) {
    super({
      ...state,
      key: `${state.groupName || ''}-${state.groupType || ''}`,
      groupName: state.groupName || '',
      groupType: state.groupType || '',
      metricsList: state.metricsList || [],
      body: undefined,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    this.setState({
      body: this.buildMetricsBody(),
    });
  }

  private buildMetricsBody(): SceneObject {
    const { groupName, metricsList } = this.state;

    let colorIndex = 0;

    return new SceneCSSGridLayout({
      key: groupName + 'metrics',
      templateColumns: GRID_TEMPLATE_COLUMNS,
      autoRows: METRICS_VIZ_PANEL_HEIGHT,
      alignItems: 'start',
      isLazy: true,
      children: metricsList.map(
        (metricName) =>
          new SceneCSSGridItem({
            body: new WithUsageDataPreviewPanel({
              vizPanelInGridItem: new MetricVizPanel({
                metricName,
                color: getColorByIndex(colorIndex++),
                groupByLabel: undefined,
              }),
              metric: metricName,
            }),
          })
      ),
    });
  }

  public static Component = ({ model }: SceneComponentProps<MetricsGroupByRow>) => {
    const styles = useStyles2(getStyles);

    const { groupName, groupType, body } = model.state;
    const [isCollapsed, setIsCollapsed] = useState(false);
    return (
      <div className={styles.row}>
        {/* for a custom label with buttons on the right, had to hack this above the collapsable section */}
        <div className={styles.container}>
          <span className={styles.groupName}>{`${groupType}: ${groupName}`}</span>
          <div className={styles.buttons}>
            <Button variant="secondary" fill="outline" className={styles.button}>
              Include
            </Button>
            <Button variant="secondary" fill="outline" className={styles.button}>
              Exclude
            </Button>
          </div>
        </div>

        <CollapsableSection onToggle={() => setIsCollapsed(!isCollapsed)} label="" isOpen={!isCollapsed}>
          {body && <body.Component model={body} />}
        </CollapsableSection>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    row: css({
      marginBottom: '32px',
    }),
    container: css({
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      width: '98%',
      marginBottom: '-36px',
    }),
    groupName: css({
      fontSize: '22px',
    }),
    buttons: css({
      display: 'flex',
      gap: '8px',
      marginLeft: 'auto',
    }),
    button: css({}),
  };
}
