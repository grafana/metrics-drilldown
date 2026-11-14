import { getTrailFor } from 'shared/utils/utils';

import { MetricsVariable } from '../MetricsVariable';

jest.mock('shared/utils/utils', () => ({ getTrailFor: jest.fn() }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('MetricsVariable recent requests', () => {
  const fetchRecentMetrics = jest.fn();

  beforeEach(() => {
    jest.mocked(getTrailFor).mockReturnValue({ fetchRecentMetrics } as unknown as ReturnType<typeof getTrailFor>);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps the latest interval results when an older request finishes last', async () => {
    const older = deferred<string[]>();
    const newer = deferred<string[]>();
    fetchRecentMetrics.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    const variable = new MetricsVariable();

    const olderLoad = variable.fetchRecentMetrics('1m');
    const newerLoad = variable.fetchRecentMetrics('1h');
    newer.resolve(['new_metric']);
    await newerLoad;
    older.resolve(['old_metric']);
    await olderLoad;

    expect(variable.state.options).toEqual([{ label: 'new_metric', value: 'new_metric' }]);
    expect(variable.state.error).toBeNull();
  });

  it('keeps loading the latest interval when an older request completes first', async () => {
    const older = deferred<string[]>();
    const newer = deferred<string[]>();
    fetchRecentMetrics.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    const variable = new MetricsVariable();

    const olderLoad = variable.fetchRecentMetrics('1m');
    const newerLoad = variable.fetchRecentMetrics('1h');
    older.resolve(['old_metric']);
    await olderLoad;
    const pendingState = variable.state;
    newer.resolve(['new_metric']);
    await newerLoad;

    expect(pendingState.loading).toBe(true);
    expect(pendingState.options).toEqual([]);
    expect(variable.state.options).toEqual([{ label: 'new_metric', value: 'new_metric' }]);
  });

  it('ignores an older request failure after the latest interval succeeds', async () => {
    const older = deferred<string[]>();
    const newer = deferred<string[]>();
    fetchRecentMetrics.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    const variable = new MetricsVariable();

    const olderLoad = variable.fetchRecentMetrics('1m');
    const newerLoad = variable.fetchRecentMetrics('1h');
    newer.resolve(['new_metric']);
    await newerLoad;
    older.reject(new Error('old timeout'));
    await olderLoad;

    expect(variable.state.error).toBeNull();
    expect(variable.state.options).toEqual([{ label: 'new_metric', value: 'new_metric' }]);
  });

  it.each(['success', 'failure'])('ignores recent request %s after switching to all metrics', async (outcome) => {
    const older = deferred<string[]>();
    fetchRecentMetrics.mockReturnValueOnce(older.promise);
    const variable = new MetricsVariable();
    jest.spyOn(variable, 'refreshOptions').mockImplementation(() => {
      variable.setState({ options: [{ label: 'all_metric', value: 'all_metric' }], loading: false, error: null });
    });

    const olderLoad = variable.fetchRecentMetrics('1m');
    variable.fetchAllMetrics();
    if (outcome === 'success') {
      older.resolve(['old_metric']);
    } else {
      older.reject(new Error('old timeout'));
    }
    await olderLoad;

    expect(variable.state.options).toEqual([{ label: 'all_metric', value: 'all_metric' }]);
    expect(variable.state.error).toBeNull();
  });

  it('reports a failure from the current request', async () => {
    const error = new Error('current timeout');
    fetchRecentMetrics.mockRejectedValueOnce(error);
    const variable = new MetricsVariable();

    await variable.fetchRecentMetrics('1m');

    expect(variable.state.loading).toBe(false);
    expect(variable.state.error).toBe(error);
    expect(variable.state.options).toEqual([]);
  });
});
