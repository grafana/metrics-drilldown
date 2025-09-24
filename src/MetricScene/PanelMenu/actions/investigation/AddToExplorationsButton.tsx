import { type DataFrame, type FieldConfig, type FieldConfigSource, type TimeRange } from '@grafana/data';
import { usePluginLinks } from '@grafana/runtime';
import {
  sceneGraph,
  SceneObjectBase,
  VizPanel,
  type SceneComponentProps,
  type SceneObjectState,
} from '@grafana/scenes';
import { type DataQuery, type DataSourceRef } from '@grafana/schema';
import { IconButton } from '@grafana/ui';
import React from 'react';

import MimirLogo from 'img/logo.svg';
import { findObjectOfType } from 'shared/utils/utils';

import pluginJson from '../../../../plugin.json';
import { VAR_DATASOURCE_EXPR } from '../../../../shared/shared';
import { isSceneQueryRunner } from '../../../../shared/utils/utils.queries';

export const investigationsPluginId = 'grafana-investigations-app';
export const extensionPointId = `${pluginJson.id}/investigation/v1`;
export const addToExplorationsButtonLabel = 'add panel to exploration';

interface AddToExplorationButtonState extends SceneObjectState {
  frame?: DataFrame;
  dsUid?: string;
  labelName?: string;
  fieldName?: string;
  context?: ExtensionContext;

  queries: DataQuery[];
  fieldConfig?: FieldConfigSource;
}

interface ExtensionContext {
  timeRange: TimeRange;
  queries: DataQuery[];
  datasource: DataSourceRef;
  origin: string;
  url: string;
  type: string;
  title: string;
  id: string;
  logoPath: string;
  note?: string;
  drillDownLabel?: string;
}

export class AddToExplorationButton extends SceneObjectBase<AddToExplorationButtonState> {
  constructor(state: Omit<AddToExplorationButtonState, 'queries'>) {
    super({ ...state, queries: [] });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private _onActivate = () => {
    this.subscribeToState(() => {
      this.getQueries();
      this.getContext();
    });

    const datasourceUid = sceneGraph.interpolate(this, VAR_DATASOURCE_EXPR);
    this.setState({ dsUid: datasourceUid });
  };

  private readonly getQueries = () => {
    const data = sceneGraph.getData(this);
    const queryRunner = sceneGraph.findObject(data, isSceneQueryRunner);

    if (isSceneQueryRunner(queryRunner)) {
      const filter = this.state.frame ? getFilter(this.state.frame) : null;
      const queries = queryRunner.state.queries.map((q) => ({
        ...q,
        expr: sceneGraph.interpolate(queryRunner, q.expr),
        legendFormat: filter?.name ? `{{ ${filter.name} }}` : sceneGraph.interpolate(queryRunner, q.legendFormat),
      }));

      if (JSON.stringify(queries) !== JSON.stringify(this.state.queries)) {
        this.setState({ queries });
      }
    }
  };

  private getPanelConfigAndDataFrames() {
    const panel = findObjectOfType(this, (o) => o instanceof VizPanel, VizPanel);
    const data = sceneGraph.getData(this);

    return {
      fieldConfig: panel?.state.fieldConfig,
      frames: data?.state.data?.series,
    };
  }

  private readonly updateFieldConfigOverrides = () => {
    const { fieldConfig, frames } = this.getPanelConfigAndDataFrames();

    if (!fieldConfig || !frames?.length) {
      return undefined;
    }

    for (const frame of frames) {
      for (const field of frame.fields) {
        const configKeys = Object.keys(field.config);
        const properties = configKeys.map((key) => ({
          id: key,
          value: field.config[key as keyof FieldConfig],
        }));

        // check if the override already exists
        const existingOverride = fieldConfig.overrides.find(
          (o) =>
            o.matcher.options === (field.config.displayNameFromDS ?? field.config.displayName ?? field.name) &&
            o.matcher.id === 'byName'
        );

        if (!existingOverride) {
          // add as first override
          fieldConfig.overrides.unshift({
            matcher: {
              id: 'byName',
              options: field.config.displayNameFromDS ?? field.config.displayName ?? field.name,
            },
            properties,
          });
        }

        if (existingOverride && JSON.stringify(existingOverride.properties) !== JSON.stringify(properties)) {
          existingOverride.properties = properties;
        }
      }
    }

    return fieldConfig;
  };

  private readonly getContext = () => {
    const fieldConfig = this.updateFieldConfigOverrides();
    const { queries, dsUid, labelName, fieldName } = this.state;
    const timeRange = sceneGraph.getTimeRange(this);

    if (!timeRange || !queries || !dsUid) {
      return;
    }
    const ctx = {
      origin: 'Metrics Drilldown',
      type: 'timeseries',
      queries,
      timeRange: { ...timeRange.state.value },
      datasource: { uid: dsUid },
      url: window.location.href,
      id: `${JSON.stringify(queries)}${labelName}${fieldName}`,
      title: labelName + (fieldName ? ` > ${fieldName}` : ''),
      logoPath: MimirLogo,
      drillDownLabel: fieldName,
      fieldConfig,
    };
    if (JSON.stringify(ctx) !== JSON.stringify(this.state.context)) {
      this.setState({ context: ctx });
    }
  };

  public static readonly Component = ({ model }: SceneComponentProps<AddToExplorationButton>) => {
    const { context } = model.useState();
    const { links } = usePluginLinks({ extensionPointId, context, limitPerPlugin: 1 });
    const link = links.find((link) => link.pluginId === investigationsPluginId);

    if (!link) {
      return null;
    }

    return (
      <IconButton
        tooltip={link.description}
        aria-label={addToExplorationsButtonLabel} // this is overriden by the `tooltip`
        key={link.id}
        name={link.icon ?? 'panel-add'}
        onClick={(e) => {
          if (link.onClick) {
            link.onClick(e);
          }
        }}
      />
    );
  };
}

const getFilter = (frame: DataFrame) => {
  const filterNameAndValueObj = frame.fields[1]?.labels ?? {};
  const keys = Object.keys(filterNameAndValueObj);
  if (keys.length !== 1) {
    return;
  }
  const name = keys[0];
  return { name, value: filterNameAndValueObj[name] };
};
