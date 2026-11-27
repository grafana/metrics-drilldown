import { availableIconsIndex } from '@grafana/data';
import { AdHocFiltersVariable, EmbeddedScene, SceneFlexItem, SceneFlexLayout, SceneVariableSet } from '@grafana/scenes';

import { evaluateFeatureFlag } from 'shared/featureFlags/openFeature';
import { VAR_FILTERS } from 'shared/shared';
import { getTrailFor } from 'shared/utils/utils';

import { ServiceFilterSection } from '../sections/ServiceFilterSection/ServiceFilterSection';
import { SideBar } from '../SideBar';

jest.mock('shared/featureFlags/openFeature', () => ({ evaluateFeatureFlag: jest.fn() }));

// The actual module imports the DataTrail, which imports the SideBar
jest.mock('shared/utils/utils', () => ({
  embeddedTrailNamespace: 'gmd',
  getObjectValues: Object.values,
  getTrailFor: jest.fn(),
}));

const mockEvaluateFeatureFlag = evaluateFeatureFlag as jest.Mock;
const mockGetTrailFor = getTrailFor as jest.Mock;

describe('SideBar sections', () => {
  const sections = new SideBar({}).state.sections;

  it('lists the category filter first', () => {
    expect(sections[0].state.key).toBe('filters-category');
  });

  it('uses the OpenTelemetry icon for the category filter, and the icon exists', () => {
    const icon = sections[0].state.icon;

    expect(icon).toBe('open-telemetry');
    expect(icon in availableIconsIndex).toBe(true);
  });

  it('lists the service filter right after the category filter, with an icon that exists', () => {
    const section = sections[1];

    expect(section).toBeInstanceOf(ServiceFilterSection);
    expect(section.state.key).toBe('filters-service');
    expect(section.state.icon in availableIconsIndex).toBe(true);
  });

  it('keeps the other filters in their order after the service filter', () => {
    expect(sections.map((section) => section.state.key)).toEqual([
      'filters-category',
      'filters-service',
      'filters-rule',
      'filters-prefix',
      'filters-suffix',
      'filters-recent',
      'groupby-labels',
      'bookmarks',
    ]);
  });
});

describe('SideBar service filter', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/');
    jest.restoreAllMocks();
  });

  describe('selection in the URL', () => {
    it('is inactive without a selection', () => {
      const sidebar = new SideBar({});

      expect(sidebar.state.sectionValues.get('filters-service')).toEqual([]);
      expect(sidebar.state.sections[1].state.active).toBe(false);
    });

    it('lists the selected jobs for the button tooltip, and marks the section active', () => {
      window.history.pushState({}, '', '/?filters-service-job=shop%2Fcart,prod%2Fpayments');

      const sidebar = new SideBar({});

      expect(sidebar.state.sectionValues.get('filters-service')).toEqual(['shop/cart', 'prod/payments']);
      expect(sidebar.state.sections[1].state.active).toBe(true);
    });

    it('ignores the key of the removed service_name tab that older URLs carry', () => {
      window.history.pushState({}, '', '/?filters-service=cart,checkout');

      const sidebar = new SideBar({});

      expect(sidebar.state.sectionValues.get('filters-service')).toEqual([]);
      expect(sidebar.state.sections[1].state.active).toBe(false);
    });

    it('keeps a comma inside a selected value', () => {
      window.history.pushState({}, '', '/?filters-service-job=a%5C%2Cb,ns%2Fx%5C%2Cy');

      const sidebar = new SideBar({});

      expect(sidebar.state.sectionValues.get('filters-service')).toEqual(['a,b', 'ns/x,y']);
    });

    it('marks the section active for a job selection alone', () => {
      window.history.pushState({}, '', '/?filters-service-job=prometheus');

      const sidebar = new SideBar({});

      expect(sidebar.state.sectionValues.get('filters-service')).toEqual(['prometheus']);
      expect(sidebar.state.sections[1].state.active).toBe(true);
    });

    it('reads the namespaced keys of the embedded mode', () => {
      window.history.pushState({}, '', '/?gmd-filters-service-job=shop%2Fcart');

      const sidebar = new SideBar({});

      expect(sidebar.state.sectionValues.get('filters-service')).toEqual(['shop/cart']);
    });

    it('does not turn the selection into a chip of the other metric filters', () => {
      window.history.pushState({}, '', '/?filters-service-job=shop%2Fcart&filters-prefix=http');

      const sidebar = new SideBar({});
      // The variables are an ancestor of the sidebar, like the ones of the DataTrail, so that the chips are found
      const trailVariables = new SceneVariableSet({ variables: [] });
      const scene = new EmbeddedScene({
        $variables: trailVariables,
        body: new SceneFlexLayout({ children: [new SceneFlexItem({ body: sidebar })] }),
      });
      mockGetTrailFor.mockReturnValue({ state: { $variables: trailVariables } });
      mockEvaluateFeatureFlag.mockResolvedValue('control');
      const deactivateScene = scene.activate();
      const deactivate = sidebar.activate();

      const otherMetricFilters = trailVariables.state.variables.find((v) => v.state.name === 'other_metric_filters');

      // The prefix selection shows as a chip, so the lookup works and the absence of the service chip is meaningful
      expect((otherMetricFilters as AdHocFiltersVariable).state.filters.map((f) => f.key)).toEqual(['filters-prefix']);

      deactivate();
      deactivateScene();
    });
  });

  describe('a sidebar built again when the user comes back from a metric', () => {
    // Scenes gives the new sidebar no URL state, while the URL and the top filters keep what the old one wrote
    function activateWithFilters(filters: AdHocFiltersVariable['state']['filters']) {
      const filtersVariable = new AdHocFiltersVariable({
        name: VAR_FILTERS,
        datasource: null,
        applyMode: 'manual',
        filters,
      });
      const trailVariables = new SceneVariableSet({ variables: [filtersVariable] });
      const sidebar = new SideBar({});
      const scene = new EmbeddedScene({
        $variables: trailVariables,
        body: new SceneFlexLayout({ children: [new SceneFlexItem({ body: sidebar })] }),
      });
      mockGetTrailFor.mockReturnValue({ state: { $variables: trailVariables } });
      mockEvaluateFeatureFlag.mockResolvedValue('control');
      const deactivateScene = scene.activate();
      const deactivate = sidebar.activate();

      return {
        sidebar,
        section: sidebar.state.sections[1] as ServiceFilterSection,
        filtersVariable,
        cleanup: () => {
          deactivate();
          deactivateScene();
        },
      };
    }

    it('takes back the filter that the top filters kept, with the choice to include all jobs', () => {
      window.history.pushState({}, '', '/?filters-service-job=shop%2Fcart&filters-service-more=1');

      const { section, sidebar, cleanup } = activateWithFilters([{ key: 'job', operator: '=~', value: 'shop/cart' }]);

      expect(section.state.selected.job).toEqual(['shop/cart']);
      expect(section.state.showExtras).toBe(true);
      expect(sidebar.state.sectionValues.get('filters-service')).toEqual(['shop/cart']);
      cleanup();
    });

    it('clears the button when the filter was deleted while the user was on a metric', () => {
      window.history.pushState({}, '', '/?filters-service-job=shop%2Fcart');

      const { section, sidebar, filtersVariable, cleanup } = activateWithFilters([]);

      expect(section.state.selected.job).toEqual([]);
      expect(filtersVariable.state.filters).toEqual([]);
      expect(sidebar.state.sectionValues.get('filters-service')).toEqual([]);
      cleanup();
    });
  });

  describe('keeping the selection and the top filters consistent', () => {
    it('starts watching the filters when the sidebar activates and stops when it deactivates', () => {
      const stopWatching = jest.fn();
      const watchFilters = jest.spyOn(ServiceFilterSection.prototype, 'watchFilters').mockReturnValue(stopWatching);
      mockGetTrailFor.mockReturnValue({ state: { $variables: new SceneVariableSet({ variables: [] }) } });
      mockEvaluateFeatureFlag.mockResolvedValue('control');

      const deactivate = new SideBar({}).activate();

      expect(watchFilters).toHaveBeenCalledTimes(1);
      expect(stopWatching).not.toHaveBeenCalled();

      deactivate();

      expect(stopWatching).toHaveBeenCalledTimes(1);
    });
  });
});
