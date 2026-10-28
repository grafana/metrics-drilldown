import { type PanelMenuItem } from '@grafana/data';
import { sceneGraph, VizPanel, type SceneObject } from '@grafana/scenes';

import { getPanelData } from '../../../shared/GmdVizPanel/components/addToDashboard/addToDashboard';
import { getAddToDashboardLabel } from '../../../shared/GmdVizPanel/components/addToDashboard/constants';
import { EventOpenAddToDashboard } from '../../../shared/GmdVizPanel/components/addToDashboard/EventOpenAddToDashboard';

export class AddToDashboardAction {
  static create(panelMenuInstance: SceneObject): PanelMenuItem {
    return {
      text: getAddToDashboardLabel(),
      iconClassName: 'apps',
      onClick: () => {
        const vizPanel = sceneGraph.getAncestor(panelMenuInstance, VizPanel);
        const panelData = getPanelData(vizPanel);
        panelMenuInstance.publishEvent(new EventOpenAddToDashboard({ panelData }), true);
      },
    };
  }
}
