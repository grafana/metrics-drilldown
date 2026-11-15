import { PageLayoutType, type NavModelItem } from '@grafana/data';
import { PluginPage } from '@grafana/runtime';
import { act, render, screen } from '@testing-library/react';
import React, { Fragment } from 'react';

import Trail, { getPageNav, renderTrailPage } from './Trail';
import { DataTrail } from '../AppDataTrail/DataTrail';
import { actionViews } from '../MetricScene/MetricActionBar';
import { MetricScene } from '../MetricScene/MetricScene';
import { MetricsReducer } from '../MetricsReducer/MetricsReducer';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  PluginPage: ({ pageNav }: { pageNav?: NavModelItem }) => <div>{pageNav?.text}</div>,
}));
jest.mock('./assistant/useMetricsDrilldownQuestions', () => ({
  useMetricsDrilldownQuestions: jest.fn(),
}));

const DEFAULT_URL =
  'http://localhost:3001/a/grafana-metricsdrilldown-app/drilldown?metric=test_metric&actionView=breakdown';

const mockMetricScene = new MetricScene({ metric: 'test_metric' });
const mockMetricsReducer = new MetricsReducer();

describe('Trail page wrapper', () => {
  const content = <div data-testid="trail-content" />;

  it('does not add the PluginPage wrapper for embedded trails', () => {
    const page = renderTrailPage(true, undefined, content);
    const props = page.props as { children: React.ReactNode };

    expect(page.type).toBe(Fragment);
    expect(props.children).toBe(content);
  });

  it('keeps the PluginPage wrapper for standalone trails', () => {
    const pageNav = { text: 'Metrics' };
    const page = renderTrailPage(false, pageNav, content);
    const props = page.props as { children: React.ReactNode; pageNav: typeof pageNav; layout: PageLayoutType };

    expect(page.type).toBe(PluginPage);
    expect(props.children).toBe(content);
    expect(props.pageNav).toBe(pageNav);
    expect(props.layout).toBe(PageLayoutType.Custom);
  });
});

describe('Trail breadcrumb subscription', () => {
  it('updates for action-view and scene changes without retaining the previous scene subscription', () => {
    const metricScene = new MetricScene({ metric: 'test_metric', actionView: actionViews.breakdown });
    const trail = new DataTrail({ metric: 'test_metric', topScene: metricScene });
    const subscription = jest.spyOn(metricScene, 'subscribeToState');
    const { unmount } = render(<Trail trail={trail} />);
    const unsubscribe = jest.spyOn(subscription.mock.results[0].value, 'unsubscribe');

    expect(screen.getByText('Breakdown')).toBeInTheDocument();

    act(() => metricScene.setState({ actionView: actionViews.related }));
    expect(screen.getByText('Related metrics')).toBeInTheDocument();

    const nextMetricScene = new MetricScene({ metric: 'next_metric', actionView: actionViews.relatedLogs });
    const nextSubscription = jest.spyOn(nextMetricScene, 'subscribeToState');
    act(() => trail.setState({ metric: 'next_metric', topScene: nextMetricScene }));
    const nextUnsubscribe = jest.spyOn(nextSubscription.mock.results[0].value, 'unsubscribe');
    expect(screen.getByText('Related logs')).toBeInTheDocument();
    expect(unsubscribe).toHaveBeenCalledTimes(1);

    act(() => trail.setState({ metric: undefined, topScene: new MetricsReducer() }));
    expect(screen.getByText('All metrics')).toBeInTheDocument();
    expect(nextUnsubscribe).toHaveBeenCalledTimes(1);

    act(() => trail.setState({ topScene: undefined }));
    expect(screen.queryByText('All metrics')).not.toBeInTheDocument();
    unmount();
  });
});

describe('Trail Component - Breadcrumb Logic Tests', () => {
  beforeEach(() => {
    __setWindowLocation(DEFAULT_URL);
  });

  describe('When no metric is selected (MetricsReducer)', () => {
    it('should return "All metrics" breadcrumb', () => {
      const result = getPageNav(mockMetricsReducer, undefined, '');

      expect(result).toEqual({ text: 'All metrics' });
    });
  });

  describe('When a metric is selected (MetricScene)', () => {
    it('should return metric name and default action view breadcrumb', () => {
      const result = getPageNav(mockMetricScene, 'test_metric', 'Breakdown');

      expect(result).toBeDefined();
      expect(result?.text).toBe('Breakdown');
      expect(result?.parentItem?.text).toBe('test_metric');
    });

    it('should handle URL with different action view parameter', () => {
      __setWindowLocation({ search: '?metric=test_metric&actionView=logs' });

      const result = getPageNav(mockMetricScene, 'test_metric', 'Related logs');

      expect(result?.text).toBe('Related logs');
      expect(result?.url).toContain('actionView=logs');
    });

    it('should handle URL with invalid action view parameter', () => {
      __setWindowLocation({ search: '?metric=test_metric&actionView=invalid' });

      const result = getPageNav(mockMetricScene, 'test_metric', 'Breakdown');

      // Should fall back to default action view
      expect(result?.text).toBe('Breakdown');
      expect(result?.url).toContain('actionView=invalid'); // URL should still contain the invalid parameter
    });

    it('should generate correct URLs for breadcrumb navigation', () => {
      const result = getPageNav(mockMetricScene, 'test_metric', 'Breakdown');

      expect(result?.url).toContain('actionView=breakdown');
      expect(result?.parentItem?.url).toContain('actionView=breakdown');
    });

    it('should reset var-groupby to $__all in the metric breadcrumb URL', () => {
      __setWindowLocation({ search: '?metric=test_metric&actionView=related&var-groupby=instance' });

      const result = getPageNav(mockMetricScene, 'test_metric', 'Related metrics');

      expect(result?.parentItem?.url).not.toContain('instance');
      expect(result?.parentItem?.url).toContain('var-groupby=%24__all');
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined metric gracefully', () => {
      const result = getPageNav(mockMetricsReducer, undefined, '');

      expect(result).toEqual({ text: 'All metrics' });
    });

    it('should handle empty metric name', () => {
      const result = getPageNav(mockMetricScene, '', 'Breakdown');

      // Empty string is falsy, so it should return undefined
      expect(result).toBeUndefined();
    });

    it('should handle undefined topScene', () => {
      const result = getPageNav(undefined, 'test_metric', 'Breakdown');

      expect(result).toBeUndefined();
    });
  });
});
