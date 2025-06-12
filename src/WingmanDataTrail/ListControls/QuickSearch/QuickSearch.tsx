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

import { reportExploreMetrics } from 'interactions';
import { VAR_DATASOURCE } from 'shared';
import { areArraysEqual } from 'WingmanDataTrail/MetricsVariables/helpers/areArraysEqual';

import { EventQuickSearchChanged } from './EventQuickSearchChanged';
interface QuickSearchState extends SceneObjectState {
  urlSearchParamName: string;
  targetName: string;
  variableNames: {
    nonFiltered: string;
    filtered: string;
  };
  value: string;
  counts: { current: number; total: number };
  displayCounts: boolean;
}

export class QuickSearch extends SceneObjectBase<QuickSearchState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_DATASOURCE],
    onReferencedVariableValueChanged: () => {
      this.setState({ value: '' });
    },
  });

  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: [this.state.urlSearchParamName],
  });

  getUrlState() {
    return { [this.state.urlSearchParamName]: this.state.value };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const newValue = (values[this.state.urlSearchParamName] as string) || '';

    if (newValue !== this.state.value) {
      this.setState({ value: newValue });
    }
  }

  public constructor({
    urlSearchParamName,
    targetName,
    variableNames,
    displayCounts,
  }: {
    urlSearchParamName: QuickSearchState['urlSearchParamName'];
    targetName: QuickSearchState['targetName'];
    variableNames: QuickSearchState['variableNames'];
    displayCounts?: QuickSearchState['displayCounts'];
  }) {
    super({
      key: 'quick-search',
      urlSearchParamName,
      targetName,
      variableNames,
      value: '',
      counts: {
        current: 0,
        total: 0,
      },
      displayCounts: Boolean(displayCounts),
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const { variableNames } = this.state;

    const filteredVariable = sceneGraph.lookupVariable(variableNames.filtered, this) as MultiValueVariable;
    const nonFilteredVariable = sceneGraph.lookupVariable(variableNames.nonFiltered, this) as MultiValueVariable;

    this._subs.add(
      filteredVariable.subscribeToState((newState, prevState) => {
        if (!newState.loading && !prevState.loading && !areArraysEqual(newState.options, prevState.options)) {
          this.setState({
            counts: {
              current: newState.options.length,
              total: nonFilteredVariable.state.options.length,
            },
          });
        }
      })
    );

    this._subs.add(
      nonFilteredVariable.subscribeToState((newState, prevState) => {
        if (!areArraysEqual(newState.options, prevState.options)) {
          this.setState({
            counts: {
              current: filteredVariable.state.options.length,
              total: newState.options.length,
            },
          });
        }
      })
    );
  }

  public toggleCountsDisplay(displayCounts: boolean) {
    this.setState({ displayCounts });
  }

  private notifyValueChange = debounce((value: string) => {
    this.publishEvent(new EventQuickSearchChanged({ searchText: value }), true);
  }, 250);

  private updateValue(value: string) {
    const wasEmpty = this.state.value === '';
    const isNewSearch = wasEmpty && value !== '';

    if (isNewSearch) {
      reportExploreMetrics('quick_search_used', {});
    }

    this.setState({ value });
    this.notifyValueChange(value);
  }

  private onChange = (e: React.FormEvent<HTMLInputElement>) => {
    this.updateValue(e.currentTarget.value);
  };

  private clear = () => {
    this.updateValue('');
  };

  private onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.clear();
    }
  };

  private getHumanFriendlyCountsMessage() {
    const { targetName, counts, displayCounts } = this.state;

    if (!displayCounts) {
      return {
        tagName: '',
        tooltipContent: '',
      };
    }

    if (counts.current === counts.total) {
      return {
        tagName: `${counts.current}`,
        tooltipContent: counts.current !== 1 ? `${counts.current} ${targetName}s in total` : `1 ${targetName} in total`,
      };
    }

    return {
      tagName: `${counts.current}/${counts.total}`,
      tooltipContent:
        counts.current !== 1
          ? `${counts.current} out of ${counts.total} ${targetName}s in total`
          : `1 out of ${counts.total} ${targetName}s in total`,
    };
  }

  static readonly Component = ({ model }: { model: QuickSearch }) => {
    const styles = useStyles2(getStyles);
    const { targetName, value } = model.useState();
    const { tagName, tooltipContent } = model.getHumanFriendlyCountsMessage();

    return (
      <Input
        value={value}
        onChange={model.onChange}
        onKeyDown={model.onKeyDown}
        placeholder={`Quick search ${targetName}s`}
        prefix={<i className="fa fa-search" />}
        suffix={
          <>
            {tagName && (
              <Tooltip content={tooltipContent} placement="top">
                <Tag className={styles.counts} name={tagName} colorIndex={9} />
              </Tooltip>
            )}
            <IconButton
              name="times"
              variant="secondary"
              tooltip="Clear search"
              onClick={model.clear}
              disabled={!value}
            />
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
