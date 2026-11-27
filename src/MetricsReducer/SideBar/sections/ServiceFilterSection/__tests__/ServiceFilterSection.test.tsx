import { urlUtil } from '@grafana/data';
import {
  AdHocFiltersVariable,
  CustomVariable,
  EmbeddedScene,
  SceneFlexItem,
  SceneFlexLayout,
  SceneTimeRange,
  sceneUtils,
  SceneVariableSet,
  type AdHocFilterWithLabels,
} from '@grafana/scenes';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';

import { LabelsDataSource } from 'MetricsReducer/labels/LabelsDataSource';
import { isKgAnnotationsAvailable } from 'shared/knowledgeGraph/kgAnnotations';
import { logger } from 'shared/logger/logger';
import { VAR_DATASOURCE, VAR_FILTERS } from 'shared/shared';

import { EventSectionValueChanged } from '../../EventSectionValueChanged';
import { fetchInstrumentedServices } from '../knowledgeGraphServices';
import { SERVICE_FILTER_SOURCE } from '../serviceFilterBridge';
import { SERVICE_FILTER_SECTION_KEY, ServiceFilterSection } from '../ServiceFilterSection';
import { joinUrlValues } from '../serviceUrlValues';

jest.mock('MetricsReducer/labels/LabelsDataSource', () => ({
  LabelsDataSource: { fetchLabelValues: jest.fn() },
}));

jest.mock('shared/knowledgeGraph/kgAnnotations', () => ({ isKgAnnotationsAvailable: jest.fn() }));

jest.mock('../knowledgeGraphServices', () => ({ fetchInstrumentedServices: jest.fn() }));

jest.mock('shared/logger/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn() } }));

const mockFetchLabelValues = LabelsDataSource.fetchLabelValues as jest.Mock;
const mockIsKgAvailable = isKgAnnotationsAvailable as jest.Mock;
const mockFetchKgServices = fetchInstrumentedServices as jest.Mock;
const mockLoggerError = logger.error as jest.Mock;

// The job tab lists these as the services cart, checkout (two jobs) and prometheus
const JOBS = ['staging/checkout', 'shop/cart', 'prod/checkout', 'prometheus'];

const JOB_URL_KEY = 'filters-service-job';

const linksOf = (element: HTMLElement) =>
  within(element)
    .getAllByRole('link')
    .map((link) => [link.textContent, link.getAttribute('href')]);
const MORE_URL_KEY = 'filters-service-more';

function mockLabelValues(values: Record<string, string[]> = { job: JOBS }) {
  mockFetchLabelValues.mockImplementation((label: string) => Promise.resolve(values[label] ?? []));
}

function setup(
  filters: AdHocFilterWithLabels[] = [],
  /** Runs after the scene is active and before the section starts watching, like the URL restore before the sidebar activates */
  beforeWatch?: (section: ServiceFilterSection) => void
) {
  const filtersVariable = new AdHocFiltersVariable({
    key: VAR_FILTERS,
    name: VAR_FILTERS,
    datasource: null,
    applyMode: 'manual',
    allowCustomValue: true,
    filters,
  });
  const dataSourceVariable = new CustomVariable({ name: VAR_DATASOURCE, query: 'ds1,ds2', value: 'ds1' });
  const section = new ServiceFilterSection({
    key: SERVICE_FILTER_SECTION_KEY,
    title: 'Service filters',
    description: 'Filter metrics by service',
    icon: 'cube',
  });
  const timeRange = new SceneTimeRange({ from: 'now-1h', to: 'now' });
  const scene = new EmbeddedScene({
    $timeRange: timeRange,
    $variables: new SceneVariableSet({ variables: [filtersVariable, dataSourceVariable] }),
    body: new SceneFlexLayout({ children: [new SceneFlexItem({ body: section })] }),
  });

  scene.activate();

  const onValueChanged = jest.fn();
  scene.subscribeToEvent(EventSectionValueChanged, (event) => onValueChanged(event.payload));

  beforeWatch?.(section);

  const stopWatching = section.watchFilters();

  return { section, scene, filtersVariable, dataSourceVariable, timeRange, onValueChanged, stopWatching };
}

const managedFilters = (filters: AdHocFilterWithLabels[]) =>
  filters.filter((f) => (f.meta as { source?: string } | undefined)?.source === SERVICE_FILTER_SOURCE);

describe('ServiceFilterSection', () => {
  beforeEach(() => {
    mockFetchLabelValues.mockReset();
    mockLabelValues();
    mockIsKgAvailable.mockReset();
    mockIsKgAvailable.mockResolvedValue(false);
    mockFetchKgServices.mockReset();
    mockFetchKgServices.mockResolvedValue({ services: [], truncated: false });
    mockLoggerError.mockReset();
  });

  describe('source of the list', () => {
    const KG_SERVICES = [
      { service: 'cart', jobs: ['other-cluster/cart', 'shop/cart'] },
      { service: 'not-in-this-data-source', jobs: ['x/unknown'] },
      { service: 'prometheus', jobs: ['prometheus'] },
    ];

    /** Renders the section and waits until the list has loaded */
    async function openSection(setupResult: ReturnType<typeof setup>) {
      render(<setupResult.section.Component model={setupResult.section} />);
      await screen.findByTestId('service-filter-list');
    }

    const rows = () =>
      screen.getAllByRole('checkbox').flatMap((box) => {
        const item = box.closest('li');

        return item ? [item.textContent] : [];
      });

    describe('without a Knowledge Graph data source', () => {
      it('lists the services found in the jobs, once per service, with the jobs of a service as its title', async () => {
        await openSection(setup());

        expect(
          screen.getByText('No Knowledge Graph found, so services are read from the job label')
        ).toBeInTheDocument();
        expect(rows()).toEqual(['cart', 'checkout', 'prometheus']);
        expect(screen.getByLabelText('checkout').closest('li')).toHaveAttribute(
          'title',
          'prod/checkout, staging/checkout'
        );
      });

      it('does not ask the Knowledge Graph', async () => {
        await openSection(setup());

        expect(mockFetchKgServices).not.toHaveBeenCalled();
      });

      it('fetches the jobs and nothing else when the section opens', async () => {
        const result = setup();
        await openSection(result);

        expect(mockFetchLabelValues).toHaveBeenCalledWith('job', result.section, undefined);
        expect(mockFetchLabelValues.mock.calls.map(([label]) => label)).toEqual(['job']);
      });

      it('has no tabs', async () => {
        await openSection(setup());

        expect(screen.queryAllByRole('tab')).toHaveLength(0);
      });

      it('explains what a job is and how OpenTelemetry sets it, with links to the sources', async () => {
        await openSection(setup());

        fireEvent.mouseEnter(screen.getByRole('button', { name: 'About this list' }));
        const help = await screen.findByRole('tooltip');

        expect(within(help).getByText(/Services are read from the job label/)).toBeInTheDocument();
        expect(within(help).getByText(/a group of scrape targets with the same purpose/)).toBeInTheDocument();
        expect(
          within(help).getByText(/service\.namespace\/service\.name, or service\.name when there is no namespace/)
        ).toBeInTheDocument();
        expect(within(help).getByText(/reads the part after the first slash as the service name/)).toBeInTheDocument();
        expect(linksOf(help)).toEqual([
          ['Prometheus: jobs and instances', 'https://prometheus.io/docs/concepts/jobs_instances/'],
          [
            'OpenTelemetry: Prometheus compatibility',
            'https://opentelemetry.io/docs/specs/otel/compatibility/prometheus_and_openmetrics/',
          ],
          [
            'Grafana Cloud: OTLP format considerations',
            'https://grafana.com/docs/grafana-cloud/send-data/otlp/otlp-format-considerations/',
          ],
        ]);
      });

      it('has no help button while the list loads', async () => {
        mockFetchLabelValues.mockReturnValue(new Promise(() => {}));
        const { section } = setup();

        render(<section.Component model={section} />);
        await act(async () => {});

        expect(screen.queryByRole('button', { name: 'About this list' })).not.toBeInTheDocument();
      });

      it('does not offer a choice of services, because the list already has them all', async () => {
        await openSection(setup());

        expect(screen.queryByRole('checkbox', { name: 'Include all jobs' })).not.toBeInTheDocument();
      });

      it('uses the job label when checking for the data source fails', async () => {
        mockIsKgAvailable.mockRejectedValue(new Error('no list'));

        await openSection(setup());

        expect(
          screen.getByText('No Knowledge Graph found, so services are read from the job label')
        ).toBeInTheDocument();
        expect(mockFetchKgServices).not.toHaveBeenCalled();
      });
    });

    describe('with a Knowledge Graph data source', () => {
      beforeEach(() => {
        mockIsKgAvailable.mockResolvedValue(true);
        mockFetchKgServices.mockResolvedValue({ services: KG_SERVICES, truncated: false });
      });

      it('asks the Knowledge Graph when the section opens, for the time range of the page', async () => {
        await openSection(setup());

        expect(mockFetchKgServices).toHaveBeenCalledTimes(1);
        expect(mockFetchKgServices).toHaveBeenCalledWith({ start: expect.any(Number), end: expect.any(Number) });
      });

      it('lists its services that have jobs in the data source, and leaves out the other services of the jobs', async () => {
        await openSection(setup());

        expect(screen.getByText('Services from the Knowledge Graph')).toBeInTheDocument();
        // checkout has jobs in the data source, and the Knowledge Graph does not know it
        expect(rows()).toEqual(['cart', 'prometheus']);
        expect(screen.getByLabelText('cart').closest('li')).toHaveAttribute('title', 'shop/cart');
        expect(screen.queryByLabelText('not-in-this-data-source')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('checkout')).not.toBeInTheDocument();
      });

      it('has no tabs', async () => {
        await openSection(setup());

        expect(screen.queryAllByRole('tab')).toHaveLength(0);
      });

      it('explains the Knowledge Graph list and the Include all jobs option, with links to the sources', async () => {
        await openSection(setup());

        fireEvent.mouseEnter(screen.getByRole('button', { name: 'About this list' }));
        const help = await screen.findByRole('tooltip');

        expect(
          within(help).getByText(/Services come from the Knowledge Graph, which lists services that are instrumented/)
        ).toBeInTheDocument();
        expect(within(help).getByText(/Selecting a service filters the metrics by its job values/)).toBeInTheDocument();
        expect(
          within(help).getByText(/a group of scrape targets with the same purpose, so these can be exporters/)
        ).toBeInTheDocument();
        expect(linksOf(help)).toEqual([
          ['Knowledge graph introduction', 'https://grafana.com/docs/grafana-cloud/knowledge-graph/introduction/'],
          ['Prometheus: jobs and instances', 'https://prometheus.io/docs/concepts/jobs_instances/'],
        ]);
      });

      it('explains only the Knowledge Graph list when there are no other jobs to add', async () => {
        mockFetchKgServices.mockResolvedValue({
          services: [
            { service: 'cart', jobs: ['shop/cart'] },
            { service: 'checkout', jobs: ['prod/checkout', 'staging/checkout'] },
            { service: 'prometheus', jobs: ['prometheus'] },
          ],
          truncated: false,
        });
        await openSection(setup());

        fireEvent.mouseEnter(screen.getByRole('button', { name: 'About this list' }));
        const help = await screen.findByRole('tooltip');

        expect(within(help).queryByText(/The Include all jobs option/)).not.toBeInTheDocument();
        expect(linksOf(help)).toEqual([
          ['Knowledge graph introduction', 'https://grafana.com/docs/grafana-cloud/knowledge-graph/introduction/'],
        ]);
      });

      it('uses the job list, with no notice, when none of its services have jobs in the data source', async () => {
        mockFetchKgServices.mockResolvedValue({
          services: [{ service: 'elsewhere', jobs: ['x/elsewhere'] }],
          truncated: false,
        });

        await openSection(setup());

        expect(
          screen.getByText(
            'The Knowledge Graph lists no services for this data source, so services are read from the job label'
          )
        ).toBeInTheDocument();
        expect(rows()).toEqual(['cart', 'checkout', 'prometheus']);
        expect(screen.queryByText('Services from the Knowledge Graph')).not.toBeInTheDocument();
        expect(screen.queryByRole('checkbox', { name: 'Include all jobs' })).not.toBeInTheDocument();
      });

      describe('when its request fails', () => {
        beforeEach(() => {
          mockFetchKgServices.mockRejectedValueOnce(new Error('503'));
        });

        it('uses the job list and shows nothing about the failure', async () => {
          await openSection(setup());

          expect(
            screen.getByText('No Knowledge Graph found, so services are read from the job label')
          ).toBeInTheDocument();
          expect(rows()).toEqual(['cart', 'checkout', 'prometheus']);
          expect(screen.queryByText('Services from the Knowledge Graph')).not.toBeInTheDocument();
          expect(screen.queryByRole('checkbox', { name: 'Include all jobs' })).not.toBeInTheDocument();
          expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        it('logs the error', async () => {
          await openSection(setup());

          expect(mockLoggerError).toHaveBeenCalledTimes(1);
          expect(mockLoggerError).toHaveBeenCalledWith(expect.objectContaining({ message: '503' }), {
            handledBy: 'service-filter-knowledge-graph',
          });
        });

        it('does not remember the failure: it tries again at the next change of the filters, and then uses the Knowledge Graph', async () => {
          const result = setup();
          await openSection(result);
          expect(
            screen.getByText('No Knowledge Graph found, so services are read from the job label')
          ).toBeInTheDocument();

          // A __name__ filter does not change the matcher, so only a list that was not remembered is fetched again
          act(() => {
            result.filtersVariable.setState({ filters: [{ key: '__name__', operator: '=', value: 'up' }] });
          });

          expect(await screen.findByText('Services from the Knowledge Graph')).toBeInTheDocument();
          expect(mockFetchKgServices).toHaveBeenCalledTimes(2);
        });
      });

      it('does not ask again when the filters change without changing the matcher', async () => {
        const result = setup();
        await openSection(result);

        act(() => {
          result.filtersVariable.setState({ filters: [{ key: '__name__', operator: '=', value: 'up' }] });
        });
        await act(async () => {});

        expect(mockFetchKgServices).toHaveBeenCalledTimes(1);
      });

      it('asks again when the time range changes', async () => {
        const result = setup();
        await openSection(result);
        mockFetchKgServices.mockResolvedValue({
          services: [{ service: 'sift', jobs: ['prometheus'] }],
          truncated: false,
        });

        act(() => {
          result.timeRange.setState({ from: 'now-5m', to: 'now' });
        });

        expect(await screen.findByLabelText('sift')).toBeInTheDocument();
        expect(screen.queryByLabelText('cart')).not.toBeInTheDocument();
      });

      it('lists only jobs that match the filters at the top, like the job list', async () => {
        const result = setup();
        await openSection(result);
        mockLabelValues({ job: ['shop/cart'] });

        act(() => {
          result.filtersVariable.setState({ filters: [{ key: 'instance', operator: '=', value: 'host-1' }] });
        });

        await waitFor(() => {
          expect(screen.getByLabelText('cart')).toBeInTheDocument();
          expect(screen.queryByLabelText('prometheus')).not.toBeInTheDocument();
        });
      });

      it('tells the user when the list may be incomplete', async () => {
        mockFetchKgServices.mockResolvedValue({ services: KG_SERVICES, truncated: true });

        await openSection(setup());

        expect(screen.getByText(/The list may be incomplete/)).toBeInTheDocument();
      });

      it('does not tell that the list may be incomplete when the job list is used', async () => {
        mockFetchKgServices.mockResolvedValue({
          services: [{ service: 'elsewhere', jobs: ['x/elsewhere'] }],
          truncated: true,
        });

        await openSection(setup());

        expect(screen.queryByText(/The list may be incomplete/)).not.toBeInTheDocument();
      });

      it('filters the metrics by the jobs of the checked service, in the job filter', async () => {
        const result = setup();
        await openSection(result);

        fireEvent.click(screen.getByLabelText('cart'));

        expect(result.section.state.selected).toEqual({ job: ['shop/cart'] });
        expect(managedFilters(result.filtersVariable.state.filters)).toEqual([
          { key: 'job', operator: '=~', value: 'shop/cart', meta: { source: SERVICE_FILTER_SOURCE } },
        ]);
        expect(result.section.state.active).toBe(true);
      });

      it('removes the filter when the service is unchecked', async () => {
        const result = setup();
        await openSection(result);
        fireEvent.click(screen.getByLabelText('cart'));

        fireEvent.click(screen.getByLabelText('cart'));

        expect(result.section.state.selected.job).toEqual([]);
        expect(result.filtersVariable.state.filters).toEqual([]);
      });

      it('shows a job that was selected earlier as checked', async () => {
        const result = setup();
        result.section.updateFromUrl({ [JOB_URL_KEY]: 'prometheus' });

        await openSection(result);

        expect(screen.getByLabelText('prometheus')).toBeChecked();
        expect(screen.getByLabelText('cart')).not.toBeChecked();
      });

      it('clears the selection with the clear button', async () => {
        const result = setup();
        await openSection(result);
        fireEvent.click(screen.getByLabelText('cart'));

        fireEvent.click(screen.getByRole('button', { name: 'clear' }));

        expect(result.section.state.selected.job).toEqual([]);
        expect(screen.getByLabelText('cart')).not.toBeChecked();
      });

      it('mentions a filter on job in the top bar', async () => {
        await openSection(setup([{ key: 'job', operator: '=', value: 'x' }]));

        expect(screen.getByText(/A filter on job in the top bar also applies/)).toBeInTheDocument();
      });

      describe('services that only the job label finds', () => {
        const includeAll = () => screen.getByRole('checkbox', { name: 'Include all jobs' });
        const toggleIncludeAll = () => fireEvent.click(includeAll());

        it('offers to include all jobs, and starts with the Knowledge Graph services only', async () => {
          await openSection(setup());

          expect(screen.getByText('Services from the Knowledge Graph')).toBeInTheDocument();
          expect(includeAll()).not.toBeChecked();
          expect(rows()).toEqual(['cart', 'prometheus']);
          expect(screen.queryByText(/Other jobs/)).not.toBeInTheDocument();
        });

        it('keeps the caption above the checkbox once the jobs are included', async () => {
          await openSection(setup());

          toggleIncludeAll();

          expect(screen.getByText('Services from the Knowledge Graph')).toBeInTheDocument();
          expect(includeAll()).toBeChecked();
        });

        it('shows how many services the list has, and counts the added services at once when all jobs are included', async () => {
          await openSection(setup());
          expect(screen.getByText('0 of 2 selected')).toBeInTheDocument();

          toggleIncludeAll();

          expect(screen.getByText('0 of 3 selected')).toBeInTheDocument();
        });

        it('shows the number of added services in the heading of their group', async () => {
          await openSection(setup());

          toggleIncludeAll();

          expect(screen.getByText('Other jobs (1)')).toBeInTheDocument();
        });

        it('does not offer the checkbox when the Knowledge Graph list has every job of the data source', async () => {
          mockFetchKgServices.mockResolvedValue({
            services: [
              { service: 'cart', jobs: ['shop/cart'] },
              { service: 'checkout', jobs: ['prod/checkout', 'staging/checkout'] },
              { service: 'prometheus', jobs: ['prometheus'] },
            ],
            truncated: false,
          });

          await openSection(setup());

          expect(screen.queryByRole('checkbox', { name: 'Include all jobs' })).not.toBeInTheDocument();
          expect(screen.getByText('Services from the Knowledge Graph')).toBeInTheDocument();
        });

        it('lists them under the Knowledge Graph services once all jobs are included', async () => {
          await openSection(setup());

          toggleIncludeAll();

          expect(rows()).toEqual(['cart', 'prometheus', 'checkout']);
          expect(screen.getByLabelText('checkout').closest('li')).toHaveAttribute(
            'title',
            'prod/checkout, staging/checkout'
          );
        });

        it('goes back to the Knowledge Graph services when the checkbox is unchecked', async () => {
          await openSection(setup());
          toggleIncludeAll();

          toggleIncludeAll();

          expect(rows()).toEqual(['cart', 'prometheus']);
          expect(screen.queryByText(/Other jobs/)).not.toBeInTheDocument();
        });

        it('explains what including all jobs adds', async () => {
          await openSection(setup());

          // The tooltip wraps the row of the checkbox
          fireEvent.mouseEnter(includeAll().closest('label')?.parentElement as HTMLElement);

          expect(
            await screen.findByText(
              /A value with the same service name as a Knowledge Graph service joins that service/
            )
          ).toBeInTheDocument();
        });

        it('selects the jobs of one of them into the job filter', async () => {
          const result = setup();
          await openSection(result);
          toggleIncludeAll();

          fireEvent.click(screen.getByLabelText('checkout'));

          expect(result.section.state.selected.job).toEqual(['prod/checkout', 'staging/checkout']);
          expect(managedFilters(result.filtersVariable.state.filters)).toMatchObject([
            { key: 'job', operator: '=~', value: 'prod/checkout|staging/checkout' },
          ]);
        });

        it('searches both groups, and shows the heading only when one of them matches', async () => {
          await openSection(setup());
          toggleIncludeAll();

          fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'cart' } });
          expect(rows()).toEqual(['cart']);
          expect(screen.queryByText(/Other jobs/)).not.toBeInTheDocument();

          fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'chec' } });
          expect(rows()).toEqual(['checkout']);
          expect(screen.getByText(/Other jobs/)).toBeInTheDocument();
        });

        it('counts the selected services of both groups, and clears both', async () => {
          const result = setup();
          await openSection(result);
          toggleIncludeAll();

          fireEvent.click(screen.getByLabelText('cart'));
          fireEvent.click(screen.getByLabelText('checkout'));
          expect(screen.getByText('2 of 3 selected')).toBeInTheDocument();

          fireEvent.click(screen.getByRole('button', { name: 'clear' }));

          expect(screen.getByText('0 of 3 selected')).toBeInTheDocument();
          expect(result.section.state.selected.job).toEqual([]);
        });

        it('drops the selected services of that group from the selection and the filter when the Knowledge Graph option is chosen', async () => {
          const result = setup();
          await openSection(result);
          toggleIncludeAll();
          fireEvent.click(screen.getByLabelText('cart'));
          fireEvent.click(screen.getByLabelText('checkout'));

          toggleIncludeAll();

          expect(result.section.state.selected.job).toEqual(['shop/cart']);
          expect(managedFilters(result.filtersVariable.state.filters)).toMatchObject([
            { key: 'job', operator: '=~', value: 'shop/cart' },
          ]);
          expect(screen.getByLabelText('cart')).toBeChecked();
        });

        it('leaves the selection and the filter as they are when none of those services was selected', async () => {
          const result = setup();
          await openSection(result);
          toggleIncludeAll();
          fireEvent.click(screen.getByLabelText('cart'));
          const filtersBefore = result.filtersVariable.state.filters;

          toggleIncludeAll();

          expect(result.section.state.selected.job).toEqual(['shop/cart']);
          expect(result.filtersVariable.state.filters).toBe(filtersBefore);
        });

        it('keeps the jobs included when the list loads again', async () => {
          const result = setup();
          await openSection(result);
          toggleIncludeAll();

          act(() => {
            result.filtersVariable.setState({ filters: [{ key: 'instance', operator: '=', value: 'host-1' }] });
          });
          await act(async () => {});

          expect(includeAll()).toBeChecked();
          expect(await screen.findByLabelText('checkout')).toBeInTheDocument();
        });

        describe('a job whose service name is the name of a Knowledge Graph service', () => {
          beforeEach(() => {
            mockLabelValues({ job: [...JOBS, 'other/cart'] });
          });

          it('joins the row of that service, so that the name is listed once', async () => {
            await openSection(setup());

            toggleIncludeAll();

            expect(rows()).toEqual(['cart', 'prometheus', 'checkout']);
            expect(screen.getByLabelText('cart').closest('li')).toHaveAttribute('title', 'shop/cart, other/cart');
            expect(screen.getByText('Other jobs (1)')).toBeInTheDocument();
            expect(screen.getByText('0 of 3 selected')).toBeInTheDocument();
          });

          it('stays out of the row until the jobs are included', async () => {
            const result = setup();
            await openSection(result);

            expect(screen.getByLabelText('cart').closest('li')).toHaveAttribute('title', 'shop/cart');

            fireEvent.click(screen.getByLabelText('cart'));

            expect(result.section.state.selected.job).toEqual(['shop/cart']);
          });

          it('is selected together with the other jobs of the service, in one filter', async () => {
            const result = setup();
            await openSection(result);
            toggleIncludeAll();

            fireEvent.click(screen.getByLabelText('cart'));

            expect(result.section.state.selected.job).toEqual(['shop/cart', 'other/cart']);
            expect(managedFilters(result.filtersVariable.state.filters)).toMatchObject([
              { key: 'job', operator: '=~', value: 'shop/cart|other/cart' },
            ]);
            expect(screen.getByLabelText('cart')).toBeChecked();
          });

          it('shows the service as partly selected when the jobs are included after it was selected', async () => {
            const result = setup();
            await openSection(result);
            fireEvent.click(screen.getByLabelText('cart'));

            toggleIncludeAll();

            expect(screen.getByLabelText('cart')).toBePartiallyChecked();
            expect(screen.getByText('1 of 3 selected')).toBeInTheDocument();

            fireEvent.click(screen.getByLabelText('cart'));

            expect(result.section.state.selected.job).toEqual(['shop/cart', 'other/cart']);
            expect(screen.getByLabelText('cart')).toBeChecked();
          });

          it('leaves the selection when the jobs are no longer included', async () => {
            const result = setup();
            await openSection(result);
            toggleIncludeAll();
            fireEvent.click(screen.getByLabelText('cart'));

            toggleIncludeAll();

            expect(result.section.state.selected.job).toEqual(['shop/cart']);
            expect(screen.getByLabelText('cart')).toBeChecked();
          });
        });

        it('lists them when the URL says that all jobs are included', async () => {
          const result = setup();
          result.section.updateFromUrl({ [MORE_URL_KEY]: '1' });

          await openSection(result);

          expect(includeAll()).toBeChecked();
          expect(rows()).toEqual(['cart', 'prometheus', 'checkout']);
        });

        it('writes the choice to the URL', async () => {
          const result = setup();
          await openSection(result);

          toggleIncludeAll();
          expect(result.section.getUrlState()[MORE_URL_KEY]).toBe('1');

          toggleIncludeAll();
          expect(result.section.getUrlState()[MORE_URL_KEY]).toBe('');
        });
      });

      it('drops its list and selection when the data source changes', async () => {
        const result = setup();
        await openSection(result);
        fireEvent.click(screen.getByLabelText('cart'));
        mockFetchKgServices.mockResolvedValue({ services: [], truncated: false });

        act(() => {
          result.dataSourceVariable.setState({ value: 'ds2' });
        });

        expect(result.section.state.selected.job).toEqual([]);
        expect(result.section.state.kgServices).toEqual([]);
        expect(screen.queryByLabelText('cart')).not.toBeInTheDocument();
      });
    });
  });

  describe('URL state', () => {
    it('has an empty value by default', () => {
      const { section } = setup();

      expect(section.getUrlState()).toEqual({ [JOB_URL_KEY]: '', [MORE_URL_KEY]: '' });
    });

    it('reads and writes the selection', () => {
      const { section } = setup();

      section.updateFromUrl({ [JOB_URL_KEY]: 'prod/checkout,shop/cart' });

      expect(section.state.selected).toEqual({ job: ['prod/checkout', 'shop/cart'] });
      expect(section.state.active).toBe(true);
      expect(section.getUrlState()).toEqual({ [JOB_URL_KEY]: 'prod/checkout,shop/cart', [MORE_URL_KEY]: '' });
    });

    it('ignores the key of the service_name tab that older URLs carry', () => {
      const { section, onValueChanged } = setup();

      section.updateFromUrl({ 'filters-service': 'cart,checkout' });

      expect(section.state.selected).toEqual({ job: [] });
      expect(section.state.active).toBe(false);
      expect(section.getUrlState()).toEqual({ [JOB_URL_KEY]: '', [MORE_URL_KEY]: '' });
      expect(onValueChanged).not.toHaveBeenCalled();
    });

    it('keeps a comma inside a value, and the spaces around a value', () => {
      const { section } = setup();

      section.updateFromUrl({ [JOB_URL_KEY]: 'ns/a\\,b, c ,d' });

      expect(section.state.selected).toEqual({ job: ['ns/a,b', ' c ', 'd'] });
      expect(section.getUrlState()).toEqual({ [JOB_URL_KEY]: 'ns/a\\,b, c ,d', [MORE_URL_KEY]: '' });
    });

    it('reads a URL that was written without escaping the same as before', () => {
      const { section } = setup();

      section.updateFromUrl({ [JOB_URL_KEY]: 'shop/cart,prod/checkout' });

      expect(section.state.selected.job).toEqual(['shop/cart', 'prod/checkout']);
    });

    it('restores a value with commas, backslashes and pipes through the URL sync of Scenes', () => {
      const jobs = ['a,b', 'c\\d', 'e|f,g', 'prod/payments'];
      const source = setup();
      source.section.updateFromUrl({ [JOB_URL_KEY]: joinUrlValues(jobs) });
      const url = urlUtil.renderUrl('', sceneUtils.getUrlState(source.scene));
      const target = setup();

      sceneUtils.syncStateFromSearchParams(target.scene, new URLSearchParams(url));

      expect(target.section.state.selected).toEqual({ job: jobs });
    });

    describe('a URL without the key, as in a history entry from before the selection', () => {
      it('clears the selection', () => {
        const { section, onValueChanged } = setup();
        section.updateFromUrl({ [JOB_URL_KEY]: 'prod/checkout' });

        section.updateFromUrl({ [JOB_URL_KEY]: null });

        expect(section.state.selected).toEqual({ job: [] });
        expect(section.state.active).toBe(false);
        expect(onValueChanged).toHaveBeenLastCalledWith({ key: SERVICE_FILTER_SECTION_KEY, values: [] });
      });

      it('changes nothing and publishes nothing when there is no selection', () => {
        const { section, onValueChanged } = setup();

        section.updateFromUrl({ [JOB_URL_KEY]: null });

        expect(section.state.selected).toEqual({ job: [] });
        expect(onValueChanged).not.toHaveBeenCalled();
      });

      it('clears the selection when Scenes syncs a URL that has no key, as browser back does', () => {
        const { section, scene } = setup();
        section.updateFromUrl({ [JOB_URL_KEY]: 'shop/cart,prod/checkout' });

        sceneUtils.syncStateFromSearchParams(scene, new URLSearchParams(''));

        expect(section.state.selected).toEqual({ job: [] });
        expect(section.state.active).toBe(false);
      });

      it('keeps the selection when Scenes syncs a URL that has the same values', () => {
        const { section, scene } = setup();
        section.updateFromUrl({ [JOB_URL_KEY]: 'shop/cart,prod/checkout' });

        sceneUtils.syncStateFromSearchParams(scene, new URLSearchParams(`${JOB_URL_KEY}=shop/cart,prod/checkout`));

        expect(section.state.selected.job).toEqual(['shop/cart', 'prod/checkout']);
      });
    });

    it('publishes the values of a selection that comes from the URL', () => {
      const { section, onValueChanged } = setup();

      section.updateFromUrl({ [JOB_URL_KEY]: 'prod/checkout' });

      expect(onValueChanged).toHaveBeenLastCalledWith({
        key: SERVICE_FILTER_SECTION_KEY,
        values: ['prod/checkout'],
      });
    });

    it('publishes an empty selection when the URL clears it, like browser back does', () => {
      const { section, onValueChanged } = setup();
      section.updateFromUrl({ [JOB_URL_KEY]: 'shop/cart' });

      section.updateFromUrl({ [JOB_URL_KEY]: '' });

      expect(onValueChanged).toHaveBeenLastCalledWith({ key: SERVICE_FILTER_SECTION_KEY, values: [] });
    });

    describe('the checkbox for the services that only the job label finds', () => {
      it('is read from and written to the URL', () => {
        const { section } = setup();

        section.updateFromUrl({ [MORE_URL_KEY]: '1' });

        expect(section.state.showExtras).toBe(true);
        expect(section.getUrlState()[MORE_URL_KEY]).toBe('1');
      });

      it.each([[''], [null]])('is unchecked when the URL has %p for it, as browser back does', (value) => {
        const { section } = setup();
        section.updateFromUrl({ [MORE_URL_KEY]: '1' });

        section.updateFromUrl({ [MORE_URL_KEY]: value });

        expect(section.state.showExtras).toBe(false);
      });

      it('stays as it is when an update does not mention it', () => {
        const { section } = setup();
        section.updateFromUrl({ [MORE_URL_KEY]: '1' });

        section.updateFromUrl({ [JOB_URL_KEY]: 'shop/cart' });

        expect(section.state.showExtras).toBe(true);
      });

      it('is unchecked when Scenes syncs a URL that has no key', () => {
        const { section, scene } = setup();
        section.updateFromUrl({ [MORE_URL_KEY]: '1' });

        sceneUtils.syncStateFromSearchParams(scene, new URLSearchParams(''));

        expect(section.state.showExtras).toBe(false);
      });

      it('survives the URL sync of Scenes', () => {
        const source = setup();
        source.section.updateFromUrl({ [MORE_URL_KEY]: '1', [JOB_URL_KEY]: 'shop/cart' });
        const url = urlUtil.renderUrl('', sceneUtils.getUrlState(source.scene));
        const target = setup();

        sceneUtils.syncStateFromSearchParams(target.scene, new URLSearchParams(url));

        expect(target.section.state.showExtras).toBe(true);
        expect(target.section.state.selected.job).toEqual(['shop/cart']);
      });

      it('does not publish the values of the section when only the checkbox changes', () => {
        const { section, onValueChanged } = setup();

        section.updateFromUrl({ [MORE_URL_KEY]: '1' });

        expect(onValueChanged).not.toHaveBeenCalled();
      });
    });

    it('publishes nothing when the URL values equal the selection', () => {
      const { section, onValueChanged } = setup();
      section.updateFromUrl({ [JOB_URL_KEY]: 'shop/cart' });
      onValueChanged.mockClear();

      section.updateFromUrl({ [JOB_URL_KEY]: 'shop/cart' });

      expect(onValueChanged).not.toHaveBeenCalled();
    });
  });

  describe('lists', () => {
    it('lists the services found in the jobs, once per service, with the jobs of a service as its title', async () => {
      const { section } = setup();
      render(<section.Component model={section} />);

      await screen.findByLabelText('prometheus');
      const labels = screen.getAllByRole('checkbox').map((checkbox) => checkbox.closest('li')?.textContent);

      expect(labels).toEqual(['cart', 'checkout', 'prometheus']);
      expect(screen.getByLabelText('checkout').closest('li')).toHaveAttribute(
        'title',
        'prod/checkout, staging/checkout'
      );
    });

    it('shows no count of services while the list loads', async () => {
      mockFetchLabelValues.mockReturnValue(new Promise(() => {}));
      const { section } = setup();

      render(<section.Component model={section} />);
      await act(async () => {});

      expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
    });

    it('shows how many of the listed services are selected', async () => {
      const { section } = setup();
      render(<section.Component model={section} />);
      await screen.findByText('0 of 3 selected');

      fireEvent.click(screen.getByLabelText('checkout'));

      expect(screen.getByText('1 of 3 selected')).toBeInTheDocument();
    });

    it('says that nothing was found when there are no jobs', async () => {
      mockLabelValues({ job: [] });
      const { section } = setup();

      render(<section.Component model={section} />);

      expect(await screen.findByText('No results.')).toBeInTheDocument();
    });

    it('filters the list with the search field', async () => {
      const { section } = setup();
      render(<section.Component model={section} />);
      await screen.findByLabelText('cart');

      fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'chec' } });

      expect(screen.queryByLabelText('cart')).not.toBeInTheDocument();
      expect(screen.getByLabelText('checkout')).toBeInTheDocument();
    });

    it('refetches the list when a top filter changes what it shows', async () => {
      const { section, filtersVariable } = setup();
      render(<section.Component model={section} />);
      await screen.findByLabelText('cart');
      mockFetchLabelValues.mockClear();

      act(() => {
        filtersVariable.setState({ filters: [{ key: 'instance', operator: '=', value: 'host-1' }] });
      });

      await waitFor(() => expect(mockFetchLabelValues).toHaveBeenCalledWith('job', section, '{instance="host-1"}'));
    });

    it('refetches the list when the time range changes', async () => {
      const { section, timeRange } = setup();
      render(<section.Component model={section} />);
      await screen.findByLabelText('cart');
      mockLabelValues({ job: ['shop/recent'] });
      mockFetchLabelValues.mockClear();

      act(() => {
        timeRange.setState({ from: 'now-5m', to: 'now' });
      });

      expect(await screen.findByLabelText('recent')).toBeInTheDocument();
      expect(screen.queryByLabelText('cart')).not.toBeInTheDocument();
      expect(mockFetchLabelValues).toHaveBeenCalledTimes(1);
    });

    it('refetches when the end of an absolute time range moves', async () => {
      const { section, timeRange } = setup();
      render(<section.Component model={section} />);
      await screen.findByLabelText('cart');
      mockFetchLabelValues.mockClear();

      act(() => {
        timeRange.setState({ from: '2026-11-01T00:00:00.000Z', to: '2026-11-01T01:00:00.000Z' });
      });
      await waitFor(() => expect(mockFetchLabelValues).toHaveBeenCalledTimes(1));
      act(() => {
        timeRange.setState({ to: '2026-11-01T02:00:00.000Z' });
      });

      await waitFor(() => expect(mockFetchLabelValues).toHaveBeenCalledTimes(2));
    });

    it('does not refetch when the time range refreshes with the same from and to, as auto refresh does', async () => {
      const { section, timeRange } = setup();
      render(<section.Component model={section} />);
      await screen.findByLabelText('cart');
      mockFetchLabelValues.mockClear();

      act(() => {
        timeRange.onRefresh();
      });

      await act(async () => {});
      expect(mockFetchLabelValues).not.toHaveBeenCalled();
    });

    it('fetches an empty list again when the filters change, as after a failed request', async () => {
      // The data source helper turns a failed request into an empty list
      mockFetchLabelValues.mockResolvedValueOnce([]);
      const { section, filtersVariable } = setup();
      render(<section.Component model={section} />);
      await screen.findByText('No results.');

      act(() => {
        filtersVariable.setState({ filters: [{ key: 'instance', operator: '=', value: 'host-1' }] });
      });

      expect(await screen.findByLabelText('cart')).toBeInTheDocument();
      expect(screen.queryByText('No results.')).not.toBeInTheDocument();
    });

    it('does not refetch the list it found when the filters change without changing the matcher', async () => {
      const { section, filtersVariable } = setup();
      render(<section.Component model={section} />);
      await screen.findByLabelText('cart');
      mockFetchLabelValues.mockClear();

      act(() => {
        filtersVariable.setState({ filters: [{ key: '__name__', operator: '=', value: 'up' }] });
      });

      await act(async () => {});
      expect(mockFetchLabelValues).not.toHaveBeenCalled();
    });

    it('does not refetch its own list when the selection changes its own filter', async () => {
      const { section } = setup();
      render(<section.Component model={section} />);
      fireEvent.click(await screen.findByLabelText('cart'));
      mockFetchLabelValues.mockClear();

      fireEvent.click(screen.getByLabelText('checkout'));

      await act(async () => {});
      expect(mockFetchLabelValues).not.toHaveBeenCalled();
    });

    it('drops the response of an older request', async () => {
      let resolveFirst: (values: string[]) => void = () => {};
      mockFetchLabelValues.mockReturnValueOnce(new Promise<string[]>((resolve) => (resolveFirst = resolve)));
      mockFetchLabelValues.mockResolvedValueOnce(['ns/new-service']);
      const { section, filtersVariable } = setup();
      render(<section.Component model={section} />);

      act(() => {
        filtersVariable.setState({ filters: [{ key: 'instance', operator: '=', value: 'host-1' }] });
      });
      await screen.findByLabelText('new-service');
      await act(async () => resolveFirst(['ns/old-service']));

      expect(screen.queryByLabelText('old-service')).not.toBeInTheDocument();
      expect(screen.getByLabelText('new-service')).toBeInTheDocument();
    });
  });

  describe('selecting', () => {
    it('writes one managed filter for the jobs of the selected services and publishes the values', async () => {
      const { section, filtersVariable, onValueChanged } = setup();
      render(<section.Component model={section} />);

      fireEvent.click(await screen.findByLabelText('cart'));
      fireEvent.click(screen.getByLabelText('prometheus'));

      expect(managedFilters(filtersVariable.state.filters)).toEqual([
        {
          key: 'job',
          operator: '=~',
          value: 'shop/cart|prometheus',
          meta: { source: SERVICE_FILTER_SOURCE },
        },
      ]);
      expect(section.state.active).toBe(true);
      expect(onValueChanged).toHaveBeenLastCalledWith({
        key: SERVICE_FILTER_SECTION_KEY,
        values: ['shop/cart', 'prometheus'],
      });
    });

    it('removes the filter and the active state when the last service is unchecked', async () => {
      const { section, filtersVariable } = setup();
      render(<section.Component model={section} />);
      fireEvent.click(await screen.findByLabelText('cart'));

      fireEvent.click(screen.getByLabelText('cart'));

      expect(filtersVariable.state.filters).toEqual([]);
      expect(section.state.active).toBe(false);
    });

    it('clears the selection with the clear button', async () => {
      const { section, filtersVariable } = setup();
      render(<section.Component model={section} />);
      fireEvent.click(await screen.findByLabelText('cart'));

      fireEvent.click(screen.getByRole('button', { name: 'clear' }));

      expect(section.state.selected.job).toEqual([]);
      expect(filtersVariable.state.filters).toEqual([]);
    });

    it('selects every job of a service and builds one filter on job', async () => {
      const { section, filtersVariable } = setup();
      render(<section.Component model={section} />);

      fireEvent.click(await screen.findByLabelText('checkout'));

      expect(section.state.selected.job).toEqual(['prod/checkout', 'staging/checkout']);
      expect(managedFilters(filtersVariable.state.filters)).toMatchObject([
        { key: 'job', operator: '=~', value: 'prod/checkout|staging/checkout' },
      ]);
      expect(screen.getByLabelText('checkout')).toBeChecked();
    });

    it('unchecks only the jobs of the unchecked service', async () => {
      const { section } = setup();
      render(<section.Component model={section} />);
      fireEvent.click(await screen.findByLabelText('checkout'));
      fireEvent.click(screen.getByLabelText('prometheus'));

      fireEvent.click(screen.getByLabelText('checkout'));

      expect(section.state.selected.job).toEqual(['prometheus']);
    });

    it('shows a notice and keeps the filter that the user typed for the same label', async () => {
      const typedByUser: AdHocFilterWithLabels = { key: 'job', operator: '=', value: 'prometheus' };
      const { section, filtersVariable } = setup([typedByUser]);
      render(<section.Component model={section} />);

      expect(await screen.findByText(/A filter on job in the top bar also applies/)).toBeInTheDocument();

      fireEvent.click(await screen.findByLabelText('cart'));
      expect(filtersVariable.state.filters).toHaveLength(2);
      expect(filtersVariable.state.filters[0]).toBe(typedByUser);

      fireEvent.click(screen.getByLabelText('cart'));
      expect(filtersVariable.state.filters).toEqual([typedByUser]);
    });

    it('shows no notice when the only filter on the label is its own', async () => {
      const { section } = setup();
      render(<section.Component model={section} />);

      fireEvent.click(await screen.findByLabelText('cart'));

      expect(screen.queryByText(/in the top bar also applies/)).not.toBeInTheDocument();
    });
  });

  describe('keeping the selection and the top filters consistent', () => {
    const restored: AdHocFilterWithLabels = { key: 'job', operator: '=~', value: 'shop/cart|prod/checkout' };
    const RESTORED_URL_VALUE = 'shop/cart,prod/checkout';

    it('adopts the filter of a selection restored from the URL, then drops the selection when it is removed', () => {
      const { section, filtersVariable, onValueChanged } = setup([restored]);

      section.updateFromUrl({ [JOB_URL_KEY]: RESTORED_URL_VALUE });
      expect(managedFilters(filtersVariable.state.filters)).toHaveLength(1);
      expect(section.state.selected.job).toEqual(['shop/cart', 'prod/checkout']);

      filtersVariable.setState({ filters: [] });

      expect(section.state.selected.job).toEqual([]);
      expect(section.state.active).toBe(false);
      expect(onValueChanged).toHaveBeenLastCalledWith({ key: SERVICE_FILTER_SECTION_KEY, values: [] });
    });

    describe('a selection restored from the URL when the sidebar activates', () => {
      const restoreSelection = (section: ServiceFilterSection) =>
        section.updateFromUrl({ [JOB_URL_KEY]: RESTORED_URL_VALUE });

      it('writes the filter of a selection that has none, so that the checked rows filter the metrics', () => {
        const typedByUser: AdHocFilterWithLabels = { key: 'instance', operator: '=', value: 'host-1' };

        const { section, filtersVariable } = setup([typedByUser], restoreSelection);

        expect(filtersVariable.state.filters).toEqual([
          typedByUser,
          {
            key: 'job',
            operator: '=~',
            value: 'shop/cart|prod/checkout',
            meta: { source: SERVICE_FILTER_SOURCE },
          },
        ]);
        expect(section.state.selected).toEqual({ job: ['shop/cart', 'prod/checkout'] });
      });

      it('keeps the selection afterwards, and drops it only when its filter is later removed', () => {
        const { section, filtersVariable } = setup([], restoreSelection);

        filtersVariable.setState({ filters: [...filtersVariable.state.filters] });
        expect(section.state.selected.job).toEqual(['shop/cart', 'prod/checkout']);

        filtersVariable.setState({ filters: [] });
        expect(section.state.selected).toEqual({ job: [] });
      });

      it('adopts the filter that the URL restored for the selection, without adding a second one', () => {
        const { filtersVariable } = setup([restored], restoreSelection);

        expect(filtersVariable.state.filters.filter((f) => f.key === 'job')).toEqual([
          { ...restored, meta: { source: SERVICE_FILTER_SOURCE } },
        ]);
      });

      it('writes nothing without a selection', () => {
        const { filtersVariable } = setup();

        expect(filtersVariable.state.filters).toEqual([]);
      });

      it('keeps a filter that the user typed with another value, and applies both', () => {
        const typedByUser: AdHocFilterWithLabels = { key: 'job', operator: '=', value: 'prometheus' };

        const { filtersVariable } = setup([typedByUser], restoreSelection);

        expect(filtersVariable.state.filters.filter((f) => f.key === 'job')).toEqual([
          typedByUser,
          { key: 'job', operator: '=~', value: 'shop/cart|prod/checkout', meta: { source: SERVICE_FILTER_SOURCE } },
        ]);
      });
    });

    describe('when the user edits the managed filter in the top bar', () => {
      // The editor of the top bar spreads the update over the filter, so the marker stays on a value or operator edit
      const editManagedFilter = (filters: AdHocFilterWithLabels[], update: Partial<AdHocFilterWithLabels>) =>
        filters.map((f) => (f.key === 'job' ? { ...f, ...update } : f));

      it.each([
        ['value', { value: 'other/value' }, { operator: '=~', value: 'other/value' }],
        ['operator', { operator: '!~' }, { operator: '!~', value: 'shop/cart|prod/checkout' }],
      ])(
        'clears the selection and keeps the edited %s as a filter of the user, without the marker',
        (_edit, update, expected) => {
          const typedByUser: AdHocFilterWithLabels = { key: 'instance', operator: '=', value: 'host-1' };
          const { section, filtersVariable, onValueChanged } = setup([typedByUser], (s) =>
            s.updateFromUrl({ [JOB_URL_KEY]: RESTORED_URL_VALUE })
          );

          filtersVariable.setState({ filters: editManagedFilter(filtersVariable.state.filters, update) });

          expect(section.state.selected.job).toEqual([]);
          expect(onValueChanged).toHaveBeenLastCalledWith({ key: SERVICE_FILTER_SECTION_KEY, values: [] });
          expect(managedFilters(filtersVariable.state.filters)).toEqual([]);
          expect(filtersVariable.state.filters).toEqual([typedByUser, { key: 'job', ...expected }]);
        }
      );

      it('writes a new managed filter next to the edited filter when the user selects again', async () => {
        const { section, filtersVariable } = setup([], (s) => s.updateFromUrl({ [JOB_URL_KEY]: RESTORED_URL_VALUE }));
        filtersVariable.setState({
          filters: editManagedFilter(filtersVariable.state.filters, { value: 'other/value' }),
        });
        render(<section.Component model={section} />);

        fireEvent.click(await screen.findByLabelText('cart'));

        expect(filtersVariable.state.filters.map((f) => [f.key, f.value, Boolean(f.meta)])).toEqual([
          ['job', 'other/value', false],
          ['job', 'shop/cart', true],
        ]);
      });
    });

    it('adopts the filter when the filters are restored after the selection', () => {
      const { section, filtersVariable } = setup();

      section.updateFromUrl({ [JOB_URL_KEY]: RESTORED_URL_VALUE });
      filtersVariable.setState({ filters: [{ key: 'instance', operator: '=', value: 'host-1' }] });
      expect(section.state.selected.job).toEqual(['shop/cart', 'prod/checkout']);

      filtersVariable.setState({ filters: [{ key: 'instance', operator: '=', value: 'host-1' }, restored] });
      expect(managedFilters(filtersVariable.state.filters)).toHaveLength(1);

      filtersVariable.setState({ filters: [] });
      expect(section.state.selected.job).toEqual([]);
    });

    it('keeps the selection when an unrelated filter changes', () => {
      const { section, filtersVariable } = setup([restored]);
      section.updateFromUrl({ [JOB_URL_KEY]: RESTORED_URL_VALUE });

      filtersVariable.setState({
        filters: [...filtersVariable.state.filters, { key: 'pod', operator: '=', value: 'p1' }],
      });

      expect(section.state.selected.job).toEqual(['shop/cart', 'prod/checkout']);
    });

    it('drops the selection when the filters are cleared, as for a binary query', () => {
      const { section, filtersVariable } = setup([restored]);
      section.updateFromUrl({ [JOB_URL_KEY]: RESTORED_URL_VALUE });

      filtersVariable.setState({ filters: [], baseFilters: [] });

      expect(section.state.selected.job).toEqual([]);
    });

    it('does not drop the selection when the selection changes before the filters, as when going back in history', () => {
      const { section, filtersVariable } = setup([restored]);
      section.updateFromUrl({ [JOB_URL_KEY]: RESTORED_URL_VALUE });

      section.updateFromUrl({ [JOB_URL_KEY]: 'prometheus' });
      expect(section.state.selected.job).toEqual(['prometheus']);

      filtersVariable.setState({ filters: [{ key: 'job', operator: '=~', value: 'prometheus' }] });

      expect(section.state.selected.job).toEqual(['prometheus']);
      expect(managedFilters(filtersVariable.state.filters)).toHaveLength(1);
    });

    it('drops the selection when the user edits the managed filter', async () => {
      const { section, filtersVariable } = setup();
      render(<section.Component model={section} />);
      fireEvent.click(await screen.findByLabelText('cart'));

      act(() => {
        filtersVariable.setState({ filters: filtersVariable.state.filters.map((f) => ({ ...f, value: 'other' })) });
      });

      expect(section.state.selected.job).toEqual([]);
    });

    it('stops reconciling once it is stopped', () => {
      const { section, filtersVariable, stopWatching } = setup([restored]);
      section.updateFromUrl({ [JOB_URL_KEY]: RESTORED_URL_VALUE });

      stopWatching();
      filtersVariable.setState({ filters: [] });

      expect(section.state.selected.job).toEqual(['shop/cart', 'prod/checkout']);
    });

    it('drops the selection, the managed filter and the list when the data source changes', async () => {
      const typedByUser: AdHocFilterWithLabels = { key: 'instance', operator: '=', value: 'host-1' };
      const { section, filtersVariable, dataSourceVariable } = setup([typedByUser]);
      render(<section.Component model={section} />);
      fireEvent.click(await screen.findByLabelText('cart'));
      mockLabelValues({ job: ['other/other-ds-service'] });
      mockFetchLabelValues.mockClear();

      act(() => {
        dataSourceVariable.setState({ value: 'ds2' });
      });

      expect(section.state.selected).toEqual({ job: [] });
      expect(section.state.active).toBe(false);
      expect(filtersVariable.state.filters).toEqual([typedByUser]);
      expect(await screen.findByLabelText('other-ds-service')).toBeInTheDocument();
      expect(screen.queryByLabelText('cart')).not.toBeInTheDocument();
    });

    it.each([[''], [undefined], [[]]])(
      'keeps the selection and its filter when the data source resolves from %p',
      (initialValue) => {
        const { section, filtersVariable, dataSourceVariable } = setup();
        // The data source has no value yet when the app loads, and the selection comes from the URL
        dataSourceVariable.setState({ value: initialValue as string });
        section.updateFromUrl({ [JOB_URL_KEY]: RESTORED_URL_VALUE });
        const filtersBefore = filtersVariable.state.filters;

        act(() => {
          dataSourceVariable.setState({ value: 'ds1' });
        });

        expect(section.state.selected.job).toEqual(['shop/cart', 'prod/checkout']);
        expect(section.state.active).toBe(true);
        expect(filtersVariable.state.filters).toBe(filtersBefore);
      }
    );

    it('clears the selection when the data source changes after it resolved', () => {
      const { section, dataSourceVariable } = setup();
      dataSourceVariable.setState({ value: '' });
      dataSourceVariable.setState({ value: 'ds1' });
      section.updateFromUrl({ [JOB_URL_KEY]: 'shop/cart' });

      act(() => {
        dataSourceVariable.setState({ value: 'ds2' });
      });

      expect(section.state.selected.job).toEqual([]);
    });
  });
});
