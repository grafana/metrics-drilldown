import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import {
  dataLayers,
  SceneDataLayerSet,
  sceneGraph,
  SceneObjectBase,
  SceneObjectRef,
  type AdHocFiltersVariable,
  type SceneObjectState,
} from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';

import { KgAnnotationToggle } from 'shared/knowledgeGraph/KgAnnotationToggle';
import { VAR_DATASOURCE, VAR_FILTERS } from 'shared/shared';

const KG_DATASOURCE_TYPE = 'grafana-knowledgegraph-datasource';
const KG_DATASOURCE_UID = 'grafanacloud-knowledgegraph';

export interface KgEntityHint {
  entityType: string;
  entityName: string;
  scope?: { env?: string; site?: string; namespace?: string };
}

interface KgSceneProps {
  $data: SceneDataLayerSet;
  behaviors: KgAnnotationBehavior[];
  controls: KgAnnotationToggle;
}

export function isKgAnnotationsAvailable(): boolean {
  return Object.values(config.datasources).some((d) => d.uid === KG_DATASOURCE_UID && d.type === KG_DATASOURCE_TYPE);
}

function getSeverities() {
  return [
    { value: 'critical', color: 'red', label: t('kg-annotations.severity.critical', 'Critical') },
    { value: 'warning', color: 'orange', label: t('kg-annotations.severity.warning', 'Warning') },
    { value: 'info', color: 'blue', label: t('kg-annotations.severity.info', 'Info') },
  ];
}

function createFromLabelsAnnotationLayers(labels: Record<string, string>, datasourceUid: string) {
  return getSeverities().map(
    (s) =>
      new dataLayers.AnnotationsDataLayer({
        name: t('kg-annotations.layer.name', 'Insights - {{severityLabel}}', { severityLabel: s.label }),
        isEnabled: true,
        isHidden: true,
        query: {
          datasource: { type: KG_DATASOURCE_TYPE, uid: KG_DATASOURCE_UID },
          enable: true,
          iconColor: s.color,
          name: t('kg-annotations.query.name', 'KG Assertions - {{severityLabel}}', { severityLabel: s.label }),
          target: {
            refId: `kgAnnotations-${s.value}`,
            queryType: 'annotations',
            queryMode: 'fromLabels',
            severityFilter: [s.value],
            fromLabelsQuery: {
              telemetryType: 'metric',
              datasourceUid,
              labels,
            },
          } as unknown as DataQuery,
        },
      })
  );
}

function createDirectAnnotationLayers(entity: KgEntityHint) {
  return getSeverities().map(
    (s) =>
      new dataLayers.AnnotationsDataLayer({
        name: t('kg-annotations.layer.name', 'Insights - {{severityLabel}}', { severityLabel: s.label }),
        isEnabled: true,
        isHidden: true,
        query: {
          datasource: { type: KG_DATASOURCE_TYPE, uid: KG_DATASOURCE_UID },
          enable: true,
          iconColor: s.color,
          name: t('kg-annotations.query.name', 'KG Assertions - {{severityLabel}}', { severityLabel: s.label }),
          target: {
            refId: `kgAnnotations-${s.value}`,
            queryType: 'annotations',
            queryMode: 'advanced',
            severityFilter: [s.value],
            advancedQuery: {
              filterCriteria: [
                {
                  entityType: entity.entityType,
                  propertyMatchers: [{ name: 'name', value: entity.entityName, op: '=' }],
                  havingAssertion: true,
                },
              ],
              ...(entity.scope
                ? {
                    scopeCriteria: {
                      nameAndValues: {
                        ...(entity.scope.env ? { env: [entity.scope.env] } : {}),
                        ...(entity.scope.site ? { site: [entity.scope.site] } : {}),
                        ...(entity.scope.namespace ? { namespace: [entity.scope.namespace] } : {}),
                      },
                    },
                  }
                : {}),
            },
          } as unknown as DataQuery,
        },
      })
  );
}

interface KgAnnotationBehaviorState extends SceneObjectState {
  layerSet: SceneObjectRef<SceneDataLayerSet>;
  toggle: SceneObjectRef<KgAnnotationToggle>;
}

export class KgAnnotationBehavior extends SceneObjectBase<KgAnnotationBehaviorState> {
  private currentLookupKey: string | undefined;

  constructor(state: KgAnnotationBehaviorState) {
    super(state);
    this.addActivationHandler(this._onActivate);
  }

  private _onActivate = () => {
    const filtersVar = sceneGraph.lookupVariable(VAR_FILTERS, this) as AdHocFiltersVariable | undefined;
    if (!filtersVar) {
      return;
    }

    const dsVar = sceneGraph.lookupVariable(VAR_DATASOURCE, this);

    this.onFiltersChanged(filtersVar, dsVar);

    const subs = [
      filtersVar.subscribeToState(() => {
        this.onFiltersChanged(filtersVar, dsVar);
      }),
    ];

    if (dsVar) {
      subs.push(
        dsVar.subscribeToState(() => {
          this.onFiltersChanged(filtersVar, dsVar);
        })
      );
    }

    return () => {
      subs.forEach((s) => s.unsubscribe());
    };
  };

  private onFiltersChanged(
    filtersVar: AdHocFiltersVariable,
    dsVar: ReturnType<typeof sceneGraph.lookupVariable> | undefined
  ) {
    const filters = filtersVar.state.filters.filter((f) => f.operator === '=');
    const labels: Record<string, string> = {};
    for (const f of filters) {
      labels[f.key] = f.value;
    }

    const datasourceUid = (dsVar?.getValue() as string) || '';
    const lookupKey = `${datasourceUid}::${JSON.stringify(labels)}`;
    const hasLabels = Object.keys(labels).length > 0;

    // Only deduplicate when we have labels — always allow the clear path to run
    // so that stale annotation data is removed when filters are emptied
    if (lookupKey === this.currentLookupKey && hasLabels) {
      return;
    }
    this.currentLookupKey = lookupKey;

    const layerSet = this.state.layerSet.resolve();
    const toggle = this.state.toggle.resolve();

    if (hasLabels && datasourceUid) {
      const layers = createFromLabelsAnnotationLayers(labels, datasourceUid);
      layerSet.setState({ layers });
      toggle.syncLayerEnabledState();
    } else {
      layerSet.setState({ layers: [] });
    }
  }
}

export function getKgSceneProps(entity?: KgEntityHint): KgSceneProps | undefined {
  if (!isKgAnnotationsAvailable()) {
    return undefined;
  }

  const layerSet = new SceneDataLayerSet({ name: 'Insights', layers: [] });

  const toggle = new KgAnnotationToggle({
    isEnabled: true,
    layerSetRef: new SceneObjectRef(layerSet),
  });

  if (entity) {
    // Direct entity query — layers are created upfront, no filter subscription needed
    const layers = createDirectAnnotationLayers(entity);
    layerSet.setState({ layers });
    return {
      $data: layerSet,
      behaviors: [],
      controls: toggle,
    };
  }

  // Fallback — watch filters and resolve entities via fromLabels
  const behavior = new KgAnnotationBehavior({
    layerSet: new SceneObjectRef(layerSet),
    toggle: new SceneObjectRef(toggle),
  });

  return {
    $data: layerSet,
    behaviors: [behavior],
    controls: toggle,
  };
}
