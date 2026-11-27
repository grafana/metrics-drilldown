import { getDataSourceInstance } from '@grafana/plugin-compat/datasources';
import { type DataSourceWithBackend } from '@grafana/runtime';

import { KG_DATASOURCE_UID } from 'shared/constants';

import { parseServicesFromJobs, type ServiceGroup } from './serviceMatchers';

/** The `service_type` of a Service entity that sends telemetry. The other types are hosts, caches, databases, etc. */
export const KG_INSTRUMENTED_SERVICE_TYPE = 'instrumented';

/**
 * The most jobs that one request asks for. The request returns distinct strings, so a large stack stays small: 4,735
 * jobs took 0.8 seconds and 169 KB on the ops stack. The server also applies its own maximum, which is not known.
 */
export const KG_MAX_JOBS = 10000;

export interface KnowledgeGraphServices {
  /** The instrumented services, named after their jobs the way that the job tab names them */
  services: ServiceGroup[];
  /** True when the request returned as many jobs as it asked for, so the list may miss some */
  truncated: boolean;
}

interface KgPropertyValuesResponse {
  values?: unknown[];
}

/**
 * The body of a request for the distinct `job` values of the Service entities that send telemetry. It asks the data
 * source's `property_values` resource, which returns strings and builds no entities.
 */
export function buildInstrumentedJobsRequest({ start, end, limit }: { start: number; end: number; limit: number }) {
  return {
    entityType: 'Service',
    propertyName: 'job',
    propertyMatchers: [{ id: 1, name: 'service_type', op: '=', type: 'String', value: KG_INSTRUMENTED_SERVICE_TYPE }],
    start,
    end,
    limit,
  };
}

/**
 * Lists the services that the Knowledge Graph knows as instrumented, over a time range in milliseconds, with one
 * request. The `job` property of a Service entity is the `job` label of its metrics. A job is named the way that the job
 * tab names it: the part after the first slash, or the whole job when it has no slash. The entity's own name is not part
 * of this request, so a service whose name differs from the end of its job (`pyroscope-ad-hoc-profiles` has the job
 * `profiles-prod-012/ad-hoc-profiles`) shows under the name that its job gives.
 *
 * A failed request rejects, so that the caller can tell a failure from an empty list and try again later.
 */
export async function fetchInstrumentedServices({
  start,
  end,
  limit = KG_MAX_JOBS,
}: {
  start: number;
  end: number;
  limit?: number;
}): Promise<KnowledgeGraphServices> {
  const ds = (await getDataSourceInstance({ uid: KG_DATASOURCE_UID })) as Partial<DataSourceWithBackend>;

  if (typeof ds?.postResource !== 'function') {
    throw new TypeError('The Knowledge Graph data source cannot send resource requests');
  }

  const response = await ds.postResource<KgPropertyValuesResponse>(
    'property_values',
    buildInstrumentedJobsRequest({ start, end, limit })
  );
  const values = response?.values ?? [];
  const jobs = values.filter((value): value is string => typeof value === 'string' && value !== '');

  return { services: parseServicesFromJobs(jobs), truncated: values.length >= limit };
}
