import { test } from '../fixtures';

test.describe('Metrics reducer view', () => {
  test.beforeEach(async ({ metricsReducerView }) => {
    // TEMP
    await metricsReducerView.gotoVariant('/trail-filters-sidebar');
  });

  test('Core UI elements', async ({ metricsReducerView }) => {
    await metricsReducerView.assertListControls();
    await metricsReducerView.assertSidebar();
    await metricsReducerView.assertMetricsList();
  });
});
