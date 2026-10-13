import { type PanelMenuItem } from '@grafana/data';
import { sceneGraph, VizPanel, type SceneObject } from '@grafana/scenes';

import { getPanelData } from '../../../shared/GmdVizPanel/components/addToDashboard/addToDashboard';
import { getCreateAlertLabel } from '../../../shared/GmdVizPanel/components/createAlert/constants';
import { EventOpenCreateAlert } from '../../../shared/GmdVizPanel/components/createAlert/EventOpenCreateAlert';
import { reportExploreMetrics } from '../../../shared/tracking/interactions';

export class CreateAlertAction {
  static create(panelMenuInstance: SceneObject): PanelMenuItem {
    return {
      text: getCreateAlertLabel(),
      iconClassName: 'bell',
      onClick: () => {
        const vizPanel = sceneGraph.getAncestor(panelMenuInstance, VizPanel);
        const panelData = getPanelData(vizPanel);
        const metric = vizPanel.state.title ?? '';
        reportExploreMetrics('create_alert_clicked', { metric });
        panelMenuInstance.publishEvent(new EventOpenCreateAlert({ panelData }), true);
      },
    };
  }
}
