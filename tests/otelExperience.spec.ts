import { expect, test } from '../e2e/fixtures';

test.describe('OTEL Experience', () => {
  test.beforeEach(async ({ selectMetricView }) => {
    await selectMetricView.goto();
  });

  test('otel enabled workflow', async ({ selectMetricView, page }) => {
    await test.step('turning otel experience on', async () => {
      await selectMetricView.toggleOtelExperience(true);
    });

    await test.step('assert deployment_environment filter is on', async () => {
      await expect(page.getByText('deployment_environment = prod')).toBeVisible();
    });

    await test.step('select utf8 metrics', async () => {
      await selectMetricView.selectMetricPanel('a.utf8.metric 🤘');
      expect(page.url().includes('otel_and_metric_filters')).toBeTruthy();
    });

    await test.step('confirm utf8 attribute is present', async () => {
      expect(page.getByRole('link', { name: 'resource ę' })).toBeTruthy();
    });
  });
});
