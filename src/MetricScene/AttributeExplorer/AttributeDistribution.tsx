// Duplicated from logs-drilldown/src/Components/AttributeDistribution/AttributeDistribution.tsx
// (also duplicated in sql-drilldown and app-o11y-kwl). The component is datasource-agnostic: it
// renders the sidebar and owns filter/lifecycle state, but never builds a query or talks to a
// datasource. All backend specifics are supplied by the adapter via the fetchAttributes /
// fetchDistribution props (see PrometheusAttributeExplorer.tsx in this repo).
// TODO: extract this component (+ attributeDistributionState.ts) into a shared library consumed by
// logs-drilldown, sql-drilldown, app-o11y-kwl, and metrics-drilldown instead of copying.

/* eslint-disable react-hooks/refs --
 * This component uses the "always-current ref" pattern (assigning ref.current during render) to read
 * fresh values inside effects/handlers without re-subscribing on every change. It is copied verbatim
 * from logs-drilldown/sql-drilldown, where the same pattern is disabled for the same reason.
 * TODO: revisit this pattern when extracting to a shared library. */

import { css, cx } from '@emotion/css';
import { colorManipulator, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Combobox, Icon, IconButton, MenuItem, Spinner, Tooltip, useStyles2, useTheme2, WithContextMenu } from '@grafana/ui';
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { type Observable, type Subscription } from 'rxjs';

import { type MetricType } from 'shared/GmdVizPanel/matchers/getMetricType';
import { logger } from 'shared/logger/logger';

import {
  computeNextFilters,
  mergeWithSnapshot,
  orderByPriority,
  reducer,
  sortByActivity,
  type ActiveFilter,
  type AttributeConfig,
  type AttributeState,
  type AttributeValueCount,
  type State,
} from './attributeDistributionState';

function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

export type { ActiveFilter, AttributeConfig, AttributeValueCount } from './attributeDistributionState';

function normalizeErrorMessage(e: unknown): string {
  const raw = e instanceof Error && e.message ? e.message : '';
  if (raw.toLowerCase().includes('max series')) {
    return t('attribute-explorer.too-many-values', 'Too many values to display');
  }
  return raw || t('attribute-explorer.error', 'Failed to load');
}

const MAX_VALUES_COLLAPSED = 1;
const MAX_VALUES_EXPANDED = 10;
const EMPTY_PRIORITY_ATTRIBUTES: string[] = [];
const EMPTY_ATTRIBUTE_LABELS: Record<string, string> = {};

export interface DatasetContext {
  datasourceUid: string;
  // Passed through opaquely, same as the rest of DatasetContext: the component never inspects it.
  histogramRange?: { lowerSeconds: number; upperSeconds: number };
  metricType: MetricType;
  query: string;
  timeRange: { from: number; to: number };
}

export interface AttributeDistributionProps {
  attributeLabels?: Record<string, string>;
  colorBars?: boolean;
  context: DatasetContext;
  fetchAttributes: (context: DatasetContext) => Promise<AttributeConfig[]>;
  fetchDistribution: (
    context: DatasetContext,
    field: string,
    filters: ActiveFilter[]
  ) => Observable<AttributeValueCount[]>;
  // Returns hover text for a small icon next to an attribute's label (e.g. "OTel metric attribute").
  // Return undefined to show no icon for that attribute. Per-attribute, not a single group caption:
  // a shared caption for the whole priority group can't distinguish adapter-detected attributes from
  // ones the user separately pinned via the combobox, since both end up in the same priority/pinned
  // section with no structural boundary between them.
  getAttributeBadge?: (attribute: string) => string | undefined;
  // Returns a URL to view the full distribution for a field in the owning drilldown app.
  // Return undefined to hide the link.
  getFieldLink?: (attribute: string) => string | undefined;
  // Returns extra context shown on hover of a value's count/percentage. Return undefined to skip the
  // tooltip for that value (e.g. an adapter that has nothing to add for most metric types).
  getValueTooltip?: (item: AttributeValueCount, field: string) => string | undefined;
  header?: React.ReactNode;
  // How many non-priority fields to auto-fetch a distribution for on load. Defaults to 10; pass 0
  // for adapters where fetching a distribution multiplies query cost (e.g. per-bucket histogram
  // breakdowns), so nothing fires until the user explicitly expands a field.
  initialAutoLoadCount?: number;
  // Caps how many priority + user-pinned fields are always visible and eagerly fetched. Unbounded by
  // default. OTel priority detection is already capped upstream, but a user can keep pinning
  // attributes across the component's lifetime with no such cap, and every priority/pinned field gets
  // its distribution fetched immediately; pass a finite value (matching whatever cap the adapter
  // already applies to its own priority detection) for adapters where fetchDistribution's query
  // multiplier is high, so a later re-detection cycle can't fire an unbounded number of concurrent
  // requests. Anything beyond the cap falls back into the ordinary non-priority "show more" flow.
  maxPriorityAndPinned?: number;
  onFiltersChange?: (filters: ActiveFilter[]) => void;
  priorityAttributes?: string[];
  queryLimitLabel?: string;
  selectedFilters?: ActiveFilter[];
  showAllLink?: { href: string; title: string };
}

export function AttributeDistribution({
  attributeLabels = EMPTY_ATTRIBUTE_LABELS,
  colorBars,
  context,
  fetchAttributes,
  fetchDistribution,
  getAttributeBadge,
  getFieldLink,
  getValueTooltip,
  header,
  initialAutoLoadCount = 10,
  maxPriorityAndPinned = Number.POSITIVE_INFINITY,
  selectedFilters: selectedFiltersProp,
  onFiltersChange,
  priorityAttributes = EMPTY_PRIORITY_ATTRIBUTES,
  queryLimitLabel,
  showAllLink,
}: Readonly<AttributeDistributionProps>) {
  const styles = useStyles2(getStyles);
  const [extraFieldsShown, setExtraFieldsShown] = useState(0);
  const [state, dispatch] = useReducer(
    reducer,
    selectedFiltersProp ?? [],
    (initFilters): State => ({
      attributes: [],
      data: {},
      detecting: false,
      selectedFilters: initFilters,
      userPinnedAttributes: [],
      valueSnapshot: null,
    })
  );

  // Always-current ref so that the initial-load effect can build the effective
  // query without adding selectedFilters to its deps (which would cause
  // redistribution fetches on every filter toggle, handled separately).
  const selectedFiltersRef = useRef(state.selectedFilters);
  selectedFiltersRef.current = state.selectedFilters;

  // Always-current refs used inside effects that should not re-run when these
  // values change (either because re-running is handled elsewhere, or because
  // the value changes on every render and would cause infinite loops).
  const contextRef = useRef(context);
  contextRef.current = context;
  const attributesRef = useRef(state.attributes);
  attributesRef.current = state.attributes;
  const userPinnedRef = useRef(state.userPinnedAttributes);
  userPinnedRef.current = state.userPinnedAttributes;
  // Read via refs so unstable consumer references don't trigger re-detection.
  // Only genuine dataset changes (query, datasource, time range) should re-detect.
  const attributeLabelsRef = useRef(attributeLabels);
  attributeLabelsRef.current = attributeLabels;
  const priorityAttributesRef = useRef(priorityAttributes);
  priorityAttributesRef.current = priorityAttributes;
  const initialAutoLoadCountRef = useRef(initialAutoLoadCount);
  initialAutoLoadCountRef.current = initialAutoLoadCount;
  const maxPriorityAndPinnedRef = useRef(maxPriorityAndPinned);
  maxPriorityAndPinnedRef.current = maxPriorityAndPinned;
  const fetchAttributesRef = useRef(fetchAttributes);
  fetchAttributesRef.current = fetchAttributes;

  // Incremented on every loadDistributions call. Each async fetch captures the
  // generation at the time it starts and drops its result if the counter has
  // advanced, preventing stale results from a previous context from dispatching
  // LOADED into the current view.
  const generationRef = useRef(0);
  const subscriptionsRef = useRef<Subscription[]>([]);
  // Tracks which fields have had a fetch started. Cleared on full reload so the
  // lazy-load effect can detect newly visible fields that still need fetching.
  const fetchedFieldsRef = useRef<Set<string>>(new Set());
  // Always-current ref to visibleAttributes. Declared early so effects above the
  // useMemo can read it; assigned after the useMemo below.
  const visibleAttributesRef = useRef<AttributeConfig[]>([]);

  const loadDistributions = useCallback(
    (attributes: AttributeConfig[], ctx: DatasetContext, filters: ActiveFilter[]) => {
      if (!attributes.length) {
        return;
      }
      subscriptionsRef.current.forEach((sub) => sub.unsubscribe());
      subscriptionsRef.current = [];
      fetchedFieldsRef.current.clear();

      const generation = ++generationRef.current;
      attributes.forEach((attr) => {
        fetchedFieldsRef.current.add(attr.attribute);
        dispatch({ type: 'LOADING', field: attr.attribute });
      });

      attributes.forEach((attr) => {
        const sub = fetchDistribution(ctx, attr.attribute, filters).subscribe({
          next: (values) => {
            if (generationRef.current === generation) {
              dispatch({ type: 'LOADED', field: attr.attribute, values });
            }
          },
          error: (e) => {
            logger.error(toError(e));
            if (generationRef.current === generation) {
              dispatch({
                type: 'ERROR',
                field: attr.attribute,
                message: normalizeErrorMessage(e),
              });
            }
          },
        });
        subscriptionsRef.current.push(sub);
      });
    },
    [fetchDistribution]
  );

  const loadDistributionsRef = useRef(loadDistributions);
  loadDistributionsRef.current = loadDistributions;

  // Fetches distributions for additional fields without cancelling existing in-flight requests.
  // Used when new fields become visible (show more, pin attribute) so already-loading fields
  // are not disrupted. Uses the current generation so stale results are still dropped on reload.
  const loadAdditional = useCallback(
    (attributes: AttributeConfig[], ctx: DatasetContext, filters: ActiveFilter[]) => {
      if (!attributes.length) {
        return;
      }
      const generation = generationRef.current;
      attributes.forEach((attr) => {
        fetchedFieldsRef.current.add(attr.attribute);
        dispatch({ type: 'LOADING', field: attr.attribute });
      });
      attributes.forEach((attr) => {
        const sub = fetchDistribution(ctx, attr.attribute, filters).subscribe({
          next: (values) => {
            if (generationRef.current === generation) {
              dispatch({ type: 'LOADED', field: attr.attribute, values });
            }
          },
          error: (e) => {
            logger.error(toError(e));
            if (generationRef.current === generation) {
              dispatch({
                type: 'ERROR',
                field: attr.attribute,
                message: normalizeErrorMessage(e),
              });
            }
          },
        });
        subscriptionsRef.current.push(sub);
      });
    },
    [fetchDistribution]
  );

  const loadAdditionalRef = useRef(loadAdditional);
  loadAdditionalRef.current = loadAdditional;

  // Sync internal filter state when selectedFilters prop changes externally (e.g. user
  // removes a filter from the page-level filter bar). Skips the initial mount since the
  // reducer lazy initializer already seeds from selectedFiltersProp on first render.
  // context, state.attributes, and loadDistributions are read via always-current refs so
  // they do not need to be deps (re-running on those changes is handled by the main effect).
  const isMountedRef = useRef(false);
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    const filters = selectedFiltersProp ?? [];
    dispatch({ type: 'SET_FILTERS', filters });
    if (attributesRef.current.length > 0) {
      loadDistributionsRef.current(visibleAttributesRef.current, contextRef.current, filters);
    }
  }, [selectedFiltersProp]);

  useEffect(() => {
    if (!context.datasourceUid || !context.query) {
      return;
    }

    let cancelled = false;

    async function run() {
      setExtraFieldsShown(0);
      dispatch({ type: 'DETECTING' });
      let detected: AttributeConfig[] = [];
      try {
        detected = await fetchAttributesRef.current(contextRef.current);
      } catch (e) {
        logger.error(toError(e));
      }
      if (cancelled) {
        return;
      }
      const ordered = orderByPriority(detected, priorityAttributesRef.current, attributeLabelsRef.current);
      dispatch({ type: 'SET_ATTRIBUTES', configs: ordered });
      const activeFilters = selectedFiltersRef.current;

      // Only fetch distributions for initially visible fields. Fields that become
      // visible later (show more, pin) are fetched by the visibleAttributes effect.
      const priorityFieldSet = new Set(priorityAttributesRef.current);
      const userPinned = new Set(userPinnedRef.current);
      const pAndP = ordered.filter((a) => priorityFieldSet.has(a.attribute) || userPinned.has(a.attribute));
      const genuineNonP = ordered.filter((a) => !priorityFieldSet.has(a.attribute) && !userPinned.has(a.attribute));
      // Capped the same way the priorityAndPinned memo below caps it: overflow beyond
      // maxPriorityAndPinned must not be fetched here either, or capping only the render-visible set
      // would still fetch everything up front and just hide the overflow's bars from view. The
      // overflow falls back into the same initialAutoLoadCount-gated pool as genuinely non-priority
      // fields, exactly like the priorityAndPinned/nonPriorityAttributes split below.
      const cappedPAndP = pAndP.slice(0, maxPriorityAndPinnedRef.current);
      const nonP = [...pAndP.slice(maxPriorityAndPinnedRef.current), ...genuineNonP];
      const initialBatch = priorityAttributesRef.current.length === 0 ? initialAutoLoadCountRef.current : 0;
      const initialVisible = [...cappedPAndP, ...nonP.slice(0, initialBatch)];
      loadDistributions(initialVisible, contextRef.current, activeFilters);
    }

    run();

    return () => {
      cancelled = true;
      subscriptionsRef.current.forEach((sub) => sub.unsubscribe());
      subscriptionsRef.current = [];
    };
    // Depends on the whole context object, not a hardcoded whitelist of its fields: context is opaque
    // to this component by design (see DatasetContext), and PrometheusAttributeExplorer already
    // memoizes it correctly against everything that should trigger a re-fetch (query, datasourceUid,
    // timeRange, metricType, histogramRange). Re-listing individual fields here duplicates that
    // memoization and silently falls out of sync whenever a new opaque field is added, which is
    // exactly what happened: histogramRange changes never triggered a re-fetch because it wasn't here.
  }, [context, loadDistributions]);

  function handleToggleFilter(field: string, value: string, operator: '!=' | '=') {
    const newFilters = computeNextFilters(state.selectedFilters, field, value, operator);
    dispatch({ type: 'TOGGLE_FILTER', field, value, operator });
    loadDistributions(visibleAttributes, context, newFilters);
    onFiltersChange?.(newFilters);
  }

  function handlePinAttribute(attribute: string) {
    dispatch({ type: 'PIN_ATTRIBUTE', attribute });
  }

  const { nonPriorityAttributes, priorityAndPinned, comboboxOptions } = useMemo(() => {
    const priorityFieldSet = new Set(priorityAttributes);
    const pinnedSet = new Set(state.userPinnedAttributes);
    const allPriorityOrPinned = state.attributes.filter(
      (a) => priorityFieldSet.has(a.attribute) || pinnedSet.has(a.attribute)
    );
    // Capped so priority + pinned can't grow without bound (OTel priority detection is capped
    // upstream, but pinning has no such limit): anything beyond maxPriorityAndPinned falls back into
    // nonPriorityAttributes below, where it's subject to the same initialAutoLoadCount/"show more"
    // gating as a genuinely non-priority field, instead of always being eagerly fetched.
    const pinned = allPriorityOrPinned.slice(0, maxPriorityAndPinned);
    const alwaysVisibleKeys = new Set(pinned.map((a) => a.attribute));
    const nonPriority = state.attributes.filter((a) => !alwaysVisibleKeys.has(a.attribute));
    return {
      // Excludes every priority/pinned field, not just the capped subset: an overflow field is still
      // pinned, so it must not also appear as something the user can newly pin via the combobox.
      comboboxOptions: nonPriority
        .filter((a) => !priorityFieldSet.has(a.attribute) && !pinnedSet.has(a.attribute))
        .map((a) => ({ label: a.attribute_name, value: a.attribute })),
      nonPriorityAttributes: nonPriority,
      priorityAndPinned: pinned,
    };
  }, [priorityAttributes, state.attributes, state.userPinnedAttributes, maxPriorityAndPinned]);

  const { visibleAttributes, remainingCount, nextBatch } = useMemo(() => {
    const initialVisible = priorityAttributes.length === 0 ? initialAutoLoadCount : 0;
    const totalShown = initialVisible + extraFieldsShown;
    const activeFilterFields = new Set(state.selectedFilters.map((f) => f.field));
    // Always include non-priority fields with active filters so a selected value is never hidden.
    // Sliced from nonPriorityAttributes in its original (detection-order) indexing: this decides which
    // fields are fetched and counted toward "show more", so it must stay stable regardless of how
    // quiet those fields turn out to be once their data arrives.
    const visibleNonPriority = nonPriorityAttributes.filter(
      (a, i) => i < totalShown || activeFilterFields.has(a.attribute)
    );
    const remaining = Math.max(0, nonPriorityAttributes.length - visibleNonPriority.length);
    // Sorted only for display, after the visible set is already fixed above: reordering by activity
    // here can't change which fields are considered visible/fetched, only the order they render in,
    // so an attribute doesn't disappear from view the moment its own "quiet" verdict comes back.
    const sortedVisibleNonPriority = sortByActivity(visibleNonPriority, state.data);
    return {
      nextBatch: Math.min(10, remaining),
      remainingCount: remaining,
      visibleAttributes: [...priorityAndPinned, ...sortedVisibleNonPriority],
    };
  }, [
    nonPriorityAttributes,
    extraFieldsShown,
    initialAutoLoadCount,
    priorityAndPinned,
    priorityAttributes,
    state.selectedFilters,
    state.data,
  ]);

  visibleAttributesRef.current = visibleAttributes;

  // Fetch distributions for any visible field that hasn't been fetched yet.
  useEffect(() => {
    const notYetFetched = visibleAttributes.filter((a) => !fetchedFieldsRef.current.has(a.attribute));
    if (notYetFetched.length > 0) {
      loadAdditionalRef.current(notYetFetched, contextRef.current, selectedFiltersRef.current);
    }
  }, [visibleAttributes]);

  return (
    <div className={styles.container}>
      {header !== undefined ? (
        header
      ) : (
        <div className={styles.header}>
          <div className={styles.title}>
            {t('attribute-explorer.title', 'Attribute Explorer')}
            <Tooltip
              content={t(
                'attribute-explorer.description',
                'Spot patterns and narrow down root causes by exploring how your data breaks down across key attributes. Click any value to filter your results.'
              )}
            >
              <Icon name="info-circle" size="sm" />
            </Tooltip>
          </div>
          {queryLimitLabel && <div className={styles.queryLimit}>{queryLimitLabel}</div>}
        </div>
      )}

      {comboboxOptions.length > 0 && (
        <Combobox
          options={comboboxOptions}
          value={null}
          placeholder={t('attribute-explorer.field-input-placeholder', 'Search to add more attributes')}
          onChange={(option) => option && handlePinAttribute(option.value)}
        />
      )}

      {state.detecting && (
        <div className={styles.detectingRow}>
          <Spinner size="sm" />
          <span>{t('attribute-explorer.discovering-fields', 'Discovering attributes…')}</span>
        </div>
      )}

      {!state.detecting && state.attributes.length === 0 && (
        <div className={styles.emptyState}>
          {t('attribute-explorer.no-fields-detected', 'No fields detected for this dataset.')}
        </div>
      )}

      <div className={styles.sections}>
        {state.detecting &&
          state.attributes.length === 0 &&
          priorityAttributes.map((attr) => {
            const badgeText = getAttributeBadge?.(attr);
            return (
              <div key={attr} className={styles.section}>
                <div className={styles.sectionHeaderRow}>
                  <div className={styles.sectionHeader}>
                    <span className={styles.sectionLabel}>{attributeLabels[attr] ?? attr}</span>
                    {badgeText && (
                      <IconButton className={styles.attributeBadgeIcon} name="info-circle" size="sm" tooltip={badgeText} />
                    )}
                  </div>
                </div>
                <div className={styles.loadingRow}>
                  <Spinner size="sm" />
                </div>
              </div>
            );
          })}
        {visibleAttributes.map((attr) => {
          const attrState = state.data[attr.attribute];
          if (!attrState) {
            return null;
          }
          const fieldFilters = state.selectedFilters.filter((f) => f.field === attr.attribute);
          const includedValues = new Set(fieldFilters.filter((f) => f.operator === '=').map((f) => f.value));
          const excludedValues = new Set(fieldFilters.filter((f) => f.operator === '!=').map((f) => f.value));
          const snapshotValues = state.valueSnapshot?.[attr.attribute] ?? null;
          return (
            <AttributeSection
              key={attr.attribute}
              attrState={attrState}
              badgeText={getAttributeBadge?.(attr.attribute)}
              config={attr}
              colorBars={!!colorBars}
              fieldLink={getFieldLink?.(attr.attribute)}
              getValueTooltip={getValueTooltip}
              hasActiveFilter={fieldFilters.length > 0}
              includedValues={includedValues}
              excludedValues={excludedValues}
              snapshotValues={snapshotValues}
              onToggleFilter={(value, operator) => handleToggleFilter(attr.attribute, value, operator)}
              onToggle={() => dispatch({ type: 'TOGGLE_EXPANDED', field: attr.attribute })}
            />
          );
        })}
        {(nonPriorityAttributes.length > 0 && (extraFieldsShown > 0 || remainingCount > 0)) || showAllLink ? (
          <div className={styles.showMoreFields}>
            {nonPriorityAttributes.length > 0 && (extraFieldsShown > 0 || remainingCount > 0) && (
              <>
                <button
                  aria-label={t('attribute-explorer.show-more-fields', 'Show {{count}} more fields', {
                    count: nextBatch,
                  })}
                  className={cx(styles.showMoreButton, remainingCount === 0 && styles.showMoreButtonDisabled)}
                  disabled={remainingCount === 0}
                  title={
                    remainingCount === 0
                      ? t('attribute-explorer.no-more-fields', 'No more fields')
                      : t('attribute-explorer.show-more-fields', 'Show {{count}} more fields', { count: nextBatch })
                  }
                  type="button"
                  onClick={() => setExtraFieldsShown(extraFieldsShown + nextBatch)}
                >
                  <Icon name="angle-down" size="sm" />
                </button>
                <button
                  aria-label={t('attribute-explorer.collapse-extra-fields', 'Collapse extra fields')}
                  className={cx(styles.showMoreButton, extraFieldsShown === 0 && styles.showMoreButtonDisabled)}
                  disabled={extraFieldsShown === 0}
                  title={
                    extraFieldsShown === 0
                      ? t('attribute-explorer.no-extra-fields-shown', 'No extra fields shown')
                      : t('attribute-explorer.collapse-extra-fields', 'Collapse extra fields')
                  }
                  type="button"
                  onClick={() => setExtraFieldsShown(0)}
                >
                  <Icon name="angle-up" size="sm" />
                </button>
              </>
            )}
            {showAllLink && (
              <a className={styles.showAllLink} href={showAllLink.href} rel="noreferrer" target="_blank">
                {showAllLink.title}
              </a>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface AttributeSectionProps {
  attrState: AttributeState;
  // Hover text for a small icon next to the label (e.g. "OTel metric attribute"). Undefined shows no icon.
  badgeText?: string;
  colorBars: boolean;
  config: AttributeConfig;
  excludedValues: Set<string>;
  fieldLink?: string;
  getValueTooltip?: (item: AttributeValueCount, field: string) => string | undefined;
  hasActiveFilter: boolean;
  includedValues: Set<string>;
  onToggle: () => void;
  onToggleFilter: (value: string, operator: '!=' | '=') => void;
  snapshotValues: AttributeValueCount[] | null;
}

function AttributeSection({
  attrState,
  badgeText,
  config,
  colorBars,
  fieldLink,
  getValueTooltip,
  hasActiveFilter,
  includedValues,
  excludedValues,
  snapshotValues,
  onToggleFilter,
  onToggle,
}: Readonly<AttributeSectionProps>) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const { error, expanded, loading, values } = attrState;

  const allValues = useMemo(() => mergeWithSnapshot(values, snapshotValues), [values, snapshotValues]);
  const visibleValues = expanded ? allValues.slice(0, MAX_VALUES_EXPANDED) : allValues.slice(0, MAX_VALUES_COLLAPSED);
  const isExpandable = allValues.length > MAX_VALUES_COLLAPSED;

  // Assign palette colors by allValues index so colors are stable on expand/collapse.
  const palette = theme.visualization.palette;
  const valueColorMap = useMemo(
    () =>
      colorBars
        ? new Map(
            allValues.map((item, i) => [item.value, theme.visualization.getColorByName(palette[i % palette.length])])
          )
        : undefined,
    [colorBars, allValues, palette, theme.visualization]
  );

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeaderRow}>
        <div className={styles.sectionHeader}>
          {/* A real <button>, wrapping only the label, not the badge: nesting the badge's own
          focusable control inside this button would be invalid (a button can't contain another
          interactive element), and a browser/screen-reader can behave unpredictably around it. */}
          <button
            className={cx(styles.sectionLabelButton, hasActiveFilter && styles.sectionHeaderActive)}
            type="button"
            onClick={isExpandable ? onToggle : undefined}
          >
            <span className={styles.sectionLabel}>{config.attribute_name}</span>
          </button>
          {badgeText && (
            // IconButton, not a custom role="button" span: it's a real <button> (so no ARIA role is
            // being asserted without the semantics/behavior to back it up), sitting as a sibling of
            // the label button above rather than nested inside it.
            <IconButton className={styles.attributeBadgeIcon} name="info-circle" size="sm" tooltip={badgeText} />
          )}
        </div>
        {fieldLink && (
          // DATASOURCE-SPECIFIC: link label is generic; adapters that pass getFieldLink can rely on
          // the destination URL itself to communicate where the link goes.
          <a
            aria-label={t('attribute-explorer.field-link-label', 'View {{name}}', {
              name: config.attribute_name,
            })}
            className={styles.fieldLinkIcon}
            data-field-link-icon
            href={fieldLink}
            rel="noreferrer"
            target="_blank"
            title={t('attribute-explorer.field-link-label', 'View {{name}}', {
              name: config.attribute_name,
            })}
          >
            <Icon name="external-link-alt" size="sm" />
          </a>
        )}
        {isExpandable && (
          <button
            aria-label={
              expanded ? t('attribute-explorer.collapse', 'Collapse') : t('attribute-explorer.expand', 'Expand')
            }
            className={styles.expandToggle}
            type="button"
            onClick={onToggle}
          >
            <Icon name={expanded ? 'angle-up' : 'angle-down'} size="sm" />
          </button>
        )}
      </div>

      {loading && values.length === 0 && (
        <div className={styles.loadingRow}>
          <Spinner size="sm" />
        </div>
      )}

      {!loading && error && (
        <div className={styles.emptyRow} title={error}>
          {error.length > 100 ? `${error.slice(0, 40)}…` : error}
        </div>
      )}

      {!error && visibleValues.length > 0 && (
        <div style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s ease' }}>
          {visibleValues.map((item) => {
            const isIncluded = includedValues.has(item.value);
            const isExcluded = excludedValues.has(item.value);
            const valueTooltip = getValueTooltip?.(item, config.attribute);
            const stats = (
              <span className={styles.stats}>
                <span className={styles.count}>{item.count}</span>
                <span className={styles.percentage}>{`${item.percentage}%`}</span>
              </span>
            );
            return (
              <WithContextMenu
                key={item.value}
                renderMenuItems={() => (
                  <>
                    <MenuItem
                      label={t('attribute-explorer.filter-for-value', 'Filter for value')}
                      onClick={() => onToggleFilter(item.value, '=')}
                    />
                    <MenuItem
                      label={t('attribute-explorer.filter-out-value', 'Filter out value')}
                      onClick={() => onToggleFilter(item.value, '!=')}
                    />
                  </>
                )}
              >
                {({ openMenu }) => (
                  <div
                    className={cx(
                      styles.valueRow,
                      isIncluded && styles.valueRowIncluded,
                      isExcluded && styles.valueRowExcluded,
                      item.retained && styles.valueRowRetained
                    )}
                    onClick={openMenu}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.currentTarget.click();
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className={styles.valueRowHeader}>
                      <span className={styles.valueLabel} title={item.value}>
                        {item.value}
                      </span>
                      {valueTooltip ? <Tooltip content={valueTooltip}>{stats}</Tooltip> : stats}
                    </div>
                    <div className={styles.barWrapper}>
                      <div
                        className={styles.bar}
                        style={{
                          background: valueColorMap?.get(item.value) ?? theme.colors.primary.main,
                          width: `${item.percentage}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </WithContextMenu>
            );
          })}
        </div>
      )}

      {!loading && !error && allValues.length === 0 && (
        <div className={styles.emptyRow}>{t('attribute-explorer.no-values-found', 'No values found')}</div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  bar: css({
    // background supplied via inline style (per-value color)
    opacity: 0.65,
    borderRadius: theme.shape.radius.default,
    height: '100%',
    transition: 'width 0.3s ease',
  }),
  barWrapper: css({
    background: colorManipulator.alpha(theme.colors.text.primary, 0.08),
    borderRadius: theme.shape.radius.default,
    height: '4px',
    overflow: 'hidden',
    width: '100%',
  }),
  container: css({
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    height: '100%',
    overflowY: 'auto',
    padding: theme.spacing(2),
    width: '100%',
  }),
  detectingRow: css({
    alignItems: 'center',
    color: theme.colors.text.secondary,
    display: 'flex',
    fontSize: theme.typography.bodySmall.fontSize,
    gap: theme.spacing(1),
    padding: theme.spacing(1, 0),
  }),
  emptyRow: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontStyle: 'italic',
    padding: theme.spacing(0.5, 2),
  }),
  emptyState: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontStyle: 'italic',
    padding: theme.spacing(1, 0),
  }),
  header: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
  }),
  loadingRow: css({
    display: 'flex',
    justifyContent: 'center',
    padding: theme.spacing(1, 0),
  }),
  count: css({
    color: theme.colors.text.secondary,
    minWidth: '32px',
    textAlign: 'right',
  }),
  percentage: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    minWidth: '36px',
    textAlign: 'right',
  }),
  stats: css({
    display: 'flex',
    flexShrink: 0,
    gap: theme.spacing(1),
  }),
  queryLimit: css({
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    padding: theme.spacing(0.5, 1),
  }),
  section: css({
    display: 'flex',
    flexDirection: 'column',
    paddingBottom: theme.spacing(1),
    width: '100%',
  }),
  sectionHeaderRow: css({
    alignItems: 'center',
    borderTop: `1px solid ${theme.colors.border.weak}`,
    display: 'flex',
    '&:hover [data-field-link-icon]': {
      opacity: 1,
    },
  }),
  fieldLinkIcon: css({
    alignItems: 'center',
    color: theme.colors.text.link,
    display: 'flex',
    flexShrink: 0,
    opacity: 0,
    padding: theme.spacing(0, 0.5),
    transition: 'opacity 0.1s',
    '&:hover': {
      color: theme.colors.text.link,
      opacity: 1,
    },
  }),
  // Always visible, unlike fieldLinkIcon: this marks a permanent fact about the attribute (why it's
  // here), not a secondary action to reveal on hover.
  attributeBadgeIcon: css({
    color: theme.colors.text.secondary,
    flexShrink: 0,
    marginLeft: theme.spacing(0.5),
  }),
  // Holds the label button and the badge as siblings, not one inside the other (a button can't
  // legitimately contain another interactive/focusable control): flex:1 here fills the row exactly
  // like the old single-button version did, keeping the badge visually adjacent to the label.
  sectionHeader: css({
    alignItems: 'center',
    display: 'flex',
    flex: 1,
    minWidth: 0,
    padding: theme.spacing(0.75, 0),
  }),
  sectionLabelButton: css({
    alignItems: 'center',
    background: 'none',
    border: 'none',
    color: theme.colors.text.primary,
    cursor: 'pointer',
    display: 'flex',
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    minWidth: 0,
    padding: 0,
    textAlign: 'left',
    '&:hover': {
      color: theme.colors.text.maxContrast,
    },
  }),
  expandToggle: css({
    alignItems: 'center',
    background: 'none',
    border: 'none',
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    display: 'flex',
    flexShrink: 0,
    marginLeft: 'auto',
    padding: theme.spacing(0, 0.5),
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
  sectionLabel: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  sections: css({
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  }),
  showMoreFields: css({
    borderTop: `1px solid ${theme.colors.border.weak}`,
    display: 'flex',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.5, 0),
  }),
  showMoreButton: css({
    alignItems: 'center',
    background: 'none',
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    display: 'flex',
    height: 20,
    justifyContent: 'center',
    padding: 0,
    width: 20,
    '&:hover': {
      background: theme.colors.action.hover,
      color: theme.colors.text.primary,
    },
  }),
  showMoreButtonDisabled: css({
    cursor: 'not-allowed',
    opacity: 0.3,
    '&:hover': {
      background: 'none',
      color: theme.colors.text.secondary,
    },
  }),
  showAllLink: css({
    color: theme.colors.text.link,
    fontSize: theme.typography.bodySmall.fontSize,
    marginLeft: 'auto',
    '&:hover': {
      textDecoration: 'underline',
    },
  }),
  title: css({
    alignItems: 'center',
    color: theme.colors.text.primary,
    display: 'flex',
    fontSize: theme.typography.h6.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    gap: theme.spacing(0.5),
  }),
  valueLabel: css({
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  valueRow: css({
    background: 'none',
    border: 'none',
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.primary,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    fontSize: theme.typography.bodySmall.fontSize,
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.5, 2),
    textAlign: 'left',
    width: '100%',
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  valueRowHeader: css({
    alignItems: 'center',
    display: 'flex',
    gap: theme.spacing(1),
    justifyContent: 'space-between',
    width: '100%',
  }),
  valueRowRetained: css({
    opacity: 0.45,
  }),
  valueRowIncluded: css({
    background: colorManipulator.alpha(theme.colors.primary.main, 0.15),
    '&:hover': {
      background: colorManipulator.alpha(theme.colors.primary.main, 0.25),
    },
  }),
  valueRowExcluded: css({
    opacity: 0.6,
    textDecoration: 'line-through',
  }),
  sectionHeaderActive: css({
    color: theme.colors.text.maxContrast,
  }),
});
