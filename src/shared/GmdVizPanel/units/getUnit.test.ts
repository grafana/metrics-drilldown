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

  it('should return the unit for hardware and energy metric suffixes', () => {
    expect(getUnitFromMetric('node_cpu_scaling_frequency_hertz')).toBe('hertz');
    expect(getUnitFromMetric('node_hwmon_temp_celsius')).toBe('celsius');
    expect(getUnitFromMetric('node_hwmon_in_volts')).toBe('volts');
    expect(getUnitFromMetric('node_hwmon_curr_amperes')).toBe('amperes');
    expect(getUnitFromMetric('node_rapl_package_joules')).toBe('joules');
    expect(getUnitFromMetric('node_hwmon_power_watts')).toBe('watts');
  });

  it('should return the unit for ratio suffix', () => {
    expect(getUnitFromMetric('cache_hit_ratio')).toBe('ratio');
  });

  it('should find the real unit when metric ends with _total', () => {
    expect(getUnitFromMetric('node_rapl_package_joules_total')).toBe('joules');
    expect(getUnitFromMetric('node_hwmon_temp_celsius_total')).toBe('celsius');
    expect(getUnitFromMetric('node_cpu_scaling_frequency_hertz_total')).toBe('hertz');
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

  it('should return the mapped Grafana unit for new suffixes', () => {
    expect(getUnit('node_cpu_scaling_frequency_hertz')).toBe('hertz');
    expect(getUnit('node_hwmon_temp_celsius')).toBe('celsius');
    expect(getUnit('node_hwmon_in_volts')).toBe('volt');
    expect(getUnit('node_hwmon_curr_amperes')).toBe('amp');
    expect(getUnit('node_rapl_package_joules')).toBe('joule');
    expect(getUnit('node_hwmon_power_watts')).toBe('watt');
    expect(getUnit('cache_hit_ratio')).toBe('percentunit');
  });

  it('should handle case insensitivity for new suffixes', () => {
    expect(getUnit('NODE_CPU_SCALING_FREQUENCY_HERTZ')).toBe('hertz');
    expect(getUnit('NODE_HWMON_TEMP_CELSIUS')).toBe('celsius');
  });
});

describe('getPerSecondRateUnit', () => {
  it('should return the mapped rate unit for a valid metric part', () => {
    expect(getPerSecondRateUnit('bytes')).toBe(RATE_BYTES_PER_SECOND);
    expect(getPerSecondRateUnit('seconds')).toBe('none');
  });

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

  it('should return correct rate units for new suffixes', () => {
    expect(getPerSecondRateUnit('node_cpu_scaling_frequency_hertz')).toBe('none');
    expect(getPerSecondRateUnit('node_hwmon_temp_celsius')).toBe('cps');
    expect(getPerSecondRateUnit('node_hwmon_in_volts')).toBe('cps');
    expect(getPerSecondRateUnit('node_hwmon_curr_amperes')).toBe('cps');
    expect(getPerSecondRateUnit('node_rapl_package_joules')).toBe('watt');
    expect(getPerSecondRateUnit('node_hwmon_power_watts')).toBe('cps');
    expect(getPerSecondRateUnit('cache_hit_ratio')).toBe('percentunit');
  });
});
