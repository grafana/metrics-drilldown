import { render, screen } from '@testing-library/react';
import React from 'react';

import { useCurrentPrometheusDataSourceUid } from 'shared/hooks/useCurrentPrometheusDataSourceUid';
import { usePrometheusDataSourceInstances } from 'shared/hooks/usePrometheusDataSourceInstances';
import { newMetricsTrail } from 'shared/utils/utils.trail';

import App from './App';

import type { AppRootProps, DataSourceInstanceListItem } from '@grafana/data';

jest.mock('shared/hooks/usePrometheusDataSourceInstances', () => ({
  usePrometheusDataSourceInstances: jest.fn(),
}));
jest.mock('shared/hooks/useCurrentPrometheusDataSourceUid', () => ({
  useCurrentPrometheusDataSourceUid: jest.fn(),
}));
jest.mock('shared/utils/utils.trail', () => ({ newMetricsTrail: jest.fn() }));
jest.mock('../shared/logger/faro/faro', () => ({ initFaro: jest.fn() }));
jest.mock('../shared/featureFlags/openFeature', () => ({
  evaluateExperimentFlagsEarly: jest.fn(),
  initOpenFeatureProvider: jest.fn(() => Promise.resolve()),
}));
jest.mock('../shared/utils/utils.styles', () => ({ getAppBackgroundColor: jest.fn() }));
jest.mock('./Onboarding', () => ({
  Onboarding: () => <div data-testid="onboarding" />,
}));
jest.mock('./Routes', () => ({
  AppRoutes: () => <div data-testid="app-routes" />,
}));
jest.mock('./AppContext', () => ({
  AppContext: require('react').createContext({}),
}));
jest.mock('./AppErrorBoundary', () => ({
  AppErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
const usePrometheusDataSourceInstancesMock = jest.mocked(usePrometheusDataSourceInstances);
const useCurrentPrometheusDataSourceUidMock = jest.mocked(useCurrentPrometheusDataSourceUid);
const newMetricsTrailMock = jest.mocked(newMetricsTrail);
const appProps = {} as AppRootProps;
const instances = [
  { uid: 'prom-a', name: 'Prometheus A', type: 'prometheus', meta: {} },
] as DataSourceInstanceListItem[];

function renderApp() {
  return render(<App {...appProps} />);
}

describe('App', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    newMetricsTrailMock.mockReturnValue({} as any);
    usePrometheusDataSourceInstancesMock.mockReturnValue({ loading: false, instances, error: undefined });
    useCurrentPrometheusDataSourceUidMock.mockReturnValue({ loading: false, uid: undefined, error: undefined });
  });

  describe('errors', () => {
    it('should show discovery errors before pending selection', () => {
      usePrometheusDataSourceInstancesMock.mockReturnValue({
        loading: false,
        instances: undefined,
        error: new Error('Datasource request failed'),
      });
      useCurrentPrometheusDataSourceUidMock.mockReturnValue({ loading: true, uid: undefined, error: undefined });

      renderApp();

      expect(screen.getByTestId('app-error')).toHaveTextContent('Failed to load data sources');
      expect(screen.getByTestId('app-error')).toHaveTextContent('Datasource request failed');
      expect(newMetricsTrailMock).not.toHaveBeenCalled();
    });

    it('should show selection errors without constructing a trail', () => {
      useCurrentPrometheusDataSourceUidMock.mockReturnValue({
        loading: false,
        uid: undefined,
        error: new Error('Default lookup failed'),
      });

      renderApp();

      expect(screen.getByTestId('app-error')).toHaveTextContent('Failed to load current Prometheus data source');
      expect(screen.getByTestId('app-error')).toHaveTextContent('Default lookup failed');
      expect(newMetricsTrailMock).not.toHaveBeenCalled();
    });
  });

  describe('onboarding', () => {
    it('should show onboarding when discovery and selection finish without instances', () => {
      usePrometheusDataSourceInstancesMock.mockReturnValue({ loading: false, instances: [], error: undefined });

      renderApp();

      expect(screen.getByTestId('onboarding')).toBeInTheDocument();
      expect(newMetricsTrailMock).not.toHaveBeenCalled();
    });
  });

  describe('loading', () => {
    it.each([
      { scenario: 'discovery is pending', instancesLoading: true, currentLoading: false, instances: undefined },
      {
        scenario: 'selection is pending with no instances',
        instancesLoading: false,
        currentLoading: true,
        instances: [],
      },
      { scenario: 'no trail is available', instancesLoading: false, currentLoading: false, instances },
    ])('should show loading when $scenario', ({ instancesLoading, currentLoading, instances }) => {
      usePrometheusDataSourceInstancesMock.mockReturnValue({ loading: instancesLoading, instances, error: undefined });
      useCurrentPrometheusDataSourceUidMock.mockReturnValue({
        loading: currentLoading,
        uid: undefined,
        error: undefined,
      });

      renderApp();

      expect(screen.getByTestId('loading-placeholder')).toBeVisible();
      expect(screen.getByTestId('loading-placeholder')).toHaveTextContent('Loading...');
      expect(screen.queryByTestId('app-routes')).not.toBeInTheDocument();
      expect(newMetricsTrailMock).not.toHaveBeenCalled();
    });
  });

  describe('routes', () => {
    it('should render routes with the selected datasource and reuse the trail on rerender', () => {
      useCurrentPrometheusDataSourceUidMock.mockReturnValue({ loading: false, uid: 'prom-a', error: undefined });

      const { rerender } = renderApp();
      expect(screen.getByTestId('app-routes')).toBeInTheDocument();
      expect(newMetricsTrailMock).toHaveBeenCalledWith({ initialDS: 'prom-a' });

      rerender(<App {...appProps} />);

      expect(newMetricsTrailMock).toHaveBeenCalledTimes(1);
    });
  });
});
