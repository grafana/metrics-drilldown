import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import {
  SceneObjectBase,
  SceneObjectUrlSyncConfig,
  VariableDependencyConfig,
  type SceneObjectState,
  type SceneObjectUrlValues,
} from '@grafana/scenes';
import { IconButton, Input, Tag, Tooltip, useStyles2 } from '@grafana/ui';
import { debounce } from 'lodash';
import React, { type KeyboardEvent } from 'react';

import { reportExploreMetrics } from 'interactions';
import { VAR_DATASOURCE } from 'shared';

import { type CountsProvider } from './CountsProvider/CountsProvider';
import { EventQuickSearchChanged } from './EventQuickSearchChanged';

interface QuickSearchState extends SceneObjectState {
  urlSearchParamName: string;
  targetName: string;
  countsProvider: CountsProvider;
  displayCounts: boolean;
  value: string;
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
    countsProvider,
    displayCounts,
  }: {
    urlSearchParamName: QuickSearchState['urlSearchParamName'];
    targetName: QuickSearchState['targetName'];
    countsProvider: QuickSearchState['countsProvider'];
    displayCounts?: QuickSearchState['displayCounts'];
  }) {
    super({
      key: 'quick-search',
      urlSearchParamName,
      targetName,
      countsProvider,
      displayCounts: Boolean(displayCounts),
      value: '',
    });
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

  private useHumanFriendlyCountsMessage() {
    const { targetName, countsProvider, displayCounts } = this.state;
    const counts = countsProvider.useCounts();

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
    const { targetName, value, countsProvider } = model.useState();
    const { tagName, tooltipContent } = model.useHumanFriendlyCountsMessage();

    return (
      <Input
        value={value}
        onChange={model.onChange}
        onKeyDown={model.onKeyDown}
        placeholder={`Quick search ${targetName}s`}
        prefix={<i className="fa fa-search" />}
        suffix={
          <>
            <countsProvider.Component model={countsProvider} />
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
