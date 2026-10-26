import { useAssistant, useInlineAssistant, type InlineAssistantOptions } from '@grafana/assistant';
import { config } from '@grafana/runtime';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { type RankingProfile } from '../profile';
import { rankingProfileStorageKey, readRankingProfile, saveRankingProfile } from '../profileStorage';
import { RankingProfileEditor, type RankingProfileEditorProps } from '../RankingProfileEditor';

jest.mock('@grafana/assistant', () => ({
  ...jest.requireActual('@grafana/assistant'),
  useAssistant: jest.fn(),
  useInlineAssistant: jest.fn(),
}));
const originalUser = config.bootData.user;
const generate = jest.fn<Promise<void>, [InlineAssistantOptions]>();
const cancel = jest.fn();
const profile = (): RankingProfile => ({
  schemaVersion: 1,
  name: 'Synthetic',
  intent: 'Synthetic business purpose.',
  rules: [{ match: { exact: 'metric_b' }, purpose: 'Synthetic purchases.', priority: 'high' }],
});
function setup(overrides: Partial<RankingProfileEditorProps> = {}) {
  const props: RankingProfileEditorProps = {
    datasourceUid: 'prom',
    names: ['metric_a', 'metric_b'],
    peekMetadata: () => ({ type: 'counter', help: 'Synthetic HELP.' }),
    signals: { trackedMetrics: new Map(), activeBurnMetrics: new Set<string>(), attributedFiringCounts: new Map() },
    isCurrentScope: () => true,
    onClose: jest.fn(),
    ...overrides,
  };
  return { ...render(<RankingProfileEditor {...props} />), props };
}
function edit(value = profile()) {
  fireEvent.change(screen.getByLabelText('Profile JSON'), { target: { value: JSON.stringify(value) } });
}
function preview() {
  fireEvent.click(screen.getByRole('button', { name: 'Validate and preview local ranking' }));
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('gmd.jev.enabled', '1');
  config.bootData.user = { ...originalUser, isSignedIn: true, id: 7, orgId: 3 };
  generate.mockReset().mockResolvedValue();
  cancel.mockReset();
  jest.mocked(useAssistant).mockReturnValue({ isAvailable: false } as never);
  jest
    .mocked(useInlineAssistant)
    .mockReturnValue({ generate, cancel, reset: jest.fn(), isGenerating: false, content: '', error: null });
});
afterEach(() => {
  config.bootData.user = originalUser;
  localStorage.clear();
});

it('supports manual JSON without Assistant, requiring preview and explicit separate semantic consent', () => {
  const { props } = setup();
  expect(screen.getByRole('button', { name: 'Save reviewed profile' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Explore metadata and suggest' })).toBeDisabled();
  edit();
  fireEvent.click(screen.getByRole('checkbox'));
  expect(readRankingProfile('prom')).toBeUndefined();
  preview();
  expect(screen.getByRole('table')).toHaveTextContent('metric_b');
  expect(generate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Save reviewed profile' }));
  expect(readRankingProfile('prom')).toEqual({ profile: profile(), shareWithJev: true });
  expect(props.onClose).toHaveBeenCalledTimes(1);
});

it('allows a reviewed manual profile when the current filtered catalog is empty', () => {
  setup({ names: [] });
  edit();
  preview();
  expect(screen.getByRole('button', { name: 'Save reviewed profile' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Save reviewed profile' }));
  expect(readRankingProfile('prom')).toEqual({ profile: profile(), shareWithJev: false });
  expect(generate).not.toHaveBeenCalled();
});

it('resets consent and preview whenever a draft changes and never saves invalid JSON', () => {
  saveRankingProfile('prom', rankingProfileStorageKey('prom')!, profile(), true);
  setup();
  expect(screen.getByRole('checkbox')).toBeChecked();
  preview();
  edit({ ...profile(), intent: 'Changed synthetic purpose.' });
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  expect(screen.getByRole('button', { name: 'Save reviewed profile' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Profile JSON'), { target: { value: '{"invalid":true}' } });
  preview();
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(readRankingProfile('prom')?.profile.intent).toBe('Synthetic business purpose.');
  expect(screen.getByRole('button', { name: 'Save reviewed profile' })).toBeDisabled();
});

it('does not save on cancel and refuses late writes after scope or saved revision changes', () => {
  const { props } = setup();
  edit();
  preview();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(props.onClose).toHaveBeenCalled();
  expect(readRankingProfile('prom')).toBeUndefined();
  // Simulate another tab creating a profile while this editor retains its original revision.
  saveRankingProfile('prom', rankingProfileStorageKey('prom')!, { ...profile(), name: 'Other view' });
  fireEvent.click(screen.getByRole('button', { name: 'Save reviewed profile' }));
  expect(readRankingProfile('prom')?.profile.name).toBe('Other view');
  expect(screen.getByRole('alert')).toBeInTheDocument();
  config.bootData.user = { ...config.bootData.user, orgId: 4 };
  fireEvent.click(screen.getByRole('button', { name: 'Save reviewed profile' }));
  expect(readRankingProfile('prom')).toBeUndefined();
});

it('Assistant generation produces only a draft with evidence; applying still needs review and fresh consent', async () => {
  jest.mocked(useAssistant).mockReturnValue({ isAvailable: true } as never);
  generate.mockImplementation(async (options) =>
    options.onComplete?.(
      JSON.stringify({
        profile: profile(),
        evidence: [
          { ruleIndex: 0, basis: 'user', metricNames: ['metric_b'], explanation: 'User explained purchases.' },
        ],
      })
    )
  );
  setup();
  fireEvent.change(screen.getByLabelText('Explain what matters'), {
    target: { value: 'Synthetic metric_b counts purchases.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Draft from explanation' }));
  await waitFor(() => expect(screen.getByLabelText('Profile JSON')).toHaveValue(JSON.stringify(profile(), null, 2)));
  expect(screen.getByText(/User explained purchases/)).toBeInTheDocument();
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  expect(readRankingProfile('prom')).toBeUndefined();
  expect(screen.getByRole('button', { name: 'Save reviewed profile' })).toBeDisabled();
  expect(generate.mock.calls[0][0].tools).toEqual([]);
});

it('exploration supplies bounded read tools and ignores cancelled/superseded generation results', async () => {
  jest.mocked(useAssistant).mockReturnValue({ isAvailable: true } as never);
  let complete: InlineAssistantOptions['onComplete'];
  let finish!: () => void;
  generate.mockImplementation((options) => {
    complete = options.onComplete;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const { unmount } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Explore metadata and suggest' }));
  expect(generate.mock.calls[0][0].tools).toHaveLength(2);
  const manual = { ...profile(), name: 'Manual draft wins' };
  edit(manual);
  await act(async () => {
    complete?.(
      JSON.stringify({
        profile: profile(),
        evidence: [{ ruleIndex: 0, basis: 'metadata', metricNames: ['metric_b'], explanation: 'Cached HELP.' }],
      })
    );
    finish();
  });
  expect(screen.getByLabelText('Profile JSON')).toHaveValue(JSON.stringify(manual));
  expect(readRankingProfile('prom')).toBeUndefined();
  unmount();
  expect(cancel).toHaveBeenCalled();
});

it('discards late Assistant results after user scope changes and cannot activate the old draft', async () => {
  jest.mocked(useAssistant).mockReturnValue({ isAvailable: true } as never);
  let complete: InlineAssistantOptions['onComplete'];
  let finish!: () => void;
  generate.mockImplementation((options) => {
    complete = options.onComplete;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  setup();
  const originalJson = (screen.getByLabelText('Profile JSON') as HTMLTextAreaElement).value;
  fireEvent.click(screen.getByRole('button', { name: 'Explore metadata and suggest' }));
  config.bootData.user = { ...config.bootData.user, id: 8 };
  await act(async () => {
    complete?.(
      JSON.stringify({
        profile: profile(),
        evidence: [{ ruleIndex: 0, basis: 'metadata', metricNames: ['metric_b'], explanation: 'Cached HELP.' }],
      })
    );
    finish();
  });
  expect(screen.getByLabelText('Profile JSON')).toHaveValue(originalJson);
  expect(readRankingProfile('prom')).toBeUndefined();
  expect(screen.getByRole('button', { name: 'Save reviewed profile' })).toBeDisabled();
});
