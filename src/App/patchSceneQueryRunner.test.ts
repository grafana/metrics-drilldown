import { SceneQueryRunner } from '@grafana/scenes';

import { patchSceneQueryRunnerFilters } from './patchSceneQueryRunner';

jest.mock('@grafana/scenes', () => ({
  SceneQueryRunner: { prototype: {} },
}));

const proto = (SceneQueryRunner as any).prototype;
const PATCHED = Symbol.for('metrics-drilldown/patchSceneQueryRunnerFilters');

const promDs = { meta: { id: 'prometheus' } };
const otherDs = { meta: { id: 'graphite' } };
const fakeTimeRange = {};

beforeEach(() => {
  delete proto[PATCHED];
  proto.prepareRequests = jest.fn().mockReturnValue({
    primary: {
      filters: [
        { key: '__name__', operator: '=~', value: '.*' },
        { key: 'job', operator: '=', value: 'api' },
      ],
    },
    secondaries: [{ filters: [{ key: '__name__', operator: '=~', value: '.*' }] }],
  });
});

describe('patchSceneQueryRunnerFilters', () => {
  it('strips __name__ from primary and secondary filters while preserving other filters', () => {
    patchSceneQueryRunnerFilters();

    const result = proto.prepareRequests.call({}, fakeTimeRange, promDs);

    expect(result.primary.filters).toEqual([{ key: 'job', operator: '=', value: 'api' }]);
    expect(result.secondaries[0].filters).toEqual([]);
  });

  it('does not re-wrap prepareRequests on a second call (idempotency)', () => {
    patchSceneQueryRunnerFilters();
    const patchedOnce = proto.prepareRequests;

    patchSceneQueryRunnerFilters();

    expect(proto.prepareRequests).toBe(patchedOnce);

    // Original should be called exactly once when patched function is called once.
    proto.prepareRequests.call({}, fakeTimeRange, promDs);
    expect(proto.prepareRequests).toBe(patchedOnce);
  });

  it('does not strip filters for non-Prometheus datasources', () => {
    patchSceneQueryRunnerFilters();

    const result = proto.prepareRequests.call({}, fakeTimeRange, otherDs);

    expect(result.primary.filters).toEqual([
      { key: '__name__', operator: '=~', value: '.*' },
      { key: 'job', operator: '=', value: 'api' },
    ]);
    expect(result.secondaries[0].filters).toEqual([{ key: '__name__', operator: '=~', value: '.*' }]);
  });
});
