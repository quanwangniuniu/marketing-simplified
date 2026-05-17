import { test, expect } from '@playwright/test';
import { navigateToTasksAndSelectProject, waitForTasksPageReady } from './tasks-helpers';

async function saveView(page: import('@playwright/test').Page, name: string) {
  await page.getByTestId('saved-views-button').click();
  await page.getByTestId('save-view-button').click();
  await page.getByTestId('save-view-name-input').fill(name);
  await page.getByTestId('save-view-confirm-button').click();
}

test.describe('Saved views', () => {
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
    await page.evaluate((key) => localStorage.removeItem(key), `tasks-saved-views-${projectId}`);
    await waitForTasksPageReady(page);
    await page.getByTestId('tab-tasks').click();
    await expect(page.getByTestId('task-list')).toBeVisible({ timeout: 15_000 });
  });

  test('Views button is visible in toolbar', async ({ page }) => {
    await expect(page.getByTestId('saved-views-button')).toBeVisible({ timeout: 10_000 });
  });

  test('opening Views shows empty state when no views saved', async ({ page }) => {
    await page.getByTestId('saved-views-button').click();
    await expect(page.getByTestId('saved-views-dropdown')).toBeVisible();
    await expect(page.getByText('No saved views yet.')).toBeVisible();
  });

  test('user can save a view and see it in the dropdown', async ({ page }) => {
    await page.getByRole('combobox', { name: 'Sort tasks' }).selectOption('due_asc');
    await saveView(page, 'My Test View');

    // Re-open and verify
    await page.getByTestId('saved-views-button').click();
    await expect(page.getByTestId('saved-views-dropdown')).toBeVisible();
    await expect(page.getByTestId('saved-view-item')).toBeVisible();
    await expect(page.getByTestId('saved-views-dropdown').getByText('My Test View')).toBeVisible();
  });

  test('applying a saved view restores filter and sort state', async ({ page }) => {
    await page.getByRole('combobox', { name: 'Sort tasks' }).selectOption('name_asc');
    await saveView(page, 'Name Sort View');

    // Reset sort
    await page.getByRole('combobox', { name: 'Sort tasks' }).selectOption('id_desc');
    await expect(page.getByRole('combobox', { name: 'Sort tasks' })).toHaveValue('id_desc');

    // Apply saved view
    await page.getByTestId('saved-views-button').click();
    await page.getByTestId('saved-view-item').click();

    await expect(page.getByRole('combobox', { name: 'Sort tasks' })).toHaveValue('name_asc');
  });

  test('user can delete a saved view', async ({ page }) => {
    await saveView(page, 'Delete Me View');

    // Re-open and delete
    await page.getByTestId('saved-views-button').click();
    await expect(page.getByTestId('saved-view-item')).toBeVisible();
    await page.getByTestId('delete-view-button').click();

    await expect(page.getByText('No saved views yet.')).toBeVisible();
  });

  test('saved views persist after page reload', async ({ page }) => {
    await saveView(page, 'Persistent View');

    await page.reload();
    await waitForTasksPageReady(page);
    await page.getByTestId('tab-tasks').click();
    await expect(page.getByTestId('task-list')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('saved-views-button').click();
    await expect(page.getByText('Persistent View')).toBeVisible();
  });
});
