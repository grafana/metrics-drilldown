import { DEFAULT_TIMESERIES_AGE_PRESETS } from '../config-presets-ages';
import { DEFAULT_HISTOGRAMS_PRESETS } from '../config-presets-histograms';
import { DEFAULT_TIMESERIES_INFO_PRESETS } from '../config-presets-infos';
import { DEFAULT_STATUS_UP_DOWN_PRESETS } from '../config-presets-status-updown';
import { DEFAULT_TIMESERIES_PRESETS, DEFAULT_TIMESERIES_RATE_PRESETS } from '../config-presets-timeseries';
import { getConfigPresetsForMetric } from '../getConfigPresetsForMetric';

describe('getConfigPresetsForMetric(metricType)', () => {
  it('returns histogram presets for native-histogram (regression for #1228)', () => {
    expect(getConfigPresetsForMetric('native-histogram')).toEqual(Object.values(DEFAULT_HISTOGRAMS_PRESETS));
  });

  it('returns histogram presets for classic-histogram', () => {
    expect(getConfigPresetsForMetric('classic-histogram')).toEqual(Object.values(DEFAULT_HISTOGRAMS_PRESETS));
  });

  it('returns rate presets for counter', () => {
    expect(getConfigPresetsForMetric('counter')).toEqual(Object.values(DEFAULT_TIMESERIES_RATE_PRESETS));
  });

  it('returns age presets prefixed with the default timeseries preset for age', () => {
    expect(getConfigPresetsForMetric('age')).toEqual([
      Object.values(DEFAULT_TIMESERIES_PRESETS)[0],
      ...Object.values(DEFAULT_TIMESERIES_AGE_PRESETS),
    ]);
  });

  it('returns status-updown presets for status-updown', () => {
    expect(getConfigPresetsForMetric('status-updown')).toEqual(Object.values(DEFAULT_STATUS_UP_DOWN_PRESETS));
  });

  it('returns info presets for info', () => {
    expect(getConfigPresetsForMetric('info')).toEqual(Object.values(DEFAULT_TIMESERIES_INFO_PRESETS));
  });

  it('falls back to the default timeseries presets for gauge', () => {
    expect(getConfigPresetsForMetric('gauge')).toEqual(Object.values(DEFAULT_TIMESERIES_PRESETS));
  });
});
