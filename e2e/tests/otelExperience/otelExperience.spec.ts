import { ROUTES } from '../../../src/constants';
import { UI_TEXT } from '../../../src/constants/ui';
import { expect, test } from '../../fixtures';

test.describe('OTEL Experience', () => {
  test('otel enabled workflow', async ({ gotoPage, page }) => {
    await test.step('navigate to trail', async () => {
      await gotoPage(`/${ROUTES.Trail}`);
    });

    const otelSwitch = page.getByLabel(UI_TEXT.METRIC_SELECT_SCENE.OTEL_LABEL);

    await test.step('element is visible', async () => {
      await expect(otelSwitch).toBeVisible();
    });

    await test.step('turning otel experience on', async () => {
      await expect(otelSwitch).toBeVisible();
      await expect(otelSwitch).not.toBeChecked();
      await otelSwitch.check({ force: true });
    });

    await test.step('asssert deployment_environment filter is on', async () => {
      await expect(otelSwitch).toBeChecked();
      await expect(page.getByText('deployment_environment = prod')).toBeVisible();
    });

    await test.step('select utf8 metrics', async () => {
      const panel = page.getByTestId('data-testid Panel header a.utf8.metric 🤘');
      await panel.getByRole('button', { name: 'select' }).click();
      expect(page.url().includes('otel_and_metric_filters')).toBeTruthy();
    });

    await test.step('confirm utf8 attribute is present', async () => {
      expect(page.getByRole('link', { name: 'resource ę' })).toBeTruthy();
    });
  });
});
