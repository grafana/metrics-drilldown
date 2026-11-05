export type SemconvInstrument = 'counter' | 'gauge' | 'histogram' | 'updowncounter';

export type SemconvStability = 'alpha' | 'beta' | 'development' | 'experimental' | 'release_candidate' | 'stable';

export interface SemconvDeprecation {
  reason: 'obsoleted' | 'renamed' | 'uncategorized';
  renamedTo?: string;
}

export interface SemconvEnumMember {
  brief?: string;
  deprecated?: boolean;
  value: number | string;
}

export interface SemconvAttribute {
  brief: string;
  deprecated?: SemconvDeprecation;
  members?: SemconvEnumMember[];
  stability: SemconvStability;
  type: string;
}

export interface SemconvMetric {
  attributes: string[];
  brief: string;
  deprecated?: SemconvDeprecation;
  instrument: SemconvInstrument;
  stability: SemconvStability;
  unit: string;
}

export interface SemconvMeta {
  license: string;
  semconvVersion: string;
  source: string;
  weaverVersion: string;
}

/** Shape of semconv.generated.json, written by scripts/semconv/generate.sh. Keys are OTel dotted names. */
export interface SemconvData {
  _meta: SemconvMeta;
  attributes: Record<string, SemconvAttribute>;
  metrics: Record<string, SemconvMetric>;
}
