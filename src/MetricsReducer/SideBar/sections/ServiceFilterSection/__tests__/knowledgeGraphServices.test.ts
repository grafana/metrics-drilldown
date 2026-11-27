import { getDataSourceInstance } from '@grafana/plugin-compat/datasources';

import { buildInstrumentedJobsRequest, fetchInstrumentedServices, KG_MAX_JOBS } from '../knowledgeGraphServices';

jest.mock('@grafana/plugin-compat/datasources', () => ({
  getDataSourceInstance: jest.fn(),
}));

const mockGetDataSourceInstance = getDataSourceInstance as jest.Mock;
const postResource = jest.fn();

const values = (jobs: unknown[]) => ({ entityType: 'Service', propertyName: 'job', values: jobs });

const range = { start: 1000, end: 2000 };

describe('buildInstrumentedJobsRequest', () => {
  test('asks for the distinct jobs of the instrumented Service entities in the time range', () => {
    expect(buildInstrumentedJobsRequest({ ...range, limit: 500 })).toEqual({
      entityType: 'Service',
      propertyName: 'job',
      propertyMatchers: [{ id: 1, name: 'service_type', op: '=', type: 'String', value: 'instrumented' }],
      start: 1000,
      end: 2000,
      limit: 500,
    });
  });
});

describe('fetchInstrumentedServices', () => {
  beforeEach(() => {
    postResource.mockReset();
    mockGetDataSourceInstance.mockReset();
    mockGetDataSourceInstance.mockResolvedValue({ postResource });
  });

  test('sends one request to the property_values resource of the Knowledge Graph data source', async () => {
    postResource.mockResolvedValue(values(['ns/a']));

    await fetchInstrumentedServices(range);

    expect(mockGetDataSourceInstance).toHaveBeenCalledWith({ uid: 'grafanacloud-knowledgegraph' });
    expect(postResource).toHaveBeenCalledTimes(1);
    expect(postResource).toHaveBeenCalledWith(
      'property_values',
      buildInstrumentedJobsRequest({ ...range, limit: KG_MAX_JOBS })
    );
  });

  test('asks for up to 10,000 jobs by default, and for the limit that the caller gives', async () => {
    postResource.mockResolvedValue(values([]));

    await fetchInstrumentedServices(range);
    await fetchInstrumentedServices({ ...range, limit: 50 });

    expect(KG_MAX_JOBS).toBe(10000);
    expect(postResource.mock.calls.map(([, body]) => body.limit)).toEqual([10000, 50]);
  });

  test('names the services after their jobs the way the job tab does, with the jobs of each service', async () => {
    postResource.mockResolvedValue(
      values([
        'staging/mlapi',
        'machine-learning/mlapi',
        'faro/faro-collector',
        'query.grafana.app',
        'prometheus',
        'machine-learning/mlapi',
      ])
    );

    expect(await fetchInstrumentedServices(range)).toEqual({
      services: [
        { service: 'faro-collector', jobs: ['faro/faro-collector'] },
        { service: 'mlapi', jobs: ['machine-learning/mlapi', 'staging/mlapi'] },
        { service: 'prometheus', jobs: ['prometheus'] },
        { service: 'query.grafana.app', jobs: ['query.grafana.app'] },
      ],
      truncated: false,
    });
  });

  test('shows a service under the name that its job gives, which can differ from the entity name', async () => {
    // The entity pyroscope-ad-hoc-profiles has this job. The request carries no entity name.
    postResource.mockResolvedValue(values(['profiles-prod-012/ad-hoc-profiles']));

    expect((await fetchInstrumentedServices(range)).services).toEqual([
      { service: 'ad-hoc-profiles', jobs: ['profiles-prod-012/ad-hoc-profiles'] },
    ]);
  });

  test.each([
    ['not text', [42, null, undefined, { job: 'x' }, ['y/z']]],
    ['empty', ['', '']],
  ])('leaves out values that are %s', async (_case, bad) => {
    postResource.mockResolvedValue(values([...bad, 'ns/kept']));

    expect((await fetchInstrumentedServices({ ...range, limit: 100 })).services).toEqual([
      { service: 'kept', jobs: ['ns/kept'] },
    ]);
  });

  test('reports a list that may be incomplete when the request returned as many jobs as it asked for', async () => {
    postResource.mockResolvedValue(values(['a/one', 'a/two', 'a/three']));

    expect((await fetchInstrumentedServices({ ...range, limit: 3 })).truncated).toBe(true);
  });

  test('reports a complete list when the request returned fewer jobs than it asked for', async () => {
    postResource.mockResolvedValue(values(['a/one', 'a/two']));

    expect((await fetchInstrumentedServices({ ...range, limit: 3 })).truncated).toBe(false);
  });

  test.each([[undefined], [{}], [{ values: [] }], [{ values: null }]])(
    'returns an empty list for the response %j',
    async (response) => {
      postResource.mockResolvedValue(response);

      expect(await fetchInstrumentedServices(range)).toEqual({ services: [], truncated: false });
    }
  );

  test('rejects when the request fails, so that a failure is not taken for an empty list', async () => {
    postResource.mockRejectedValue(new Error('503'));

    await expect(fetchInstrumentedServices(range)).rejects.toThrow('503');
  });

  test('rejects when the data source cannot send resource requests', async () => {
    mockGetDataSourceInstance.mockResolvedValue({});

    await expect(fetchInstrumentedServices(range)).rejects.toThrow(/cannot send resource requests/);
  });

  test('rejects when the data source cannot be found', async () => {
    mockGetDataSourceInstance.mockRejectedValue(new Error('Datasource not found'));

    await expect(fetchInstrumentedServices(range)).rejects.toThrow('Datasource not found');
  });
});
