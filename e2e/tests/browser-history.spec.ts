import { ROUTES } from '../../src/constants';
import { test } from '../fixtures';

test.describe('Browser History', () => {
  test('From Wingman', async ({ gotoPage, page, metricsReducerView }) => {
    await gotoPage(`/${ROUTES.Drilldown}`);
    await metricsReducerView.assertListControls();
    await metricsReducerView.assertSidebar();
    await metricsReducerView.assertMetricsList();

    await metricsReducerView.selectMetricPanel('a_utf8_http_requests_total');
    await page.goBack();

    await metricsReducerView.assertListControls();
    await metricsReducerView.assertSidebar();
    await metricsReducerView.assertMetricsList();
  });
});
