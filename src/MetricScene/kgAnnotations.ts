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

export function buildKgAnnotationsLayer({
  datasourceUid,
  entityType,
  entityName,
  entityScope,
}: KgEntityConfig): SceneDataLayerSet {
  return new SceneDataLayerSet({
    layers: [
      new dataLayers.AnnotationsDataLayer({
        name: 'Asserts Insights',
        isEnabled: true,
        query: {
          name: 'Asserts Insights',
          enable: true,
          iconColor: 'red',
          datasource: { type: 'grafana-knowledgegraph-datasource', uid: datasourceUid },
          target: {
            refId: 'kgAnnotations',
            queryType: 'annotations',
            queryMode: 'advanced',
            advancedQuery: {
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
            },
          } as unknown as DataQuery,
        },
      }),
    ],
  });
}
