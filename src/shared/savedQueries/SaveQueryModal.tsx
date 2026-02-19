
import { css } from '@emotion/css';
import { AppEvents, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { Alert, Box, Button, Field, Input, Modal, Stack, useStyles2 } from '@grafana/ui';
import React, { useCallback, useEffect, useState, type FormEvent } from 'react';

import { logger } from 'shared/logger/logger';
import { reportExploreMetrics } from 'shared/tracking/interactions';

import { findExistingQuery, useSavedQueries } from './savedQuery';

interface Props {
  readonly dsUid: string;
  readonly query: string;
  readonly onClose: () => void;
}

export function SaveQueryModal({ dsUid, query, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [state, setState] = useState<'error' | 'idle' | 'saving'>('idle');
  const styles = useStyles2(getStyles);

  const { saveQuery, queries } = useSavedQueries(dsUid);
  const existingQuery = findExistingQuery(queries, query);

  useEffect(() => {
    reportExploreMetrics('saved_query_save_modal_opened', {});
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const appEvents = getAppEvents();

      try {
        setState('saving');
        await saveQuery({ description, dsUid, query, title });

        appEvents.publish({
          payload: [t('metrics.metrics-drilldown.save-query.success', 'Query successfully saved.')],
          type: AppEvents.alertSuccess.name,
        });

        reportExploreMetrics('saved_query_saved', { source: 'local' });

        onClose();
      } catch (e) {
        logger.error(e instanceof Error ? e : new Error(String(e)));
        setState('error');

        appEvents.publish({
          payload: [t('metrics.metrics-drilldown.save-query.error', 'Unexpected error saving this query.')],
          type: AppEvents.alertError.name,
        });
      }
    },
    [description, dsUid, onClose, query, saveQuery, title]
  );

  return (
    <Modal
      title={t('metrics.metrics-drilldown.save-query.modal-title', 'Save current query')}
      isOpen={true}
      onDismiss={onClose}
    >
      <Alert title="" severity="info">
        {t(
          'metrics.metrics-drilldown.save-query.modal-alert',
          'Saved queries are stored locally in your browser and will only be available on this device.'
        )}
      </Alert>
      <Box marginBottom={2}>
        <code className={styles.query}>{query}</code>
      </Box>
      <form onSubmit={handleSubmit}>
        <Stack gap={1} direction="column" minWidth={0} flex={1}>
          <Box flex={1} marginBottom={2}>
            {existingQuery && (
              <Alert title="" severity="warning">
                {t(
                  'metrics.metrics-drilldown.save-query.already-exists.alert',
                  'There is a previously saved query with the same expression: {{title}}',
                  {
                    title: existingQuery.title,
                  }
                )}
              </Alert>
            )}
            <Field
              label={t('metrics.metrics-drilldown.save-query.title', 'Title')}
              noMargin
              htmlFor="save-query-title"
            >
              <Input
                id="save-query-title"
                required
                value={title}
                onChange={(e: FormEvent<HTMLInputElement>) => setTitle(e.currentTarget.value)}
                disabled={state === 'saving'}
              />
            </Field>
          </Box>
          <Box flex={1} marginBottom={2}>
            <Field
              label={t('metrics.metrics-drilldown.save-query.description', 'Description')}
              noMargin
              htmlFor="save-query-description"
            >
              <Input
                id="save-query-description"
                value={description}
                onChange={(e: FormEvent<HTMLInputElement>) => setDescription(e.currentTarget.value)}
                disabled={state === 'saving'}
              />
            </Field>
          </Box>
        </Stack>
        <Modal.ButtonRow>
          <Button variant="secondary" fill="outline" onClick={onClose} disabled={state === 'saving'}>
            {t('metrics.metrics-drilldown.save-query.cancel', 'Cancel')}
          </Button>
          <Button type="submit" disabled={!title || state === 'saving'}>
            {t('metrics.metrics-drilldown.save-query.save', 'Save')}
          </Button>
        </Modal.ButtonRow>
      </form>
    </Modal>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  query: css({
    backgroundColor: theme.colors.background.elevated,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    padding: theme.spacing(1),
    display: 'block',
    whiteSpace: 'pre-wrap',
  }),
});
