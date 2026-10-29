import { render, screen } from '@testing-library/react';
import React from 'react';

import { usePrometheusDataSourceInstances } from 'shared/hooks/usePrometheusDataSourceInstances';

import App from './App';

import type { AppRootProps, DataSourceInstanceListItem } from '@grafana/data';

jest.mock('shared/hooks/usePrometheusDataSourceInstances', () => ({
  usePrometheusDataSourceInstances: jest.fn(),
}));
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
  defaultTrail: {},
}));
jest.mock('./AppErrorBoundary', () => ({
  AppErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
const usePrometheusDataSourceInstancesMock = jest.mocked(usePrometheusDataSourceInstances);
const appProps = {} as AppRootProps;

function renderApp() {
  return render(<App {...appProps} />);
}

describe('App', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should render loading placeholder while loading instances', () => {
    usePrometheusDataSourceInstancesMock.mockReturnValue({ loading: true, instances: undefined, error: undefined });

    renderApp();

    expect(screen.getByTestId('loading-placeholder')).toBeVisible();
    expect(screen.getByTestId('loading-placeholder')).toHaveTextContent('Loading...');
  });

  it('should show the load error', () => {
    usePrometheusDataSourceInstancesMock.mockReturnValue({
      loading: false,
      instances: undefined,
      error: new Error('Datasource request failed'),
    });

    renderApp();

    expect(screen.getByTestId('app-error')).toHaveTextContent('Datasource request failed');
  });

  it('should show onboarding when there are no instances', () => {
    usePrometheusDataSourceInstancesMock.mockReturnValue({ loading: false, instances: [], error: undefined });

    renderApp();

    expect(screen.getByTestId('onboarding')).toBeInTheDocument();
  });

  it('should render app routes when there is one instance', () => {
    usePrometheusDataSourceInstancesMock.mockReturnValue({
      loading: false,
      instances: [
        {
          uid: 'prometheus-1',
          name: 'Prometheus',
          type: 'prometheus',
          meta: {} as DataSourceInstanceListItem['meta'],
        } as DataSourceInstanceListItem,
      ],
      error: undefined,
    });

    renderApp();

    expect(screen.getByTestId('metrics-drilldown-app')).toBeInTheDocument();
  });
});
