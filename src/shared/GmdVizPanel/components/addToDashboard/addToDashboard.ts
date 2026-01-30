import { type TimeRange } from '@grafana/data';
import { sceneGraph, type VizPanel } from '@grafana/scenes';
import { type Panel } from '@grafana/schema';

import { isSceneQueryRunner, removeIgnoreUsageLabel } from 'shared/utils/utils.queries';

export function getPanelData(vizPanel: VizPanel): PanelDataRequestPayload {
  const data = sceneGraph.getData(vizPanel);
  const queryRunner = sceneGraph.findObject(data, isSceneQueryRunner);

  // Get the time range from the scene
  const timeRange = sceneGraph.getTimeRange(vizPanel);
  // DTO (dashboard transfer object) in Grafana requires raw timerange
  const range = timeRange.state.value;

  let targets: any[] = [];
  let datasource;
  let maxDataPoints;

  if (isSceneQueryRunner(queryRunner)) {
    // Targets (queries) from QueryRunner with interpolated variables and __ignore_usage__ removed
    targets = queryRunner.state.queries?.map((query) => ({
      ...query,
      expr: query.expr ? removeIgnoreUsageLabel(sceneGraph.interpolate(vizPanel, query.expr)) : query.expr,
      legendFormat: query.legendFormat ? sceneGraph.interpolate(vizPanel, query.legendFormat) : query.legendFormat,
      // remove the field fromExploreMetrics from the query because this will become a panel in the dashboard
      fromExploreMetrics: false,
    })) || [];

    // Datasource from QueryRunner with interpolated variables
    datasource = queryRunner.state.datasource
      ? {
          ...queryRunner.state.datasource,
          uid: queryRunner.state.datasource.uid
            ? sceneGraph.interpolate(vizPanel, queryRunner.state.datasource.uid)
            : queryRunner.state.datasource.uid,
        }
      : queryRunner.state.datasource;

    maxDataPoints = queryRunner.state.maxDataPoints;
  }

  const panel: Panel = {
    // Panel basic info from VizPanel
    type: vizPanel.state.pluginId,
    title: vizPanel.state.title ? sceneGraph.interpolate(vizPanel, vizPanel.state.title) : vizPanel.state.title,

    // Targets (queries) from QueryRunner with interpolated variables
    targets,

    // Datasource from QueryRunner with interpolated variables
    datasource,

    // Panel options from VizPanel
    options: vizPanel.state.options,

    // Field configuration from VizPanel
    fieldConfig: vizPanel.state.fieldConfig as any,

    // Additional properties from VizPanel
    ...(vizPanel.state.description && { description: vizPanel.state.description }),
    ...(maxDataPoints && { maxDataPoints }),
  };
  return { panel, range };
}

export interface PanelDataRequestPayload {
  panel: Panel;
  range: TimeRange;
}
