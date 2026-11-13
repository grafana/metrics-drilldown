import { getDataSourceInstance } from '@grafana/plugin-compat/datasources';
import { sceneGraph, SceneQueryRunner, type SceneComponentProps } from '@grafana/scenes';
import { act, render, screen, waitFor } from '@testing-library/react';
import React, { useEffect } from 'react';

import { GmdVizPanel } from 'shared/GmdVizPanel/GmdVizPanel';

import { MetricChart, type MetricChartProps } from './MetricChart';
import { MetricSceneRoot } from '../metrics-molecules/MetricSceneRoot';

jest.mock('@grafana/plugin-compat/datasources', () => ({ getDataSourceInstance: jest.fn() }));

const props: MetricChartProps = { dataSourceUid: 'prom-a', metric: 'temperature', from: 'now-1h', to: 'now' };

// Exercise real scene/query/metadata lifecycles without loading Grafana panel plugins in jsdom.
function TestSceneRenderer({ model }: Readonly<SceneComponentProps<MetricSceneRoot>>) {
  useEffect(() => {
    const stopRoot = model.activate();
    const panel = sceneGraph.findDescendents(model, GmdVizPanel)[0];
    const stopPanel = panel.activate();
    return () => {
      stopPanel();
      stopRoot();
    };
  }, [model]);
  return <div data-testid="metric-scene" />;
}

beforeEach(() => {
  jest.spyOn(MetricSceneRoot, 'Component').mockImplementation(TestSceneRenderer);
  jest.spyOn(SceneQueryRunner.prototype, 'runQueries').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

function deferredMetadata() {
  let resolve!: (response: unknown) => void;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('scope changes do not emit old metadata, time/filter context or host callbacks', async () => {
  const oldMetadata = deferredMetadata();
  const newMetadata = deferredMetadata();
  jest.mocked(getDataSourceInstance).mockImplementation(async (_ref, vars) => {
    const uid = sceneGraph.interpolate(vars?.__sceneObject?.value, '${ds}');
    return {
      uid,
      type: 'prometheus',
      languageProvider: { request: () => (uid === 'prom-a' ? oldMetadata.promise : newMetadata.promise) },
    } as any;
  });
  const oldCallback = jest.fn();
  const newCallback = jest.fn();
  const { rerender, unmount } = render(<MetricChart {...props} onQueriesChange={oldCallback} />);
  rerender(
    <MetricChart
      {...props}
      dataSourceUid="prom-b"
      from="now-6h"
      filters={[{ key: 'job', operator: '=', value: 'new' }]}
      onQueriesChange={newCallback}
    />
  );
  await act(async () => {
    oldMetadata.resolve({ temperature: [{ type: 'histogram' }] });
  });
  expect(oldCallback).not.toHaveBeenCalled();
  expect(newCallback).not.toHaveBeenCalled();
  await act(async () => {
    newMetadata.resolve({ temperature: [{ type: 'counter' }] });
  });
  await waitFor(() => expect(newCallback).toHaveBeenCalled());
  expect(newCallback.mock.lastCall[0][0]).toMatchObject({ datasource: { uid: 'prom-b' } });
  expect(newCallback.mock.lastCall[0][0].expr).toBe('sum(rate(temperature{ job="new"}[$__rate_interval]))');
  unmount();
});

test('unmount disconnects the callback and cancels late metadata-driven changes', async () => {
  const metadata = deferredMetadata();
  jest.mocked(getDataSourceInstance).mockResolvedValue({
    uid: 'prom-a',
    type: 'prometheus',
    languageProvider: { request: () => metadata.promise },
  } as any);
  const callback = jest.fn();
  const { unmount } = render(<MetricChart {...props} onQueriesChange={callback} />);
  unmount();
  await act(async () => {
    metadata.resolve({ temperature: [{ type: 'histogram' }] });
  });
  expect(callback).not.toHaveBeenCalled();
});

test('callback replacement uses the current host without rebuilding the explicit scope', async () => {
  jest.mocked(getDataSourceInstance).mockResolvedValue({
    uid: 'prom-a',
    type: 'prometheus',
    languageProvider: { request: async () => ({ temperature: [{ type: 'gauge' }] }) },
  } as any);
  const oldCallback = jest.fn();
  const newCallback = jest.fn();
  const { rerender } = render(<MetricChart {...props} onQueriesChange={oldCallback} />);
  await waitFor(() => expect(oldCallback).toHaveBeenCalled());
  rerender(<MetricChart {...props} onQueriesChange={newCallback} />);
  expect(newCallback).toHaveBeenCalledTimes(1);
  expect(getDataSourceInstance).toHaveBeenCalledTimes(1);
  expect(oldCallback).toHaveBeenCalledTimes(1);
});

test('invalid scope renders an inline error without issuing queries or metadata requests', () => {
  const callback = jest.fn();
  const { rerender } = render(<MetricChart {...props} metric="" onQueriesChange={callback} />);
  expect(screen.getByText('Invalid metric chart scope')).toBeInTheDocument();
  rerender(<MetricChart {...props} dataSourceUid="" onQueriesChange={callback} />);
  expect(screen.queryByTestId('metric-scene')).not.toBeInTheDocument();
  expect(getDataSourceInstance).not.toHaveBeenCalled();
  expect(callback).not.toHaveBeenCalled();
});
