import { expect, test } from '../../fixtures';

test.describe('Smoke tests', () => {
  test('Main UI elements', async ({ trailView }) => {
    await trailView.goto();

    await expect(trailView.getByText('Data source')).toBeVisible();
    await expect(trailView.getByTestId('app-controls').getByText('gdev-prometheus')).toBeVisible();

    await expect(trailView.getByPlaceholder('Filter by label values')).toBeVisible();
    await expect(trailView.getByPlaceholder('Search metrics')).toBeVisible();

    await expect(trailView.getByText('View by')).toBeVisible();
    await expect(trailView.getByText('All metric names')).toBeVisible();

    await trailView.assertSelectedTimeRange('2025-02-18 14:30:00 to 2025-02-18 17:15:00');

    await expect(trailView.getByTestId('scene-body')).toBeVisible();

    const panelsCount = await trailView.getByTestId('scene-body').locator('[data-viz-panel-key]').count();
    await expect(panelsCount).toBe(20);
  });
});
