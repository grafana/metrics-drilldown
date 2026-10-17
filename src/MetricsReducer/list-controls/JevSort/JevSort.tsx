import { t } from '@grafana/i18n';
import {
  sceneGraph,
  SceneObjectBase,
  type CustomVariable,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { Button } from '@grafana/ui';
import React from 'react';

import { isJevEnabled } from 'MetricScene/RelatedMetrics/ranking/toggles';

import { MetricsSorter, VAR_WINGMAN_SORT_BY } from '../MetricsSorter/MetricsSorter';

interface JevSortState extends SceneObjectState {
  active: boolean;
  visible: boolean;
}
export class JevSort extends SceneObjectBase<JevSortState> {
  private previousSort = 'default';
  constructor() {
    super({ key: 'jev-sort', active: false, visible: isJevEnabled() });
    this.addActivationHandler(() => {
      const variable = this.getSortVariable();
      this.setState({ active: variable.getValue() === 'jev-relevance' });
      this._subs.add(
        variable.subscribeToState((state, previous) => {
          if (state.value !== previous.value) {
            if (previous.value !== 'jev-relevance') {
              this.previousSort = String(previous.value);
            }
            this.setState({ active: state.value === 'jev-relevance' });
          }
        })
      );
    });
  }
  private getSortVariable(): CustomVariable {
    const sorter = sceneGraph.findByKeyAndType(this, 'metrics-sorter', MetricsSorter);
    return sorter.state.$variables.getByName(VAR_WINGMAN_SORT_BY) as CustomVariable;
  }
  public toggle = () => {
    const variable = this.getSortVariable();
    variable.changeValueTo(variable.getValue() === 'jev-relevance' ? this.previousSort : 'jev-relevance');
  };
  public static readonly Component = ({ model }: SceneComponentProps<JevSort>) => {
    const { active, visible } = model.useState();
    if (!visible) {
      return null;
    }
    return (
      <Button
        size="sm"
        variant={active ? 'primary' : 'secondary'}
        aria-pressed={active}
        onClick={model.toggle}
        title={t('jev-sort.tooltip', 'Sort metrics by incident and SLO priority, then Jev usefulness')}
      >
        {t('jev-sort.label', 'Jev Sorted ✨')}
      </Button>
    );
  };
}
