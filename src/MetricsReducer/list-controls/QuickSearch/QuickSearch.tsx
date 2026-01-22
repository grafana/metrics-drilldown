import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
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

import { VAR_DATASOURCE } from 'shared/shared';
import { evaluateFeatureFlag } from 'shared/featureFlags/openFeature';
import { reportExploreMetrics } from 'shared/tracking/interactions';
import { type AssistantHint, getQuickSearchPlaceholder } from 'shared/utils/utils.quicksearch';

import { type CountsProvider } from './CountsProvider/CountsProvider';
import { EventQuickSearchChanged } from './EventQuickSearchChanged';
import { openQuickSearchAssistant, useQuickSearchAssistantAvailability } from './QuickSearchAssistant';

interface QuickSearchState extends SceneObjectState {
  urlSearchParamName: string;
  targetName: string;
  countsProvider: CountsProvider;
  displayCounts: boolean;
  value: string;
  isQuestionMode: boolean;
  assistantTabExperimentVariant: 'treatment' | 'control' | 'excluded';
}

export class QuickSearch extends SceneObjectBase<QuickSearchState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_DATASOURCE],
    onReferencedVariableValueChanged: () => {
      this.setState({ value: '', isQuestionMode: false });
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
      isQuestionMode: false,
      assistantTabExperimentVariant: 'excluded',
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    // EXPERIMENT: Evaluate early so analytics enrichment can include the variant when assistant events fire later.
    evaluateFeatureFlag('drilldown.metrics.grafana_assistant_quick_search_tab_test').then((flagValue) => {
      if (flagValue === 'treatment' || flagValue === 'control' || flagValue === 'excluded') {
        this.setState({ assistantTabExperimentVariant: flagValue });
      }
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

    // Only report search usage when not in question mode
    if (isNewSearch && !this.state.isQuestionMode) {
      reportExploreMetrics('quick_search_used', {});
    }

    this.setState({ value });

    // Only notify for filtering when not in question mode
    if (!this.state.isQuestionMode) {
      this.notifyValueChange(value);
    }
  }

  private onChange = (e: React.FormEvent<HTMLInputElement>) => {
    const newValue = e.currentTarget.value;

    // Intercept '?' when input is empty and not already in question mode to enter AI mode
    if (newValue === '?' && this.state.value === '' && !this.state.isQuestionMode) {
      reportExploreMetrics('quick_search_assistant_mode_entered', { from: 'question_mark' });
      this.setState({ isQuestionMode: true });
      return; // Don't add '?' to the input value
    }

    this.updateValue(newValue);
  };

  private clear = () => {
    this.resetToQuickSearch();
  };

  public resetToQuickSearch = () => {
    this.setState({ isQuestionMode: false });
    this.updateValue('');
  };

  private onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.clear();
    }

    // Handle Enter key in question mode to open assistant
    if (e.key === 'Enter' && this.state.isQuestionMode && this.state.value.trim()) {
      e.preventDefault();
      openQuickSearchAssistant(this, this.state.value);
      // clear the question mode, return to quicksearch because the assistant has opened.
      this.resetToQuickSearch();
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
        tooltipContent:
          counts.current !== 1
            ? t('quick-search.count-total-plural', '{{count}} {{targetName}}s in total', {
                count: counts.current,
                targetName,
              })
            : t('quick-search.count-total-singular', '1 {{targetName}} in total', { targetName }),
      };
    }

    return {
      tagName: `${counts.current}/${counts.total}`,
      tooltipContent:
        counts.current !== 1
          ? t('quick-search.count-filtered-plural', '{{current}} out of {{total}} {{targetName}}s in total', {
              current: counts.current,
              total: counts.total,
              targetName,
            })
          : t('quick-search.count-filtered-singular', '1 out of {{total}} {{targetName}}s in total', {
              total: counts.total,
              targetName,
            }),
    };
  }

  static readonly Component = ({ model }: { model: QuickSearch }) => {
    const styles = useStyles2(getStyles);
    const { targetName, value, countsProvider, isQuestionMode, assistantTabExperimentVariant } = model.useState();
    const { tagName, tooltipContent } = model.useHumanFriendlyCountsMessage();
    const isAssistantAvailable = useQuickSearchAssistantAvailability();
    const isAssistantTabExperimentTreatment = assistantTabExperimentVariant === 'treatment';

    const assistantHint: AssistantHint = isAssistantTabExperimentTreatment ? 'tab' : 'question_mark';
    const placeholder = getQuickSearchPlaceholder({ targetName, isQuestionMode, isAssistantAvailable, assistantHint });

    return (
      <Input
        value={value}
        onChange={model.onChange}
        onKeyDown={(e) => {
          // EXPERIMENT (treatment): pressing Tab enters assistant mode instead of moving focus.
          // Gate on assistant availability so we don't steal keyboard navigation when assistant is unavailable.
          // Keep Shift+Tab to preserve backwards focus navigation.
          if (e.key === 'Tab' && !e.shiftKey && !isQuestionMode && isAssistantTabExperimentTreatment && isAssistantAvailable) {
            e.preventDefault();
            reportExploreMetrics('quick_search_assistant_mode_entered', { from: 'tab' });
            model.setState({ isQuestionMode: true });
            return;
          }

          model.onKeyDown(e);
        }}
        placeholder={placeholder}
        prefix={<i className="fa fa-search" />}
        suffix={
          <>
            {isAssistantAvailable && (isQuestionMode || isAssistantTabExperimentTreatment) && (
              <IconButton
                name="ai-sparkle"
                variant="primary"
                tooltip={t('quick-search.ask-assistant-tooltip', 'Ask the Grafana Assistant')}
                aria-label={t('quick-search.ask-assistant-aria-label', 'Ask the Grafana Assistant')}
                onClick={() => {
                  // EXPERIMENT (treatment): clicking the always-visible button enters assistant mode.
                  // Control behavior remains: button is only shown in question mode.
                  if (!isQuestionMode) {
                    reportExploreMetrics('quick_search_assistant_mode_entered', { from: 'button' });
                    model.setState({ isQuestionMode: true });
                    return;
                  }
                  if (!value) {
                    return;
                  }
                  openQuickSearchAssistant(model, value);
                  // reset to quicksearch because the assistant has opened.
                  model.resetToQuickSearch();
                }}
              />
            )}
            <countsProvider.Component model={countsProvider} />
            {!isQuestionMode && tagName && (
              <Tooltip content={tooltipContent} placement="top">
                <Tag className={styles.counts} name={tagName} colorIndex={9} />
              </Tooltip>
            )}
            <IconButton
              name="times"
              variant="secondary"
              tooltip={t('quick-search.clear-search-tooltip', 'Clear search')}
              onClick={model.clear}
              disabled={!value && !isQuestionMode}
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
