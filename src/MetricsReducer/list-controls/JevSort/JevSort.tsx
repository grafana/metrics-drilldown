import { t } from '@grafana/i18n';
import {
  sceneGraph,
  SceneObjectBase,
  type CustomVariable,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { Button, Stack } from '@grafana/ui';
import React from 'react';

import { isJevEnabled } from 'MetricScene/RelatedMetrics/ranking/toggles';

import { RankingProfileSettings } from './RankingProfileSettings';
import { MetricsSorter, VAR_WINGMAN_SORT_BY } from '../MetricsSorter/MetricsSorter';

interface JevSortState extends SceneObjectState {
  active: boolean;
  visible: boolean;
  settingsOpen: boolean;
}
export class JevSort extends SceneObjectBase<JevSortState> {
  private previousSort = 'default';
  constructor() {
    super({ key: 'jev-sort', active: false, visible: isJevEnabled(), settingsOpen: false });
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
    const { active, visible, settingsOpen } = model.useState();
    if (!visible) {
      return null;
    }
    return (
      <Stack direction="row" gap={1}>
        <Button
          size="sm"
          variant={active ? 'primary' : 'secondary'}
          aria-pressed={active}
          onClick={model.toggle}
          title={t('jev-sort.tooltip', 'Sort metrics by incident and SLO priority, then Jev usefulness')}
        >
          {t('jev-sort.label', 'Jev Sorted ✨')}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          icon="cog"
          aria-label={t('jev-profile.open', 'Configure ranking profile')}
          title={t('jev-profile.open', 'Configure ranking profile')}
          onClick={() => model.setState({ settingsOpen: true })}
        />
        {settingsOpen && (
          <RankingProfileSettings model={model} onClose={() => model.setState({ settingsOpen: false })} />
        )}
      </Stack>
    );
  };
}
