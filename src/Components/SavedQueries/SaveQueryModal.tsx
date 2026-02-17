import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { css } from '@emotion/css';

import { AdHocVariableFilter, AppEvents, GrafanaTheme2 } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { sceneGraph, SceneObject } from '@grafana/scenes';
import { Modal, Button, Box, Field, Input, Stack, useStyles2, Alert } from '@grafana/ui';

import { DataTrail } from '../../AppDataTrail/DataTrail';
import { useCheckForExistingQuery, useSavedQueries } from '../../services/saveQuery';
import { buildQueryExpression, LabelMatcher } from '../../shared/GmdVizPanel/buildQueryExpression';
import { getMetricTypeSync, MetricType } from '../../shared/GmdVizPanel/matchers/getMetricType';
import { reportExploreMetrics } from '../../shared/tracking/interactions';
import { VAR_FILTERS } from '../../shared/shared';
import { isAdHocFiltersVariable } from '../../shared/utils/utils.variables';

interface Props {
  dsUid: string;
  metric: string;
  onClose(): void;
  sceneRef: SceneObject;
}

export function SaveQueryModal({ dsUid, metric, onClose, sceneRef }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [state, setState] = useState<'error' | 'idle' | 'saved' | 'saving'>('idle');
  const styles = useStyles2(getStyles);

  const trail = useMemo(() => sceneGraph.getAncestor(sceneRef, DataTrail), [sceneRef]);

  const labelMatchers = useMemo(() => {
    const filtersVar = sceneGraph.lookupVariable(VAR_FILTERS, trail);
    if (!isAdHocFiltersVariable(filtersVar)) {
      return [];
    }
    return filtersVar.state.filters
      .filter((f: AdHocVariableFilter) => f.key !== '__name__')
      .map(
        (f: AdHocVariableFilter): LabelMatcher => ({
          key: f.key,
          operator: f.operator,
          value: f.value,
        })
      );
  }, [trail]);

  const queryExpr = useMemo(() => {
    return buildQueryExpression({
      metric: { name: metric, type: getMetricTypeSync(metric) as MetricType },
      labelMatchers,
      addIgnoreUsageFilter: true,
    });
  }, [metric, labelMatchers]);

  const { saveQuery } = useSavedQueries(dsUid);
  const existingQuery = useCheckForExistingQuery(dsUid, metric, labelMatchers);

  useEffect(() => {
    reportExploreMetrics('save_query_modal_opened', {});
    if (existingQuery) {
      reportExploreMetrics('duplicate_query_warning_shown', {});
    }
  }, [existingQuery]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const appEvents = getAppEvents();

      try {
        setState('saving');
        await saveQuery({
          description,
          dsUid,
          metric,
          labelMatchers,
          title,
        });
        setState('saved');

        appEvents.publish({
          payload: ['Query successfully saved.'],
          type: AppEvents.alertSuccess.name,
        });

        reportExploreMetrics('query_saved', {
          has_description: description.length > 0,
          label_matcher_count: labelMatchers.length,
          storage_type: 'local_storage',
        });

        onClose();
      } catch (e) {
        console.error(e);
        setState('error');

        appEvents.publish({
          payload: ['Unexpected error saving this query.'],
          type: AppEvents.alertError.name,
        });
      }
    },
    [description, dsUid, metric, labelMatchers, onClose, saveQuery, title]
  );

  return (
    <Modal title="Save current query" isOpen={true} onDismiss={onClose}>
      <Alert title="" severity="info">
        Saved queries are stored locally in your browser and will only be available on this device.
      </Alert>
      <Box marginBottom={2}>
        <code className={styles.query}>{queryExpr}</code>
      </Box>
      {state !== 'saved' ? (
        <form onSubmit={handleSubmit}>
          <Stack gap={1} direction="column" minWidth={0} flex={1}>
            <Box flex={1} marginBottom={2}>
              {existingQuery && (
                <Alert title="" severity="warning">
                  There is a previously saved query with the same metric and filters: {existingQuery.title}
                </Alert>
              )}
              <Field label="Title" noMargin htmlFor="save-query-title">
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
              <Field label="Description" noMargin htmlFor="save-query-description">
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
              Cancel
            </Button>
            <Button type="submit" disabled={!title || state === 'saving'}>
              Save
            </Button>
          </Modal.ButtonRow>
        </form>
      ) : (
        <>
          <Alert title="Success" severity="success">
            Query successfully saved.
          </Alert>
          <Modal.ButtonRow>
            <Button variant="secondary" fill="outline" onClick={onClose}>
              Close
            </Button>
          </Modal.ButtonRow>
        </>
      )}
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
    whiteSpace: 'wrap',
  }),
});
