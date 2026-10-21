import { isAssistantAvailable } from '@grafana/assistant';
import { type DataFrame, type PanelMenuItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { SceneObjectBase, VizPanelMenu, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import React from 'react';

import { getTrailFor } from '../../shared/utils/utils';
import { TOPVIEW_PANEL_MENU_KEY } from '../MetricGraphScene';
import { AddToDashboardAction } from './actions/AddToDashboardAction';
import { AddToNotebookAction } from './actions/AddToNotebookAction';
import { BookmarkAction } from './actions/BookmarkAction';
import { CopyUrlAction } from './actions/CopyUrlAction';
import { CreateAlertAction } from './actions/CreateAlertAction';
import { ExploreAction } from './actions/ExploreAction';
import { OpenAssistantAction } from './actions/OpenAssistantAction';

interface PanelMenuState extends SceneObjectState {
  body?: VizPanelMenu;
  frame?: DataFrame;
  labelName?: string;
  fieldName?: string;
}

/**
 * @todo the VizPanelMenu interface is overly restrictive, doesn't allow any member functions on this class, so everything is currently inlined
 * @see https://github.com/grafana/metrics-drilldown/issues/863
 */
export class PanelMenu extends SceneObjectBase<PanelMenuState> implements VizPanelMenu {
  constructor(state: Omit<PanelMenuState, 'body'>) {
    super({
      ...state,
      body: new VizPanelMenu({}),
    });

    this.addActivationHandler(() => {
      const isMainGraphPanel = this.state.key === TOPVIEW_PANEL_MENU_KEY;
      const trail = isMainGraphPanel ? getTrailFor(this) : undefined;
      let assistantAvailable = false;

      const buildItems = (trail: ReturnType<typeof getTrailFor> | undefined) => {
        // Navigation group of options (all panels)
        const items: PanelMenuItem[] = [
          {
            text: t('panel-menu.group.navigation', 'Navigation'),
            type: 'group',
          },
          ExploreAction.create(this),
        ];

        if (trail) {
          // Only add these actions to the main metric graph panel
          const actionItems: PanelMenuItem[] = [];

          if (assistantAvailable) {
            actionItems.push(OpenAssistantAction.create(this));
          }
          if (trail.state.isAddToDashboardAvailable) {
            actionItems.push(AddToDashboardAction.create(this));
          }
          if (trail.state.isAddToNotebookAvailable) {
            actionItems.push(AddToNotebookAction.create(this));
          }
          if (trail.state.isCreateAlertAvailable) {
            actionItems.push(CreateAlertAction.create(this));
          }
          actionItems.push(BookmarkAction.create(this, () => buildItems(trail)));
          actionItems.push(CopyUrlAction.create(trail));

          items.push(
            {
              text: t('panel-menu.group.actions', 'Actions'),
              type: 'group',
            },
            ...actionItems
          );
        }

        this.state.body?.setState({ items });
      };

      buildItems(trail);

      if (trail) {
        // Everything below only runs for the main panel: row-level menus never read
        // `assistantAvailable` or watch trail/URL changes, so subscribing there would just
        // trigger unused rebuilds on every emission.
        this._subs.add(
          isAssistantAvailable().subscribe((available) => {
            assistantAvailable = available;
            buildItems(trail);
          })
        );

        this._subs.add(
          trail.subscribeToState((newState, prevState) => {
            if (
              newState.isAddToDashboardAvailable !== prevState.isAddToDashboardAvailable ||
              newState.isAddToNotebookAvailable !== prevState.isAddToNotebookAvailable ||
              newState.isCreateAlertAvailable !== prevState.isCreateAlertAvailable
            ) {
              buildItems(trail);
            }
          })
        );

        // Catches URL changes (metric, filter, time range) that don't touch the trail state
        // above but can leave the bookmark label stale; cheaper than tracking every object that
        // could affect it.
        this._subs.add(locationService.getLocationObservable().subscribe(() => buildItems(trail)));
      }
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
