import { expect, test } from '../e2e/fixtures';
import { testIds } from '../src/App/testIds';
import { ROUTES } from '../src/constants';
import { UI_TEXT } from '../src/constants/ui';

test.describe('Home page', () => {
  test('Core UI elements: main container, title and start button', async ({ gotoPage, page }) => {
    await gotoPage(`/${ROUTES.Home}`);

    // Verify main container and title
    const container = page.getByTestId(testIds.pageHome.container);
    await expect(container).toBeVisible();
    await expect(page.getByText(UI_TEXT.HOME.TITLE)).toBeVisible();
    await expect(page.getByText(UI_TEXT.HOME.SUBTITLE)).toBeVisible();

    // Verify start button
    const startButton = page.getByTestId(testIds.pageHome.startButton);
    await expect(startButton).toBeVisible();
    await expect(startButton).toContainText(UI_TEXT.HOME.START_BUTTON);
  });

  test('Start button navigates to Trail page', async ({ gotoPage, page }) => {
    await gotoPage(`/${ROUTES.Home}`);
    await page.getByTestId(testIds.pageHome.startButton).click();
    await expect(page.getByText(UI_TEXT.SEARCH.TITLE)).toBeVisible();
  });

  test.describe('Bookmarks', () => {
    test('Bookmarks state persists', async ({ gotoPage, page }) => {
      // Only run if bookmarks exist
      await gotoPage(`/${ROUTES.Home}`);
      const bookmarksToggle = page.getByTestId(testIds.pageHome.bookmarksToggle);

      if (await bookmarksToggle.isVisible()) {
        // Toggle bookmarks
        await bookmarksToggle.click();
        const bookmarksList = page.getByTestId(testIds.pageHome.bookmarksList);
        await expect(bookmarksList).toBeVisible();

        // Refresh page
        await page.reload();

        // Verify bookmarks remain expanded
        await expect(bookmarksList).toBeVisible();
      }
    });
  });
});
