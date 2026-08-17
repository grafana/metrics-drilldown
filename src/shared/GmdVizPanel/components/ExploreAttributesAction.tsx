import { css, cx } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph, SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Button, Tooltip, useStyles2 } from '@grafana/ui';
import React from 'react';

import { MetricScene } from 'MetricScene/MetricScene';
import { GmdVizPanel } from 'shared/GmdVizPanel/GmdVizPanel';

interface ExploreAttributesActionState extends SceneObjectState {}

// Wired into MetricGraphScene's main panel headerActions only (see panelOptions there) -- assumes a
// MetricScene ancestor exists, same as this file's siblings assume a DataTrail ancestor (getTrailFor).
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
  `,
  tooltipLabel: css`
    font-weight: ${theme.typography.fontWeightMedium};
  `,
});
