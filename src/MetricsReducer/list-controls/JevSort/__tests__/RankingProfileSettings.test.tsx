import { config } from '@grafana/runtime';
import { DataSourceVariable, sceneGraph } from '@grafana/scenes';
import { render } from '@testing-library/react';
import React from 'react';

import { VAR_FILTERED_METRICS_VARIABLE } from 'MetricsReducer/metrics-variables/FilteredMetricsVariable';
import { VAR_METRICS_VARIABLE } from 'MetricsReducer/metrics-variables/MetricsVariable';
import { VAR_DATASOURCE } from 'shared/shared';
import { getTrailFor } from 'shared/utils/utils';

import { RankingProfileEditor } from '../RankingProfileEditor';
import { RankingProfileSettings } from '../RankingProfileSettings';

jest.mock('../RankingProfileEditor', () => ({ RankingProfileEditor: jest.fn(() => null) }));
jest.mock('shared/utils/utils', () => ({
  getTrailFor: jest.fn(),
  getObjectKeys: Object.keys,
  getObjectValues: Object.values,
  embeddedTrailNamespace: 'gmd',
}));
jest.mock('@grafana/scenes', () => {
  const actual = jest.requireActual('@grafana/scenes');
  return {
    ...actual,
    sceneGraph: { ...actual.sceneGraph, lookupVariable: jest.fn(), findByKeyAndType: jest.fn() },
  };
});

const originalUser = config.bootData.user;
beforeEach(() => {
  localStorage.setItem('gmd.jev.enabled', '1');
  config.bootData.user = { ...originalUser, isSignedIn: true, id: 7, orgId: 3 };
  jest.mocked(RankingProfileEditor).mockReturnValue(<></>);
});
afterEach(() => {
  config.bootData.user = originalUser;
  localStorage.clear();
});

it.each([{ names: ['checkout_requests_total'] }, { names: [] }])(
  'snapshots only the displayed catalog: $names',
  ({ names }) => {
    const datasource = new DataSourceVariable({ name: VAR_DATASOURCE, value: 'prom', pluginId: 'prometheus' });
    const options = (values: string[]) => ({ state: { options: values.map((value) => ({ value, label: value })) } });
    jest.mocked(sceneGraph.lookupVariable).mockImplementation((name) => {
      if (name === VAR_DATASOURCE) {
        return datasource;
      }
      if (name === VAR_FILTERED_METRICS_VARIABLE) {
        return options(names) as never;
      }
      if (name === VAR_METRICS_VARIABLE) {
        return options(['checkout_requests_total', 'unrelated_private_metric']) as never;
      }
      return null;
    });
    jest.mocked(sceneGraph.findByKeyAndType).mockReturnValue({
      peekSloMetricSignals: () => undefined,
      peekUsageCounts: () => ({}),
    } as never);
    const peek = jest.fn((name: string) => ({ help: `Synthetic HELP for ${name}.` }));
    jest.mocked(getTrailFor).mockReturnValue({ peekMetricMetadata: peek } as never);

    render(<RankingProfileSettings model={{} as never} onClose={jest.fn()} />);

    expect(jest.mocked(RankingProfileEditor).mock.calls[0][0].names).toEqual(names);
    expect(peek.mock.calls.map(([name]) => name)).toEqual(names);
  }
);
