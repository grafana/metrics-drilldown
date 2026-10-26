import { getDataSourceInstanceList } from '@grafana/plugin-compat/datasources';
import { renderHook, waitFor } from '@testing-library/react';

import { useDataSourceInstances } from './useDataSourceInstances';

jest.mock('@grafana/plugin-compat/datasources', () => ({
  getDataSourceInstanceList: jest.fn(),
}));

const getDataSourceInstanceListMock = jest.mocked(getDataSourceInstanceList);

describe('useDataSourceInstances', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    getDataSourceInstanceListMock.mockResolvedValue([]);
  });

  it('should load data source instances', async () => {
    const { result } = renderHook(() => useDataSourceInstances());

    expect(result.current).toEqual({ loading: true, instances: undefined, error: undefined });

    await waitFor(() => {
      expect(result.current).toEqual({ loading: false, instances: [], error: undefined });
    });

    expect(getDataSourceInstanceListMock).toHaveBeenCalledTimes(1);
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
