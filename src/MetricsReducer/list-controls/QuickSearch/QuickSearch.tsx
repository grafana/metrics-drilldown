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

import { evaluateFeatureFlag } from 'shared/featureFlags/openFeature';
import { VAR_DATASOURCE } from 'shared/shared';
import { reportExploreMetrics } from 'shared/tracking/interactions';
import { getQuickSearchPlaceholder } from 'shared/utils/utils.quicksearch';

import { NOTIFY_VALUE_CHANGE_DELAY } from './constants';
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
  }, NOTIFY_VALUE_CHANGE_DELAY);

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

    // When showing all items
    if (counts.current === counts.total) {
      return {
        tagName: `${counts.current}`,
        tooltipContent: t('quick-search.count-total', '{{targetName}}: {{count}} in total', {
          targetName,
          count: counts.current,
        }),
      };
    }

    // When filtered
    return {
      tagName: `${counts.current}/${counts.total}`,
      tooltipContent: t('quick-search.count-filtered', '{{targetName}}: {{current}} of {{total}} in total', {
        targetName,
        current: counts.current,
        total: counts.total,
        count: counts.current,
      }),
    };
  }

  static readonly Component = ({ model }: { model: QuickSearch }) => {
    const styles = useStyles2(getStyles);
    const { targetName, value, countsProvider, isQuestionMode, assistantTabExperimentVariant } = model.useState();
    const { tagName, tooltipContent } = model.useHumanFriendlyCountsMessage();
    const isAssistantAvailable = useQuickSearchAssistantAvailability();
    const inputRef = React.useRef<HTMLInputElement>(null);

    // --- Experiment logic ---
    const isTreatment = assistantTabExperimentVariant === 'treatment';
    const showAiButton = isAssistantAvailable && (isTreatment || isQuestionMode);

    // --- Placeholder ---
    // Treatment: show tab+enter hint. Control/Excluded: show '?' hint.
    const placeholder = getQuickSearchPlaceholder({
      targetName,
      isQuestionMode,
      isAssistantAvailable,
      assistantHintType: isTreatment ? 'tab_enter' : 'question_mark',
    });

    // --- Handlers ---
    const handleChange = (e: React.FormEvent<HTMLInputElement>) => {
      const newValue = e.currentTarget.value;

      // '?' shortcut: only control/excluded, only when assistant available
      const isQuestionMarkShortcut =
        newValue === '?' && value === '' && !isQuestionMode && !isTreatment && isAssistantAvailable;

      if (isQuestionMarkShortcut) {
        reportExploreMetrics('quick_search_assistant_mode_entered', { from: 'question_mark' });
        model.setState({ isQuestionMode: true });
        return;
      }

      model.onChange(e);
    };

    const handleAiButtonClick = () => {
      // Enter question mode and focus input
      if (!isQuestionMode) {
        reportExploreMetrics('quick_search_assistant_mode_entered', { from: 'button' });
        model.setState({ isQuestionMode: true });
        inputRef.current?.focus();
        return;
      }

      // In question mode, no text: focus input as a hint to type
      if (!value.trim()) {
        inputRef.current?.focus();
        return;
      }

      // In question mode with text: submit to assistant
      openQuickSearchAssistant(model, value);
      model.resetToQuickSearch();
    };

    // --- Render ---
    return (
      <Input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={model.onKeyDown}
        placeholder={placeholder}
        prefix={<i className="fa fa-search" />}
        suffix={
          <>
            {showAiButton && (
              <IconButton
                name="ai-sparkle"
                variant="primary"
                tooltip={t('quick-search.ask-assistant-tooltip', 'Ask the Grafana Assistant')}
                aria-label={t('quick-search.ask-assistant-aria-label', 'Ask the Grafana Assistant')}
                onClick={handleAiButtonClick}
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
              aria-label={t('quick-search.clear-search-tooltip', 'Clear search')}
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
