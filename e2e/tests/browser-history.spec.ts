import { test } from '../fixtures';

test.describe('Browser History', () => {
  test('The back button works', async ({ metricsReducerView }) => {
    await metricsReducerView.goto();
    await metricsReducerView.assertCoreUI();

    await metricsReducerView.selectMetricPanel('go_cgo_go_to_c_calls_calls_total');
    await metricsReducerView.goBack();

    await metricsReducerView.assertCoreUI();
  });
});
