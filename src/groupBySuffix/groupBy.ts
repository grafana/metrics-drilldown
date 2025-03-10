/**
 * take a list of metrics
 *
 * iterate over the metrics
 *
 * Skip certain metrics
 * - if the metric contains : it is a recording rules aand we should skip it
 *
 * break the metric into parts based on a delimiter
 * - can be a _ or a .
 * - maybe a combination
 *
 * Identify the suffix of the metric
 * - if the suffix ends in total, bucket, summary or count we should group by the second to last suffix
 *
 * Examples of suffixes based on Groups
 *
 * TIME-BASED:
 * - seconds
 * - milliseconds
 * - microseconds
 * - minutes
 * - hours
 *
 * SIZE/RESOURCE:
 * - bytes
 * - bits
 * - packets
 * - inodes
 * - kbytes
 * - mbytes
 * - gigabytes
 *
 * STATE/STATUS:
 * - info
 * - state
 * - status
 * - up
 * - enabled
 * - active
 * - running
 * - failed
 * - healthy
 * - degraded
 *
 * Resource usage
 * - free
 * - used
 * - limit
 * - available
 * - capacity
 * - allocated
 * - utilized
 * - utilization
 * - reserved
 *
 * OPERATION:
 * - success
 * - failure
 * - error
 * - errors
 * - rejected
 * - dropped
 * - timeout
 * - retry
 * - attempt
 * - skip
 * - drop
 *
 * Requests
 * - requests
 * - responses
 * - connections
 * - operations
 * - flight
 * - queued
 * - failed
 *
 * Performance
 * - usage
 * - utilization
 * - saturation
 * - pressure
 * - load
 *
 */

/**
 * Group metrics by their suffixes into predefined categories.
 *
 * @param metrics List of metric names to group
 * @returns Object with strategies as keys, containing groups of metrics
 */
export function groupByStrategies(metrics: string[]): Record<string, Record<string, string[]>> {
  // Define suffix groups
  const suffixGroups: Record<string, string[]> = {
    'TIME-BASED': ['seconds', 'milliseconds', 'microseconds', 'minutes', 'hours'],
    'SIZE/RESOURCE': ['bytes', 'bits', 'packets', 'inodes', 'kbytes', 'mbytes', 'gigabytes'],
    'STATE/STATUS': ['info', 'state', 'status', 'up', 'enabled', 'active', 'running', 'failed', 'healthy', 'degraded'],
    'RESOURCE USAGE': [
      'free',
      'used',
      'usage',
      'limit',
      'available',
      'capacity',
      'allocated',
      'utilized',
      'utilization',
      'reserved',
    ],
    OPERATION: [
      'success',
      'failure',
      'failures',
      'error',
      'errors',
      'rejected',
      'dropped',
      'timeout',
      'retry',
      'attempt',
      'skip',
      'drop',
    ],
    REQUESTS: ['requests', 'responses', 'connections', 'operations', 'flight', 'queued', 'failed'],
    PERFORMANCE: ['saturation', 'pressure', 'load'],
  };

  // Initialize result object with suffix strategy
  const result: Record<string, Record<string, string[]>> = {
    suffix: {},
  };

  // Initialize empty arrays for each group in the suffix strategy
  Object.keys(suffixGroups).forEach((group) => {
    result.suffix[group] = [];
  });
  // Add an "OTHER" category for metrics that don't match any group
  result.suffix['OTHER'] = [];

  // Process each metric
  for (const metric of metrics) {
    // Skip metrics containing ":"
    if (metric.includes(':')) {
      continue;
    }

    // Split by delimiters to find the suffix
    let parts: string[] = [];
    if (metric.includes('_')) {
      parts = metric.split('_');
    } else if (metric.includes('.')) {
      parts = metric.split('.');
    } else {
      // If no delimiter, consider the whole metric as one part
      parts = [metric];
    }

    // Handle special case where suffix is total, bucket, summary, or count
    // Use second to last element instead
    let suffix = parts[parts.length - 1];
    if (parts.length > 1 && ['total', 'bucket', 'summary', 'count'].includes(suffix)) {
      suffix = parts[parts.length - 2];
    }

    // Check which group this suffix belongs to
    let found = false;
    for (const [group, suffixes] of Object.entries(suffixGroups)) {
      if (suffixes.includes(suffix)) {
        result.suffix[group].push(metric);
        found = true;
        break;
      }
    }

    // If not found in any group, add to OTHER
    if (!found) {
      result.suffix['OTHER'].push(metric);
    }
  }

  return result;
}
