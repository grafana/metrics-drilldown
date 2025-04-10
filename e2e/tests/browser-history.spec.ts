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

    // Capture the URL after clicking the start button
    // const initialUrl = page.url();

    await selectMetricView.selectMetricPanel('a_utf8_http_requests_total');
    await page.goBack();

    // Capture the URL after going back and compare with the initial URL
    // const backUrl = page.url();
    // expect(backUrl).toBe(initialUrl);

    // We should not return to the homepage but to the metric selection page
    await expect(page.getByText(testIds.pageHome.container)).not.toBeVisible();
    await selectMetricView.assertTopControls();
    await selectMetricView.assertOtelExperienceSwitchIsVisible();
  });

  test('From Wingman', async ({ gotoPage, page, selectMetricView, metricsReducerView }) => {
    await gotoPage(`/${ROUTES.TrailWithSidebar}`);
    await selectMetricView.assertTopControls();
    await metricsReducerView.assertSidebar();

    // Capture the URL after clicking the start button
    // const initialUrl = page.url();

    await selectMetricView.selectMetricPanel('a_utf8_http_requests_total');
    await page.goBack();

    // Capture the URL after going back and compare with the initial URL
    // const backUrl = page.url();
    // expect(backUrl).toBe(initialUrl);

    // We should not return to the homepage but to the metric selection page
    await selectMetricView.assertTopControls();
    await metricsReducerView.assertSidebar();
  });
});
