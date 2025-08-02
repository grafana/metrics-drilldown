import { getExploreURL, sceneGraph, SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button } from '@grafana/ui';
import React from 'react';

import { AutoVizPanel } from './AutoVizPanel';
import { UI_TEXT } from '../../constants/ui';
import { reportExploreMetrics } from '../../interactions';
import { METRIC_AUTOVIZPANEL_KEY } from '../../MetricGraphScene';
import { MetricScene } from '../../MetricScene';

interface ExploreActionState extends SceneObjectState {}

export class ExploreAction extends SceneObjectBase<ExploreActionState> {
  constructor() {
    super({
      key: 'explore-action',
    });
  }

  private getLinkToExplore = async () => {
    const metricScene = sceneGraph.getAncestor(this, MetricScene);
    const autoVizPanel = sceneGraph.findByKeyAndType(this, METRIC_AUTOVIZPANEL_KEY, AutoVizPanel);
    const panelData =
      typeof autoVizPanel.state.panel !== 'undefined'
        ? sceneGraph.getData(autoVizPanel.state.panel).state.data
        : undefined;

    if (!panelData) {
      throw new Error('Cannot get link to explore, no panel data found');
    }

    return getExploreURL(panelData, metricScene, panelData.timeRange);
  };

  public openExploreLink = async () => {
    reportExploreMetrics('selected_metric_action_clicked', { action: 'open_in_explore' });
    this.getLinkToExplore().then((link) => {
      // We use window.open instead of a Link or <a> because we want to compute the explore link when clicking,
      // if we precompute it we have to keep track of a lot of dependencies
      window.open(link, '_blank');
    });
  };

  public static readonly Component = ({ model }: SceneComponentProps<ExploreAction>) => {
    return (
      <Button
        variant={'secondary'}
        fill={'outline'}
        size={'sm'}
        icon="compass"
        tooltip={UI_TEXT.METRIC_SELECT_SCENE.OPEN_EXPLORE_LABEL}
        onClick={() => model.openExploreLink()}
      >
        Explore
      </Button>
    );
  };
}


