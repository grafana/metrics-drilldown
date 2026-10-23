import { getMetricTypeSync } from 'shared/GmdVizPanel/matchers/getMetricType';

import { sortRelatedMetrics } from '../sortRelatedMetrics';
import {
  type RankingCandidate,
  type RankingMetric,
  type RankingMetricType,
  type RelatedMetricsRankingRequest,
} from './types';

const METRIC_NAME = /^[a-zA-Z_:][a-zA-Z0-9_:]*$/;
const LABEL_NAME = /^[a-zA-Z_]\w*$/;

export type MetadataPeek = (metric: string) =>
  | {
      type?: string;
      unit?: string;
      help?: string;
    }
  | undefined;

export type LabelNamesLookup = (metric: string) => Promise<string[]>;

function metricType(metadataType: string | undefined, name: string): RankingMetricType {
  if (metadataType) {
    if (metadataType === 'classic-histogram') {
      return 'histogram';
    }
    if (metadataType === 'status-updown' || metadataType === 'age') {
      return 'gauge';
    }
    if (['counter', 'gauge', 'histogram', 'summary', 'native-histogram', 'info', 'unknown'].includes(metadataType)) {
      return metadataType as RankingMetricType;
    }
  }

  const inferred = getMetricTypeSync(name);
  if (inferred === 'classic-histogram') {
    return 'histogram';
  }
  if (inferred === 'status-updown' || inferred === 'age') {
    return 'gauge';
  }
  return inferred as RankingMetricType;
}

function labelsOnly(labels: string[] | undefined): string[] | undefined {
  const result = labels?.filter((label) => label !== '__name__' && LABEL_NAME.test(label)).slice(0, 30);
  return result?.length ? result : undefined;
}

export function metricFeatures(name: string, peekMetadata: MetadataPeek, labels?: string[]): RankingMetric {
  const metadata = peekMetadata(name);
  const feature: RankingMetric = { name, type: metricType(metadata?.type, name) };
  if (metadata?.unit) {
    feature.unit = metadata.unit.slice(0, 32);
  }
  if (metadata?.help) {
    feature.help = metadata.help.slice(0, 300);
  }
  const labelNames = labelsOnly(labels);
  if (labelNames) {
    feature.labelNames = labelNames;
  }
  return feature;
}

export async function buildRankingRequest({
  selectedMetric,
  metricNames,
  peekMetadata,
  lookupLabelNames,
  datasourceUid,
}: {
  selectedMetric: string;
  metricNames: string[];
  peekMetadata: MetadataPeek;
  lookupLabelNames: LabelNamesLookup;
  datasourceUid?: string;
}): Promise<{ request: RelatedMetricsRankingRequest; candidatesById: Map<string, string> }> {
  const baseline = sortRelatedMetrics([...metricNames], selectedMetric);
  const names = [...new Set(baseline)].filter((name) => name !== selectedMetric && METRIC_NAME.test(name)).slice(0, 40);
  const labelResults = await Promise.all(
    names.map(async (name) => {
      try {
        return await lookupLabelNames(name);
      } catch {
        return [];
      }
    })
  );
  let selectedLabels: string[] = [];
  try {
    selectedLabels = await lookupLabelNames(selectedMetric);
  } catch {
    // Labels are optional request context.
  }

  const candidatesById = new Map<string, string>();
  const candidates: RankingCandidate[] = names.map((name, index) => {
    const id = `c${String(index + 1).padStart(2, '0')}`;
    candidatesById.set(id, name);
    return {
      id,
      ...metricFeatures(name, peekMetadata, labelResults[index]),
      baselineRank: index + 1,
    };
  });
  const selected = metricFeatures(selectedMetric, peekMetadata, selectedLabels);
  const request: RelatedMetricsRankingRequest = {
    schemaVersion: 1,
    ...(datasourceUid ? { datasourceUid } : {}),
    selected,
    candidates,
  };
  return { request, candidatesById };
}

export const isValidMetricName = (name: string) => METRIC_NAME.test(name);
