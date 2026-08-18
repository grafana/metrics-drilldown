import { css, cx } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph, SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button, Field, Input, Tooltip, useStyles2 } from '@grafana/ui';
import React, { useEffect, useRef, useState } from 'react';

import { DEFAULT_CLASSIC_HISTOGRAM_RANGE, type HistogramRange } from 'MetricScene/AttributeExplorer/PrometheusAttributeExplorer';
import { MetricScene } from 'MetricScene/MetricScene';
import { GmdVizPanel } from 'shared/GmdVizPanel/GmdVizPanel';
import { getUnitFromMetric } from 'shared/GmdVizPanel/units/getUnit';

interface ExploreAttributesActionState extends SceneObjectState {}

function getHistogramMeaningCopy(unit: string | null, lowerSeconds: number): string {
  if (unit === 'seconds') {
    return t(
      'explore-attributes-action.tooltip.meaning-seconds',
      'For each attribute value, the percentage shown means: "X% of this value\'s own traffic is above {{lower}}s". We call this slow.',
      { lower: lowerSeconds }
    );
  }
  if (unit) {
    return t(
      'explore-attributes-action.tooltip.meaning-unit',
      'For each attribute value, the percentage shown means: "X% of this value\'s own traffic is above {{lower}} {{unit}}".',
      { lower: lowerSeconds, unit }
    );
  }
  return t(
    'explore-attributes-action.tooltip.meaning-unknown',
    'For each attribute value, the percentage shown means: "X% of this value\'s own traffic is above {{lower}}".',
    { lower: lowerSeconds }
  );
}

// Assumes a MetricScene ancestor exists, same as siblings here assume a DataTrail ancestor.
export class ExploreAttributesAction extends SceneObjectBase<ExploreAttributesActionState> {
  constructor() {
    super({});
  }

  public static readonly Component = ({ model }: SceneComponentProps<ExploreAttributesAction>) => {
    const styles = useStyles2(getStyles);
    const metricScene = sceneGraph.getAncestor(model, MetricScene);
    const { attributeExplorerOpen, histogramRange } = metricScene.useState();
    const { metric, metricType } = sceneGraph.getAncestor(model, GmdVizPanel).useState();
    const label = t('explore-attributes-action.label', 'Explore Attributes');

    // Task 9 (native-histogram C2) isn't built yet, so this control only applies where the underlying
    // query actually uses it: showing it for a type that ignores it would be its own kind of lie.
    const isClassicHistogram = metricType === 'classic-histogram';
    const unit = isClassicHistogram ? getUnitFromMetric(metric) : null;
    const range = histogramRange ?? DEFAULT_CLASSIC_HISTOGRAM_RANGE;

    const [lowerText, setLowerText] = useState(String(range.lowerSeconds));
    const [upperText, setUpperText] = useState(
      range.upperSeconds === Number.POSITIVE_INFINITY ? '' : String(range.upperSeconds)
    );

    const commitTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
    useEffect(() => () => clearTimeout(commitTimeoutRef.current), []);

    // Debounced, not applied on every keystroke directly: each commit triggers a full re-detection
    // cycle in AttributeDistribution (it re-fetches attributes and re-queries every currently-visible
    // field, not just the histogram range), so typing a multi-digit value without debouncing fires
    // that whole cycle once per character; with several visible fields, overlapping in-flight
    // requests could keep the sidebar spinning well after typing stopped.
    const commitRange = (next: Partial<HistogramRange>) => {
      clearTimeout(commitTimeoutRef.current);
      commitTimeoutRef.current = setTimeout(() => {
        metricScene.setHistogramRange({ ...range, ...next });
      }, 500);
    };

    // Commits on every keystroke (debounced above) rather than onBlur: this tooltip only exists while
    // hovered (interactive mode keeps it open on mouse-move into the content), and there is no
    // reliable moment to hang a blur handler off of before the tooltip itself unmounts the input.
    const handleLowerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const text = e.currentTarget.value;
      setLowerText(text);
      const parsed = Number(text);
      if (text.trim() !== '' && !isNaN(parsed)) {
        commitRange({ lowerSeconds: parsed });
      }
    };

    const handleUpperChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const text = e.currentTarget.value;
      setUpperText(text);
      if (text.trim() === '') {
        commitRange({ upperSeconds: Number.POSITIVE_INFINITY });
        return;
      }
      const parsed = Number(text);
      if (!isNaN(parsed)) {
        commitRange({ upperSeconds: parsed });
      }
    };

    const tooltipContent = (
      <div className={styles.tooltip}>
        <div>
          <span className={styles.tooltipLabel}>{t('explore-attributes-action.tooltip.metric', 'Metric:')}</span>{' '}
          {metric}
        </div>
        <div>
          <span className={styles.tooltipLabel}>{t('explore-attributes-action.tooltip.type', 'Type:')}</span>{' '}
          {metricType}
        </div>
        <div>
          {t(
            'explore-attributes-action.tooltip.description',
            'The Attribute Explorer surfaces the labels and attribute values present for this metric so you can filter and drill down into them.'
          )}
        </div>
        {isClassicHistogram && (
          <div className={styles.histogramSection}>
            <div>
              {t(
                'explore-attributes-action.tooltip.histogram-intro',
                "This metric is a histogram. Each attribute value's own data is compared against a threshold from the histogram's buckets, shown as a percentage in the sidebar. You can change that threshold below."
              )}
            </div>
            <div className={styles.histogramInputs}>
              <Field
                label={
                  unit
                    ? t('explore-attributes-action.tooltip.lower-limit-unit', 'Lower limit ({{unit}})', { unit })
                    : t('explore-attributes-action.tooltip.lower-limit', 'Lower limit')
                }
              >
                <Input
                  type="number"
                  width={12}
                  value={lowerText}
                  onChange={handleLowerChange}
                  data-testid="histogram-lower-limit-input"
                />
              </Field>
              <Field
                label={
                  unit
                    ? t('explore-attributes-action.tooltip.upper-limit-unit', 'Upper limit ({{unit}})', { unit })
                    : t('explore-attributes-action.tooltip.upper-limit', 'Upper limit')
                }
              >
                <Input
                  type="number"
                  width={12}
                  placeholder={t('explore-attributes-action.tooltip.upper-limit-placeholder', 'no limit')}
                  value={upperText}
                  onChange={handleUpperChange}
                  data-testid="histogram-upper-limit-input"
                />
              </Field>
            </div>
            <div>{getHistogramMeaningCopy(unit, range.lowerSeconds)}</div>
            {!unit && (
              <div className={styles.warning}>
                {t(
                  'explore-attributes-action.tooltip.unit-unknown',
                  "We couldn't determine this metric's unit from its name. Double-check that this threshold makes sense before trusting the percentage."
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );

    return (
      <Tooltip content={tooltipContent} placement="top" interactive>
        <Button
          id="explore-attributes-action"
          className={cx(styles.button)}
          aria-label={label}
          aria-pressed={Boolean(attributeExplorerOpen)}
          variant="secondary"
          fill="solid"
          size="sm"
          onClick={() => metricScene.toggleAttributeExplorer()}
          icon="filter"
          data-testid="explore-attributes-action"
        >
          {t('metric-graph.explore-attributes', 'Explore Attributes')}
        </Button>
      </Tooltip>
    );
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  button: css`
    margin: 0;
    margin-left: ${theme.spacing(1)};
  `,
  tooltip: css`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(0.5)};
    max-width: 320px;
  `,
  tooltipLabel: css`
    font-weight: ${theme.typography.fontWeightMedium};
  `,
  histogramSection: css`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(0.5)};
    border-top: 1px solid ${theme.colors.border.weak};
    padding-top: ${theme.spacing(0.5)};
  `,
  histogramInputs: css`
    display: flex;
    gap: ${theme.spacing(1)};
  `,
  warning: css`
    color: ${theme.colors.warning.text};
  `,
});
