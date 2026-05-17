import { test, expect } from '@playwright/test';
import { navigateToTasksAndSelectProject, waitForTasksPageReady } from './tasks-helpers';

test.describe('Quick task drawer', () => {
  test.describe.configure({ mode: 'serial' });

  let projectId: number;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const page = await context.newPage();
    projectId = await navigateToTasksAndSelectProject(page);
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`/tasks?project_id=${projectId}`);
    await waitForTasksPageReady(page);
    await page.getByTestId('tab-tasks').click();
    await expect(page.getByTestId('task-list')).toBeVisible({ timeout: 15_000 });
  });

  test('clicking a task row opens the drawer without navigating', async ({ page }) => {
    const firstSummary = page.getByTestId('task-row-open').first();
    await expect(firstSummary).toBeVisible({ timeout: 10_000 });
    await firstSummary.click();

    // URL should stay on /tasks (no navigation)
    await expect(page).toHaveURL(/\/tasks(\?|$)/, { timeout: 5_000 });

    // Drawer should appear
    await expect(page.getByTestId('task-drawer')).toBeVisible({ timeout: 10_000 });
  });

  test('drawer shows task content', async ({ page }) => {
    await page.getByTestId('task-row-open').first().click();
    await expect(page.getByTestId('task-drawer')).toBeVisible({ timeout: 10_000 });

    // Should show a task ID label
    await expect(page.getByTestId('task-drawer').getByText(/Task #\d+/)).toBeVisible({ timeout: 10_000 });
  });

  test('drawer can be closed with X button', async ({ page }) => {
    await page.getByTestId('task-row-open').first().click();
    await expect(page.getByTestId('task-drawer')).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('task-drawer-close').click();
    await expect(page.getByTestId('task-drawer')).not.toBeVisible({ timeout: 5_000 });
  });

  test('drawer can be closed with Escape key', async ({ page }) => {
    await page.getByTestId('task-row-open').first().click();
    await expect(page.getByTestId('task-drawer')).toBeVisible({ timeout: 10_000 });

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('task-drawer')).not.toBeVisible({ timeout: 5_000 });
  });

  test('drawer can be closed by clicking the backdrop', async ({ page }) => {
    await page.getByTestId('task-row-open').first().click();
    await expect(page.getByTestId('task-drawer')).toBeVisible({ timeout: 10_000 });

    // Click the backdrop (left side of the overlay, outside the panel)
    await page.getByTestId('task-drawer-backdrop').click();
    await expect(page.getByTestId('task-drawer')).not.toBeVisible({ timeout: 5_000 });
  });

  test('"Open full page" button navigates to task detail', async ({ page }) => {
    await page.getByTestId('task-row-open').first().click();
    await expect(page.getByTestId('task-drawer')).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('task-drawer-open-full').click();
    await page.waitForURL(/\/tasks\/\d+/, { timeout: 10_000 });
  });

  test('task list remains visible behind the drawer', async ({ page }) => {
    await page.getByTestId('task-row-open').first().click();
    await expect(page.getByTestId('task-drawer')).toBeVisible({ timeout: 10_000 });

    // Task list still in DOM
    await expect(page.getByTestId('task-list')).toBeAttached();
  });

  test('j/k nav buttons appear when multiple tasks are visible', async ({ page }) => {
    const rows = page.getByTestId('task-row-open');
    const count = await rows.count();
    // Only run if there are at least 2 tasks
    if (count < 2) return;

    await rows.first().click();
    await expect(page.getByTestId('task-drawer')).toBeVisible({ timeout: 10_000 });

    // Nav buttons should be visible
    await expect(page.getByTestId('drawer-nav-prev')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('drawer-nav-next')).toBeVisible({ timeout: 5_000 });

    // First task: prev button should be disabled
    await expect(page.getByTestId('drawer-nav-prev')).toBeDisabled();
    await expect(page.getByTestId('drawer-nav-next')).not.toBeDisabled();
  });

  test('j key navigates to next task', async ({ page }) => {
    const rows = page.getByTestId('task-row-open');
    const count = await rows.count();
    if (count < 2) return;

    await rows.first().click();
    await expect(page.getByTestId('task-drawer')).toBeVisible({ timeout: 10_000 });

    const firstLabel = await page.getByTestId('task-drawer').getByText(/Task #\d+/).textContent();

    // Press j to move to next task
    await page.keyboard.press('j');

    // Wait for the task # to change
    await expect(page.getByTestId('task-drawer').getByText(/Task #\d+/)).not.toHaveText(firstLabel ?? '', { timeout: 5_000 });
  });

  test('k key navigates to previous task after j', async ({ page }) => {
    const rows = page.getByTestId('task-row-open');
    const count = await rows.count();
    if (count < 2) return;

    await rows.first().click();
    await expect(page.getByTestId('task-drawer')).toBeVisible({ timeout: 10_000 });

    const firstLabel = await page.getByTestId('task-drawer').getByText(/Task #\d+/).textContent();

    await page.keyboard.press('j');
    await expect(page.getByTestId('task-drawer').getByText(/Task #\d+/)).not.toHaveText(firstLabel ?? '', { timeout: 5_000 });

    // k should go back to the first task
    await page.keyboard.press('k');
    await expect(page.getByTestId('task-drawer').getByText(/Task #\d+/)).toHaveText(firstLabel ?? '', { timeout: 5_000 });
  });

  test('priority chip opens dropdown when clicked', async ({ page }) => {
    await page.getByTestId('task-row-open').first().click();
    await expect(page.getByTestId('task-drawer')).toBeVisible({ timeout: 10_000 });

    const priorityTrigger = page.getByTestId('header-priority-trigger');
    await expect(priorityTrigger).toBeVisible({ timeout: 10_000 });
    await priorityTrigger.click();

    // Priority options should appear
    await expect(page.getByRole('button', { name: /urgent/i }).or(page.getByRole('button', { name: /high/i })).first()).toBeVisible({ timeout: 3_000 });
  });
});
