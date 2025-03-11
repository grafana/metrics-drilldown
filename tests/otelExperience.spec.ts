import { expect, test } from './fixtures';
import { ROUTES } from '../src/constants';
import { UI_TEXT } from '../src/constants/ui';

test.describe('OTEL Experience', () => {
  test('otel toggle is visible', async ({ gotoPage, page }) => {
    await test.step('navigate to trail', async () => {
      await gotoPage(`/${ROUTES.Trail}`);
    });

    await test.step('element is visible', async () => {
      const otelSwitch = page.getByLabel(UI_TEXT.METRIC_SELECT_SCENE.OTEL_LABEL);
      await expect(otelSwitch).toBeVisible();
    });
  });
});
