import { type DataFrame, type PanelMenuItem, type PluginExtensionLink } from '@grafana/data';
import { config, getObservablePluginLinks } from '@grafana/runtime';
import {
  SceneObjectBase,
  VizPanelMenu,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
} from '@grafana/scenes';
import React from 'react';
import { firstValueFrom } from 'rxjs';

import { logger } from 'tracking/logger/logger';

import { getTrailFor } from '../utils';
import { CopyUrlAction } from './actions/CopyUrlAction';
import { ExploreAction } from './actions/ExploreAction';
import { AddToExplorationButton, extensionPointId } from './AddToExplorationsButton';

const ADD_TO_INVESTIGATION_MENU_TEXT = 'Add to investigation';
const ADD_TO_INVESTIGATION_MENU_DIVIDER_TEXT = 'investigations_divider'; // Text won't be visible
const ADD_TO_INVESTIGATION_MENU_GROUP_TEXT = 'Investigations';

interface PanelMenuState extends SceneObjectState {
  body?: VizPanelMenu;
  frame?: DataFrame;
  labelName?: string;
  fieldName?: string;
  addExplorationsLink?: boolean;
  explorationsButton?: AddToExplorationButton;
}

/**
 * @todo the VizPanelMenu interface is overly restrictive, doesn't allow any member functions on this class, so everything is currently inlined
 */
export class PanelMenu extends SceneObjectBase<PanelMenuState> implements VizPanelMenu, SceneObject {
  constructor(state: Partial<PanelMenuState>) {
    super({ ...state, addExplorationsLink: state.addExplorationsLink ?? true });
    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
      // Check if this is the main metric graph panel by key
      const isMainGraphPanel = this.state.key === 'TOPWVIEW_PANEL_MENU_KEY';

      // Navigation options (all panels)
      const items: PanelMenuItem[] = [
        {
          text: 'Navigation',
          type: 'group',
        },
        ExploreAction.create(this),
      ];

      // Only add Copy URL to the main metric graph panel
      if (isMainGraphPanel) {
        const trail = getTrailFor(this);
        items.push(
          {
            text: 'Actions',
            type: 'group',
          },
          CopyUrlAction.create(trail)
        );
      }

      this.setState({
        body: new VizPanelMenu({
          items,
        }),
      });

      const addToExplorationsButton = new AddToExplorationButton({
        labelName: this.state.labelName,
        fieldName: this.state.fieldName,
        frame: this.state.frame,
      });
      this._subs.add(
        addToExplorationsButton?.subscribeToState(async () => {
          await subscribeToAddToExploration(this);
        })
      );
      this.setState({
        explorationsButton: addToExplorationsButton,
      });

      if (this.state.addExplorationsLink) {
        this.state.explorationsButton?.activate();
      }
  }

  addItem(item: PanelMenuItem): void {
    if (this.state.body) {
      this.state.body.addItem(item);
    }
  }

  setItems(items: PanelMenuItem[]): void {
    if (this.state.body) {
      this.state.body.setItems(items);
    }
  }

  public static readonly Component = ({ model }: SceneComponentProps<PanelMenu>) => {
    const { body } = model.useState();

    if (body) {
      return <body.Component model={body} />;
    }

    return <></>;
  };
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

async function subscribeToAddToExploration(menu: PanelMenu) {
  const addToExplorationButton = menu.state.explorationsButton;
  if (addToExplorationButton) {
    const link = await getInvestigationLink(addToExplorationButton);

    const existingMenuItems = menu.state.body?.state.items ?? [];

    const existingAddToExplorationLink = existingMenuItems.find((item) => item.text === ADD_TO_INVESTIGATION_MENU_TEXT);

    if (link) {
      if (!existingAddToExplorationLink) {
        menu.state.body?.addItem({
          text: ADD_TO_INVESTIGATION_MENU_DIVIDER_TEXT,
          type: 'divider',
        });
        menu.state.body?.addItem({
          text: ADD_TO_INVESTIGATION_MENU_GROUP_TEXT,
          type: 'group',
        });
        menu.state.body?.addItem({
          text: ADD_TO_INVESTIGATION_MENU_TEXT,
          iconClassName: 'plus-square',
          onClick: (e) => link.onClick && link.onClick(e),
        });
      } else {
        if (existingAddToExplorationLink) {
          menu.state.body?.setItems(
            existingMenuItems.filter(
              (item) =>
                [
                  ADD_TO_INVESTIGATION_MENU_DIVIDER_TEXT,
                  ADD_TO_INVESTIGATION_MENU_GROUP_TEXT,
                  ADD_TO_INVESTIGATION_MENU_TEXT,
                ].includes(item.text) === false
            )
          );
        }
      }
    }
  }
}
