import { t } from '@grafana/i18n';
import { SceneObjectBase, type SceneDataLayerSet, type SceneObjectRef, type SceneObjectState } from '@grafana/scenes';
import { InlineLabel, InlineSwitch, TextLink } from '@grafana/ui';
import React from 'react';

export interface KgAnnotationToggleState extends SceneObjectState {
  isEnabled: boolean;
  layerSetRef: SceneObjectRef<SceneDataLayerSet>;
}

export class KgAnnotationToggle extends SceneObjectBase<KgAnnotationToggleState> {
  static readonly Component = KgAnnotationToggleRenderer;

  public toggleEnabled = () => {
    const next = !this.state.isEnabled;
    this.setState({ isEnabled: next });
    for (const layer of this.state.layerSetRef.resolve().state.layers) {
      layer.setState({ isEnabled: next });
    }
  };

  public syncLayerEnabledState = () => {
    for (const layer of this.state.layerSetRef.resolve().state.layers) {
      layer.setState({ isEnabled: this.state.isEnabled });
    }
  };
}

function KgAnnotationToggleRenderer({ model }: Readonly<{ model: KgAnnotationToggle }>) {
  const { isEnabled, layerSetRef } = model.useState();
  const { layers } = layerSetRef.resolve().useState();
  const hasLayers = layers.length > 0;

  const description = t(
    'kg-annotations.toggle.description',
    'Overlay health states (critical, warning, info) from the Knowledge Graph on timeseries panels.'
  );

  const tooltipContent = hasLayers ? (
    description
  ) : (
    <span>
      {description} {t('kg-annotations.toggle.disabled-tooltip', 'Add label filters to match entities.')}{' '}
      <TextLink external href="https://grafana.com/docs/grafana-cloud/knowledge-graph/introduction/">
        {t('kg-annotations.toggle.learn-more', 'Learn more')}
      </TextLink>
    </span>
  );

  return (
    <div style={{ display: 'flex', alignSelf: 'flex-end' }}>
      <InlineLabel tooltip={tooltipContent} interactive={!hasLayers} width="auto" transparent>
        {t('kg-annotations.toggle.label', 'Insights')}
      </InlineLabel>
      <InlineSwitch value={isEnabled} onChange={model.toggleEnabled} disabled={!hasLayers} />
    </div>
  );
}
