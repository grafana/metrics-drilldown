import { type SceneObject } from '@grafana/scenes';

import { buildExplainMetricContext, buildExplainMetricPrompt } from 'MetricScene/PanelMenu/actions/OpenAssistantAction';
import {
  buildQuickSearchContext,
  openQuickSearchAssistant,
} from 'MetricsReducer/list-controls/QuickSearch/QuickSearchAssistant';

import {
  blankQuestions,
  explainContextCases,
  explainPromptCases,
  quickSearchContextCases,
} from './cases/assistant-prompts.cases';

const openAssistantMock = jest.fn();
jest.mock('@grafana/assistant', () => ({
  isAssistantAvailable: jest.fn(),
  openAssistant: (...args: unknown[]) => openAssistantMock(...args),
  // Keep the real shape simple and inspectable: the evals assert on item type and payload only.
  createAssistantContextItem: (type: string, params: unknown) => ({ type, params }),
}));

jest.mock('shared/tracking/interactions', () => ({ reportExploreMetrics: jest.fn() }));

beforeEach(() => openAssistantMock.mockClear());

describe('evals: "Explain in Assistant" prompt', () => {
  it('has unique case ids', () => {
    const ids = explainPromptCases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(explainPromptCases)('$failureMode: $id', (c) => {
    const prompt = buildExplainMetricPrompt(c.metricName, c.query);
    c.mustContain.forEach((s) => expect(prompt).toContain(s));
    c.mustNotContain.forEach((s) => expect(prompt).not.toContain(s));
  });
});

describe('evals: "Explain in Assistant" context', () => {
  it.each(explainContextCases)('$failureMode: $id', (c) => {
    const items = buildExplainMetricContext(c.datasourceUid, c.metricName, c.metadata) as unknown as Array<{
      type: string;
      params: Record<string, unknown>;
    }>;
    expect(items.map((i) => i.type)).toEqual(c.expectedTypes);

    // when a datasource is known, the metric must be attached as the __name__ label value
    items
      .filter((i) => i.type === 'label_value')
      .forEach((i) => expect(i.params).toMatchObject({ labelName: '__name__', labelValue: c.metricName }));
  });
});

describe('evals: quick-search context', () => {
  it.each(quickSearchContextCases)('$failureMode: $id', (c) => {
    const items = buildQuickSearchContext({
      datasourceUid: c.datasourceUid,
      filters: c.filters,
      timeRange: c.timeRange,
    }) as unknown as Array<{ type: string; params: { data?: Record<string, unknown> } }>;

    expect(items.map((i) => i.type)).toEqual(c.expectedTypes);
    // the time range item is always last and must carry both bounds
    expect(items[items.length - 1].params.data).toEqual(c.timeRange);
  });

  it.each(blankQuestions)('no-op-guard: does not open the Assistant for a blank question ($id)', ({ question }) => {
    openQuickSearchAssistant({} as SceneObject, question);
    expect(openAssistantMock).not.toHaveBeenCalled();
  });
});
