import { expect, test } from './fixtures';

test.describe('OTEL Experience', () => {
  test('otel enabled workflow', async ({ navigateToTrail, otelSwitch, utf8MetricPanel, page }) => {
    await test.step('navigate to trail', async () => {
      await navigateToTrail();
    });

    await test.step('element is visible', async () => {
      await expect(otelSwitch).toBeVisible();
    });

    await test.step('turning otel experience on', async () => {
      await expect(otelSwitch).toBeVisible();
      await expect(otelSwitch).not.toBeChecked();
      await otelSwitch.check({ force: true });
    });

    await test.step('assert deployment_environment filter is on', async () => {
      await expect(otelSwitch).toBeChecked();
      await expect(page.getByText('deployment_environment = prod')).toBeVisible();
    });

    await test.step('select utf8 metrics', async () => {
      await utf8MetricPanel.getByRole('button', { name: 'select' }).click();
      expect(page.url().includes('otel_and_metric_filters')).toBeTruthy();
    });

    await test.step('confirm utf8 attribute is present', async () => {
      expect(page.getByRole('link', { name: 'resource ę' })).toBeTruthy();
    });
  });
});
