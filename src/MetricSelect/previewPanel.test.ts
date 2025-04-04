import { type AdHocVariableFilter } from '@grafana/data';
import { SceneCSSGridItem, sceneGraph, SceneQueryRunner, type AdHocFiltersVariable } from '@grafana/scenes';

import { VAR_FILTERS } from 'shared';

import { getPreviewPanelFor, PreviewPanel } from './PreviewPanel';

describe('getPreviewPanelFor', () => {
  const sceneGraphSpy = jest.spyOn(sceneGraph, 'lookupVariable');
  const createAdHocVariableStub = (filters: AdHocVariableFilter[]) => {
    return {
      __typename: 'AdHocFiltersVariable',
      state: {
        name: VAR_FILTERS,
        type: 'adhoc',
        filters,
      },
    } as unknown as AdHocFiltersVariable;
  };

  function setVariables(variables: AdHocVariableFilter[] | null) {
    sceneGraphSpy.mockReturnValue(variables ? createAdHocVariableStub(variables) : null);
  }

  beforeEach(() => {
    sceneGraphSpy.mockClear();
  });
  describe('includes __ignore_usage__ indicator', () => {
    const metricName = 'METRIC';

    function callAndGetExpr() {
      const gridItem = getPreviewPanelFor(metricName, 0, false);
      expect(gridItem).toBeInstanceOf(SceneCSSGridItem);
      const previewPanel = gridItem.state.body as PreviewPanel;
      expect(previewPanel).toBeInstanceOf(PreviewPanel);
      const runner = previewPanel.state.$data as SceneQueryRunner;
      expect(runner).toBeInstanceOf(SceneQueryRunner);
      const query = runner.state.queries[0];
      const expr = query.expr as string;

      return expr;
    }

    test('When there are no filters, only the __ignore_usage__ label is added', () => {
      setVariables([]);
      const expected = `avg(${metricName}{__ignore_usage__=""})`;
      const expr = callAndGetExpr();
      expect(expr).toBe(expected);
    });

    test('When there are 1 or more filters, they are appended after the __ignore_usage__ label', () => {
      setVariables([
        { key: 'filter1', value: 'value1', operator: '=' },
        { key: 'filter2', value: 'value2', operator: '=' },
      ]);
      const expected = `avg(${metricName}{__ignore_usage__="", filter1="value1", filter2="value2"})`;
      const expr = callAndGetExpr();
      expect(expr).toBe(expected);
    });
  });
});
