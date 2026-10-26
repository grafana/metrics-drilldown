import { render, screen } from '@testing-library/react';
import React from 'react';

import { useDataSourceInstances } from 'shared/hooks/useDataSourceInstances';

import App from './App';

import type { AppRootProps, DataSourceInstanceListItem } from '@grafana/data';

jest.mock('shared/hooks/useDataSourceInstances', () => ({
  useDataSourceInstances: jest.fn(),
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
const useDataSourceInstancesMock = jest.mocked(useDataSourceInstances);
const appProps = {} as AppRootProps;

function renderApp() {
  return render(<App {...appProps} />);
}

describe('App', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should render nothing while loading instances', () => {
    useDataSourceInstancesMock.mockReturnValue({ loading: true, instances: undefined, error: undefined });

    const { container } = renderApp();

    expect(container).toBeEmptyDOMElement();
  });

  it('should show the load error', () => {
    useDataSourceInstancesMock.mockReturnValue({
      loading: false,
      instances: undefined,
      error: new Error('Datasource request failed'),
    });

    renderApp();

    expect(screen.getByTestId('app-error')).toHaveTextContent('Datasource request failed');
  });

  it('should show onboarding when there are no instances', () => {
    useDataSourceInstancesMock.mockReturnValue({ loading: false, instances: [], error: undefined });

    renderApp();

    expect(screen.getByTestId('onboarding')).toBeInTheDocument();
  });

  it('should render app routes when there is one instance', () => {
    useDataSourceInstancesMock.mockReturnValue({
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
