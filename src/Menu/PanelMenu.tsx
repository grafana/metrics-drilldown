import { type DataFrame, type PanelMenuItem, type PluginExtensionLink } from '@grafana/data';
// Certain imports are not available in the dependant package, but can be if the plugin is running in a different Grafana version.
// We need both imports to support Grafana v11 and v12.
// @ts-expect-error
import { getObservablePluginLinks, getPluginLinkExtensions } from '@grafana/runtime';
import {
  getExploreURL,
  sceneGraph,
  SceneObjectBase,
  VizPanel,
  VizPanelMenu,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
} from '@grafana/scenes';
import React from 'react';
import { firstValueFrom } from 'rxjs';

import { AddToExplorationButton, extensionPointId } from '../MetricSelect/AddToExplorationsButton';
import { getQueryRunnerFor } from '../utils/utils.queries';

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
    this.addActivationHandler(() => {
      let exploreUrl: Promise<string | undefined> | undefined;
      try {
        const viz = sceneGraph.getAncestor(this, VizPanel);
        const panelData = sceneGraph.getData(viz).state.data;
        if (!panelData) {
          throw new Error('Cannot get link to explore, no panel data found');
        }
        const queryRunner = getQueryRunnerFor(viz);
        const queries = queryRunner?.state.queries ?? [];
        queries.forEach((query) => {
          // removing legendFormat to get verbose legend in Explore
          delete query.legendFormat;
        });
        // 'this' scene object contain the variable for the metric name which is correctly interpolated into the explore url
        // when used in the metric select scene case,
        // this will get the explore url with interpolated variables and include the labels __ignore_usage__, this is a known issue
        // in the metric scene we do not get use the __ignore_usage__ labels in the explore url
        exploreUrl = getExploreURL(panelData, this, panelData.timeRange);
      } catch (e) {}

      // Navigation options (all panels)
      const items: PanelMenuItem[] = [
        {
          text: 'Navigation',
          type: 'group',
        },
        {
          text: 'Explore',
          iconClassName: 'compass',
          onClick: () => exploreUrl?.then((url) => url && window.open(url, '_blank')),
          shortcut: 'p x',
        },
      ];

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
    });
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

  public static Component = ({ model }: SceneComponentProps<PanelMenu>) => {
    const { body } = model.useState();

    if (body) {
      return <body.Component model={body} />;
    }

    return <></>;
  };
}

const getInvestigationLink = async (addToExplorations: AddToExplorationButton) => {
  const context = addToExplorations.state.context;

  // `getPluginLinkExtensions` is removed in Grafana v12
  if (getPluginLinkExtensions !== undefined) {
    const links = getPluginLinkExtensions({
      extensionPointId,
      context,
    });

    return links.extensions[0];
  }

  // `getObservablePluginLinks` is introduced in Grafana v12
  if (getObservablePluginLinks !== undefined) {
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
