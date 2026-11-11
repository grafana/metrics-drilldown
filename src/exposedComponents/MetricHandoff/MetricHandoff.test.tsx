import { locationService } from '@grafana/runtime';
import { render, screen, within } from '@testing-library/react';
import React from 'react';

import { MetricHandoff } from './MetricHandoff';
import { type MetricHandoffProps } from './types';

jest.mock('@grafana/i18n', () => ({
  ...jest.requireActual('@grafana/i18n'),
  t: (_key: string, defaultValue: string) => defaultValue,
}));

const scope: MetricHandoffProps = {
  dataSourceUid: 'prom-one',
  from: 'now-1h',
  to: 'now',
  queries: [{ refId: 'A', expr: 'up' }],
  metric: 'up',
  filters: [{ key: 'job', operator: '=', value: 'one' }],
  groupBy: 'instance',
};

function link(container: HTMLElement, name: string) {
  return within(container).getByRole('link', { name }).getAttribute('href')!;
}

function params(url: string) {
  return new URL(url, 'https://grafana.example').searchParams;
}

describe('MetricHandoff', () => {
  afterEach(() => jest.restoreAllMocks());

  it('renders independent scoped links outside scene ancestry without owning the browser URL', () => {
    const push = jest.spyOn(locationService, 'push');
    const replace = jest.spyOn(locationService, 'replace');
    const partial = jest.spyOn(locationService, 'partial');
    const originalUrl = window.location.href;
    const other: MetricHandoffProps = {
      ...scope,
      dataSourceUid: 'prom-two',
      from: 1700000000000,
      to: 1700003600000,
      queries: [{ refId: 'second', expr: 'sum(errors_total)' }],
      metric: 'errors_total',
      filters: [{ key: 'job', operator: '=~', value: 'two|three' }],
      groupBy: 'region',
    };
    const { rerender } = render(
      <>
        <MetricHandoff {...scope} />
        <MetricHandoff {...other} />
      </>
    );
    const [first, second] = screen.getAllByRole('navigation', { name: 'Metric navigation' });
    const secondExplore = link(second, 'Open in Explore');
    const secondDrilldown = link(second, 'Open metric in Metrics Drilldown');
    expect(params(link(first, 'Open metric in Metrics Drilldown')).getAll('var-filters')).toEqual(['job|=|one']);
    expect(params(secondDrilldown).getAll('var-filters')).toEqual(['job|=~|two__gfp__three']);
    expect(params(secondDrilldown).get('var-groupby')).toBe('region');
    expect(JSON.parse(params(secondExplore).get('left')!)).toMatchObject({
      datasource: 'prom-two',
      queries: [{ refId: 'second', expr: 'sum(errors_total)' }],
      range: { from: '1700000000000', to: '1700003600000' },
    });

    rerender(
      <>
        <MetricHandoff {...scope} dataSourceUid="changed" metric="temperature" />
        <MetricHandoff {...other} />
      </>
    );
    expect(link(second, 'Open in Explore')).toBe(secondExplore);
    expect(link(second, 'Open metric in Metrics Drilldown')).toBe(secondDrilldown);
    expect(params(link(first, 'Open metric in Metrics Drilldown')).get('metric')).toBe('temperature');
    expect(window.location.href).toBe(originalUrl);
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(partial).not.toHaveBeenCalled();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('only offers Explore when no explicit metric context exists', () => {
    render(<MetricHandoff {...scope} metric={undefined} />);
    expect(screen.getByRole('link', { name: 'Open in Explore' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open metric in Metrics Drilldown' })).not.toBeInTheDocument();
  });

  it('renders an accessible warning instead of unusable links for invalid scope', () => {
    render(<MetricHandoff {...scope} from="invalid" />);
    expect(screen.getByRole('alert')).toHaveTextContent('No navigation available');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
