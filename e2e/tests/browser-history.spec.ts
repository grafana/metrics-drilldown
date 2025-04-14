import { testIds } from '../../src/App/testIds';
import { ROUTES } from '../../src/constants';
import { expect, test } from '../fixtures';

test.describe('Browser History', () => {
  test('From Homepage', async ({ gotoPage, page, selectMetricView }) => {
    await gotoPage(`/${ROUTES.Home}`);
    const startButton = page.getByTestId(testIds.pageHome.startButton);
    await startButton.click();
    await selectMetricView.assertTopControls();
    await selectMetricView.assertOtelExperienceSwitchIsVisible();

    await selectMetricView.selectMetricPanel('a_utf8_http_requests_total');
    await page.goBack();

    // We should not return to the homepage but to the metric selection page
    await expect(page.getByText(testIds.pageHome.container)).not.toBeVisible();
    await selectMetricView.assertTopControls();
    await selectMetricView.assertOtelExperienceSwitchIsVisible();
  });

  test('From Wingman', async ({ gotoPage, page, metricsReducerView }) => {
    await gotoPage(`/${ROUTES.TrailWithSidebar}`);
    await metricsReducerView.assertHeaderControls();
    await metricsReducerView.assertSidebar();
    await metricsReducerView.assertMetricsList();

    await metricsReducerView.selectMetricPanel('a_utf8_http_requests_total');
    await page.goBack();

    // We should not return to the homepage but to the metric selection page
    await metricsReducerView.assertHeaderControls();
    await metricsReducerView.assertSidebar();
    await metricsReducerView.assertMetricsList();
  });
});
