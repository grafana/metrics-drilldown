import { dataLayers, SceneDataLayerSet } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';

export type KgEntityScope = {
  env?: string;
  site?: string;
  namespace?: string;
};

export type KgEntityConfig = {
  datasourceUid: string;
  entityType: string;
  entityName: string;
  entityScope?: KgEntityScope;
};

const SEVERITY_LAYERS = [
  { severity: 'critical', name: 'Asserts Critical', iconColor: 'red', refId: 'kgAnnotations-critical' },
  { severity: 'warning', name: 'Asserts Warning', iconColor: 'orange', refId: 'kgAnnotations-warning' },
  { severity: 'info', name: 'Asserts Info', iconColor: 'blue', refId: 'kgAnnotations-info' },
] as const;

export function buildKgAnnotationsLayer({
  datasourceUid,
  entityType,
  entityName,
  entityScope,
}: KgEntityConfig): SceneDataLayerSet {
  const advancedQuery = {
    filterCriteria: [
      {
        entityType,
        propertyMatchers: [{ id: -1, name: 'name', op: '=', value: entityName, type: 'String' }],
        connectToEntityTypes: [],
        havingAssertion: false,
      },
    ],
    ...(entityScope
      ? {
          scopeCriteria: {
            nameAndValues: {
              env: entityScope.env ? [entityScope.env] : undefined,
              site: entityScope.site ? [entityScope.site] : undefined,
              namespace: entityScope.namespace ? [entityScope.namespace] : undefined,
            },
          },
        }
      : {}),
  };

  return new SceneDataLayerSet({
    layers: SEVERITY_LAYERS.map(
      ({ severity, name, iconColor, refId }) =>
        new dataLayers.AnnotationsDataLayer({
          name,
          isEnabled: true,
          query: {
            name,
            enable: true,
            iconColor,
            datasource: { type: 'grafana-knowledgegraph-datasource', uid: datasourceUid },
            target: {
              refId,
              queryType: 'annotations',
              queryMode: 'advanced',
              severity,
              advancedQuery,
            } as unknown as DataQuery,
          },
        })
    ),
  });
}
