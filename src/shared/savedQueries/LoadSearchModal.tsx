
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

import { useSavedSearches, type SavedSearch } from './saveSearch';

interface Props {
  readonly onClose: () => void;
  readonly sceneRef: SceneObject;
}

export function LoadSearchModal({ onClose, sceneRef }: Props) {
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const styles = useStyles2(getStyles);

  const trail = useMemo(() => getTrailFor(sceneRef), [sceneRef]);
  const dsUid = useMemo(() => {
    const dsVar = sceneGraph.findByKeyAndType(trail, VAR_DATASOURCE, MetricsDrilldownDataSourceVariable);
    return dsVar.getValue().toString();
  }, [trail]);
  const sceneTimeRange = useMemo(() => sceneGraph.getTimeRange(sceneRef).state.value, [sceneRef]);

  const { deleteSearch, searches, isLoading } = useSavedSearches(dsUid);

  const selectedSearch = useMemo(() => {
    if (!searches.length) {
      return null;
    }
    return searches.find((search) => search.uid === selectedUid) ?? searches[0];
  }, [searches, selectedUid]);

  useEffect(() => {
    reportExploreMetrics('saved_query_load_modal_opened', {});
  }, []);

  const href = useMemo(() => {
    if (!selectedSearch) {
      return '';
    }
    try {
      const { metric, labels } = parsePromQLQuery(selectedSearch.query);
      const promURLObject = createPromURLObject(
        selectedSearch.dsUid,
        labels,
        metric,
        sceneTimeRange.raw.from.toString(),
        sceneTimeRange.raw.to.toString()
      );
      const params = buildNavigateToMetricsParams(promURLObject);
      return createAppUrl(ROUTES.Drilldown, params);
    } catch {
      return '';
    }
  }, [sceneTimeRange, selectedSearch]);

  const formattedTime = useMemo(
    () => (selectedSearch ? dateTime(selectedSearch.timestamp).format('ddd MMM DD YYYY HH:mm [GMT]ZZ') : ''),
    [selectedSearch]
  );

  const onSelect = useCallback((search: SavedSearch) => {
    setSelectedUid(search.uid);
    reportExploreMetrics('saved_query_toggled', { source: 'local' });
  }, []);

  const onDelete = useCallback(() => {
    if (!selectedSearch) {
      return;
    }
    deleteSearch(selectedSearch.uid);
    reportExploreMetrics('saved_query_deleted', { source: 'local' });
  }, [deleteSearch, selectedSearch]);

  const onLinkClick = useCallback(() => {
    reportExploreMetrics('saved_query_loaded', {});
    onClose();
  }, [onClose]);

  return (
    <Modal
      title={t('metrics.metrics-drilldown.load-search.modal-title', 'Load a previously saved search')}
      isOpen={true}
      onDismiss={onClose}
    >
      {!isLoading && searches.length === 0 && (
        <Box backgroundColor="secondary" padding={1.5} marginBottom={2}>
          {!searches.length && (
            <Text variant="body">
              {t('metrics.metrics-drilldown.load-search.empty', 'No saved searches to display.')}
            </Text>
          )}
        </Box>
      )}
      {searches.length > 0 && (
        <Stack flex={1} gap={0} minHeight={25}>
          <Box display="flex" flex={1} minWidth={0}>
            <ScrollContainer>
              <Stack direction="column" gap={0} flex={1} minWidth={0} role="radiogroup">
                {searches.map((search) => (
                  <SavedSearchItem key={search.uid} search={search} selected={search === selectedSearch} onSelect={onSelect} />
                ))}
              </Stack>
            </ScrollContainer>
            <Divider direction="vertical" spacing={0} />
          </Box>
          <Box display="flex" flex={2} minWidth={0}>
            <ScrollContainer>
              {selectedSearch && (
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
                    {selectedSearch.title}
                  </Text>
                  <Text variant="bodySmall" truncate>
                    {formattedTime}
                  </Text>
                  {selectedSearch.description && (
                    <Text variant="body" truncate>
                      {selectedSearch.description}
                    </Text>
                  )}

                  <code className={styles.query}>{selectedSearch.query}</code>
                  <Box display="flex" flex={1} justifyContent="flex-end" direction="column">
                    <Stack justifyContent="flex-start">
                      <IconButton
                        size="xl"
                        name="trash-alt"
                        onClick={onDelete}
                        tooltip={t('metrics.metrics-drilldown.load-search.remove', 'Remove')}
                      />
                      <LinkButton onClick={onLinkClick} href={href} variant="primary">
                        {t('metrics.metrics-drilldown.load-search.select', 'Select')}
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

interface SavedSearchItemProps {
  readonly onSelect: (search: SavedSearch) => void;
  readonly search: SavedSearch;
  readonly selected?: boolean;
}

function SavedSearchItem({ onSelect, search, selected }: SavedSearchItemProps) {
  const styles = useStyles2(getStyles);

  const id = useId();
  return (
    <label className={styles.label} htmlFor={id} aria-label={search.title}>
      <input
        tabIndex={selected ? 0 : -1}
        type="radio"
        id={id}
        name="saved-searches"
        className={styles.input}
        onChange={() => onSelect(search)}
        checked={selected}
      />
      <Stack alignItems="center" justifyContent="space-between">
        <Stack minWidth={0}>
          <Text truncate>{search.title ?? ''}</Text>
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
