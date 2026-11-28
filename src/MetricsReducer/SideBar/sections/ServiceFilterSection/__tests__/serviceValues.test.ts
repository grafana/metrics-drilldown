import { SceneVariableSet, type AdHocFilterWithLabels } from '@grafana/scenes';

import { LabelsDataSource } from 'MetricsReducer/labels/LabelsDataSource';

import { SERVICE_FILTER_SOURCE } from '../serviceFilterBridge';
import { buildTopFiltersMatcher, fetchServiceGroups } from '../serviceValues';

jest.mock('MetricsReducer/labels/LabelsDataSource', () => ({
  LabelsDataSource: { fetchLabelValues: jest.fn() },
}));

const mockFetchLabelValues = LabelsDataSource.fetchLabelValues as jest.Mock;

const managed = (key: string, value: string): AdHocFilterWithLabels => ({
  key,
  operator: '=~',
  value,
  meta: { source: SERVICE_FILTER_SOURCE },
});

describe('buildTopFiltersMatcher', () => {
  test('starts with a nonempty matcher, because Prometheus rejects a selector of exclusions only', () => {
    const filters: AdHocFilterWithLabels[] = [{ key: 'instance', operator: '!=', value: 'host-1' }];

    expect(buildTopFiltersMatcher(filters, 'job')).toBe('{__name__=~".+",instance!="host-1"}');
  });

  test('returns undefined when there are no filters', () => {
    expect(buildTopFiltersMatcher([], 'service_name')).toBeUndefined();
  });

  test('returns undefined when the only filter is the managed filter of the key', () => {
    expect(buildTopFiltersMatcher([managed('service_name', 'cart')], 'service_name')).toBeUndefined();
  });

  test('builds a selector from the top filters', () => {
    const filters: AdHocFilterWithLabels[] = [
      { key: 'instance', operator: '=', value: 'host-1' },
      { key: 'pod', operator: '!~', value: 'tmp.*' },
    ];

    expect(buildTopFiltersMatcher(filters, 'service_name')).toBe('{__name__=~".+",instance="host-1",pod!~"tmp.*"}');
  });

  test('leaves out the managed filter of the key but keeps the managed filter of the other label', () => {
    const filters = [managed('service_name', 'cart'), managed('job', 'shop/cart')];

    expect(buildTopFiltersMatcher(filters, 'service_name')).toBe('{__name__=~".+",job=~"shop/cart"}');
    expect(buildTopFiltersMatcher(filters, 'job')).toBe('{__name__=~".+",service_name=~"cart"}');
  });

  test('keeps a filter that the user typed for the same label', () => {
    const filters: AdHocFilterWithLabels[] = [{ key: 'service_name', operator: '=', value: 'cart' }];

    expect(buildTopFiltersMatcher(filters, 'service_name')).toBe('{__name__=~".+",service_name="cart"}');
  });

  test('leaves out the __name__ filters', () => {
    const filters: AdHocFilterWithLabels[] = [
      { key: '__name__', operator: '=', value: 'up' },
      { key: 'instance', operator: '=', value: 'host-1' },
    ];

    expect(buildTopFiltersMatcher(filters, 'service_name')).toBe('{__name__=~".+",instance="host-1"}');
  });

  test('escapes the quotes and backslashes of a value', () => {
    const filters: AdHocFilterWithLabels[] = [{ key: 'path', operator: '=', value: 'a"b\\c' }];

    expect(buildTopFiltersMatcher(filters, 'service_name')).toBe('{__name__=~".+",path="a\\"b\\\\c"}');
  });
});

describe('fetching the services', () => {
  const scene = new SceneVariableSet({ variables: [] });

  beforeEach(() => {
    mockFetchLabelValues.mockReset();
  });

  test('fetchServiceGroups sorts the jobs without duplicates or empty ones', async () => {
    mockFetchLabelValues.mockResolvedValue(['shop/cart', '', 'prod/checkout', 'shop/cart']);

    expect(await fetchServiceGroups(scene, [])).toEqual([
      { service: 'cart', jobs: ['shop/cart'] },
      { service: 'checkout', jobs: ['prod/checkout'] },
    ]);
  });

  test.each([
    ['a space', ' '],
    ['several spaces', '   '],
    ['a tab and a new line', '\t\n'],
    ['a non-breaking space', ' '],
    ['a zero width space', '​'],
    ['a byte order mark', '﻿'],
    ['a soft hyphen', '­'],
    ['white space around invisible characters', ' ​  '],
    ['a control character', '\u0001'],
    ['a delete character', '\u007f'],
    ['a next line character', '\u0085'],
    ['control characters around white space', '\u0001 \u0002'],
  ])('fetchServiceGroups leaves out a job made of %s, which would show as an empty row', async (_name, blank) => {
    mockFetchLabelValues.mockResolvedValue([blank, 'shop/cart', blank + blank, 'prod/checkout']);

    expect(await fetchServiceGroups(scene, [])).toEqual([
      { service: 'cart', jobs: ['shop/cart'] },
      { service: 'checkout', jobs: ['prod/checkout'] },
    ]);
  });

  test('fetchServiceGroups keeps a job that has a control character between visible characters, unchanged', async () => {
    mockFetchLabelValues.mockResolvedValue(['shop/ca\u0001rt']);

    const groups = await fetchServiceGroups(scene, []);

    expect(groups.flatMap((group) => group.jobs)).toEqual(['shop/ca\u0001rt']);
  });

  test('fetchServiceGroups keeps a job that has white space around visible characters, unchanged', async () => {
    mockFetchLabelValues.mockResolvedValue(['a b/cart', 'checkout ']);

    const groups = await fetchServiceGroups(scene, []);

    expect(groups.flatMap((group) => group.jobs)).toEqual(['a b/cart', 'checkout ']);
  });

  test('fetchServiceGroups passes the matcher of the top filters', async () => {
    mockFetchLabelValues.mockResolvedValue([]);

    await fetchServiceGroups(scene, [{ key: 'instance', operator: '=', value: 'host-1' }, managed('job', 'shop/cart')]);

    expect(mockFetchLabelValues).toHaveBeenCalledWith('job', scene, '{__name__=~".+",instance="host-1"}');
  });

  test('fetchServiceGroups returns an empty list when the datasource gives no value', async () => {
    mockFetchLabelValues.mockResolvedValue([]);

    expect(await fetchServiceGroups(scene, [])).toEqual([]);
  });

  test('fetchServiceGroups asks for job and groups the jobs by service', async () => {
    mockFetchLabelValues.mockResolvedValue(['staging/checkout', 'shop/cart', 'prod/checkout', 'prometheus']);

    const groups = await fetchServiceGroups(scene, []);

    expect(groups).toEqual([
      { service: 'cart', jobs: ['shop/cart'] },
      { service: 'checkout', jobs: ['prod/checkout', 'staging/checkout'] },
      { service: 'prometheus', jobs: ['prometheus'] },
    ]);
    expect(mockFetchLabelValues).toHaveBeenCalledWith('job', scene, undefined);
  });

  test('fetchServiceGroups leaves out its own managed filter and keeps the service_name one', async () => {
    mockFetchLabelValues.mockResolvedValue([]);

    await fetchServiceGroups(scene, [managed('job', 'shop/cart'), managed('service_name', 'cart')]);

    expect(mockFetchLabelValues).toHaveBeenCalledWith('job', scene, '{__name__=~".+",service_name=~"cart"}');
  });
});
