import { expect, test } from './fixtures';
import { ROUTES } from '../src/constants';
import { UI_TEXT } from '../src/constants/ui';

test.describe('OTEL Experience', () => {
  test('otel toggle workflow', async ({ gotoPage, page }) => {
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
      await expect(otelSwitch).toBeChecked();
    });

    await test.step('asssert deployment_environment filter is on', async () => {
      await expect(page.getByText('deployment_environment')).toBeVisible();
    });
  });
});
