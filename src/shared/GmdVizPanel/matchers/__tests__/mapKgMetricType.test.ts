import { mapKgMetricType } from '../mapKgMetricType';

describe('mapKgMetricType', () => {
  it('maps counter to counter', () => {
    expect(mapKgMetricType('counter')).toBe('counter');
  });

  it('maps gauge to gauge', () => {
    expect(mapKgMetricType('gauge')).toBe('gauge');
  });

  it('maps histogram to classic-histogram', () => {
    expect(mapKgMetricType('histogram')).toBe('classic-histogram');
  });

  it('maps summary to summary', () => {
    expect(mapKgMetricType('summary')).toBe('summary');
  });
});
