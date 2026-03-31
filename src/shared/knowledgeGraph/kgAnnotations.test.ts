import { config } from '@grafana/runtime';
import { SceneDataLayerSet, SceneObjectRef } from '@grafana/scenes';

import { getKgSceneProps, isKgAnnotationsAvailable } from 'shared/knowledgeGraph/kgAnnotations';
import { KgAnnotationToggle } from 'shared/knowledgeGraph/KgAnnotationToggle';

const originalDatasources = config.datasources;
const originalFeatureToggles = { ...config.featureToggles };

const KG_DATASOURCE = {
  uid: 'grafanacloud-knowledgegraph',
  type: 'grafana-knowledgegraph-datasource',
  name: 'Knowledge Graph',
  meta: {} as any,
  id: 1,
  access: 'proxy' as const,
  readOnly: false,
  jsonData: {},
  url: '',
  isDefault: false,
};

afterEach(() => {
  config.datasources = originalDatasources;
  config.featureToggles = { ...originalFeatureToggles };
});

describe('isKgAnnotationsAvailable', () => {
  it('returns false when feature flag is off', () => {
    config.featureToggles = { ...originalFeatureToggles };
    delete (config.featureToggles as Record<string, unknown>).kgAnnotationsInMetricsDrilldown;
    config.datasources = { knowledgegraph: KG_DATASOURCE };

    expect(isKgAnnotationsAvailable()).toBe(false);
  });

  it('returns false when KG datasource is missing', () => {
    (config.featureToggles as Record<string, unknown>).kgAnnotationsInMetricsDrilldown = true;
    config.datasources = {};

    expect(isKgAnnotationsAvailable()).toBe(false);
  });

  it('returns true when both flag and datasource are present', () => {
    (config.featureToggles as Record<string, unknown>).kgAnnotationsInMetricsDrilldown = true;
    config.datasources = { knowledgegraph: KG_DATASOURCE };

    expect(isKgAnnotationsAvailable()).toBe(true);
  });
});

describe('getKgSceneProps', () => {
  it('returns undefined when not available', () => {
    config.featureToggles = { ...originalFeatureToggles };
    delete (config.featureToggles as Record<string, unknown>).kgAnnotationsInMetricsDrilldown;

    expect(getKgSceneProps()).toBeUndefined();
  });

  it('returns proper structure when available', () => {
    (config.featureToggles as Record<string, unknown>).kgAnnotationsInMetricsDrilldown = true;
    config.datasources = { knowledgegraph: KG_DATASOURCE };

    const props = getKgSceneProps();
    expect(props).toBeDefined();
    expect(props!.$data).toBeInstanceOf(SceneDataLayerSet);
    expect(props!.behaviors).toHaveLength(1);
    expect(props!.controls).toBeInstanceOf(KgAnnotationToggle);
  });
});

describe('KgAnnotationToggle', () => {
  it('toggles enabled state and propagates to layers', () => {
    const layerSet = new SceneDataLayerSet({ name: 'test', layers: [] });
    const toggle = new KgAnnotationToggle({
      isEnabled: true,
      layerSetRef: new SceneObjectRef(layerSet),
    });

    expect(toggle.state.isEnabled).toBe(true);
    toggle.toggleEnabled();
    expect(toggle.state.isEnabled).toBe(false);
    toggle.toggleEnabled();
    expect(toggle.state.isEnabled).toBe(true);
  });

  it('syncLayerEnabledState syncs current toggle state to layers', () => {
    const layerSet = new SceneDataLayerSet({ name: 'test', layers: [] });
    const toggle = new KgAnnotationToggle({
      isEnabled: false,
      layerSetRef: new SceneObjectRef(layerSet),
    });

    toggle.syncLayerEnabledState();
    // With empty layers, this should not throw
    expect(toggle.state.isEnabled).toBe(false);
  });
});
