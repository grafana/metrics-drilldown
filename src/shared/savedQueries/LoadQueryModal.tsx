
import { css } from '@emotion/css';
import { dateTime, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph, type SceneObject } from '@grafana/scenes';
import { Box, Divider, IconButton, LinkButton, Modal, ScrollContainer, Stack, Text, useStyles2 } from '@grafana/ui';
import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';

import { MetricsDrilldownDataSourceVariable } from 'AppDataTrail/MetricsDrilldownDataSourceVariable';
import { buildNavigateToMetricsParams, createAppUrl, createPromURLObject, parsePromQLQuery } from 'extensions/links';
import { ROUTES } from 'shared/constants/routes';
import { VAR_DATASOURCE } from 'shared/shared';
import { reportExploreMetrics } from 'shared/tracking/interactions';
import { getTrailFor } from 'shared/utils/utils';

import { useSavedQueries, type SavedQuery } from './savedQuery';

interface Props {
  readonly onClose: () => void;
  readonly sceneRef: SceneObject;
}

export function LoadQueryModal({ onClose, sceneRef }: Props) {
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const styles = useStyles2(getStyles);

  const trail = useMemo(() => getTrailFor(sceneRef), [sceneRef]);
  const dsUid = useMemo(() => {
    const dsVar = sceneGraph.findByKeyAndType(trail, VAR_DATASOURCE, MetricsDrilldownDataSourceVariable);
    return dsVar.getValue().toString();
  }, [trail]);

  const { deleteQuery, queries, isLoading } = useSavedQueries(dsUid);

  const selectedQuery = useMemo(() => {
    if (!queries.length) {
      return null;
    }
    return queries.find((q) => q.uid === selectedUid) ?? queries[0];
  }, [queries, selectedUid]);

  useEffect(() => {
    reportExploreMetrics('saved_query_load_modal_opened', {});
  }, []);

  const href = useMemo(() => {
    if (!selectedQuery) {
      return '';
    }
    try {
      const { metric, labels } = parsePromQLQuery(selectedQuery.query);
      const timeRange = sceneGraph.getTimeRange(sceneRef).state.value;
      const promURLObject = createPromURLObject(
        selectedQuery.dsUid,
        labels,
        metric,
        timeRange.raw.from.toString(),
        timeRange.raw.to.toString()
      );
      const params = buildNavigateToMetricsParams(promURLObject);
      return createAppUrl(ROUTES.Drilldown, params);
    } catch {
      return '';
    }
  }, [sceneRef, selectedQuery]);

  const formattedTime = useMemo(
    () => (selectedQuery ? dateTime(selectedQuery.timestamp).format('ddd MMM DD YYYY HH:mm [GMT]ZZ') : ''),
    [selectedQuery]
  );

  const onSelect = useCallback((query: SavedQuery) => {
    setSelectedUid(query.uid);
    reportExploreMetrics('saved_query_toggled', { source: 'local' });
  }, []);

  const onDelete = useCallback(() => {
    if (!selectedQuery) {
      return;
    }
    deleteQuery(selectedQuery.uid);
    reportExploreMetrics('saved_query_deleted', { source: 'local' });
  }, [deleteQuery, selectedQuery]);

  const onLinkClick = useCallback(() => {
    if (!href) {
      return;
    }
    reportExploreMetrics('saved_query_loaded', {});
    onClose();
  }, [href, onClose]);

  return (
    <Modal
      title={t('metrics.metrics-drilldown.load-query.modal-title', 'Load a previously saved query')}
      isOpen={true}
      onDismiss={onClose}
    >
      {!isLoading && queries.length === 0 && (
        <Box backgroundColor="secondary" padding={1.5} marginBottom={2}>
          <Text variant="body">
            {t('metrics.metrics-drilldown.load-query.empty', 'No saved queries to display.')}
          </Text>
        </Box>
      )}
      {queries.length > 0 && (
        <Stack flex={1} gap={0} minHeight={25}>
          <Box display="flex" flex={1} minWidth={0}>
            <ScrollContainer>
              <Stack direction="column" gap={0} flex={1} minWidth={0} role="radiogroup">
                {queries.map((query) => (
                  <SavedQueryItem key={query.uid} query={query} selected={query === selectedQuery} onSelect={onSelect} />
                ))}
              </Stack>
            </ScrollContainer>
            <Divider direction="vertical" spacing={0} />
          </Box>
          <Box display="flex" flex={2} minWidth={0}>
            <ScrollContainer>
              {selectedQuery && (
                <Box
                  direction="column"
                  display="flex"
                  gap={1}
                  flex={1}
                  paddingBottom={0}
                  paddingLeft={2}
                  paddingRight={1}
                >
                  <Text variant="h5" element="h3" truncate>
                    {selectedQuery.title}
                  </Text>
                  <Text variant="bodySmall" truncate>
                    {formattedTime}
                  </Text>
                  {selectedQuery.description && (
                    <Text variant="body" truncate>
                      {selectedQuery.description}
                    </Text>
                  )}

                  <code className={styles.query}>{selectedQuery.query}</code>
                  <Box display="flex" flex={1} justifyContent="flex-end" direction="column">
                    <Stack justifyContent="flex-start">
                      <IconButton
                        size="xl"
                        name="trash-alt"
                        onClick={onDelete}
                        tooltip={t('metrics.metrics-drilldown.load-query.remove', 'Remove')}
                      />
                      <LinkButton onClick={onLinkClick} href={href} variant="primary" disabled={!href}>
                        {t('metrics.metrics-drilldown.load-query.select', 'Select')}
                      </LinkButton>
                    </Stack>
                  </Box>
                </Box>
              )}
            </ScrollContainer>
          </Box>
        </Stack>
      )}
    </Modal>
  );
}

interface SavedQueryItemProps {
  readonly onSelect: (query: SavedQuery) => void;
  readonly query: SavedQuery;
  readonly selected?: boolean;
}

function SavedQueryItem({ onSelect, query, selected }: SavedQueryItemProps) {
  const styles = useStyles2(getStyles);

  const id = useId();
  return (
    <label className={styles.label} htmlFor={id} aria-label={query.title}>
      <input
        tabIndex={selected ? 0 : -1}
        type="radio"
        id={id}
        name="saved-queries"
        className={styles.input}
        onChange={() => onSelect(query)}
        checked={selected}
      />
      <Stack alignItems="center" justifyContent="space-between">
        <Stack minWidth={0}>
          <Text truncate>{query.title ?? ''}</Text>
        </Stack>
      </Stack>
    </label>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  query: css({
    backgroundColor: theme.colors.background.elevated,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    padding: theme.spacing(1),
    marginBottom: theme.spacing(1),
    display: 'block',
    whiteSpace: 'pre-wrap',
  }),
  input: css({
    cursor: 'pointer',
    inset: 0,
    opacity: 0,
    position: 'absolute',
  }),
  label: css({
    width: '100%',
    padding: theme.spacing(2, 2, 2, 1),
    position: 'relative',

    [theme.transitions.handleMotion('no-preference')]: {
      transition: theme.transitions.create(['background-color', 'border-color'], {
        duration: theme.transitions.duration.standard,
      }),
    },

    ':has(:checked)': {
      backgroundColor: theme.colors.action.selected,
    },

    ':has(:focus-visible)': css({
      backgroundColor: theme.colors.action.hover,
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: '-2px',
    }),
  }),
});
