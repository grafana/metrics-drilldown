import { test } from '../fixtures';

test.describe('Metrics reducer view', () => {
  test.describe('Variant #1: Side bar with prefixes and categories filters', () => {
    test.beforeEach(async ({ metricsReducerView }) => {
      await metricsReducerView.gotoVariant(
        '/trail-filters-sidebar',
        new URLSearchParams({ 'var-variant': 'onboard-filters-sidebar' })
      );
    });

    test('Core UI elements', async ({ metricsReducerView }) => {
      await metricsReducerView.assertHeaderControls('filters');
      await metricsReducerView.assertSidebar('filters');
      await metricsReducerView.assertMetricsList();
    });
  });

  test.describe('Variant #2: Pills with prefixes and categories filters', () => {
    test.beforeEach(async ({ metricsReducerView }) => {
      await metricsReducerView.gotoVariant('/trail-filters-pills');
    });

    test('Core UI elements', async ({ metricsReducerView }) => {
      await metricsReducerView.assertHeaderControls('pills');
      await metricsReducerView.assertSidebar('pills');
      await metricsReducerView.assertMetricsList();
    });
  });

  test.describe('Variant #3: Side bar with prefixes filters and group by labels', () => {
    test.beforeEach(async ({ metricsReducerView }) => {
      await metricsReducerView.gotoVariant('/trail-filters-labels');
    });

    test('Core UI elements', async ({ metricsReducerView }) => {
      await metricsReducerView.assertHeaderControls('labels');
      await metricsReducerView.assertSidebar('labels');
      await metricsReducerView.assertMetricsList();
    });
  });
});
