import {
  DEFAULT_RATE_UNIT,
  DEFAULT_UNIT,
  getPerSecondRateUnit,
  getUnit,
  getUnitFromMetric,
  RATE_BYTES_PER_SECOND,
  UNIT_BYTES,
  UNIT_SECONDS,
} from './getUnit';

describe('getUnitFromMetric', () => {
  it('should return null for an empty string input', () => {
    expect(getUnitFromMetric('')).toBe(null);
  });

  it('should return the last part of the metric if it is a valid unit', () => {
    expect(getUnitFromMetric('go_gc_gomemlimit_bytes')).toBe(UNIT_BYTES);
    expect(getUnitFromMetric('go_gc_duration_seconds')).toBe(UNIT_SECONDS);
  });

  it('should return null if no valid unit is found', () => {
    expect(getUnitFromMetric('ALERTS')).toBe(null);
    expect(getUnitFromMetric('utf8 metric with.dot')).toBe(null);
  });

  it('should handle metrics with extra underscores', () => {
    expect(getUnitFromMetric('go_gc__duration__seconds')).toBe(UNIT_SECONDS);
  });

  it('should return null if the metric ends with an invalid unit', () => {
    expect(getUnitFromMetric('go_gc_duration_invalidunit')).toBe(null);
  });

  it('should return the last unit if the metric contains only valid units', () => {
    expect(getUnitFromMetric('bytes_seconds')).toBe(UNIT_SECONDS);
  });
});

describe('getUnit', () => {
  it('should return the mapped unit for a valid metric part', () => {
    expect(getUnit('bytes')).toBe('bytes');
    expect(getUnit('seconds')).toBe('s');
  });

  it('should return the default unit if the metric part is an empty string', () => {
    expect(getUnit('')).toBe(DEFAULT_UNIT);
  });

  it('should return the default unit if the metric part is not in UNIT_MAP', () => {
    expect(getUnit('invalidPart')).toBe(DEFAULT_UNIT);
  });

  it('should handle case sensitivity correctly', () => {
    expect(getUnit('BYTES')).toBe(UNIT_BYTES);
    expect(getUnit('SECONDS')).toBe('s');
  });

  it('should not throw errors for unusual input', () => {
    expect(() => getUnit('123')).not.toThrow();
    expect(() => getUnit('some_random_string')).not.toThrow();
  });
});

describe('getPerSecondRateUnit', () => {
  it('should return the mapped rate unit for a valid metric part', () => {
    expect(getPerSecondRateUnit('bytes')).toBe(RATE_BYTES_PER_SECOND);
    expect(getPerSecondRateUnit('seconds')).toBe('none');
  });

  it('should return the default rate unit if the metric part is undefined', () => {});

  it('should return the default rate unit if the metric part is an empty string', () => {
    expect(getPerSecondRateUnit('')).toBe(DEFAULT_RATE_UNIT);
  });

  it('should return the default rate unit if the metric part is not in RATE_UNIT_MAP', () => {
    expect(getPerSecondRateUnit('invalidPart')).toBe(DEFAULT_RATE_UNIT);
  });

  it('should handle case sensitivity correctly', () => {
    expect(getPerSecondRateUnit('BYTES')).toBe(RATE_BYTES_PER_SECOND);
  });

  it('should not throw errors for unusual input', () => {
    expect(() => getPerSecondRateUnit('123')).not.toThrow();
    expect(() => getPerSecondRateUnit('some_random_string')).not.toThrow();
  });
});
