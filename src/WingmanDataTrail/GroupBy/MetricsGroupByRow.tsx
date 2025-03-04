import {
  PanelBuilders,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneObjectBase,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
} from '@grafana/scenes';
import { CollapsableSection } from '@grafana/ui';
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
    const { groupName, groupType, body } = model.state;
    const [isCollapsed, setIsCollapsed] = useState(false);
    return (
      <>
        {/* hide the body when collapsed */}
        <CollapsableSection
          onToggle={() => setIsCollapsed(!isCollapsed)}
          label={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{`${groupName} ${groupType}`}</span>
              {/* 
                styling these button in the label so that they are far right needs to be done
                The CollapsibleSection component does not allow for styling the label much 
              */}
              <button className="btn btn-sm btn-secondary">Include</button>
              <button className="btn btn-sm btn-secondary">Exclude</button>
            </div>
          }
          isOpen={!isCollapsed}
        >
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
    // templateColumns: 'repeat(3, minmax(0, 1fr))',
    // autoRows: height,
    isLazy: true,
    key: groupName + 'metrics',
  });

  // Create container for both rows
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
