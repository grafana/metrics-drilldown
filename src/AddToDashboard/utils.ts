import { sceneGraph , type VizPanel } from '@grafana/scenes';
import { type Panel } from '@grafana/schema';

import { type PanelDataRequestPayload } from 'shared';
import { getQueryRunnerFor } from 'utils/utils.queries';

export function getPanelData(vizPanel: VizPanel): PanelDataRequestPayload {
  const queryRunner = getQueryRunnerFor(vizPanel);
    
  // Get the time range from the scene
  const timeRange = sceneGraph.getTimeRange(vizPanel);
  // DTO (dashboard transfer object) in Grafana requires raw timerange
  const range = timeRange.state.value;
  
  const panel: Panel = {
    // Panel basic info from VizPanel
    type: vizPanel.state.pluginId,
    title: vizPanel.state.title ? sceneGraph.interpolate(vizPanel, vizPanel.state.title) : vizPanel.state.title,
    
    // Targets (queries) from QueryRunner with interpolated variables
    targets: queryRunner?.state.queries?.map((query) => ({
      ...query,
      expr: query.expr ? sceneGraph.interpolate(vizPanel, query.expr) : query.expr,
      legendFormat: query.legendFormat ? sceneGraph.interpolate(vizPanel, query.legendFormat) : query.legendFormat,
      // remove the field fromExploreMetrics from the query because this will become a panel in the dashboard
      fromExploreMetrics: false,
    })) || [],
    
    // Datasource from QueryRunner with interpolated variables
    datasource: queryRunner?.state.datasource ? {
      ...queryRunner.state.datasource,
      uid: queryRunner.state.datasource.uid ? sceneGraph.interpolate(vizPanel, queryRunner.state.datasource.uid) : queryRunner.state.datasource.uid
    } : queryRunner?.state.datasource,
    
    // Panel options from VizPanel
    options: vizPanel.state.options,
    
    // Field configuration from VizPanel
    fieldConfig: vizPanel.state.fieldConfig as any,
    
    // Additional properties from VizPanel
    ...(vizPanel.state.description && { description: vizPanel.state.description }),
    ...(queryRunner?.state.maxDataPoints && { maxDataPoints: queryRunner.state.maxDataPoints }),
  };
  return { panel, range }
}
