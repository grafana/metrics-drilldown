import { css, cx } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph, SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button, Tooltip, useStyles2 } from '@grafana/ui';
import React from 'react';

import { isHistogramWithThreshold } from 'MetricScene/AttributeExplorer/PrometheusAttributeExplorer';
import { MetricScene } from 'MetricScene/MetricScene';
import { GmdVizPanel } from 'shared/GmdVizPanel/GmdVizPanel';

interface ExploreAttributesActionState extends SceneObjectState {}

// Assumes a MetricScene ancestor exists, same as siblings here assume a DataTrail ancestor.
export class ExploreAttributesAction extends SceneObjectBase<ExploreAttributesActionState> {
  constructor() {
    super({});
  }

  public static readonly Component = ({ model }: SceneComponentProps<ExploreAttributesAction>) => {
    const styles = useStyles2(getStyles);
    const metricScene = sceneGraph.getAncestor(model, MetricScene);
    const { attributeExplorerOpen } = metricScene.useState();
    const { metric, metricType } = sceneGraph.getAncestor(model, GmdVizPanel).useState();
    const label = t('explore-attributes-action.label', 'Explore Attributes');

    // The Attribute Explorer only supports histogram metrics (see PrometheusAttributeExplorerProps);
    // the button that opens it is hidden for every other metric type rather than showing a control
    // for a view that doesn't exist for them.
    if (!isHistogramWithThreshold(metricType)) {
      return null;
    }

    // Fixed text, not branched by metric type: this button only ever renders for the two histogram
    // types now, so there's nothing left to vary here. The threshold itself is set in the Attribute
    // Explorer sidebar, not here; this tooltip is purely informational.
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
        <div>
          {t(
            'explore-attributes-action.tooltip.histogram-intro',
            "This metric is a histogram. Each attribute value's own data is compared against a threshold from the histogram's buckets, shown as a percentage in the sidebar. Set that threshold from the Attribute Explorer's own header, once it's open."
          )}
        </div>
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
});
