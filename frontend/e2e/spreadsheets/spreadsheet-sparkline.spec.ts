import { test, expect } from '@playwright/test';
import {
  navigateToSpreadsheetAndSelectProject,
  editCell,
} from './spreadsheet-helpers';

/**
 * MED-295 — in-cell sparkline render.
 * Types =SPARKLINE(A1:A5) into a cell and asserts it renders a Recharts chart
 * (SVG) from the source range, not the raw JSON payload.
 */
test.describe('Spreadsheet in-cell sparkline (MED-295)', () => {
  test.describe.configure({ mode: 'serial' });

  let projectId: number;
  let spreadsheetId: number;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'e2e/.auth/user.json',
    });
    const page = await context.newPage();
    const ids = await navigateToSpreadsheetAndSelectProject(page);
    projectId = ids.projectId;
    spreadsheetId = ids.spreadsheetId;
    await context.close();
  });

  test('=SPARKLINE(range) renders a chart in the cell', async ({ page }) => {
    await page.goto(`/projects/${projectId}/spreadsheets/${spreadsheetId}`);
    await expect(page.getByTestId('select-all-cell')).toBeVisible({
      timeout: 30_000,
    });
    await page.waitForTimeout(500);

    // Seed a numeric series in column A (A1:A5).
    const values = ['10', '20', '15', '30', '25'];
    for (let r = 0; r < values.length; r++) {
      await editCell(page, r, 0, values[r]);
    }

    // Put a sparkline in E1 charting A1:A5.
    await editCell(page, 0, 4, '=SPARKLINE(A1:A5)');

    // Reload so the grid fetches the backend-resolved series (computed_string).
    await page.reload();
    await expect(page.getByTestId('select-all-cell')).toBeVisible({
      timeout: 30_000,
    });

    const sparkCell = page.locator('td[data-row="0"][data-col="4"]').first();
    await sparkCell.scrollIntoViewIfNeeded();

    // The cell renders our SparklineCell (an SVG line), not the JSON text.
    await expect(sparkCell.getByTestId('sparkline-cell')).toBeVisible({
      timeout: 15_000,
    });
    await expect(sparkCell.locator('svg')).toBeVisible({ timeout: 15_000 });
    await expect(sparkCell).not.toContainText('sparkline');
  });
});
