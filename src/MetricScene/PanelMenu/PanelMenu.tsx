import { type DataFrame, type PanelMenuItem } from '@grafana/data';
import { SceneObjectBase, VizPanelMenu, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import React from 'react';

import { getTrailFor } from '../../shared/utils/utils';
import { TOPVIEW_PANEL_MENU_KEY } from '../MetricGraphScene';
import { CopyUrlAction } from './actions/CopyUrlAction';
import { ExploreAction } from './actions/ExploreAction';

interface PanelMenuState extends SceneObjectState {
  body?: VizPanelMenu;
  frame?: DataFrame;
  labelName?: string;
  fieldName?: string;
}

/**
 * @todo the VizPanelMenu interface is overly restrictive, doesn't allow any member functions on this class, so everything is currently inlined
 */
export class PanelMenu extends SceneObjectBase<PanelMenuState> implements VizPanelMenu {
  constructor(state: Omit<PanelMenuState, 'body'>) {
    super({
      ...state,
      body: new VizPanelMenu({}),
    });

    this.addActivationHandler(() => {
      // Navigation group of options (all panels)
      const items: PanelMenuItem[] = [
        {
          text: 'Navigation',
          type: 'group',
        },
        ExploreAction.create(this),
      ];

      const isMainGraphPanel = this.state.key === TOPVIEW_PANEL_MENU_KEY;
      if (isMainGraphPanel) {
        // Only add Copy URL to the main metric graph panel
        items.push(
          {
            text: 'Actions',
            type: 'group',
          },
          CopyUrlAction.create(getTrailFor(this))
        );
      }

      this.state.body?.setState({ items });
    });
  }

  addItem(item: PanelMenuItem): void {
    this.state.body?.addItem(item);
  }

  setItems(items: PanelMenuItem[]): void {
    this.state.body?.setItems(items);
  }

  public static readonly Component = ({ model }: SceneComponentProps<PanelMenu>) => {
    const { body } = model.useState();
    return <div data-testid="panel-menu">{body && <body.Component model={body} />}</div>;
  };
}
