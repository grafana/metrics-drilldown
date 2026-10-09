import { isAssistantAvailable } from '@grafana/assistant';
import { type DataFrame, type PanelMenuItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { SceneObjectBase, VizPanelMenu, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import React from 'react';

import { getTrailFor } from '../../shared/utils/utils';
import { TOPVIEW_PANEL_MENU_KEY } from '../MetricGraphScene';
import { AddToDashboardAction } from './actions/AddToDashboardAction';
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
      let assistantAvailable = false;

      const buildItems = () => {
        // Navigation group of options (all panels)
        const items: PanelMenuItem[] = [
          {
            text: t('panel-menu.group.navigation', 'Navigation'),
            type: 'group',
          },
          ExploreAction.create(this),
        ];

        const isMainGraphPanel = this.state.key === TOPVIEW_PANEL_MENU_KEY;
        if (isMainGraphPanel) {
          // Only add these actions to the main metric graph panel
          const trail = getTrailFor(this);
          const actionItems: PanelMenuItem[] = [];

          if (assistantAvailable) {
            actionItems.push(OpenAssistantAction.create(this));
          }
          if (trail.state.isAddToDashboardAvailable) {
            actionItems.push(AddToDashboardAction.create(this));
          }
          if (trail.state.isCreateAlertAvailable) {
            actionItems.push(CreateAlertAction.create(this));
          }
          actionItems.push(BookmarkAction.create(this, buildItems));
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

      buildItems();

      this._subs.add(
        isAssistantAvailable().subscribe((available) => {
          assistantAvailable = available;
          buildItems();
        })
      );

      const isMainGraphPanel = this.state.key === TOPVIEW_PANEL_MENU_KEY;
      if (isMainGraphPanel) {
        const trail = getTrailFor(this);
        this._subs.add(
          trail.subscribeToState((newState, prevState) => {
            if (
              newState.isAddToDashboardAvailable !== prevState.isAddToDashboardAvailable ||
              newState.isCreateAlertAvailable !== prevState.isCreateAlertAvailable
            ) {
              buildItems();
            }
          })
        );

        // A metric, filter, or time-range change updates the URL without changing any of the
        // trail state watched above, which would otherwise leave the bookmark item's "Add
        // bookmark" / "Remove bookmark" label pointing at whatever view the menu last built
        // against. getLocationObservable() fires on every URL change regardless of which part
        // changed, so rebuilding here keeps the label accurate without enumerating every Scene
        // object (filters variable, $timeRange, ...) that could affect it.
        this._subs.add(locationService.getLocationObservable().subscribe(buildItems));
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
