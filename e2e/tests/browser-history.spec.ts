import { testIds } from '../../src/App/testIds';
import { ROUTES } from '../../src/constants';
import { expect, test } from '../fixtures';

test.describe('Browser History', () => {
  test('From Trail', async ({ gotoPage, page, selectMetricView }) => {
    await gotoPage(`/${ROUTES.Trail}`);
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
    await metricsReducerView.assertListControls();
    await metricsReducerView.assertSidebar();
    await metricsReducerView.assertMetricsList();

    await metricsReducerView.selectMetricPanel('a_utf8_http_requests_total');
    await page.goBack();

    // We should not return to the homepage but to the metric selection page
    await metricsReducerView.assertListControls();
    await metricsReducerView.assertSidebar();
    await metricsReducerView.assertMetricsList();
  });
});
