import { type DataFrame, type PanelMenuItem } from '@grafana/data';
import {
  SceneObjectBase,
  VizPanelMenu,
  type SceneComponentProps,
  type SceneObject,
  type SceneObjectState,
} from '@grafana/scenes';
import React from 'react';

import { TOPVIEW_PANEL_MENU_KEY } from 'MetricGraphScene';

import { getTrailFor } from '../utils';
import { CopyUrlAction } from './actions/CopyUrlAction';
import { ExploreAction } from './actions/ExploreAction';
import { type AddToExplorationButton } from './actions/investigation/AddToExplorationsButton';
import { InvestigationAction } from './actions/investigation/InvestigationAction';

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
      // Check if this is the main metric graph panel by key
      const isMainGraphPanel = this.state.key === TOPVIEW_PANEL_MENU_KEY;

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

      // Add investigation items if enabled (async)
      if (this.state.addExplorationsLink) {
        InvestigationAction.create(
          this,
          this.state.labelName,
          this.state.fieldName,
          this.state.frame
        ).then((investigationItems) => {
          if (investigationItems.length > 0) {
            this.state.body?.setItems([...items, ...investigationItems]);
          }
        });
      }

      this.setState({
        body: new VizPanelMenu({
          items,
        }),
      });
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

  public static readonly Component = ({ model }: SceneComponentProps<PanelMenu>) => {
    const { body } = model.useState();

    if (body) {
      return <body.Component model={body} />;
    }

    return <></>;
  };
}

