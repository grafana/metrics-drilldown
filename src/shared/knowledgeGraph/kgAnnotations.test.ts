import { getDataSourceInstanceList } from '@grafana/plugin-compat/datasources';
import { dataLayers, SceneDataLayerSet, SceneObjectRef } from '@grafana/scenes';

import { getKgSceneProps, isKgAnnotationsAvailable } from 'shared/knowledgeGraph/kgAnnotations';
import { KgAnnotationToggle } from 'shared/knowledgeGraph/KgAnnotationToggle';
import { isKnowledgeGraphDataSource } from 'shared/utils/utils.datasource';

jest.mock('@grafana/plugin-compat/datasources', () => ({
  getDataSourceInstanceList: jest.fn(),
}));

const getDataSourceInstanceListMock = jest.mocked(getDataSourceInstanceList);

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

beforeEach(() => {
  jest.resetAllMocks();
  getDataSourceInstanceListMock.mockResolvedValue([]);
});

describe('isKgAnnotationsAvailable', () => {
  it('returns false when KG datasource is missing', async () => {
    getDataSourceInstanceListMock.mockResolvedValue([]);

    expect(await isKgAnnotationsAvailable()).toBe(false);
    expect(getDataSourceInstanceListMock).toHaveBeenCalledWith({ all: true, filter: isKnowledgeGraphDataSource });
  });

  it('returns true when KG datasource is present', async () => {
    getDataSourceInstanceListMock.mockResolvedValue([KG_DATASOURCE]);

    expect(await isKgAnnotationsAvailable()).toBe(true);
    expect(getDataSourceInstanceListMock).toHaveBeenCalledWith({ all: true, filter: isKnowledgeGraphDataSource });
  });
});

describe('getKgSceneProps', () => {
  it('returns undefined when KG datasource is missing', async () => {
    getDataSourceInstanceListMock.mockResolvedValue([]);

    expect(await getKgSceneProps()).toBeUndefined();
  });

  it('returns proper structure when KG datasource is present', async () => {
    getDataSourceInstanceListMock.mockResolvedValue([KG_DATASOURCE]);

    const props = await getKgSceneProps();
    expect(props).toBeDefined();
    expect(props!.$data).toBeInstanceOf(SceneDataLayerSet);
    expect(props!.behaviors).toHaveLength(1);
    expect(props!.controls).toBeInstanceOf(KgAnnotationToggle);
  });
});

function makeLayerSet(isEnabled: boolean) {
  const layer = new dataLayers.AnnotationsDataLayer({ name: 'test-layer', isEnabled, query: {} as any });
  const layerSet = new SceneDataLayerSet({ name: 'test', layers: [layer] });
  return { layer, layerSet };
}

describe('KgAnnotationToggle', () => {
  it('toggles enabled state and propagates to layers', () => {
    const { layer, layerSet } = makeLayerSet(true);
    const toggle = new KgAnnotationToggle({
      isEnabled: true,
      layerSetRef: new SceneObjectRef(layerSet),
    });

    toggle.toggleEnabled();
    expect(toggle.state.isEnabled).toBe(false);
    expect(layer.state.isEnabled).toBe(false);

    toggle.toggleEnabled();
    expect(toggle.state.isEnabled).toBe(true);
    expect(layer.state.isEnabled).toBe(true);
  });

  it('syncLayerEnabledState syncs current toggle state to layers', () => {
    const { layer, layerSet } = makeLayerSet(true);
    const toggle = new KgAnnotationToggle({
      isEnabled: false,
      layerSetRef: new SceneObjectRef(layerSet),
    });

    toggle.syncLayerEnabledState();
    expect(layer.state.isEnabled).toBe(false);
  });

  // KgAnnotationBehavior reactive tests (filter/datasource subscriptions, layer creation, dedup)
  // are not covered here. The behavior relies on sceneGraph.lookupVariable which requires a
  // fully mounted scene tree with AdHocFiltersVariable and a datasource variable wired up.
  // This needs a dedicated integration-style test with scene activation -- deferred to a follow-up.
});
