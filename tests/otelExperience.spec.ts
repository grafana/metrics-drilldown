import { expect, test } from './fixtures';
import { ROUTES } from '../src/constants';
import { UI_TEXT } from '../src/constants/ui';

test.describe('OTEL Experience', () => {
  test('otel toggle is visible', async ({ gotoPage, getOtelSwitch }) => {
    await gotoPage(`/${ROUTES.Trail}`);
    await test.step('General assersions', async () => {
      const otelSwitch = await getOtelSwitch();
      await expect(otelSwitch).toBeVisible();
      await expect(otelSwitch).toContainText(UI_TEXT.METRIC_SELECT_SCENE.OTEL_LABEL);
    });
  });
});
