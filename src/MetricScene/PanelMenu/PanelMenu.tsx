import { type DataFrame, type PanelMenuItem } from '@grafana/data';
import { SceneObjectBase, VizPanelMenu, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import React from 'react';

import { getTrailFor } from '../../shared/utils/utils';
import { TOPVIEW_PANEL_MENU_KEY } from '../MetricGraphScene';
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
 * the VizPanelMenu interface is overly restrictive, doesn't allow any member functions on this class, so everything is currently inlined
 * @see https://github.com/grafana/metrics-drilldown/issues/863
 */
export class PanelMenu extends SceneObjectBase<PanelMenuState> implements VizPanelMenu {
  constructor(state: Omit<PanelMenuState, 'body'>) {
    super({
      ...state,
      addExplorationsLink: state.addExplorationsLink ?? true,
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

      // Add investigation items if enabled (async)
      if (this.state.addExplorationsLink) {
        InvestigationAction.create(this, this.state.labelName, this.state.fieldName, this.state.frame).then(
          (investigationItems) => {
            if (investigationItems.length > 0) {
              this.state.body?.setItems([...items, ...investigationItems]);
            }
          }
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
