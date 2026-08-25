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
    const { metricType } = sceneGraph.getAncestor(model, GmdVizPanel).useState();
    const label = t('explore-attributes-action.label', 'Histogram distribution');

    // The Attribute Explorer only supports histogram metrics (see PrometheusAttributeExplorerProps);
    // the button that opens it is hidden for every other metric type rather than showing a control
    // for a view that doesn't exist for them.
    if (!isHistogramWithThreshold(metricType)) {
      return null;
    }

    // One short line: the metric name and type are already visible in the panel title, and the
    // threshold/percentage explanation lives in the Attribute Explorer's own header tooltip once it's
    // open, so repeating either here was pure duplication.
    const tooltipContent = t(
      'explore-attributes-action.tooltip.description',
      'Explore the distribution of histogram observation for labels and attribute values for this metric.'
    );

    return (
      <Tooltip content={tooltipContent} placement="top">
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
          {t('metric-graph.explore-attributes', 'Histogram analysis')}
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
});
