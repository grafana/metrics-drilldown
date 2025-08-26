import { parseMatcher } from '../parseMatcher';

describe('parseMatcher(matcher)', () => {
  test.each([
    ['alertname=ErrorRatioBreach', { key: 'alertname', operator: '=', value: 'ErrorRatioBreach' }],
    ['alertname!=ErrorRatioBreach', { key: 'alertname', operator: '!=', value: 'ErrorRatioBreach' }],
    ['alertname=~ErrorRatioBreach', { key: 'alertname', operator: '=~', value: 'ErrorRatioBreach' }],
    ['alertname=~Error.+', { key: 'alertname', operator: '=~', value: 'Error.+' }],
    ['alertname=~.+Error', { key: 'alertname', operator: '=~', value: '.+Error' }],
    ['alertname!~ErrorRatioBreach', { key: 'alertname', operator: '!~', value: 'ErrorRatioBreach' }],
    ['alertname!~Error.+', { key: 'alertname', operator: '!~', value: 'Error.+' }],
    ['alertname!~.+Error', { key: 'alertname', operator: '!~', value: '.+Error' }],
    ['p99<42', { key: 'p99', operator: '<', value: '42' }],
    ['p99>42', { key: 'p99', operator: '>', value: '42' }],
    [
      'component_id=otelcol.exporter.otlp.tail_sampler',
      { key: 'component_id', operator: '=', value: 'otelcol.exporter.otlp.tail_sampler' },
    ],
    [
      'component_id!=otelcol.exporter.otlp.tail_sampler',
      { key: 'component_id', operator: '!=', value: 'otelcol.exporter.otlp.tail_sampler' },
    ],
    ['component_id=~.*exporter.*', { key: 'component_id', operator: '=~', value: '.*exporter.*' }],
    ['component_id!~.*exporter.*', { key: 'component_id', operator: '!~', value: '.*exporter.*' }],
  ])('%s', (matcher, expectedFilter) => {
    expect(parseMatcher(matcher)).toStrictEqual(expectedFilter);
  });
});
