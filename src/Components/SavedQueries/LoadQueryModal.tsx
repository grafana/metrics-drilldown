import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';

import { css } from '@emotion/css';

import { dateTime, GrafanaTheme2 } from '@grafana/data';
import { sceneGraph, SceneObject } from '@grafana/scenes';
import { Modal, Box, useStyles2, Stack, Text, Divider, ScrollContainer, LinkButton, IconButton } from '@grafana/ui';

import { DataTrail } from '../../AppDataTrail/DataTrail';
import { SavedQuery, useSavedQueries } from '../../services/saveQuery';
import { getDataSourceVariable } from '../../services/variableGetters';
import { buildQueryExpression } from '../../shared/GmdVizPanel/buildQueryExpression';
import { getMetricTypeSync, MetricType } from '../../shared/GmdVizPanel/matchers/getMetricType';
import { reportExploreMetrics } from '../../shared/tracking/interactions';
import { MetricSelectedEvent, VAR_FILTERS } from '../../shared/shared';

interface Props {
  onClose(): void;
  sceneRef: SceneObject;
}

export function LoadQueryModal({ onClose, sceneRef }: Props) {
  const [selectedQuery, setSelectedQuery] = useState<SavedQuery | null>(null);
  const styles = useStyles2(getStyles);

  const trail = useMemo(() => sceneGraph.getAncestor(sceneRef, DataTrail), [sceneRef]);

  const dsUid = useMemo(() => {
    const dsVariable = getDataSourceVariable(trail);
    return dsVariable.getValue().toString();
  }, [trail]);

  const { deleteQuery, queries, isLoading } = useSavedQueries(dsUid);

  useEffect(() => {
    const selected = queries.find((query) => query === selectedQuery);
    if (!selected && queries.length) {
      setSelectedQuery(
        selectedQuery ? queries.find((query) => query.uid === selectedQuery.uid) ?? queries[0] : queries[0]
      );
    }
  }, [selectedQuery, queries]);

  useEffect(() => {
    reportExploreMetrics('load_query_modal_opened', {
      saved_query_count: queries.length,
      storage_type: 'local_storage',
    });
  }, [queries.length]);

  const formattedTime = useMemo(
    () => (selectedQuery ? dateTime(selectedQuery.timestamp).format('ddd MMM DD YYYY HH:mm [GMT]ZZ') : ''),
    [selectedQuery]
  );

  const queryExpr = useMemo(() => {
    if (!selectedQuery) {
      return '';
    }
    return buildQueryExpression({
      metric: { name: selectedQuery.metric, type: getMetricTypeSync(selectedQuery.metric) as MetricType },
      labelMatchers: selectedQuery.labelMatchers,
      addIgnoreUsageFilter: true,
    });
  }, [selectedQuery]);

  const onSelect = useCallback((query: SavedQuery) => {
    setSelectedQuery(query);
  }, []);

  const onDelete = useCallback(() => {
    if (!selectedQuery) {
      return;
    }
    deleteQuery(selectedQuery.uid);
    reportExploreMetrics('saved_query_deleted', {
      storage_type: 'local_storage',
    });
  }, [deleteQuery, selectedQuery]);

  const onLoadQuery = useCallback(() => {
    if (!selectedQuery) {
      return;
    }

    // Build URL values for navigation
    const dsVariable = getDataSourceVariable(trail);
    const urlValues: Record<string, string | string[]> = {
      metric: selectedQuery.metric,
      [`var-${dsVariable.state.name}`]: selectedQuery.dsUid,
    };

    // Convert label matchers to URL format
    if (selectedQuery.labelMatchers.length > 0) {
      urlValues[`var-${VAR_FILTERS}`] = selectedQuery.labelMatchers.map(
        (m) => `${m.key}|${m.operator}|${m.value}`
      );
    }

    // Publish event to navigate to the metric
    trail.publishEvent(
      new MetricSelectedEvent({
        metric: selectedQuery.metric,
        urlValues,
      })
    );

    reportExploreMetrics('saved_query_loaded', {
      label_matcher_count: selectedQuery.labelMatchers.length,
      storage_type: 'local_storage',
    });

    onClose();
  }, [onClose, selectedQuery, trail]);

  return (
    <Modal title="Load a previously saved query" isOpen={true} onDismiss={onClose}>
      {!isLoading && queries.length === 0 && (
        <Box backgroundColor="secondary" padding={1.5} marginBottom={2}>
          <Text variant="body">No saved queries to display.</Text>
        </Box>
      )}
      {queries.length > 0 && (
        <Stack flex={1} gap={0} minHeight={25}>
          <Box display="flex" flex={1} minWidth={0}>
            <ScrollContainer>
              <Stack direction="column" gap={0} flex={1} minWidth={0} role="radiogroup">
                {queries.map((query, i) => (
                  <SavedQueryItem key={i} query={query} selected={query === selectedQuery} onSelect={onSelect} />
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
                  <Text variant="h5" truncate>
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

                  <code className={styles.query}>{queryExpr}</code>
                  <Box display="flex" flex={1} justifyContent="flex-end" direction="column">
                    <Stack justifyContent="flex-start">
                      <IconButton size="xl" name="trash-alt" onClick={onDelete} tooltip="Remove" />
                      <LinkButton onClick={onLoadQuery} variant="primary">
                        Select
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
  onSelect(query: SavedQuery): void;
  query: SavedQuery;
  selected?: boolean;
}

function SavedQueryItem({ onSelect, query, selected }: SavedQueryItemProps) {
  const styles = useStyles2(getStyles);

  const id = useId();
  return (
    <label className={styles.label} htmlFor={id} aria-label={query.title}>
      <input
        // only the selected item should be tabbable
        // arrow keys should navigate between items
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
    whiteSpace: 'wrap',
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

    // Add transitions for smooth highlighting fade-out
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
