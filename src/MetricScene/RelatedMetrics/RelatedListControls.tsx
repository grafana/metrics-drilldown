import { css } from '@emotion/css';
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
import { useStyles2 } from '@grafana/ui';
import React from 'react';

import { LayoutSwitcher } from 'MetricsReducer/list-controls/LayoutSwitcher';
import { type CountsProvider } from 'MetricsReducer/list-controls/QuickSearch/CountsProvider/CountsProvider';
import { MetricVariableCountsProvider } from 'MetricsReducer/list-controls/QuickSearch/CountsProvider/MetricVariableCountsProvider';
import { QuickSearch } from 'MetricsReducer/list-controls/QuickSearch/QuickSearch';

import { PrefixFilterDropdown } from './PrefixFilterDropdown';

interface RelatedListControlsState extends SceneObjectState {
  $variables?: SceneVariableSet;
  inputControls?: SceneReactObject;
  onChange?: (value: SelectableValue<string>) => void; // Keeping for backward compatibility
}

export class RelatedListControls extends EmbeddedScene {
  constructor(state: Partial<RelatedListControlsState>) {
    super({
      ...state,
      key: 'related-list-controls',
      body: new SceneFlexLayout({
        direction: 'row',
        width: '100%',
        maxHeight: '32px',
        children: [
          new SceneFlexItem({
            width: 'auto',
            body: new PrefixFilterDropdown({}),
          }),
          new SceneFlexItem({
            body: new QuickSearch({
              urlSearchParamName: 'gmd-relatedSearchText',
              targetName: 'related metric',
              countsProvider: new MetricVariableCountsProvider() as unknown as CountsProvider,
              displayCounts: true,
              ariaLabel: t('related-metrics.search-aria-label', 'Quick search related metrics'),
            }),
          }),
          new SceneFlexItem({
            width: 'auto',
            body: new LayoutSwitcher({}),
          }),
        ],
      }),
    });
  }

  public static readonly Component = ({ model }: SceneComponentProps<RelatedListControls>) => {
    const styles = useStyles2(getStyles);
    const { body } = model.useState();

    return (
      <div className={styles.controls} data-testid="related-list-controls">
        <body.Component model={body} />
      </div>
    );
  };
}

function getStyles() {
  return {
    controls: css({
      display: 'flex',
      alignItems: 'end',
    }),
  };
}
