import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  sceneGraph,
  SceneObjectBase,
  SceneObjectUrlSyncConfig,
  VariableDependencyConfig,
  type MultiValueVariable,
  type SceneObjectState,
  type SceneObjectUrlValues,
} from '@grafana/scenes';
import { IconButton, Input, Tag, Tooltip, useStyles2 } from '@grafana/ui';
import { debounce } from 'lodash';
import React, { type KeyboardEvent } from 'react';

import { NULL_GROUP_BY_VALUE } from 'WingmanDataTrail/Labels/LabelsDataSource';
import { VAR_WINGMAN_GROUP_BY } from 'WingmanDataTrail/Labels/LabelsVariable';
import {
  VAR_FILTERED_METRICS_VARIABLE,
  type FilteredMetricsVariable,
} from 'WingmanDataTrail/MetricsVariables/FilteredMetricsVariable';
import { VAR_METRICS_VARIABLE, type MetricsVariable } from 'WingmanDataTrail/MetricsVariables/MetricsVariable';
import { VAR_MAIN_LABEL_VARIABLE } from 'WingmanOnboarding/HeaderControls/MainLabelVariable';

import { EventQuickSearchChanged } from './EventQuickSearchChanged';

interface QuickSearchState extends SceneObjectState {
  value: string;
  counts: { current: number; total: number };
  disableRatioDisplay: boolean;
}

export class QuickSearch extends SceneObjectBase<QuickSearchState> {
  public static readonly URL_SEARCH_PARAM_NAME = 'search_txt';

  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_METRICS_VARIABLE, VAR_FILTERED_METRICS_VARIABLE, VAR_MAIN_LABEL_VARIABLE, VAR_WINGMAN_GROUP_BY],
    onAnyVariableChanged: (variable) => {
      if ([VAR_METRICS_VARIABLE, VAR_FILTERED_METRICS_VARIABLE].includes(variable.state.name)) {
        const { counts } = this.state;
        const key = variable.state.name === VAR_METRICS_VARIABLE ? 'total' : 'current';
        const newCount = (sceneGraph.lookupVariable(variable.state.name, this) as MultiValueVariable).state.options
          .length;

        if (newCount !== counts[key]) {
          this.setState({ counts: { ...counts, [key]: newCount } });
        }
        return;
      }

      if (variable.state.name === VAR_MAIN_LABEL_VARIABLE) {
        this.setState({ disableRatioDisplay: Boolean((variable as MultiValueVariable).state.value) });
        return;
      }

      if (variable.state.name === VAR_WINGMAN_GROUP_BY) {
        const value = (variable as MultiValueVariable).state.value;
        this.setState({ disableRatioDisplay: Boolean(value && value !== NULL_GROUP_BY_VALUE) });
        return;
      }

      this.setState({ disableRatioDisplay: false });
    },
  });

  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: [QuickSearch.URL_SEARCH_PARAM_NAME],
  });

  getUrlState() {
    return { [QuickSearch.URL_SEARCH_PARAM_NAME]: this.state.value };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const newValue = (values[QuickSearch.URL_SEARCH_PARAM_NAME] as string) || '';

    if (newValue !== this.state.value) {
      this.setState({ value: newValue });
    }
  }

  public constructor() {
    super({
      key: 'quick-search',
      value: '',
      counts: {
        current: 0,
        total: 0,
      },
      disableRatioDisplay: false,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    this.setState({
      counts: {
        current: (sceneGraph.lookupVariable(VAR_FILTERED_METRICS_VARIABLE, this) as FilteredMetricsVariable).state
          .options.length,
        total: (sceneGraph.lookupVariable(VAR_METRICS_VARIABLE, this) as MetricsVariable).state.options.length,
      },
    });

    this.updateDisableRatioDisplay();

    this.notifyValueChange(this.state.value);
  }

  private updateDisableRatioDisplay() {
    const mainLabelVariable = sceneGraph.lookupVariable(VAR_MAIN_LABEL_VARIABLE, this) as MultiValueVariable;
    const groupByVariable = sceneGraph.lookupVariable(VAR_WINGMAN_GROUP_BY, this) as MultiValueVariable;
    const groupByValue = groupByVariable.state.value;

    this.setState({
      disableRatioDisplay:
        Boolean(mainLabelVariable?.state.value) || Boolean(groupByValue && groupByValue !== NULL_GROUP_BY_VALUE),
    });
  }

  private notifyValueChange = debounce((value: string) => {
    this.publishEvent(new EventQuickSearchChanged({ searchText: value }), true);
  }, 250);

  private updateValue(value: string) {
    this.setState({ value });
    this.notifyValueChange(value);
  }

  private onChange = (e: React.FormEvent<HTMLInputElement>) => {
    this.updateValue(e.currentTarget.value);
  };

  public clear = () => {
    this.updateValue('');
  };

  private onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.clear();
    }
  };

  private getHumanFriendlyCountsMessage() {
    const { counts, disableRatioDisplay } = this.state;

    if (disableRatioDisplay) {
      // we keep current because it's the count of the active variable (e.g. MetricsWithLabelValueVariable) after selecting a "Group by" value
      // (total is always the count of options of MetricsVariable)
      return {
        tagName: `${counts.current}`,
        tooltipContent: counts.current !== 1 ? `${counts.current} metrics in total` : '1 metric in total',
      };
    }

    return {
      tagName: `${counts.current}/${counts.total}`,
      tooltipContent:
        counts.current !== 1
          ? `${counts.current} out of ${counts.total} metrics in total`
          : `1 out of ${counts.total} metrics in total`,
    };
  }

  static Component = ({ model }: { model: QuickSearch }) => {
    const styles = useStyles2(getStyles);
    const { value } = model.useState();

    const { tagName, tooltipContent } = model.getHumanFriendlyCountsMessage();

    return (
      <Input
        value={value}
        onChange={model.onChange}
        onKeyDown={model.onKeyDown}
        placeholder="Quick search metrics..."
        prefix={<i className="fa fa-search" />}
        suffix={
          <>
            <Tooltip content={tooltipContent} placement="top">
              <Tag className={styles.counts} name={tagName} colorIndex={9} />
            </Tooltip>
            <IconButton name="times" variant="secondary" tooltip="Clear search" onClick={model.clear} />
          </>
        }
      />
    );
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  counts: css`
    margin-right: ${theme.spacing(1)};
    border-radius: 11px;
    padding: 2px ${theme.spacing(1)};
    color: ${theme.colors.text.primary};
    background-color: ${theme.colors.background.secondary};
  `,
});
