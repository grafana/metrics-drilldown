import { type AdHocVariableFilter } from '@grafana/data';
import { escapeRegExp } from 'lodash';

export const JOB_LABEL = 'job';

export type ServiceGroup = {
  /** The service name, taken from the part of the job after the first "/" */
  service: string;
  /** Every job value that maps to this service, one per namespace, sorted and without duplicates */
  jobs: string[];
};

/**
 * Prometheus with OpenTelemetry sets `job` to `<service.namespace>/<service.name>`, or to `<service.name>` when the
 * service has no namespace. One service name can therefore appear in several jobs, one per namespace.
 *
 * The job is split on its first "/", so `ns/a/b` is service `a/b` in namespace `ns`.
 */
function getServiceFromJob(job: string): string {
  const slashIndex = job.indexOf('/');
  const service = slashIndex === -1 ? job : job.slice(slashIndex + 1);

  // A job such as "ns/" (or "ns/" and a zero width space) has no visible service part, so the whole job stands for the
  // service, and its row does not look empty
  return isBlankValue(service) ? job : service;
}

/**
 * A value made only of white space, control characters (such as \u0001) or invisible formatting characters (zero width
 * space, byte order mark, soft hyphen) has no visible label. Its row would look empty and its filter would match no
 * metric, so it is not listed.
 */
export function isBlankValue(value: string) {
  return /^[\s\p{Cc}\p{Cf}]*$/u.test(value);
}

/**
 * Groups job values by the service they belong to, sorted by service name.
 */
export function parseServicesFromJobs(jobs: string[]): ServiceGroup[] {
  const jobsByService = new Map<string, Set<string>>();

  for (const job of jobs) {
    if (job === '') {
      continue;
    }

    const service = getServiceFromJob(job);
    const serviceJobs = jobsByService.get(service) ?? new Set<string>();
    serviceJobs.add(job);
    jobsByService.set(service, serviceJobs);
  }

  return [...jobsByService.entries()]
    .map(([service, serviceJobs]) => ({ service, jobs: [...serviceJobs].sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => a.service.localeCompare(b.service));
}

/**
 * Builds the ad hoc filter that keeps only the series whose label `key` equals one of `values`.
 * Every value is matched exactly: Prometheus anchors regex matchers, and the values are regex-escaped.
 * Returns null when there is nothing to select, so that callers remove the filter instead of writing an empty one.
 */
export function buildServiceFilter(key: string, values: string[]): AdHocVariableFilter | null {
  const uniqueValues = [...new Set(values.filter((value) => value !== ''))];

  if (uniqueValues.length === 0) {
    return null;
  }

  return {
    key,
    operator: '=~',
    value: uniqueValues.map(escapeRegExp).join('|'),
  };
}
