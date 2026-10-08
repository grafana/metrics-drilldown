import { type PanelMenuItem } from '@grafana/data';
import { sceneGraph, VizPanel } from '@grafana/scenes';

import { getPanelData } from '../../../shared/GmdVizPanel/components/addToDashboard/addToDashboard';
import { CREATE_ALERT_LABEL } from '../../../shared/GmdVizPanel/components/createAlert/constants';
import { EventOpenCreateAlert } from '../../../shared/GmdVizPanel/components/createAlert/EventOpenCreateAlert';
import { reportExploreMetrics } from '../../../shared/tracking/interactions';

export class CreateAlertAction {
  static create(panelMenuInstance: any): PanelMenuItem {
    return {
      text: CREATE_ALERT_LABEL,
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
