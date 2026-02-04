import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  EmbeddedScene,
  SceneFlexItem,
  SceneFlexLayout,
  type SceneComponentProps,
  type SceneObjectState,
  type SceneReactObject,
  type SceneVariableSet,
} from '@grafana/scenes';
import { Stack } from '@grafana/ui';
import React from 'react';

import { LayoutSwitcher } from './LayoutSwitcher';
import { MetricsSorter } from './MetricsSorter/MetricsSorter';
import { type CountsProvider } from './QuickSearch/CountsProvider/CountsProvider';
import { MetricVariableCountsProvider } from './QuickSearch/CountsProvider/MetricVariableCountsProvider';
import { QuickSearch } from './QuickSearch/QuickSearch';

interface ListControlsState extends SceneObjectState {
  $variables?: SceneVariableSet;
  inputControls?: SceneReactObject;
  onChange?: (value: SelectableValue<string>) => void; // Keeping for backward compatibility
}

// @ts-ignore to fix build error. Is there a Scenes friend way of doing this?
export class ListControls extends EmbeddedScene {
  constructor(state: Partial<ListControlsState>) {
    super({
      ...state,
      key: 'list-controls',
      body: new SceneFlexLayout({
        direction: 'row',
        width: '100%',
        maxHeight: '32px',
        children: [
          new SceneFlexItem({
            body: new QuickSearch({
              urlSearchParamName: 'search_txt',
              targetName: 'metric',
              countsProvider: new MetricVariableCountsProvider() as unknown as CountsProvider,
              ariaLabel: t('quick-search.aria-label-metrics', 'Quick search metrics'),
            }),
          }),
          new SceneFlexItem({
            width: 'auto',
            body: new MetricsSorter({}),
          }),
          new SceneFlexItem({
            width: 'auto',
            body: new LayoutSwitcher({}),
          }),
        ],
      }),
    });
  }

  public static readonly Component = ({ model }: SceneComponentProps<ListControls>) => {
    const { body } = model.useState();

    return (
      <Stack direction="row" alignItems="center">
        <body.Component model={body} />
      </Stack>
    );
  };
}
