import { MetricScene } from '../MetricScene';

describe('MetricScene background tasks', () => {
  describe('breakdown panels counter', () => {
    it('should update breakdownPanelsCount state when handler is called', () => {
      const metricScene = new MetricScene({ metric: 'test_metric' });

      // Activate the scene
      metricScene.activate();

      // Initially, breakdownPanelsCount should be undefined
      expect(metricScene.state.breakdownPanelsCount).toBeUndefined();

      // Simulate a count update by setting state
      metricScene.setState({ breakdownPanelsCount: 5 });

      // The state should be updated
      expect(metricScene.state.breakdownPanelsCount).toBe(5);
    });

    it('should register breakdown panels count change handler on activation', () => {
      const metricScene = new MetricScene({ metric: 'test_metric' });

      // Activate the scene
      metricScene.activate();

      // Call the orchestrator's setter to trigger handlers
      metricScene.breakdownPanelsOrchestrator.breakdownPanelsCount = 42;

      // The state should be updated through the handler
      expect(metricScene.state.breakdownPanelsCount).toBe(42);
    });
  });

  describe('related metrics counter', () => {
    it('should update relatedMetricsCount state when handler is called', () => {
      const metricScene = new MetricScene({ metric: 'test_metric' });

      // Activate the scene
      metricScene.activate();

      // Initially, relatedMetricsCount should be undefined
      expect(metricScene.state.relatedMetricsCount).toBeUndefined();

      // Simulate a count update by setting state
      metricScene.setState({ relatedMetricsCount: 10 });

      // The state should be updated
      expect(metricScene.state.relatedMetricsCount).toBe(10);
    });

    it('should register related metrics count change handler on activation', () => {
      const metricScene = new MetricScene({ metric: 'test_metric' });

      // Activate the scene
      metricScene.activate();

      // Call the orchestrator's setter to trigger handlers
      metricScene.relatedMetricsOrchestrator.relatedMetricsCount = 99;

      // The state should be updated through the handler
      expect(metricScene.state.relatedMetricsCount).toBe(99);
    });
  });
});
