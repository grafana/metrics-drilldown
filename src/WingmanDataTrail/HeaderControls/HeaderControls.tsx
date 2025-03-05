import { type SelectableValue } from '@grafana/data';
import {
  EmbeddedScene,
  SceneFlexItem,
  SceneFlexLayout,
  type SceneObjectState,
  type SceneReactObject,
  type SceneVariableSet,
} from '@grafana/scenes';

import { GroupByControls } from './GroupByControls';
import { LayoutSwitcher } from './LayoutSwitcher';
import { MetricsSorter } from './MetricsSorter';
import { QuickSearch } from './QuickSearch';

interface HeaderControlsState extends SceneObjectState {
  $variables?: SceneVariableSet;
  inputControls?: SceneReactObject;
  onChange?: (value: SelectableValue<string>) => void; // Keeping for backward compatibility
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
            width: 'auto',
            body: new GroupByControls({}),
          }),
          new SceneFlexItem({
            width: 'auto',
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
