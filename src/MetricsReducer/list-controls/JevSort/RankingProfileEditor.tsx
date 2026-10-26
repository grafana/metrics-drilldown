import { css } from '@emotion/css';
import { useAssistant, useInlineAssistant } from '@grafana/assistant';
import { t } from '@grafana/i18n';
import { Alert, Button, Checkbox, Field, Modal, Stack, TextArea } from '@grafana/ui';
import React, { useEffect, useRef, useState } from 'react';

import { type MetadataPeek } from 'MetricScene/RelatedMetrics/ranking/buildRankingRequest';

import {
  EMPTY_PROFILE,
  formatRankingProfile,
  matchProfileRule,
  MAX_PROFILE_BYTES,
  parseRankingProfile,
} from './profile';
import {
  createProfileAssistantSession,
  PROFILE_SYSTEM_PROMPT,
  type ProfileDraftMode,
  type ProfileEvidence,
} from './profileAssistant';
import { rankingProfileStorageKey, readRankingProfile, saveRankingProfile } from './profileStorage';
import { buildLocalBaseline, type LocalCandidate, type LocalSignals } from './ranking';

export interface RankingProfileEditorProps {
  datasourceUid: string;
  names: string[];
  peekMetadata: MetadataPeek;
  signals: LocalSignals;
  isCurrentScope: () => boolean;
  onClose: () => void;
}
interface Preview {
  before: LocalCandidate[];
  after: LocalCandidate[];
  unmatched: number;
}

/** Drafts are local component state. Only an explicit reviewed Save can activate a profile or consent. */
export function RankingProfileEditor(props: Readonly<RankingProfileEditorProps>) {
  const { datasourceUid, names, peekMetadata, signals, onClose } = props;
  const [saved] = useState(() => readRankingProfile(datasourceUid));
  const [openingKey] = useState(() => rankingProfileStorageKey(datasourceUid));
  const [json, setJson] = useState(() => formatRankingProfile(saved?.profile ?? EMPTY_PROFILE));
  const [share, setShare] = useState(saved?.shareWithJev ?? false);
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState<ProfileEvidence[]>([]);
  const [preview, setPreview] = useState<Preview>();
  const [error, setError] = useState<string>();
  const { isAvailable } = useAssistant();
  const { generate, cancel, isGenerating } = useInlineAssistant();
  const generation = useRef(0);
  const inFlight = useRef(false);
  const scopeCheck = useRef(props.isCurrentScope);
  scopeCheck.current = props.isCurrentScope;
  const isCurrent = () =>
    Boolean(openingKey && rankingProfileStorageKey(datasourceUid) === openingKey && scopeCheck.current());

  useEffect(
    () => () => {
      generation.current++;
      inFlight.current = false;
      cancel();
    },
    [cancel]
  );

  function edit(value: string) {
    generation.current++;
    inFlight.current = false;
    cancel();
    setJson(value);
    setShare(false);
    setEvidence([]);
    setPreview(undefined);
    setError(undefined);
  }
  async function draft(mode: ProfileDraftMode) {
    if (
      inFlight.current ||
      !isCurrent() ||
      !isAvailable ||
      !names.length ||
      (mode === 'describe' && !description.trim())
    ) {
      return;
    }
    const token = ++generation.current;
    inFlight.current = true;
    setError(undefined);
    try {
      const session = createProfileAssistantSession(names, peekMetadata, mode, isCurrent);
      let existing;
      try {
        existing = parseRankingProfile(json);
      } catch {
        /* Invalid manual drafts are not sent to Assistant. */
      }
      await generate({
        origin: `grafana-metricsdrilldown-app/ranking-profile/${mode}`,
        systemPrompt: PROFILE_SYSTEM_PROMPT,
        prompt: session.prompt(description, existing),
        tools: session.tools,
        onComplete(text) {
          if (generation.current !== token || !isCurrent()) {
            return;
          }
          try {
            const proposal = session.parse(text);
            setJson(formatRankingProfile(proposal.profile));
            setShare(false);
            setEvidence(proposal.evidence);
            setPreview(undefined);
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : t('jev-profile.invalid-draft', 'Assistant returned an invalid draft.')
            );
          }
        },
        onError() {
          if (generation.current === token && isCurrent()) {
            setError(
              t('jev-profile.generation-failed', 'Assistant generation failed. Your saved profile is unchanged.')
            );
          }
        },
      });
    } catch {
      if (generation.current === token && isCurrent()) {
        setError(t('jev-profile.generation-failed', 'Assistant generation failed. Your saved profile is unchanged.'));
      }
    } finally {
      if (generation.current === token) {
        inFlight.current = false;
      }
    }
  }
  function previewDraft() {
    try {
      if (!isCurrent()) {
        throw new Error(
          t('jev-profile.reopen', 'Settings context changed. Reopen the editor and preview before saving.')
        );
      }
      const profile = parseRankingProfile(json);
      setPreview({
        before: buildLocalBaseline(names, { ...signals, rankingProfile: saved?.profile }, peekMetadata),
        after: buildLocalBaseline(names, { ...signals, rankingProfile: profile }, peekMetadata),
        unmatched: profile.rules.filter(
          (rule) => !names.some((name) => matchProfileRule({ ...profile, rules: [rule] }, name))
        ).length,
      });
      setError(undefined);
    } catch (err) {
      setPreview(undefined);
      setError(err instanceof Error ? err.message : t('jev-profile.invalid-json', 'Invalid ranking profile JSON.'));
    }
  }
  function save(remove = false) {
    if (!isCurrent() || (!remove && (!preview || inFlight.current))) {
      setError(t('jev-profile.reopen', 'Settings context changed. Reopen the editor and preview before saving.'));
      return;
    }
    try {
      saveRankingProfile(
        datasourceUid,
        openingKey!,
        remove ? undefined : parseRankingProfile(json),
        remove ? false : share,
        JSON.stringify(saved ?? null)
      );
      onClose();
    } catch {
      setError(
        t(
          'jev-profile.save-failed',
          'Could not save: storage is unavailable or settings changed in another view. Reopen the editor before retrying.'
        )
      );
    }
  }

  return (
    <Modal title={t('jev-profile.title', 'Ranking profile')} isOpen onDismiss={onClose}>
      <p>
        {t(
          'jev-profile.scope',
          'Personal settings for this user, organization, and datasource. Existing history stays separate. Do not include secrets.'
        )}
      </p>
      {!openingKey && (
        <Alert
          severity="warning"
          title={t('jev-profile.identity', 'Sign in and select a datasource to save a profile.')}
        />
      )}
      {error && <Alert severity="error" title={error} />}
      <Field
        label={t('jev-profile.json', 'Profile JSON')}
        description={t(
          'jev-profile.json-help',
          'Version 1; up to 20 exact/prefix rules and 8 KiB. Editing a draft clears previous sharing consent.'
        )}
      >
        <TextArea
          aria-label={t('jev-profile.json', 'Profile JSON')}
          value={json}
          rows={12}
          maxLength={MAX_PROFILE_BYTES}
          onChange={(event) => edit(event.currentTarget.value)}
        />
      </Field>
      <Field
        label={t('jev-profile.description', 'Explain what matters')}
        description={t(
          'jev-profile.assistant-disclosure',
          'Drafting sends this explanation, the valid draft, and bounded cached metric metadata to Grafana Assistant. No visit history, label values, or samples are supplied. Assistant has its own data policies.'
        )}
      >
        <TextArea
          aria-label={t('jev-profile.description', 'Explain what matters')}
          value={description}
          rows={3}
          maxLength={2000}
          disabled={isGenerating}
          onChange={(event) => setDescription(event.currentTarget.value)}
        />
      </Field>
      <Stack direction="row" wrap="wrap" gap={1}>
        <Button
          variant="secondary"
          disabled={!isAvailable || isGenerating || !description.trim() || !names.length || !openingKey}
          onClick={() => draft('describe')}
        >
          {t('jev-profile.draft', 'Draft from explanation')}
        </Button>
        <Button
          variant="secondary"
          disabled={!isAvailable || isGenerating || !names.length || !openingKey}
          onClick={() => draft('explore')}
        >
          {t('jev-profile.explore', 'Explore metadata and suggest')}
        </Button>
        {isGenerating && (
          <Button
            variant="secondary"
            onClick={() => {
              generation.current++;
              inFlight.current = false;
              cancel();
            }}
          >
            {t('jev-profile.cancel-generation', 'Cancel generation')}
          </Button>
        )}
      </Stack>
      {!isAvailable && (
        <p>
          {t(
            'jev-profile.assistant-unavailable',
            'Assistant is unavailable. You can still edit, preview, and save JSON manually.'
          )}
        </p>
      )}
      <p>
        {t(
          'jev-profile.exploration-limits',
          'Exploration uses cached metadata from the matching catalog: at most 6 tool calls and 40 inspected metrics, with no datasource queries. Coverage is incomplete; review inferred meanings.'
        )}
      </p>
      {evidence.length > 0 && (
        <details open>
          <summary>{t('jev-profile.evidence', 'Assistant evidence — review before saving')}</summary>
          <ul>
            {evidence.map((item) => (
              <li key={item.ruleIndex}>
                {item.ruleIndex + 1}:{' '}
                {
                  {
                    user: t('jev-profile.evidence-user', 'User explanation'),
                    metadata: t('jev-profile.evidence-metadata', 'Observed metadata'),
                    inferred: t('jev-profile.evidence-inferred', 'Inferred meaning'),
                  }[item.basis]
                }{' '}
                — {item.metricNames.join(', ')} — {item.explanation}
              </li>
            ))}
          </ul>
        </details>
      )}
      <Field>
        <Checkbox
          checked={share}
          disabled={!openingKey || isGenerating}
          onChange={(event) => setShare(event.currentTarget.checked)}
          label={t(
            'jev-profile.consent',
            'I approve sending this profile’s intent and matching purpose notes to Jev when ranking runs. Personal history stays local.'
          )}
        />
      </Field>
      <Button variant="secondary" disabled={isGenerating || !openingKey} onClick={previewDraft}>
        {t('jev-profile.preview', 'Validate and preview local ranking')}
      </Button>
      {preview && (
        <div className={css({ maxWidth: '100%', overflowX: 'auto' })}>
          <p>
            {t(
              'jev-profile.preview-help',
              'Preview shows deterministic local order using cached evidence, not a Jev call. Semantic results are evaluated only after saving and running Jev sorting.'
            )}
          </p>
          <p>
            {t(
              'jev-profile.preview-counts',
              '{{count}} matching metrics; {{unmatched}} rules have no match in this filtered catalog. First 20 shown.',
              { count: names.length, unmatched: preview.unmatched }
            )}
          </p>
          <table>
            <thead>
              <tr>
                <th>{t('jev-profile.before', 'Before')}</th>
                <th>{t('jev-profile.after', 'After')}</th>
                <th>{t('jev-profile.band', 'Priority band')}</th>
              </tr>
            </thead>
            <tbody>
              {preview.after.slice(0, 20).map((candidate, index) => (
                <tr key={candidate.name}>
                  <td>{preview.before[index]?.name}</td>
                  <td>{candidate.name}</td>
                  <td>
                    {
                      [
                        t('jev-profile.band-incident', 'Incident / SLO burn'),
                        t('jev-profile.band-slo', 'SLO tracked'),
                        t('jev-profile.band-ordinary', 'Ordinary'),
                      ][candidate.band]
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal.ButtonRow>
        {saved && (
          <Button variant="destructive" disabled={isGenerating} onClick={() => save(true)}>
            {t('jev-profile.remove', 'Remove saved profile')}
          </Button>
        )}
        <Button variant="secondary" onClick={onClose}>
          {t('jev-profile.cancel', 'Cancel')}
        </Button>
        <Button disabled={!openingKey || !preview || isGenerating} onClick={() => save()}>
          {t('jev-profile.save', 'Save reviewed profile')}
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}
