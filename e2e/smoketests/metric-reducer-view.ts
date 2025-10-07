import { test } from '../fixtures';

test.describe('Metrics reducer view', () => {
  test.beforeEach(async ({ metricsReducerView }) => {
    await metricsReducerView.goto();
  });

  // eslint-disable-next-line playwright/expect-expect
  test('Core UI elements', async ({ metricsReducerView }) => {
    await metricsReducerView.assertCoreUI();
  });
});
