import { Expression, promql } from 'tsqtsq';

import { VAR_FILTERS } from 'shared/shared';

import { LabelMatcher } from '../shared/GmdVizPanel/buildQueryExpression';

/**
 * Parses a PromQL expression to extract the metric name and label matchers.
 * This is used when loading saved queries from the Query Library.
 *
 * @param expr - The PromQL expression string (e.g., 'metric_name{label="value",other="test"}')
 * @returns Object containing the metric name and array of label matchers
 */
export function parsePrometheusQuery(expr: string): {
  metric: string;
  labelMatchers: LabelMatcher[];
} {
  try {
    // Parse the expression using tsqtsq
    const parsed = promql.parse(expr);

    // Extract metric name and label matchers from the parsed expression
    // The expression format is: metric_name{label1="value1",label2="value2"}
    // or for UTF-8 metrics: {__name__="metric_name",label1="value1"}

    let metric = '';
    const labelMatchers: LabelMatcher[] = [];

    // Use regex to extract metric name and labels
    // Match: optional_metric{labels} or just {labels}
    const metricRegex = /^([a-zA-Z_:][a-zA-Z0-9_:]*)?(?:\{([^}]*)\})?/;
    const match = expr.match(metricRegex);

    if (match) {
      // Get metric name from the first capture group (if present)
      if (match[1]) {
        metric = match[1];
      }

      // Parse labels from the second capture group
      if (match[2]) {
        const labelsStr = match[2];
        // Split by comma, but be careful with quoted values that might contain commas
        const labelPairs = splitLabelPairs(labelsStr);

        for (const pair of labelPairs) {
          const labelMatch = pair.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*(=~|!=|!~|=)\s*"([^"]*)"/);
          if (labelMatch) {
            const [, key, operator, value] = labelMatch;

            // Skip special labels used for query building
            if (key === '__ignore_usage__' || key.includes(VAR_FILTERS)) {
              continue;
            }

            // If __name__ is found, that's the metric name (UTF-8 case)
            if (key === '__name__') {
              metric = value;
              continue;
            }

            labelMatchers.push({
              key,
              operator,
              value,
            });
          }
        }
      }
    }

    return { metric, labelMatchers };
  } catch (error) {
    console.error('Failed to parse PromQL expression:', error);
    // Return empty result on parse error
    return { metric: '', labelMatchers: [] };
  }
}

/**
 * Splits label pairs by comma, handling quoted values that may contain commas
 */
function splitLabelPairs(labelsStr: string): string[] {
  const pairs: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < labelsStr.length; i++) {
    const char = labelsStr[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === ',' && !inQuotes) {
      if (current.trim()) {
        pairs.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }

  // Add the last pair
  if (current.trim()) {
    pairs.push(current.trim());
  }

  return pairs;
}
