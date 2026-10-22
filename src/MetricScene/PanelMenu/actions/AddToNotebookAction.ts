import { type PanelMenuItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph, VizPanel, type SceneObject } from '@grafana/scenes';

import { displayWarning } from 'MetricsReducer/helpers/displayStatus';
import { EventOpenAddToNotebook } from 'shared/GmdVizPanel/components/addToNotebook/EventOpenAddToNotebook';
import {
  buildNotebookCapture,
  canAddToNotebook,
  getAddToNotebookLabel,
} from 'shared/GmdVizPanel/components/addToNotebook/notebookCapture';
import { getTrailFor } from 'shared/utils/utils';

export class AddToNotebookAction {
  static create(panelMenuInstance: SceneObject): PanelMenuItem {
    return {
      text: getAddToNotebookLabel(),
      iconClassName: 'book',
      onClick: () => {
        if (!getTrailFor(panelMenuInstance).state.isAddToNotebookAvailable || !canAddToNotebook()) {
          return;
        }
        try {
          const vizPanel = sceneGraph.getAncestor(panelMenuInstance, VizPanel);
          const capture = buildNotebookCapture(vizPanel);
          panelMenuInstance.publishEvent(new EventOpenAddToNotebook(capture), true);
        } catch {
          displayWarning([
            t(
              'panel-menu.notebook.unsupported',
              'This chart cannot be added to a notebook. Only main metric charts with resolved Prometheus queries and no custom data transformations are supported.'
            ),
          ]);
        }
      },
    };
  }
}
