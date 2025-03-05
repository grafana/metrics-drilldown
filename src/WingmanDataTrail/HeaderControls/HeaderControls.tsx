import { type SelectableValue } from '@grafana/data';
import {
  EmbeddedScene,
  SceneFlexItem,
  SceneFlexLayout,
  SceneReactObject,
  type SceneObjectState,
} from '@grafana/scenes';
import { Select } from '@grafana/ui';
import React from 'react';

import { LayoutSwitcher } from './LayoutSwitcher';
import { MetricsSorter } from './MetricsSorter';
import { QuickSearch } from './QuickSearch';

interface HeaderControlsState extends SceneObjectState {
  onChange: (value: SelectableValue<string>) => void;
}

export class HeaderControls extends EmbeddedScene {
  constructor(state: Partial<HeaderControlsState>) {
    const quickSearch = new QuickSearch();
    const layoutSwitcher = new LayoutSwitcher();

    super({
      ...state,
      key: 'header-controls',
      body: new SceneFlexLayout({
        direction: 'row',
        maxHeight: '32px',
        children: [
          new SceneFlexItem({
            body: quickSearch,
          }),
          new SceneFlexItem({
            maxWidth: '240px',
            body: new SceneReactObject({
              reactNode: (
                <Select
                  placeholder="Group by label..."
                  options={[
                    { label: '(None)', value: 'none' },
                    { label: 'cluster (2)', value: 'cluster' },
                    { label: 'namespace (3)', value: 'namespace' },
                    { label: 'service (11)', value: 'service' },
                  ]}
                  // TEMP: add a groupBy variable dependency in MetricsReducer instead
                  onChange={(value) => state.onChange!(value)}
                />
              ),
            }),
          }),
          new SceneFlexItem({
            maxWidth: '240px',
            body: new MetricsSorter({}),
          }),
          new SceneFlexItem({
            width: 'auto',
            body: layoutSwitcher,
          }),
        ],
      }),
    });
  }
}
