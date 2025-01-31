import { expect, test } from './fixtures';
import { ROUTES } from '../src/constants';

test.describe('navigating app', () => {
  test('home page should render successfully', async ({ gotoPage, page }) => {
    await gotoPage(`/${ROUTES.Home}`);
    await expect(page.getByText('Start your metrics exploration!')).toBeVisible();
  });

  test('trail page should render successfully', async ({ gotoPage, page }) => {
    await gotoPage(`/${ROUTES.Trail}`);
    await expect(page.getByText('Search metrics')).toBeVisible();
  });
});
