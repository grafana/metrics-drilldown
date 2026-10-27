import { type DataSourceInstanceListItem } from '@grafana/data';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';

import { getCurrentPrometheusDataSource } from 'shared/utils/utils.datasource';

import { useCurrentPrometheusDataSourceUid } from './useCurrentPrometheusDataSourceUid';

jest.mock('shared/utils/utils.datasource', () => ({
  getCurrentPrometheusDataSource: jest.fn(),
}));

const resolveUidMock = jest.mocked(getCurrentPrometheusDataSource);
const instances = [
  { uid: 'prom-a', name: 'Prometheus A', type: 'prometheus', meta: {} },
] as DataSourceInstanceListItem[];

function pendingUid() {
  let resolve!: (uid: string | undefined) => void;
  const promise = new Promise<string | undefined>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

describe('useCurrentPrometheusDataSourceUid', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should wait for discovery and selection before returning a UID', async () => {
    const pending = pendingUid();
    resolveUidMock.mockReturnValue(pending.promise);
    const { result, rerender } = renderHook(
      (input: DataSourceInstanceListItem[] | undefined) => useCurrentPrometheusDataSourceUid(input),
      { initialProps: undefined as DataSourceInstanceListItem[] | undefined }
    );

    expect(result.current).toEqual({ loading: true, uid: undefined, error: undefined });
    expect(resolveUidMock).not.toHaveBeenCalled();

    rerender(instances);

    expect(result.current).toEqual({ loading: true, uid: undefined, error: undefined });

    await act(async () => pending.resolve('prom-a'));

    expect(result.current).toEqual({ loading: false, uid: 'prom-a', error: undefined });
  });

  it('should normalize a rejected lookup', async () => {
    resolveUidMock.mockRejectedValue('Default lookup failed');
    const { result } = renderHook(() => useCurrentPrometheusDataSourceUid(instances));

    await waitFor(() =>
      expect(result.current).toEqual({
        loading: false,
        uid: undefined,
        error: new Error('Default lookup failed'),
      })
    );
  });

  it('should complete empty discovery without a UID', async () => {
    resolveUidMock.mockResolvedValue(undefined);
    const emptyInstances: DataSourceInstanceListItem[] = [];
    const { result } = renderHook(() => useCurrentPrometheusDataSourceUid(emptyInstances));

    await waitFor(() => expect(result.current).toEqual({ loading: false, uid: undefined, error: undefined }));
  });
});
