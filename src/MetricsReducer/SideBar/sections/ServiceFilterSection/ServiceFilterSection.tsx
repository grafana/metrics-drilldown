import { css, cx } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import {
  AdHocFiltersVariable,
  sceneGraph,
  SceneObjectBase,
  SceneObjectUrlSyncConfig,
  type SceneComponentProps,
  type SceneObjectUrlValues,
} from '@grafana/scenes';
import {
  Button,
  Checkbox,
  Icon,
  IconButton,
  Input,
  Spinner,
  TextLink,
  Toggletip,
  Tooltip,
  useStyles2,
} from '@grafana/ui';
import React, { useMemo, useState } from 'react';

import { getSharedListStyles } from 'MetricsReducer/SideBar/sections/sharedListStyles';
import { isKgAnnotationsAvailable } from 'shared/knowledgeGraph/kgAnnotations';
import { logger } from 'shared/logger/logger';
import { VAR_DATASOURCE, VAR_FILTERS } from 'shared/shared';
import { isAdHocFiltersVariable } from 'shared/utils/utils.variables';

import { EventSectionValueChanged } from '../EventSectionValueChanged';
import { SectionTitle } from '../SectionTitle';
import { type SideBarSectionState } from '../types';
import { fetchInstrumentedServices, KG_MAX_JOBS } from './knowledgeGraphServices';
import {
  adoptServiceFilter,
  getFiltersWithoutManagedFilter,
  getManagedServiceFilter,
  isServiceSelectionApplied,
  releaseManagedServiceFilter,
  removeManagedServiceFilter,
  setManagedServiceFilter,
} from './serviceFilterBridge';
import { JOB_LABEL, type ServiceGroup } from './serviceMatchers';
import { joinUrlValues, splitUrlValues } from './serviceUrlValues';
import { buildTopFiltersMatcher, fetchServiceGroups } from './serviceValues';

export const SERVICE_FILTER_SECTION_KEY = 'filters-service';

/** The label that the section filters on. Every selection is stored as exact values of this label. */
export type ServiceLabel = typeof JOB_LABEL;

const LABELS: ServiceLabel[] = [JOB_LABEL];

/**
 * Where the rows of the list come from: the services that the Knowledge Graph knows, or the services that the job
 * label describes. The list uses the Knowledge Graph when the stack has one that knows services of this data source.
 */
export type ServiceSource = 'knowledge-graph' | 'job';

/**
 * Why the list reads the job label: the stack has no usable Knowledge Graph (no data source, or its request failed),
 * the Knowledge Graph lists no service that has a job in this data source, or the data source returned no job at all
 * (no series match the filters, or the request failed).
 */
type ServiceFallback = 'no-knowledge-graph' | 'no-services' | 'no-jobs';

/** The rows of a group. `hidden` holds the selected jobs that no other group shows, so that no filter is invisible. */
type RowGroup = ServiceSource | 'extra' | 'hidden';

/**
 * The selection is stored as the exact job values, so that the filter can be rebuilt from the URL without fetching the
 * jobs first. Values are separated by commas in the URL, like the other filters of the sidebar.
 */
export const SERVICE_FILTER_URL_KEYS: Record<ServiceLabel, string> = {
  [JOB_LABEL]: `${SERVICE_FILTER_SECTION_KEY}-job`,
};

/**
 * Whether the list also shows the services that only the job label finds. It is kept in the URL, so that a shared link
 * shows the same rows as the sender saw.
 */
export const SERVICE_FILTER_MORE_URL_KEY = `${SERVICE_FILTER_SECTION_KEY}-more`;

export interface ServiceFilterSectionState extends SideBarSectionState {
  source: ServiceSource;
  /** Why the list reads the job label. It matters only while the source is the job label. */
  fallback: ServiceFallback;
  /** The services that the job label describes, with the jobs of the selected data source */
  serviceGroups: ServiceGroup[];
  /** The services of the Knowledge Graph, with the jobs that exist in the selected data source */
  kgServices: ServiceGroup[];
  /** True when the Knowledge Graph request returned as many jobs as it asked for, so the list may miss services */
  kgTruncated: boolean;
  /** True when the services that only the job label finds are listed under the Knowledge Graph services */
  showExtras: boolean;
  loading: boolean;
  selected: Record<ServiceLabel, string[]>;
}

/** `partial` is true when some of the jobs of the service are selected and others are not */
type ListItem = { value: string; label: string; checked: boolean; partial?: boolean; tooltip?: string };

export class ServiceFilterSection extends SceneObjectBase<ServiceFilterSectionState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: [...Object.values(SERVICE_FILTER_URL_KEYS), SERVICE_FILTER_MORE_URL_KEY],
  });

  /** The newest request. The response of an older request is dropped. */
  private requestId = 0;

  /**
   * What the shown list was fetched for (the matcher of the top filters and the time range), to refetch only when one
   * of them changed what the list shows. `shownComplete` is false when that request failed or found nothing.
   */
  private shownKey: string | undefined;
  private shownComplete = false;

  /** What the request in flight fetches, so that going back to the shown key drops that request */
  private pendingKey: string | undefined;

  /**
   * The selection that the URL held when the sidebar was built. Scenes gives a section that is built again (when the
   * user comes back from a metric) no URL state, so the section uses this to take back its filter.
   */
  private urlHint: { selection: string[]; showExtras: boolean } | undefined;

  /** Whether the stack has a Knowledge Graph data source. It does not change while the page is open, so it is asked once. */
  private knowledgeGraphAvailable: Promise<boolean> | undefined;

  /** Whether the managed filter of each label was seen in the top filters. A selection is dropped only once it is lost. */
  private applied: Record<ServiceLabel, boolean> = { [JOB_LABEL]: false };

  /** True while this section writes the top filters, so that the changes it makes are not reconciled */
  private writing = false;

  constructor({
    key,
    title,
    description,
    icon,
    disabled,
    active,
    urlSelection,
    urlShowExtras,
  }: {
    key: ServiceFilterSectionState['key'];
    title: ServiceFilterSectionState['title'];
    description: ServiceFilterSectionState['description'];
    icon: ServiceFilterSectionState['icon'];
    disabled?: ServiceFilterSectionState['disabled'];
    active?: ServiceFilterSectionState['active'];
    /** The selected jobs that the URL holds when the sidebar is built */
    urlSelection?: string[];
    /** Whether the URL says that all jobs are included */
    urlShowExtras?: boolean;
  }) {
    super({
      key,
      title,
      description,
      icon,
      disabled: disabled ?? false,
      active: active ?? false,
      source: 'job',
      fallback: 'no-knowledge-graph',
      serviceGroups: [],
      kgServices: [],
      kgTruncated: false,
      // A sidebar that is built again gets no URL state, and the choice does not depend on a selection
      showExtras: urlShowExtras ?? false,
      loading: false,
      selected: { [JOB_LABEL]: [] },
    });

    this.urlHint = { selection: urlSelection ?? [], showExtras: urlShowExtras ?? false };
    this.addActivationHandler(this.onActivate.bind(this));
  }

  getUrlState() {
    const { selected } = this.state;

    return {
      [SERVICE_FILTER_URL_KEYS[JOB_LABEL]]: joinUrlValues(selected[JOB_LABEL]),
      [SERVICE_FILTER_MORE_URL_KEY]: this.state.showExtras ? '1' : '',
    };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const selected = { ...this.state.selected };
    let changed = false;

    for (const label of LABELS) {
      const value = values[SERVICE_FILTER_URL_KEYS[label]];

      // Scenes gives null for a key that is not in the URL (e.g. browser back to an entry from before the selection),
      // which means no selection. A key that is missing from `values` is not part of this update.
      if (value === undefined || (value !== null && typeof value !== 'string')) {
        continue;
      }

      const parsed = value === null ? [] : splitUrlValues(value);

      if (joinUrlValues(parsed) !== joinUrlValues(selected[label])) {
        selected[label] = parsed;
        // The filter of the previous selection is not the one of this selection, so it was not lost
        this.applied[label] = false;
        changed = true;
      }
    }

    const showExtras = parseShowExtras(values[SERVICE_FILTER_MORE_URL_KEY]);

    if (showExtras !== undefined && showExtras !== this.state.showExtras) {
      this.setState({ showExtras });
    }

    if (!changed) {
      return;
    }

    this.setState({ selected, active: hasSelection(selected) });
    this.reconcile();
    // The sidebar button reads its tooltip and dot from the published values, so it must hear of a selection that
    // comes from the URL (e.g. browser back and forward). It runs after reconcile, which may drop the selection.
    this.publishValues();
  }

  /**
   * Keeps the selection and the top filters consistent. It adopts the filter of a selection restored from the URL,
   * drops the selection when its filter is removed from the top bar or cleared (e.g. by a binary query), and drops
   * everything when the data source changes, because the services belong to a data source.
   * It must run while the sidebar is mounted, whether or not this section is open. Returns the function that stops it.
   */
  public watchFilters(): () => void {
    const filtersVariable = this.getFiltersVariable();
    const unsubscribes: Array<() => void> = [];

    if (filtersVariable) {
      this.restoreSelection(filtersVariable);
      // The URL is restored before the sidebar activates, so a selection without a filter now has none to wait for
      this.reconcile({ apply: true });

      const sub = filtersVariable.subscribeToState((newState, prevState) => {
        if (newState.filters !== prevState.filters) {
          this.reconcile();
        }
      });
      unsubscribes.push(() => sub.unsubscribe());
    }

    const dataSourceVariable = sceneGraph.lookupVariable(VAR_DATASOURCE, this);

    if (dataSourceVariable) {
      const sub = dataSourceVariable.subscribeToState((newState, prevState) => {
        const { value } = newState as { value?: unknown };
        const { value: previousValue } = prevState as { value?: unknown };

        // An empty previous value means that the data source is resolving at load, not that the user switched it.
        // Clearing then would wipe a selection restored from the URL on every load.
        if (value !== previousValue && !isEmptyValue(previousValue)) {
          this.onDataSourceChanged();
        }
      });
      unsubscribes.push(() => sub.unsubscribe());
    }

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }

  /**
   * The list page is built again when the user comes back from a metric, and Scenes gives the new section no URL state,
   * so it starts with no selection while its filter is still in the top filters. The section takes the filter back when
   * it equals the selection that the URL kept. It does not write back a filter that the user deleted meanwhile, it
   * leaves a filter that the user edited to the user, and it removes a filter of another data source. The state change
   * also writes the URL, which otherwise keeps the selection of the section that was replaced.
   */
  private restoreSelection(filtersVariable: AdHocFiltersVariable) {
    const hint = this.urlHint;
    this.urlHint = undefined;

    // A selection from the URL (a page load) is handled by reconcile
    if (!hint || hasSelection(this.state.selected)) {
      return;
    }

    const managed = getManagedServiceFilter(filtersVariable, JOB_LABEL);
    const dataSource = this.getDataSource();

    if (!managed && !hint.selection.length) {
      return;
    }

    let restored = false;

    this.writing = true;
    try {
      if (managed?.dataSource && dataSource && managed.dataSource !== dataSource) {
        removeManagedServiceFilter(filtersVariable, JOB_LABEL);
      } else if (hint.selection.length && adoptServiceFilter(filtersVariable, JOB_LABEL, hint.selection, dataSource)) {
        restored = true;
      } else if (managed) {
        releaseManagedServiceFilter(filtersVariable, JOB_LABEL);
      }
    } finally {
      this.writing = false;
    }

    const selected = { [JOB_LABEL]: restored ? hint.selection : [] };

    this.applied[JOB_LABEL] = restored;
    this.setState({ selected, showExtras: hint.showExtras, active: restored });
    this.publishValues();
  }

  private getDataSource(): string | undefined {
    const value = sceneGraph.lookupVariable(VAR_DATASOURCE, this)?.getValue();

    return typeof value === 'string' && value ? value : undefined;
  }

  private onActivate() {
    // Opening the section tries a failed list again
    this.ensureLoaded({ retry: true });

    const filtersVariable = this.getFiltersVariable();

    if (filtersVariable) {
      // The top filters narrow the list, so a change of the filters may change what the list shows
      this._subs.add(
        filtersVariable.subscribeToState((newState, prevState) => {
          if (newState.filters !== prevState.filters) {
            this.ensureLoaded();
          }
        })
      );
    }

    // The services that have data depend on the time range. Auto refresh does not change `from` and `to`, so it does
    // not refetch the list.
    this._subs.add(
      sceneGraph.getTimeRange(this).subscribeToState((newState, prevState) => {
        if (newState.from !== prevState.from || newState.to !== prevState.to) {
          this.ensureLoaded();
        }
      })
    );
  }

  private getFiltersVariable() {
    const variable = sceneGraph.lookupVariable(VAR_FILTERS, this);

    return isAdHocFiltersVariable(variable) ? variable : undefined;
  }

  private getFilters() {
    return this.getFiltersVariable()?.state.filters ?? [];
  }

  private isKnowledgeGraphAvailable(): Promise<boolean> {
    this.knowledgeGraphAvailable ??= isKgAnnotationsAvailable().catch(() => false);

    return this.knowledgeGraphAvailable;
  }

  /**
   * Loads the list, unless it is shown or being fetched for the same top filters and time range. A list that failed or
   * came back empty is fetched again when the filters or the time range change, or with `retry` when the section opens.
   * The section's own filter changes nothing that the list depends on, so it never fetches the list again.
   */
  private ensureLoaded({ retry = false }: { retry?: boolean } = {}) {
    const matcher = buildTopFiltersMatcher(this.getFilters(), JOB_LABEL) ?? '';
    const { from, to } = sceneGraph.getTimeRange(this).state;
    const key = JSON.stringify([matcher, from, to]);

    if (key === this.pendingKey) {
      return;
    }

    if (key === this.shownKey && (this.shownComplete || !retry)) {
      if (this.pendingKey !== undefined) {
        // Back to the shown list while a request for other filters runs: its response must not replace the list
        this.requestId++;
        this.pendingKey = undefined;
        this.setState({ loading: false });
      }
      return;
    }

    this.load(key);
  }

  /**
   * Lists the services that the Knowledge Graph knows as instrumented over the selected time range. A failure is
   * logged and gives undefined. It is not shown to the user, because a Grafana outside of Grafana Cloud has no
   * Knowledge Graph to answer.
   */
  private async fetchKnowledgeGraph() {
    try {
      const { from, to } = sceneGraph.getTimeRange(this).state.value;

      return await fetchInstrumentedServices({ start: from.valueOf(), end: to.valueOf() });
    } catch (error) {
      logger.error(error as Error, { handledBy: 'service-filter-knowledge-graph' });
      return undefined;
    }
  }

  private async load(key: string) {
    const requestId = ++this.requestId;

    this.pendingKey = key;
    this.setState({ loading: true });

    try {
      const complete = await this.fetchList(requestId);

      if (complete === undefined) {
        return;
      }

      // The data source helper reports a failed request as an empty list, so an empty list counts as incomplete, like a
      // failed Knowledge Graph request
      this.shownKey = key;
      this.shownComplete = complete;
    } finally {
      if (requestId === this.requestId) {
        this.pendingKey = undefined;
        this.setState({ loading: false });
      }
    }
  }

  /**
   * Fetches the list into the state. The jobs of the data source are always fetched. When the stack has a Knowledge
   * Graph, its services are fetched in parallel, and the list uses them when at least one has a job in this data source.
   * Returns whether the result is complete, or undefined when a newer request replaced this one while it was waiting,
   * in which case the response is dropped.
   */
  private async fetchList(requestId: number): Promise<boolean | undefined> {
    const filters = this.getFilters();
    const knowledgeGraphAvailable = await this.isKnowledgeGraphAvailable();
    const [serviceGroups, knowledgeGraph] = await Promise.all([
      fetchServiceGroups(this, filters),
      knowledgeGraphAvailable ? this.fetchKnowledgeGraph() : Promise.resolve(undefined),
    ]);

    if (requestId !== this.requestId) {
      return undefined;
    }

    const kgServices = knowledgeGraph ? keepJobsOfDataSource(knowledgeGraph.services, serviceGroups) : [];
    const useKnowledgeGraph = kgServices.length > 0;

    this.setState({
      source: useKnowledgeGraph ? 'knowledge-graph' : 'job',
      fallback: getFallback(serviceGroups, knowledgeGraph),
      serviceGroups,
      kgServices,
      kgTruncated: useKnowledgeGraph && Boolean(knowledgeGraph?.truncated),
    });

    const knowledgeGraphFailed = knowledgeGraphAvailable && !knowledgeGraph;

    return serviceGroups.length > 0 && !knowledgeGraphFailed;
  }

  private onDataSourceChanged() {
    this.writing = true;
    try {
      const filtersVariable = this.getFiltersVariable();

      if (filtersVariable) {
        LABELS.forEach((label) => removeManagedServiceFilter(filtersVariable, label));
      }
    } finally {
      this.writing = false;
    }

    // Responses of the previous data source must not fill the list
    this.requestId++;
    this.pendingKey = undefined;
    this.shownKey = undefined;
    this.shownComplete = false;
    this.applied = { [JOB_LABEL]: false };

    this.setState({
      source: 'job',
      fallback: 'no-knowledge-graph',
      serviceGroups: [],
      kgServices: [],
      kgTruncated: false,
      loading: false,
      selected: { [JOB_LABEL]: [] },
      active: false,
    });
    this.publishValues();

    if (this.isActive) {
      this.ensureLoaded();
    }
  }

  /**
   * With `apply`, a selection that has no filter and never had one (e.g. it comes from a URL that carries the
   * selection but not the filter) gets its managed filter written, so that the checked rows filter the metrics.
   * It is only safe once the URL state of the top filters is restored. Before that, the restore would remove the filter.
   */
  private reconcile({ apply = false }: { apply?: boolean } = {}) {
    const filtersVariable = this.getFiltersVariable();

    if (!filtersVariable || this.writing) {
      return;
    }

    const selected = { ...this.state.selected };
    let dropped = false;

    this.writing = true;
    try {
      for (const label of LABELS) {
        const values = selected[label];

        if (!values.length) {
          this.applied[label] = false;
          continue;
        }

        let isApplied =
          isServiceSelectionApplied(filtersVariable, label, values) ||
          adoptServiceFilter(filtersVariable, label, values, this.getDataSource());

        if (!isApplied && this.applied[label]) {
          // The filter was there and is gone: the user removed it or something cleared the filters
          selected[label] = [];
          dropped = true;
          // A filter that the user edited stays in the top bar, as the user's own filter
          releaseManagedServiceFilter(filtersVariable, label);
        } else if (!isApplied && apply) {
          setManagedServiceFilter(filtersVariable, label, values, this.getDataSource());
          isApplied = true;
        }

        this.applied[label] = isApplied;
      }
    } finally {
      this.writing = false;
    }

    if (dropped) {
      this.setState({ selected, active: hasSelection(selected) });
      this.publishValues();
    }
  }

  private publishValues() {
    const { selected, key } = this.state;

    this.publishEvent(new EventSectionValueChanged({ key, values: [...selected[JOB_LABEL]] }), true);
  }

  private setSelection = (label: ServiceLabel, values: string[]) => {
    const selected = { ...this.state.selected, [label]: values };
    const filtersVariable = this.getFiltersVariable();

    this.setState({ selected, active: hasSelection(selected) });

    if (filtersVariable) {
      this.writing = true;
      try {
        setManagedServiceFilter(filtersVariable, label, values, this.getDataSource());
      } finally {
        this.writing = false;
      }
    }

    this.applied[label] = values.length > 0 && Boolean(filtersVariable);
    this.publishValues();
  };

  /** The services of a group of rows. `extra` is the group of the services that only the job label finds. */
  private getRows(group: RowGroup): ServiceGroup[] {
    const rows = getRowGroups(this.state);

    if (group === 'extra') {
      return rows.others;
    }

    return group === 'hidden' ? rows.hidden : rows.main;
  }

  private setShowExtras = (show: boolean) => {
    this.setState({ showExtras: show });

    if (show) {
      return;
    }

    // The filter must not apply jobs that the list no longer shows
    const { serviceGroups, kgServices } = this.state;
    const extraJobs = new Set(findExtraServices(serviceGroups, kgServices).flatMap((row) => row.jobs));
    const current = this.state.selected[JOB_LABEL];
    const remaining = current.filter((job) => !extraJobs.has(job));

    if (remaining.length !== current.length) {
      this.setSelection(JOB_LABEL, remaining);
    }
  };

  private onToggle = (group: RowGroup, value: string, checked: boolean) => {
    const current = this.state.selected[JOB_LABEL];
    // A service stands for all of its jobs, one per namespace
    const affected = this.getRows(group).find((row) => row.service === value)?.jobs ?? [];

    this.setSelection(
      JOB_LABEL,
      checked ? [...new Set([...current, ...affected])] : current.filter((v) => !affected.includes(v))
    );
  };

  public static readonly Component = ({ model }: SceneComponentProps<ServiceFilterSection>) => {
    const styles = useStyles2(getStyles);
    const listStyles = useStyles2(getSharedListStyles);
    const {
      title,
      description,
      source,
      fallback,
      serviceGroups,
      kgServices,
      kgTruncated,
      showExtras,
      loading,
      selected,
    } = model.useState();
    const { filters } = sceneGraph.findByKeyAndType(model, VAR_FILTERS, AdHocFiltersVariable).useState();
    const [searchValue, setSearchValue] = useState('');

    const isKnowledgeGraph = source === 'knowledge-graph';
    const selectedJobs = selected[JOB_LABEL];

    const rows = useMemo(
      () => getRowGroups({ source, serviceGroups, kgServices, showExtras, selected }),
      [source, serviceGroups, kgServices, showExtras, selected]
    );
    const hiddenItems = useMemo(() => toItems(rows.hidden, selectedJobs), [rows.hidden, selectedJobs]);
    const mainItems = useMemo(() => toItems(rows.main, selectedJobs), [rows.main, selectedJobs]);
    const extraItems = useMemo(() => toItems(rows.others, selectedJobs), [rows.others, selectedJobs]);
    const visibleHiddenItems = useMemo(() => filterItems(hiddenItems, searchValue), [hiddenItems, searchValue]);
    const visibleItems = useMemo(() => filterItems(mainItems, searchValue), [mainItems, searchValue]);
    const visibleExtraItems = useMemo(() => filterItems(extraItems, searchValue), [extraItems, searchValue]);

    // The checkbox exists only when the job label finds jobs that the Knowledge Graph does not list
    const hasChoice = isKnowledgeGraph && rows.extras.length > 0;
    const allItems = [...hiddenItems, ...mainItems, ...extraItems];
    const selectedCount = allItems.filter((item) => item.checked || item.partial).length;
    const totalCount = allItems.length;
    const hasManualFilter = getFiltersWithoutManagedFilter(filters, JOB_LABEL).some((f) => f.key === JOB_LABEL);
    // The first load has nothing to show. A later load keeps the list on screen, so that focus stays where it was.
    const initialLoad = loading && serviceGroups.length === 0;
    const hasRows = visibleHiddenItems.length > 0 || visibleItems.length > 0 || visibleExtraItems.length > 0;

    return (
      <div className={styles.container}>
        <SectionTitle title={title} description={description} />

        {!initialLoad && (
          <>
            <div className={styles.sourceRow}>
              <div className={styles.source}>{getSourceCaption(isKnowledgeGraph, fallback)}</div>
              <Toggletip
                placement="bottom"
                content={<SourceHelp isKnowledgeGraph={isKnowledgeGraph} hasChoice={hasChoice} />}
              >
                <IconButton
                  name="info-circle"
                  size="sm"
                  variant="secondary"
                  aria-label={t('sidebar.service-filter.source-help-label', 'About this list')}
                />
              </Toggletip>
            </div>
            {hasChoice && (
              <div className={styles.includeRow}>
                {/* The tooltip is on the checkbox itself, so that focus reaches it and the description belongs to it */}
                <Tooltip
                  placement="bottom"
                  content={t(
                    'sidebar.service-filter.include-jobs-description',
                    'Adds the other values of the job label in this data source. A value with the same service name as a Knowledge Graph service joins that service, and the other values are listed below. A job is a group of scrape targets, so these can include exporters and other infrastructure.'
                  )}
                >
                  <Checkbox
                    label={t('sidebar.service-filter.include-jobs', 'Include all jobs')}
                    value={showExtras}
                    onChange={(event) => model.setShowExtras(event.currentTarget.checked)}
                  />
                </Tooltip>
              </div>
            )}
          </>
        )}

        {hasManualFilter && (
          <div className={styles.notice}>
            <Icon name="info-circle" size="sm" />
            <span>
              {t(
                'sidebar.service-filter.manual-filter-notice',
                'A filter on {{label}} in the top bar also applies. Results match both.',
                { label: JOB_LABEL }
              )}
            </span>
          </div>
        )}

        {isKnowledgeGraph && kgTruncated && (
          <div className={styles.notice}>
            <Icon name="exclamation-triangle" size="sm" />
            <span>
              {t(
                'sidebar.service-filter.kg-truncated',
                'The list may be incomplete, because the Knowledge Graph returned {{limit}} jobs, the most that the list asks for.',
                { limit: KG_MAX_JOBS }
              )}
            </span>
          </div>
        )}

        <Input
          className={styles.searchInput}
          prefix={<Icon name="search" />}
          placeholder={t('sidebar.filter.search-placeholder', 'Search...')}
          aria-label={t('sidebar.filter.search-aria-label', 'Search filter options')}
          value={searchValue}
          onChange={(e) => setSearchValue(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setSearchValue('');
            }
          }}
          suffix={
            <IconButton
              name="times"
              variant="secondary"
              tooltip={t('sidebar.filter.clear-search-tooltip', 'Clear search')}
              aria-label={t('sidebar.filter.clear-search-tooltip', 'Clear search')}
              onClick={() => setSearchValue('')}
            />
          }
        />

        <div className={listStyles.listHeader}>
          {/* Without rows the count would read 0 of 0, so it shows only when the list has rows */}
          <div className={styles.count}>
            {!initialLoad &&
              totalCount > 0 &&
              t('sidebar.service-filter.selected-count', '{{selected}} of {{total}} selected', {
                selected: selectedCount,
                total: totalCount,
              })}
            {loading && !initialLoad && <Spinner inline size="xs" />}
          </div>
          <Button
            variant="secondary"
            fill="text"
            onClick={() => model.setSelection(JOB_LABEL, [])}
            disabled={!selected[JOB_LABEL].length}
          >
            {t('checkbox-list.clear', 'clear')}
          </Button>
        </div>

        {initialLoad && <Spinner inline />}

        {!initialLoad && !hasRows && (
          <div className={listStyles.noResults}>{t('checkbox-list.no-results', 'No results.')}</div>
        )}

        {!initialLoad && hasRows && (
          <ul className={listStyles.list} data-testid="service-filter-list">
            {visibleHiddenItems.length > 0 && (
              <>
                <li className={styles.groupHeadingFirst}>
                  {t('sidebar.service-filter.hidden-heading', 'Selected jobs not in this list ({{total}})', {
                    total: hiddenItems.length,
                  })}
                </li>
                <ServiceRows
                  items={visibleHiddenItems}
                  group="hidden"
                  listStyles={listStyles}
                  rowClassName={styles.row}
                  onToggle={model.onToggle}
                />
              </>
            )}
            <ServiceRows
              items={visibleItems}
              group={source}
              listStyles={listStyles}
              rowClassName={styles.row}
              onToggle={model.onToggle}
            />
            {visibleExtraItems.length > 0 && (
              <>
                <li className={styles.groupHeading}>
                  {t('sidebar.service-filter.extras-heading', 'Other jobs ({{total}})', {
                    total: extraItems.length,
                  })}
                </li>
                <ServiceRows
                  items={visibleExtraItems}
                  group="extra"
                  listStyles={listStyles}
                  rowClassName={styles.row}
                  onToggle={model.onToggle}
                />
              </>
            )}
          </ul>
        )}
      </div>
    );
  };
}

const PROMETHEUS_JOBS_URL = 'https://prometheus.io/docs/concepts/jobs_instances/';
const OTEL_PROMETHEUS_URL = 'https://opentelemetry.io/docs/specs/otel/compatibility/prometheus_and_openmetrics/';
const GRAFANA_OTLP_URL = 'https://grafana.com/docs/grafana-cloud/send-data/otlp/otlp-format-considerations/';
const KNOWLEDGE_GRAPH_URL = 'https://grafana.com/docs/grafana-cloud/knowledge-graph/introduction/';

function getSourceCaption(isKnowledgeGraph: boolean, fallback: ServiceFallback) {
  if (isKnowledgeGraph) {
    return t('sidebar.service-filter.source-kg', 'Services from the Knowledge Graph');
  }

  switch (fallback) {
    case 'no-jobs':
      return t('sidebar.service-filter.source-no-jobs', 'No jobs found for the selected filters and time range');
    case 'no-services':
      return t(
        'sidebar.service-filter.source-job-no-services',
        'The Knowledge Graph lists no services for this data source, so services are read from the job label'
      );
    default:
      return t(
        'sidebar.service-filter.source-job',
        'No Knowledge Graph found, so services are read from the job label'
      );
  }
}

function getFallback(
  serviceGroups: ServiceGroup[],
  knowledgeGraph: Awaited<ReturnType<typeof fetchInstrumentedServices>> | undefined
): ServiceFallback {
  if (!serviceGroups.length) {
    return 'no-jobs';
  }

  return knowledgeGraph ? 'no-services' : 'no-knowledge-graph';
}

/** The rows that the list shows, by group, with the selected jobs that no group shows */
function getRowGroups({
  source,
  serviceGroups,
  kgServices,
  showExtras,
  selected,
}: Pick<ServiceFilterSectionState, 'source' | 'serviceGroups' | 'kgServices' | 'showExtras' | 'selected'>) {
  const isKnowledgeGraph = source === 'knowledge-graph';
  // The services that only the job label finds are offered next to the Knowledge Graph services
  const extras = isKnowledgeGraph ? findExtraServices(serviceGroups, kgServices) : [];
  // A job of the job label that has the name of a Knowledge Graph service is a job of that service, so it joins its row
  const { merged, others } =
    isKnowledgeGraph && showExtras ? splitExtras(kgServices, extras) : { merged: kgServices, others: [] };
  const main = isKnowledgeGraph ? merged : serviceGroups;
  const shownJobs = new Set([...main, ...others].flatMap((row) => row.jobs));
  const hidden = selected[JOB_LABEL].filter((job) => !shownJobs.has(job)).map((job) => ({ service: job, jobs: [job] }));

  return { extras, main, others, hidden };
}

/**
 * Explains where the list comes from, with the definitions that the list relies on and links to them. The words job,
 * service.name and service.namespace have exact meanings in Prometheus and OpenTelemetry, and a reader who knows them
 * can check every statement here.
 */
function SourceHelp({ isKnowledgeGraph, hasChoice }: Readonly<{ isKnowledgeGraph: boolean; hasChoice: boolean }>) {
  const styles = useStyles2(getStyles);
  const option = t('sidebar.service-filter.include-jobs', 'Include all jobs');

  if (isKnowledgeGraph) {
    return (
      <div className={styles.help} data-testid="service-filter-help">
        <p>
          <Trans i18nKey="sidebar.service-filter.help-kg">
            Services come from the Knowledge Graph, which lists services that are instrumented with OpenTelemetry or
            other APM tools. Selecting a service filters the metrics by its job values. Only jobs that exist in this
            data source are used.{' '}
            <TextLink external href={KNOWLEDGE_GRAPH_URL}>
              Knowledge graph introduction
            </TextLink>
          </Trans>
        </p>
        {hasChoice && (
          <p>
            <Trans i18nKey="sidebar.service-filter.help-jobs" values={{ option }}>
              The {'{{option}}'} option also lists the values of the job label that the Knowledge Graph does not list.
              In Prometheus, a job is a group of scrape targets with the same purpose, so these can be exporters and
              other infrastructure as well as services.{' '}
              <TextLink external href={PROMETHEUS_JOBS_URL}>
                Prometheus: jobs and instances
              </TextLink>
            </Trans>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={styles.help} data-testid="service-filter-help">
      <p>
        <Trans i18nKey="sidebar.service-filter.help-job">
          Services are read from the job label. In Prometheus, a job is a group of scrape targets with the same purpose,
          set in the scrape configuration.{' '}
          <TextLink external href={PROMETHEUS_JOBS_URL}>
            Prometheus: jobs and instances
          </TextLink>
        </Trans>
      </p>
      <p>
        <Trans i18nKey="sidebar.service-filter.help-otel">
          OpenTelemetry metrics get the job service.namespace/service.name, or service.name when there is no namespace.{' '}
          <TextLink external href={OTEL_PROMETHEUS_URL}>
            OpenTelemetry: Prometheus compatibility
          </TextLink>{' '}
          <TextLink external href={GRAFANA_OTLP_URL}>
            Grafana Cloud: OTLP format considerations
          </TextLink>
        </Trans>
      </p>
      <p>
        {t(
          'sidebar.service-filter.help-limit',
          'This list reads the part after the first slash as the service name, so a job that does not come from OpenTelemetry can appear as a service.'
        )}
      </p>
    </div>
  );
}

function ServiceRows({
  items,
  group,
  listStyles,
  rowClassName,
  onToggle,
}: Readonly<{
  items: ListItem[];
  group: RowGroup;
  listStyles: ReturnType<typeof getSharedListStyles>;
  rowClassName: string;
  onToggle: (group: RowGroup, value: string, checked: boolean) => void;
}>) {
  return (
    <>
      {items.map((item) => {
        // The jobs of a service are read out with its name, because the title shows only on hover
        const jobs = item.tooltip && item.tooltip !== item.label ? { 'aria-description': item.tooltip } : {};

        return (
          <li
            key={`${group}:${item.value}`}
            className={cx(listStyles.listItem, rowClassName)}
            title={item.tooltip ?? item.label}
          >
            <Checkbox
              {...jobs}
              label={item.label}
              checked={item.checked}
              indeterminate={item.partial}
              // Checkbox sets the mixed state but never clears it, so a row that stops being partial would stay mixed
              ref={(element) => {
                if (element) {
                  element.indeterminate = Boolean(item.partial);
                }
              }}
              onChange={(e) => onToggle(group, item.value, e.currentTarget.checked)}
            />
          </li>
        );
      })}
    </>
  );
}

function toItems(groups: ServiceGroup[], selectedJobs: string[]): ListItem[] {
  const selected = new Set(selectedJobs);

  return groups.map((group) => {
    const checked = group.jobs.every((job) => selected.has(job));

    return {
      value: group.service,
      label: group.service,
      checked,
      partial: !checked && group.jobs.some((job) => selected.has(job)),
      tooltip: group.jobs.join(', '),
    };
  });
}

function filterItems(items: ListItem[], searchValue: string): ListItem[] {
  const search = searchValue.toLowerCase();

  // A service is also found by its jobs, e.g. by its namespace
  return items.filter(
    (item) => item.label.toLowerCase().includes(search) || Boolean(item.tooltip?.toLowerCase().includes(search))
  );
}

/**
 * The services that the job label finds in the data source and that the Knowledge Graph list does not have, with only
 * the jobs that the Knowledge Graph list does not have. A service that the list has under other jobs stays here with
 * the jobs that are left.
 */
function findExtraServices(jobServices: ServiceGroup[], knowledgeGraphServices: ServiceGroup[]): ServiceGroup[] {
  const knownJobs = new Set(knowledgeGraphServices.flatMap((service) => service.jobs));

  return jobServices
    .map((service) => ({ ...service, jobs: service.jobs.filter((job) => !knownJobs.has(job)) }))
    .filter((service) => service.jobs.length > 0);
}

/**
 * Splits the jobs that the Knowledge Graph does not list. A job whose service name is the name of a Knowledge Graph
 * service belongs to that service, whatever its namespace, so it joins the row of the service. The other jobs stay in
 * their own rows.
 */
function splitExtras(
  knowledgeGraphServices: ServiceGroup[],
  extras: ServiceGroup[]
): { merged: ServiceGroup[]; others: ServiceGroup[] } {
  const extraJobsByName = new Map(extras.map((extra) => [extra.service, extra.jobs]));
  const knownNames = new Set(knowledgeGraphServices.map((service) => service.service));

  return {
    merged: knowledgeGraphServices.map((service) => ({
      ...service,
      jobs: [...service.jobs, ...(extraJobsByName.get(service.service) ?? [])],
    })),
    others: extras.filter((extra) => !knownNames.has(extra.service)),
  };
}

/** Scenes gives null for a key that is not in the URL, which means that the box is not checked. */
function parseShowExtras(value: SceneObjectUrlValues[string]): boolean | undefined {
  if (value === undefined || (value !== null && typeof value !== 'string')) {
    return undefined;
  }

  return Boolean(value);
}

/**
 * Keeps the jobs that the data source has. A job that the data source does not have would filter out every metric, so
 * it is dropped, and so is a service left without a job.
 */
function keepJobsOfDataSource(services: ServiceGroup[], jobsOfDataSource: ServiceGroup[]): ServiceGroup[] {
  const jobs = new Set(jobsOfDataSource.flatMap((group) => group.jobs));

  return services
    .map((service) => ({ ...service, jobs: service.jobs.filter((job) => jobs.has(job)) }))
    .filter((service) => service.jobs.length > 0);
}

function hasSelection(selected: Record<ServiceLabel, string[]>) {
  return LABELS.some((label) => selected[label].length > 0);
}

function isEmptyValue(value: unknown) {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      height: '100%',
      overflowY: 'hidden',
    }),
    sourceRow: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(1),
    }),
    includeRow: css({
      fontSize: theme.typography.sm.fontSize,
    }),
    source: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.sm.fontSize,
    }),
    help: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      maxWidth: '320px',
      '& p': {
        margin: 0,
      },
    }),
    notice: css({
      display: 'flex',
      alignItems: 'flex-start',
      gap: theme.spacing(0.5),
      color: theme.colors.text.secondary,
      fontSize: theme.typography.sm.fontSize,
    }),
    // A service name is one long word, like adobeanalytics.datasource.grafana.app. Without this it cannot wrap in the
    // narrow sidebar, and it is cut off at the edge of the list.
    row: css({
      overflowWrap: 'anywhere',
    }),
    count: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
    }),
    groupHeadingFirst: css({
      listStyle: 'none',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.sm.fontSize,
      padding: theme.spacing(0, 0, 0.5),
    }),
    groupHeading: css({
      listStyle: 'none',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.sm.fontSize,
      marginTop: theme.spacing(1),
      padding: theme.spacing(1, 0, 0.5),
      borderTop: `1px solid ${theme.colors.border.weak}`,
    }),
    searchInput: css({
      flexBasis: '32px',
      flexShrink: 0,
      marginBottom: theme.spacing(1),
      padding: theme.spacing(0, 0.5),
    }),
  };
}
