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

import { ShowMorePanel } from './ShowMorePanel';

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
      body: state.body || buildMetricsBody(state.groupName || '', state.groupType || '', state.metricsList || [], true),
    });
  }

  public static Component = ({ model }: SceneComponentProps<MetricsGroupByRow>) => {
    const styles = useStyles2(getStyles);

    const { groupName, groupType, body, metricsList } = model.state;
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [showingMore, setShowingMore] = useState(false);

    const handleToggleShowMore = () => {
      if (showingMore) {
        // Show less - display only first 3 metrics
        const newBody = buildMetricsBody(groupName || '', groupType || '', metricsList || [], true);
        model.setState({
          body: newBody,
        });
      } else {
        // Show more - display all metrics
        const newBody = buildMetricsBody(groupName || '', groupType || '', metricsList || [], false);
        model.setState({
          body: newBody,
        });
      }
      setShowingMore(!showingMore);
    };

    return (
      <>
        {/* for a custom label with buttons on the right, had to hack this above the collapsable section */}
        <div className={styles.container}>
          <span className={styles.groupName}>{`${groupName} ${groupType} (${metricsList.length})`}</span>
          <div className={styles.buttons}>
            <button className="btn btn-sm btn-secondary">Include</button>
            <button className="btn btn-sm btn-secondary">Exclude</button>
          </div>
        </div>
        <CollapsableSection onToggle={() => setIsCollapsed(!isCollapsed)} label="" isOpen={!isCollapsed}>
          <body.Component model={body} />
          {/* Show toggle button if there are more than three metrics */}
          {metricsList.length > 3 && (
            <div className={styles.showMoreButton}>
              <button className="btn btn-sm btn-secondary" onClick={handleToggleShowMore}>
                {showingMore ? (
                  <>
                    Show Less&nbsp;<i className="fa fa-caret-up"></i>
                  </>
                ) : (
                  <>
                    Show More&nbsp;<i className="fa fa-caret-down"></i>
                  </>
                )}
              </button>
            </div>
          )}
        </CollapsableSection>
      </>
    );
  };
}

function buildMetricsBody(
  groupName: string,
  groupType: string,
  metricsList: string[],
  firstLoad?: boolean
): SceneObject {
  const metricChildren: Array<SceneObject<SceneObjectState> | SceneCSSGridItem> = [];
  // if the metrics list is less than three, set the list length to the length of the metrics list
  // if the firstLoad is true, only iterate through the first 3 metrics
  const listLength = firstLoad && metricsList.length >= 5 ? 5 : metricsList.length;

  for (let i = 0; i < listLength; i++) {
    const metricPanel = createMetricPanel(metricsList[i]);
    metricChildren.push(metricPanel);
  }

  if (firstLoad && metricsList.length > 5) {
    // Create a ShowMorePanel that matches the size of the metric panels
    const showMorePanel = new SceneCSSGridItem({
      body: new ShowMorePanel({
        onClick: () => {
          // This click will be handled by the separate button below the grid
          // It's included here for visual purposes only
        },
      }),
    });
    metricChildren.push(showMorePanel);
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
  // Remove the non-existent SceneButton
  const panel = new SceneCSSGridItem({
    body: PanelBuilders.timeseries().setTitle(title).setOption('legend', { showLegend: false }).build(),
  });
  return panel;
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
      // fontSize: (theme.typography.fontSize = 12),
    }),
    buttons: css({
      marginLeft: 'auto',
    }),
    showMoreButton: css({
      display: 'flex',
      justifyContent: 'center',
      marginTop: '10px',
    }),
  };
}
