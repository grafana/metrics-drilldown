import { type PanelMenuItem } from '@grafana/data';
import { sceneGraph, VizPanel } from '@grafana/scenes';

import { getPanelData } from '../../../shared/GmdVizPanel/components/addToDashboard/addToDashboard';
import { ADD_TO_DASHBOARD_LABEL } from '../../../shared/GmdVizPanel/components/addToDashboard/constants';
import { EventOpenAddToDashboard } from '../../../shared/GmdVizPanel/components/addToDashboard/EventOpenAddToDashboard';

export class AddToDashboardAction {
  static create(panelMenuInstance: any): PanelMenuItem {
    return {
      text: ADD_TO_DASHBOARD_LABEL,
      iconClassName: 'apps',
      onClick: () => {
        const vizPanel = sceneGraph.getAncestor(panelMenuInstance, VizPanel);
        const panelData = getPanelData(vizPanel);
        panelMenuInstance.publishEvent(new EventOpenAddToDashboard({ panelData }), true);
      },
    };
  }
}
