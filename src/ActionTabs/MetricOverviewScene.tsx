import { isValidLegacyName, type PromMetricsMetadataItem } from '@grafana/prometheus';
import {
  sceneGraph,
  SceneObjectBase,
  VariableDependencyConfig,
  type QueryVariable,
  type SceneComponentProps,
  type SceneObjectState,
  type VariableValueOption,
} from '@grafana/scenes';
import { Stack, Text, TextLink } from '@grafana/ui';
import React, { useEffect } from 'react';

import { getUnitFromMetric } from '../autoQuery/units';
import { reportExploreMetrics } from '../interactions';
import { MetricScene } from '../MetricScene';
import { updateOtelJoinWithGroupLeft } from '../otel/util';
import { VAR_DATASOURCE_EXPR, VAR_GROUP_BY, VAR_OTEL_GROUP_LEFT } from '../shared';
import { StatusWrapper } from '../StatusWrapper';
import { getMetricSceneFor, getTrailFor } from '../utils';
import { isQueryVariable } from '../utils/utils.variables';

export interface MetricOverviewSceneState extends SceneObjectState {
  metadata?: PromMetricsMetadataItem;
  metadataLoading?: boolean;
}

export class MetricOverviewScene extends SceneObjectBase<MetricOverviewSceneState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_DATASOURCE_EXPR],
    onReferencedVariableValueChanged: this.onReferencedVariableValueChanged.bind(this),
  });

  constructor(state: Partial<MetricOverviewSceneState>) {
    super({
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private getVariable(): QueryVariable {
    const variable = sceneGraph.lookupVariable(VAR_GROUP_BY, this)!;
    if (!isQueryVariable(variable)) {
      throw new Error('Group by variable not found');
    }

    return variable;
  }

  private _onActivate() {
    this.updateMetadata();
  }

  private onReferencedVariableValueChanged() {
    this.updateMetadata();
    this.updateOtelGroupLeft();
  }

  private async updateMetadata() {
    this.setState({ metadataLoading: true, metadata: undefined });
    const metricScene = getMetricSceneFor(this);
    const metric = metricScene.state.metric;

    const trail = getTrailFor(this);
    const metadata = await trail.getMetricMetadata(metric);
    this.setState({ metadata, metadataLoading: false });
  }

  private async updateOtelGroupLeft() {
    const trail = getTrailFor(this);

    if (trail.state.useOtelExperience) {
      await updateOtelJoinWithGroupLeft(trail, trail.state.metric ?? '');
    }
  }

  public static Component = ({ model }: SceneComponentProps<MetricOverviewScene>) => {
    const { metadata, metadataLoading } = model.useState();
    const variable = model.getVariable();
    const { loading: labelsLoading, options: labelOptions } = variable.useState();

    let allLabelOptions = labelOptions;

    const trail = getTrailFor(model);
    const { useOtelExperience } = trail.useState();

    if (useOtelExperience) {
      // when the group left variable is changed we should get all the resource attributes + labels
      const resourceAttributes = sceneGraph.lookupVariable(VAR_OTEL_GROUP_LEFT, trail)?.getValue();
      if (typeof resourceAttributes === 'string') {
        const attributeArray: VariableValueOption[] = resourceAttributes.split(',').map((el) => {
          let label = el;
          if (!isValidLegacyName(el)) {
            // remove '' from label
            label = el.slice(1, -1);
          }
          return { label, value: el };
        });
        allLabelOptions = attributeArray.concat(allLabelOptions);
      }
    }

    useEffect(() => {
      if (useOtelExperience) {
        // this will update the group left variable
        model.updateOtelGroupLeft();
      }
    }, [model, useOtelExperience]);

    // Get unit name from the metric name
    const metricScene = getMetricSceneFor(model);
    const metric = metricScene.state.metric;
    let unit = getUnitFromMetric(metric) ?? 'Unknown';
    return (
      <StatusWrapper isLoading={labelsLoading || metadataLoading}>
        <Stack gap={6}>
          <>
            <Stack direction="column" gap={0.5}>
              <Text weight={'medium'}>Description</Text>
              <div style={{ maxWidth: 360 }}>
                {metadata?.help ? <div>{metadata?.help}</div> : <i>No description available</i>}
              </div>
            </Stack>
            <Stack direction="column" gap={0.5}>
              <Text weight={'medium'}>Type</Text>
              {metadata?.type ? <div>{metadata?.type}</div> : <i>Unknown</i>}
            </Stack>
            <Stack direction="column" gap={0.5}>
              <Text weight={'medium'}>Unit</Text>
              {metadata?.unit ? <div>{metadata?.unit}</div> : <i>{unit}</i>}
            </Stack>
            <Stack direction="column" gap={0.5}>
              <Text weight={'medium'}>{useOtelExperience ? 'Attributes' : 'Labels'}</Text>
              {allLabelOptions.length === 0 && 'Unable to fetch labels.'}
              {allLabelOptions.map((l) => (
                <TextLink
                  key={l.label}
                  href={`#View breakdown for ${l.label}`}
                  title={`View breakdown for ${l.label}`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    sceneGraph.getAncestor(model, MetricScene).setActionView('breakdown');
                    const groupByVar = sceneGraph.lookupVariable(VAR_GROUP_BY, model);
                    if (isQueryVariable(groupByVar) && l.label != null) {
                      reportExploreMetrics('label_selected', { label: l.label, cause: 'overview_link' });
                      groupByVar.setState({ value: l.value });
                    }
                    return false;
                  }}
                >
                  {l.label!}
                </TextLink>
              ))}
            </Stack>
          </>
        </Stack>
      </StatusWrapper>
    );
  };
}

export function buildMetricOverviewScene() {
  return new MetricOverviewScene({});
}
