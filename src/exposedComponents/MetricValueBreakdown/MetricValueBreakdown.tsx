import { LoadingState, type AdHocVariableFilter, type PanelData } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceInstance } from '@grafana/plugin-compat/datasources';
import { type PromQuery } from '@grafana/prometheus';
import { SceneFlexItem, sceneGraph, SceneQueryRunner, type SceneFlexLayout, type VizPanel } from '@grafana/scenes';
import { Alert, Button, Combobox, Field, Spinner } from '@grafana/ui';
import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { MetricDatasourceHelper } from 'AppDataTrail/MetricDatasourceHelper/MetricDatasourceHelper';
import { buildQueryExpression } from 'shared/GmdVizPanel/buildQueryExpression';
import { PANEL_HEIGHT } from 'shared/GmdVizPanel/config/panel-heights';
import { buildStaticTimeseriesPanel } from 'shared/GmdVizPanel/types/timeseries/buildTimeseriesPanel';
import { isPrometheusDataSource } from 'shared/utils/utils.datasource';

import { DEFAULT_MAX_VALUES, getSharedBounds, getValueFrames, HARD_MAX_VALUES, type ValueFrame } from './valueFrames';
import {
  createMetricScene,
  isValidMetricSceneOptions,
  observeMetricQueries,
  type MetricSceneOptions,
} from '../metrics-molecules/metricScene';

export interface MetricValueBreakdownProps extends MetricSceneOptions {
  label: string;
  onLabelChange: (label: string) => void;
  onFilterSelect?: (filter: AdHocVariableFilter) => void;
  /** Same local-variable expansion and built-in macro behavior as MetricChart. */
  onQueriesChange?: (queries: PromQuery[]) => void;
  /** Alphabetically first sampled values. Defaults to 6; capped at 24. */
  maxValues?: number;
}

type Model = ReturnType<typeof createMetricScene>;
type ValuePanel = ValueFrame & { panel?: VizPanel };
interface View {
  model: Model;
  loading?: boolean;
  error?: boolean;
  values: ValuePanel[];
  omitted: number;
}

function isValidOptions(options: MetricSceneOptions, label: string) {
  return (
    isValidMetricSceneOptions(options) &&
    label !== '__name__' &&
    label !== 'le' &&
    isValidMetricSceneOptions({ ...options, metric: label })
  );
}

/** Grouped defaults are the display computation, not per-value app preference queries. */
export function MetricValueBreakdown({
  label,
  onLabelChange,
  onFilterSelect,
  onQueriesChange,
  maxValues = DEFAULT_MAX_VALUES,
  ...scope
}: Readonly<MetricValueBreakdownProps>) {
  const inputId = useId();
  const scopeKey = JSON.stringify({ scope, label });
  const model = useMemo(() => {
    const options: { scope: MetricSceneOptions; label: string } = JSON.parse(scopeKey);
    return isValidOptions(options.scope, options.label)
      ? createMetricScene(options.scope, { groupBy: options.label }, { type: 'timeseries' })
      : undefined;
  }, [scopeKey]);
  const valid = model && Number.isInteger(maxValues) && maxValues > 0 && typeof onLabelChange === 'function';
  const limit = Math.min(maxValues, HARD_MAX_VALUES);
  const [view, setView] = useState<View>();
  const [labels, setLabels] = useState<{ model: Model; values?: string[]; error?: boolean }>();
  const limitRef = useRef(limit);
  const redraw = useRef<(() => void) | undefined>(undefined);

  // A display limit must not deactivate the scene and discard its query observers.
  useLayoutEffect(() => {
    limitRef.current = limit;
    redraw.current?.();
  }, [limit]);

  useLayoutEffect(
    () => (valid && onQueriesChange ? observeMetricQueries(model.panel, onQueriesChange) : undefined),
    [model, valid, onQueriesChange]
  );

  useEffect(() => {
    if (!valid) {
      return;
    }
    let active = true;
    const layout = model.scene.state.body as SceneFlexLayout;
    const sourceItem = layout.state.children[0];
    const offScene = model.scene.activate();
    let runner: SceneQueryRunner | undefined;
    let offRunner: (() => void) | undefined;
    let offData: (() => void) | undefined;

    const update = (data?: PanelData) => {
      if (!active) {
        return;
      }
      const loading = !data || data.state === LoadingState.Loading || data.state === LoadingState.Streaming;
      const error = data?.state === LoadingState.Error || Boolean(data?.errors?.length);
      const all = !loading && !error ? getValueFrames(data!.series, label) : [];
      const items = all.slice(0, limitRef.current);
      const bounds = getSharedBounds(items);
      const values = items.map((item, index): ValuePanel => {
        if (!item.hasSamples) {
          return item;
        }
        const panel = buildStaticTimeseriesPanel({
          metric: { name: model.panel.state.metric, type: model.panel.state.metricType },
          data: data!,
          frame: item.frame,
          panelConfig: {
            type: 'timeseries',
            // VizPanel interpolates titles as templates. Render literal label values in React instead.
            title: '',
            height: PANEL_HEIGHT.M,
            fixedColorIndex: index,
            headerActions: () => [],
          },
        });
        panel.setState({
          fieldConfig: {
            ...panel.state.fieldConfig,
            defaults: {
              ...panel.state.fieldConfig.defaults,
              // The static builder uses the raw metric unit; preserve the grouped runner's rate unit.
              unit: model.panel.state.body?.state.fieldConfig.defaults.unit,
              ...bounds,
            },
          },
        });
        return { ...item, panel };
      });
      layout.setState({
        children: [sourceItem, ...values.flatMap(({ panel }) => (panel ? [new SceneFlexItem({ body: panel })] : []))],
      });
      setView({ model, loading, error, values, omitted: all.length - values.length });
    };

    const bindRunner = () => {
      if (!model.panel.state.metricTypeResolved) {
        return;
      }
      // Observe the raw runner: the app's grouped VizPanel transformer truncates and substitutes labels.
      const next = model.panel.state.body && sceneGraph.findDescendents(model.panel.state.body, SceneQueryRunner)[0];
      if (next === runner) {
        return;
      }
      offData?.();
      offRunner?.();
      runner = next;
      update();
      if (runner) {
        const sub = runner.subscribeToState((state) => update(state.data));
        offData = () => sub.unsubscribe();
        offRunner = runner.activate();
        update(runner.state.data);
      }
    };
    redraw.current = () => update(runner?.state.data);
    const panelSub = model.panel.subscribeToState(bindRunner);
    // Activate metadata resolution, but not the source VizPanel: only its resolved raw runner runs.
    const offPanel = model.panel.activate();
    bindRunner();
    const discover = async () => {
      const ds = await getDataSourceInstance({ uid: sceneGraph.interpolate(model.panel, '${ds}') });
      if (!isPrometheusDataSource(ds)) {
        throw new Error('Expected a Prometheus datasource');
      }
      const matcher = sceneGraph.interpolate(
        model.panel,
        buildQueryExpression({
          metric: { name: model.panel.state.metric, type: model.panel.state.metricType },
          addIgnoreUsageFilter: false,
        })
      );
      return MetricDatasourceHelper.fetchLabels({
        ds,
        matcher,
        timeRange: sceneGraph.getTimeRange(model.scene).state.value,
      });
    };
    discover().then(
      (values) =>
        active &&
        setLabels({
          model,
          values: [...new Set(values)]
            .filter((value) => value !== '__name__' && value !== 'le')
            .sort((a, b) => a.localeCompare(b)),
        }),
      () => active && setLabels({ model, error: true })
    );
    return () => {
      active = false;
      redraw.current = undefined;
      panelSub.unsubscribe();
      offData?.();
      offRunner?.();
      offPanel();
      offScene();
      layout.setState({ children: [sourceItem] });
    };
  }, [model, valid, label]);

  if (!valid) {
    return (
      <Alert
        severity="error"
        title={t('metric-value-breakdown.invalid-scope', 'Invalid metric breakdown scope or label')}
      />
    );
  }
  const current = view?.model === model ? view : undefined;
  const currentLabels = labels?.model === model ? labels : undefined;
  return (
    <div>
      <Field label={t('metric-value-breakdown.label', 'Break down by label')} htmlFor={inputId}>
        <Combobox
          id={inputId}
          value={{ label, value: label }}
          options={(currentLabels?.values ?? []).map((value) => ({ label: value, value }))}
          loading={!currentLabels?.values && !currentLabels?.error}
          onChange={(option) => onLabelChange(option.value)}
        />
      </Field>
      {currentLabels?.error && (
        <Alert severity="warning" title={t('metric-value-breakdown.labels-error', 'Unable to load label names')} />
      )}
      <p>
        {t(
          'metric-value-breakdown.sampled-notice',
          'Grouped default computation, ordered alphabetically. Only values returned by the sampled range query are shown; this is not an exhaustive list of label values. Charts share a y-axis range.'
        )}
      </p>
      {(!current || current.loading) && (
        <div role="status" aria-label={t('metric-value-breakdown.loading', 'Loading breakdown')}>
          <Spinner />
        </div>
      )}
      {current?.error && (
        <Alert severity="error" title={t('metric-value-breakdown.query-error', 'Unable to load breakdown')} />
      )}
      {current && !current.loading && !current.error && current.values.length === 0 && (
        <p>{t('metric-value-breakdown.no-samples', 'No samples in this time range')}</p>
      )}
      {current?.values.map(({ value, panel }) => (
        <section key={value} aria-label={value || t('metric-value-breakdown.empty-value', '(empty label value)')}>
          <h3>{value || t('metric-value-breakdown.empty-value', '(empty label value)')}</h3>
          {panel ? (
            <div style={{ height: PANEL_HEIGHT.M }}>
              <panel.Component model={panel} />
            </div>
          ) : (
            <p>{t('metric-value-breakdown.no-samples', 'No samples in this time range')}</p>
          )}
          {onFilterSelect && (
            <Button variant="secondary" onClick={() => onFilterSelect({ key: label, operator: '=', value })}>
              {t('metric-value-breakdown.select-filter', 'Filter by {{label}}={{value}}', { label, value })}
            </Button>
          )}
        </section>
      ))}
      {Boolean(current?.omitted) && (
        <p>
          {t('metric-value-breakdown.omitted', '{{count}} sampled values omitted (display limit {{limit}}).', {
            count: current!.omitted,
            limit,
          })}
        </p>
      )}
    </div>
  );
}

export default MetricValueBreakdown;
