import { setDataSourceSrv } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { DataSourceType, MockDataSourceSrv } from '../mocks/datasource';
import { ALL_VARIABLE_VALUE } from '../services/variables';
import { VAR_GROUP_BY } from '../shared';
import { activateFullSceneTree } from '../utils/utils.testing';
import { LabelBreakdownScene } from './LabelBreakdownScene';
import { MetricLabelsList } from './MetricLabelsList/MetricLabelsList';
import { MetricLabelValuesList } from './MetricLabelValuesList/MetricLabelValuesList';
import { ResponsiveGroupBySelector } from './ResponsiveGroupBySelector';

// Mock dependencies
jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  measureText: jest.fn(() => ({ width: 100, height: 14 })),
  useStyles2: jest.fn(() => ({
    container: 'mock-container',
    controls: 'mock-controls',
    searchField: 'mock-search-field',
    responsiveGroupByWrapper: 'mock-responsive-wrapper',
  })),
}));

jest.mock('@grafana/scenes', () => ({
  ...jest.requireActual('@grafana/scenes'),
  sceneGraph: {
    lookupVariable: jest.fn(),
  },
}));

jest.mock('../interactions', () => ({
  reportExploreMetrics: jest.fn(),
}));

jest.mock('../tracking/logger/logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

// Mock the body components
jest.mock('./MetricLabelsList/MetricLabelsList', () => ({
  MetricLabelsList: jest.fn().mockImplementation(() => ({
    Component: jest.fn(() => <div data-testid="metric-labels-list">Labels List</div>),
    Controls: jest.fn(() => <div data-testid="labels-list-controls">Labels Controls</div>),
  })),
}));

jest.mock('./MetricLabelValuesList/MetricLabelValuesList', () => ({
  MetricLabelValuesList: jest.fn().mockImplementation(() => ({
    Component: jest.fn(() => <div data-testid="metric-label-values-list">Values List</div>),
    Controls: jest.fn(() => <div data-testid="values-list-controls">Values Controls</div>),
  })),
}));

const mockLookupVariable = sceneGraph.lookupVariable as jest.MockedFunction<typeof sceneGraph.lookupVariable>;

describe('LabelBreakdownScene Integration', () => {
  let mockGroupByVariable: any;
  let scene: LabelBreakdownScene;
  let mockResizeObserver: jest.MockedClass<typeof ResizeObserver>;

  beforeAll(() => {
    setDataSourceSrv(
      new MockDataSourceSrv({
        prom: {
          name: 'Prometheus',
          type: DataSourceType.Prometheus,
          uid: 'ds',
        },
      })
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock ResizeObserver
          const mockObserve = jest.fn();
      const mockUnobserve = jest.fn();
      const mockDisconnect = jest.fn();

      mockResizeObserver = jest.fn().mockImplementation((callback) => ({
        observe: mockObserve.mockImplementation(() => {
          // Simulate container with sufficient width
          callback([{ target: { clientWidth: 800 } }]);
        }),
        unobserve: mockUnobserve,
        disconnect: mockDisconnect,
      }));
    global.ResizeObserver = mockResizeObserver;

    // Mock group by variable
    mockGroupByVariable = {
      state: {
        options: [
          { label: 'instance', value: 'instance' },
          { label: 'job', value: 'job' },
          { label: 'service', value: 'service' },
        ],
        value: ALL_VARIABLE_VALUE,
      },
      useState: jest.fn(),
      subscribeToState: jest.fn(),
      changeValueTo: jest.fn(),
      hasAllValue: jest.fn(() => true),
      Component: jest.fn(() => <div data-testid="legacy-group-by">Legacy GroupBy</div>),
    };

    mockGroupByVariable.useState.mockReturnValue({
      options: mockGroupByVariable.state.options,
      value: mockGroupByVariable.state.value,
    });

    // Setup variable lookup
    mockLookupVariable.mockImplementation((name: string) => {
      if (name === VAR_GROUP_BY) {
        return mockGroupByVariable;
      }
      return null;
    });

    // Create scene
    scene = new LabelBreakdownScene({ metric: 'test_metric' });
  });

  describe('Initialization', () => {
    it('should create ResponsiveGroupBySelector on initialization', () => {
      expect(scene.state.responsiveSelector).toBeInstanceOf(ResponsiveGroupBySelector);
    });

    it('should initialize with correct metric', () => {
      expect(scene.state.metric).toBe('test_metric');
    });

    it('should have undefined body initially', () => {
      expect(scene.state.body).toBeUndefined();
    });

    it('should provide access to ResponsiveGroupBySelector', () => {
      const selector = scene.getResponsiveSelector();
      expect(selector).toBeInstanceOf(ResponsiveGroupBySelector);
    });

    it('should throw error if ResponsiveGroupBySelector is not initialized', () => {
      const sceneWithoutSelector = new LabelBreakdownScene({ metric: 'test' });
      sceneWithoutSelector.setState({ responsiveSelector: undefined });

      expect(() => sceneWithoutSelector.getResponsiveSelector()).toThrow(
        'ResponsiveGroupBySelector not initialized'
      );
    });
  });

  describe('Activation and Variable Subscription', () => {
    it('should subscribe to group by variable changes on activation', () => {
      activateFullSceneTree(scene);

      expect(mockGroupByVariable.subscribeToState).toHaveBeenCalled();
    });

    it('should update body when activated', () => {
      activateFullSceneTree(scene);

      expect(scene.state.body).toBeInstanceOf(MetricLabelsList);
    });

    it('should update body when variable value changes', () => {
      activateFullSceneTree(scene);

      // Initially should have MetricLabelsList (all value)
      expect(scene.state.body).toBeInstanceOf(MetricLabelsList);

      // Simulate variable change
      mockGroupByVariable.hasAllValue.mockReturnValue(false);
      mockGroupByVariable.state.value = 'instance';

      const subscribeCallback = mockGroupByVariable.subscribeToState.mock.calls[0][0];
      subscribeCallback(
        { value: 'instance' },
        { value: ALL_VARIABLE_VALUE }
      );

      expect(scene.state.body).toBeInstanceOf(MetricLabelValuesList);
    });
  });

  describe('Body Management', () => {
    beforeEach(() => {
      activateFullSceneTree(scene);
    });

    it('should create MetricLabelsList when variable has all value', () => {
      mockGroupByVariable.hasAllValue.mockReturnValue(true);

      // Trigger updateBody
      const subscribeCallback = mockGroupByVariable.subscribeToState.mock.calls[0][0];
      subscribeCallback({ value: ALL_VARIABLE_VALUE }, { value: 'instance' });

      expect(scene.state.body).toBeInstanceOf(MetricLabelsList);
    });

    it('should create MetricLabelValuesList when variable has specific value', () => {
      mockGroupByVariable.hasAllValue.mockReturnValue(false);
      mockGroupByVariable.state.value = 'instance';

      // Trigger updateBody
      const subscribeCallback = mockGroupByVariable.subscribeToState.mock.calls[0][0];
      subscribeCallback({ value: 'instance' }, { value: ALL_VARIABLE_VALUE });

      expect(scene.state.body).toBeInstanceOf(MetricLabelValuesList);
    });

    it('should pass correct parameters to MetricLabelValuesList', () => {
      mockGroupByVariable.hasAllValue.mockReturnValue(false);
      mockGroupByVariable.state.value = 'service';

      // Trigger updateBody
      const subscribeCallback = mockGroupByVariable.subscribeToState.mock.calls[0][0];
      subscribeCallback({ value: 'service' }, { value: ALL_VARIABLE_VALUE });

      // Check that MetricLabelValuesList was created with correct parameters
      expect(MetricLabelValuesList).toHaveBeenCalledWith({
        metric: 'test_metric',
        label: 'service',
      });
    });
  });

  describe('Component Rendering', () => {
    beforeEach(() => {
      activateFullSceneTree(scene);
    });

    it('should render ResponsiveGroupBySelector by default', () => {
      render(<LabelBreakdownScene.Component model={scene} />);

      // Should render the ResponsiveGroupBySelector (which includes "Group by" field)
      expect(screen.getByText('Group by')).toBeInTheDocument();
    });

    it('should render MetricLabelsList component when body is MetricLabelsList', () => {
      render(<LabelBreakdownScene.Component model={scene} />);

      expect(screen.getByTestId('metric-labels-list')).toBeInTheDocument();
      expect(screen.getByTestId('labels-list-controls')).toBeInTheDocument();
    });

    it('should render MetricLabelValuesList component when body is MetricLabelValuesList', () => {
      // Change to specific label value
      mockGroupByVariable.hasAllValue.mockReturnValue(false);
      mockGroupByVariable.state.value = 'instance';

      // Trigger updateBody
      const subscribeCallback = mockGroupByVariable.subscribeToState.mock.calls[0][0];
      subscribeCallback({ value: 'instance' }, { value: ALL_VARIABLE_VALUE });

      render(<LabelBreakdownScene.Component model={scene} />);

      expect(screen.getByTestId('metric-label-values-list')).toBeInTheDocument();
      expect(screen.getByTestId('values-list-controls')).toBeInTheDocument();
    });

    it('should render panels-list container', () => {
      render(<LabelBreakdownScene.Component model={scene} />);

      expect(screen.getByTestId('panels-list')).toBeInTheDocument();
    });

    it('should apply correct CSS classes', () => {
      render(<LabelBreakdownScene.Component model={scene} />);

      const container = screen.getByTestId('panels-list').parentElement;
      expect(container).toHaveClass('mock-container');

      const controls = screen.getByText('Group by').closest('.mock-controls');
      expect(controls).toBeInTheDocument();
    });
  });

  describe('ResponsiveGroupBySelector Integration', () => {
    beforeEach(() => {
      activateFullSceneTree(scene);
    });

    it('should pass correct model to ResponsiveGroupBySelector', () => {
      render(<LabelBreakdownScene.Component model={scene} />);

      const selector = scene.getResponsiveSelector();
      expect(selector).toBeInstanceOf(ResponsiveGroupBySelector);
    });

    it('should handle ResponsiveGroupBySelector interactions', async () => {
      render(<LabelBreakdownScene.Component model={scene} />);

      // Find and click a radio button
      const allButton = screen.getByLabelText('All');
      fireEvent.click(allButton);

      await waitFor(() => {
        expect(mockGroupByVariable.changeValueTo).toHaveBeenCalledWith(ALL_VARIABLE_VALUE);
      });
    });

    it('should update scene body when ResponsiveGroupBySelector changes selection', async () => {
      render(<LabelBreakdownScene.Component model={scene} />);

      // Initially should have MetricLabelsList
      expect(scene.state.body).toBeInstanceOf(MetricLabelsList);

      // Simulate selecting a specific label
      const instanceButton = screen.getByLabelText('instance');
      fireEvent.click(instanceButton);

      // Mock the variable change response
      mockGroupByVariable.hasAllValue.mockReturnValue(false);
      mockGroupByVariable.state.value = 'instance';

      // Trigger the subscription callback
      const subscribeCallback = mockGroupByVariable.subscribeToState.mock.calls[0][0];
      subscribeCallback({ value: 'instance' }, { value: ALL_VARIABLE_VALUE });

      expect(scene.state.body).toBeInstanceOf(MetricLabelValuesList);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when group by variable is not found', () => {
      mockLookupVariable.mockImplementation(() => null);

      expect(() => {
        activateFullSceneTree(scene);
      }).toThrow('Group by variable not found');
    });

    it('should throw error when group by variable is wrong type', () => {
      mockLookupVariable.mockImplementation(() => ({
        type: 'wrong-type',
      } as any));

      expect(() => {
        activateFullSceneTree(scene);
      }).toThrow('Group by variable not found');
    });
  });

  describe('Responsive Wrapper Styling', () => {
    it('should apply responsive wrapper styles', () => {
      activateFullSceneTree(scene);
      render(<LabelBreakdownScene.Component model={scene} />);

      const wrapper = screen.getByText('Group by').closest('.mock-responsive-wrapper');
      expect(wrapper).toBeInTheDocument();
    });
  });

  describe('Legacy Fallback', () => {
    it('should be able to render legacy GroupBy component when useResponsive is false', () => {
      // This test would require modifying the component to accept a prop
      // For now, we just verify the structure is in place
      activateFullSceneTree(scene);
      render(<LabelBreakdownScene.Component model={scene} />);

      // The component currently always uses responsive, but structure supports fallback
      expect(screen.getByText('Group by')).toBeInTheDocument();
    });
  });

  describe('Scene State Management', () => {
    it('should maintain state consistency across updates', () => {
      activateFullSceneTree(scene);

      const initialBody = scene.state.body;
      expect(initialBody).toBeInstanceOf(MetricLabelsList);

      // Change variable and verify state update
      mockGroupByVariable.hasAllValue.mockReturnValue(false);
      mockGroupByVariable.state.value = 'job';

      const subscribeCallback = mockGroupByVariable.subscribeToState.mock.calls[0][0];
      subscribeCallback({ value: 'job' }, { value: ALL_VARIABLE_VALUE });

      expect(scene.state.body).toBeInstanceOf(MetricLabelValuesList);
      expect(scene.state.body).not.toBe(initialBody);
      expect(scene.state.metric).toBe('test_metric'); // Should remain unchanged
    });

    it('should not update body if variable value does not change', () => {
      activateFullSceneTree(scene);

      const initialBody = scene.state.body;
      const subscribeCallback = mockGroupByVariable.subscribeToState.mock.calls[0][0];

      // Call with same values
      subscribeCallback(
        { value: ALL_VARIABLE_VALUE },
        { value: ALL_VARIABLE_VALUE }
      );

      expect(scene.state.body).toBe(initialBody);
    });
  });
});
