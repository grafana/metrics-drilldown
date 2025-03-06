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
import { MetricVizPanel } from 'WingmanDataTrail/MetricVizPanel/MetricVizPanel';

import { ShowMorePanel } from './ShowMorePanel';

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
      body: this.buildMetricsBody(true),
    });
  }

  private buildMetricsBody(limit?: boolean): SceneObject {
    const { groupName, metricsList } = this.state;

    const listLength = limit && metricsList.length >= 5 ? 5 : metricsList.length;

    let colorIndex = 0;

    const panelList = metricsList.slice(0, listLength);

    const panels = panelList.map(
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
    );

    if (limit && metricsList.length > 5) {
      // Create a ShowMorePanel that matches the size of the metric panels
      const showMorePanel = new SceneCSSGridItem({
        body: new ShowMorePanel({
          onClick: () => {
            console.log('show more panel clicked');
            // When clicked, show all metrics by creating a new body with limit=false
            // bug is somewhere here for not re-rendering the body when clicked
            const newBody = this.buildMetricsBody(false);
            this.setState({
              body: newBody,
            });
          },
        }),
      });
      panels.push(showMorePanel);
    }

    return new SceneCSSGridLayout({
      key: `${groupName}-metrics-${limit ? 'limited' : 'all'}`, // Add a different key to force re-render
      templateColumns: GRID_TEMPLATE_COLUMNS,
      autoRows: '240px', // will need to fix this at some point
      alignItems: 'start',
      isLazy: true,
      children: panels,
    });
  }

  public static Component = ({ model }: SceneComponentProps<MetricsGroupByRow>) => {
    const styles = useStyles2(getStyles);

    const { groupName, groupType, body, metricsList } = model.state;
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [showingMore, setShowingMore] = useState(false);

    const handleToggleShowMore = () => {
      setShowingMore(!showingMore);

      // Create a new body with the appropriate limit based on the new state
      const newBody = model.buildMetricsBody(showingMore);
      model.setState({
        body: newBody,
      });
    };

    return (
      <div className={styles.rowContainer}>
        {/* for a custom label with buttons on the right, had to hack this above the collapsable section */}
        <div className={styles.container}>
          <span className={styles.groupName}>{`${groupName} ${groupType} (${metricsList.length})`}</span>
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
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    rowContainer: css({
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(2),
      background: theme.colors.background.primary,
      boxShadow: theme.shadows.z1,
      marginBottom: '32px',
    }),
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
    showMoreButton: css({
      display: 'flex',
      justifyContent: 'center',
      marginTop: '8px',
    }),
    button: css({}),
  };
}
