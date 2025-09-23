import { type DataFrame, type PanelMenuItem, type PluginExtensionLink } from '@grafana/data';
import { config, getObservablePluginLinks } from '@grafana/runtime';
import { firstValueFrom } from 'rxjs';

import { logger } from 'shared/logger/logger';

import { AddToExplorationButton, extensionPointId } from './AddToExplorationsButton';

const ADD_TO_INVESTIGATION_MENU_TEXT = 'Add to investigation';
const ADD_TO_INVESTIGATION_MENU_DIVIDER_TEXT = 'investigations_divider'; // Text won't be visible
const ADD_TO_INVESTIGATION_MENU_GROUP_TEXT = 'Investigations';

export class InvestigationAction {
  static async create(
    panelMenuInstance: any,
    labelName?: string,
    fieldName?: string,
    frame?: DataFrame
  ): Promise<PanelMenuItem[]> {
    const addToExplorationsButton = new AddToExplorationButton({
      labelName,
      fieldName,
      frame,
    });

    // Attach the button to the panel menu instance to provide scene graph context
    panelMenuInstance.setState({
      explorationsButton: addToExplorationsButton,
    });

    // Activate the button so it can access scene graph
    if (panelMenuInstance.state.addExplorationsLink) {
      addToExplorationsButton.activate();
    }

    const link = await getInvestigationLink(addToExplorationsButton);
    const items: PanelMenuItem[] = [];

    if (link) {
      items.push(
        {
          text: ADD_TO_INVESTIGATION_MENU_DIVIDER_TEXT,
          type: 'divider',
        },
        {
          text: ADD_TO_INVESTIGATION_MENU_GROUP_TEXT,
          type: 'group',
        },
        {
          text: ADD_TO_INVESTIGATION_MENU_TEXT,
          iconClassName: 'plus-square',
          onClick: (e) => link.onClick && link.onClick(e),
        }
      );
    }

    return items;
  }
}

const getInvestigationLink = async (addToExplorations: AddToExplorationButton) => {
  const context = addToExplorations.state.context;

  // Check if we're running on Grafana v11
  if (config.buildInfo.version.startsWith('11.')) {
    try {
      const runtime = await import('@grafana/runtime');
      const getPluginLinkExtensions = (runtime as any).getPluginLinkExtensions;
      if (getPluginLinkExtensions !== undefined) {
        const links = getPluginLinkExtensions({
          extensionPointId,
          context,
        });

        return links.extensions[0];
      }
    } catch (e) {
      // Ignore import error and fall through to v12 implementation
      logger.error(e as Error, { message: 'Error importing getPluginLinkExtensions' });
    }
  }

  // `getObservablePluginLinks` is introduced in Grafana v12
  if (typeof getObservablePluginLinks === 'function') {
    const links: PluginExtensionLink[] = await firstValueFrom(
      getObservablePluginLinks({
        extensionPointId,
        context,
      })
    );

    return links[0];
  }

  return undefined;
};
