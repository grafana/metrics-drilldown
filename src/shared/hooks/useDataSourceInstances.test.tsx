import { type DataSourceInstanceListItem } from '@grafana/data';
import { getDataSourceInstanceList } from '@grafana/plugin-compat/datasources';
import { renderHook, waitFor } from '@testing-library/react';

import { isPrometheusDataSource } from 'shared/utils/utils.datasource';

import { useDataSourceInstances } from './useDataSourceInstances';

jest.mock('@grafana/plugin-compat/datasources', () => ({
  getDataSourceInstanceList: jest.fn(),
}));

jest.mock('shared/utils/utils.datasource', () => ({
  isPrometheusDataSource: jest.fn(),
}));

const getDataSourceInstanceListMock = jest.mocked(getDataSourceInstanceList);

describe('useDataSourceInstances', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    getDataSourceInstanceListMock.mockResolvedValue([
      {
        uid: 'prometheus-1',
        name: 'Prometheus',
        type: 'prometheus',
        meta: {} as DataSourceInstanceListItem['meta'],
      } as DataSourceInstanceListItem,
    ]);
  });

  it('should load data source instances', async () => {
    const { result } = renderHook(() => useDataSourceInstances());

    expect(result.current).toEqual({ loading: true, instances: undefined, error: undefined });

    await waitFor(() => {
      expect(result.current).toEqual({
        loading: false,
        instances: [
          {
            uid: 'prometheus-1',
            name: 'Prometheus',
            type: 'prometheus',
            meta: {},
          },
        ],
        error: undefined,
      });
    });

    expect(getDataSourceInstanceListMock).toHaveBeenCalledTimes(1);
    expect(getDataSourceInstanceListMock).toHaveBeenCalledWith({ filter: isPrometheusDataSource });
  });

  it('should normalize a rejected value into an error', async () => {
    getDataSourceInstanceListMock.mockRejectedValue('Unable to load instances');

    const { result } = renderHook(() => useDataSourceInstances());

    await waitFor(() => {
      expect(result.current).toEqual({
        loading: false,
        instances: undefined,
        error: new Error('Unable to load instances'),
      });
    });
  });
});
