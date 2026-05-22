import { test, expect, type Page } from '@playwright/test';
import {
  createDraftTaskViaApi,
  deleteTaskById,
  navigateToTasksAndSelectProject,
  waitForTasksPageReady,
} from './tasks-helpers';
import { openFirstTaskFromListAndNavigate } from './task-workspace-helpers';

test.describe('Task list filter/sort persistence', () => {
  test.describe.configure({ mode: 'serial' });

  let projectId: number;
  let fixtureTaskId: number | null = null;
  let fixtureSummary = '';

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const page = await context.newPage();
    projectId = await navigateToTasksAndSelectProject(page);
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    // Fresh page load — state always resets on reload now.
    await page.goto(`/tasks?project_id=${projectId}`);
    await waitForTasksPageReady(page);
    fixtureSummary = `Persistence fixture ${Date.now()}`;
    fixtureTaskId = await createDraftTaskViaApi(page, projectId, fixtureSummary);
    await page.reload();
    await waitForTasksPageReady(page);
    await page.getByTestId('tab-tasks').click();
    await expect(page.getByTestId('task-list')).toBeVisible({ timeout: 15_000 });
  });

  test.afterEach(async ({ page }) => {
    if (fixtureTaskId) {
      await deleteTaskById(page, fixtureTaskId).catch(() => {});
      fixtureTaskId = null;
    }
  });

  async function focusFixtureTask(page: Page) {
    const searchInput = page.getByPlaceholder('Search summary, type or owner…');
    await expect(searchInput).toBeVisible();
    await searchInput.fill(fixtureSummary);
    await expect(page.getByTestId('task-row').filter({ hasText: fixtureSummary })).toBeVisible({ timeout: 10_000 });
  }

  test('sort selection persists after navigating to task detail and back', async ({ page }) => {
    const sortSelect = page.getByRole('combobox', { name: 'Sort tasks' });
    await expect(sortSelect).toBeVisible();
    await sortSelect.selectOption('due_asc');
    await expect(sortSelect).toHaveValue('due_asc');
    await focusFixtureTask(page);

    // Navigate into a task
    await openFirstTaskFromListAndNavigate(page);
    await page.waitForURL(/\/tasks\/\d+/, { timeout: 10_000 });

    // Navigate back
    await page.getByTestId('back-to-tasks').click();
    await page.waitForURL(/\/tasks/, { timeout: 10_000 });
    await expect(page.getByTestId('task-list')).toBeVisible({ timeout: 15_000 });

    // Sort should be restored
    await expect(page.getByRole('combobox', { name: 'Sort tasks' })).toHaveValue('due_asc');
  });

  test('group-by selection persists after navigating to task detail and back', async ({ page }) => {
    const groupSelect = page.getByRole('combobox', { name: 'Group tasks' });
    await expect(groupSelect).toBeVisible();
    await groupSelect.selectOption('status');
    await expect(groupSelect).toHaveValue('status');
    await focusFixtureTask(page);

    await openFirstTaskFromListAndNavigate(page);
    await page.waitForURL(/\/tasks\/\d+/, { timeout: 10_000 });
    await page.getByTestId('back-to-tasks').click();
    await page.waitForURL(/\/tasks/, { timeout: 10_000 });
    await expect(page.getByTestId('task-list')).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole('combobox', { name: 'Group tasks' })).toHaveValue('status');
  });

  test('search text persists after navigating to task detail and back', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search summary, type or owner…');
    await expect(searchInput).toBeVisible();
    await searchInput.fill(fixtureSummary);
    await expect(page.getByTestId('task-row').filter({ hasText: fixtureSummary })).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(200);

    await openFirstTaskFromListAndNavigate(page);
    await page.waitForURL(/\/tasks\/\d+/, { timeout: 10_000 });
    await page.getByTestId('back-to-tasks').click();
    await page.waitForURL(/\/tasks/, { timeout: 10_000 });
    await expect(page.getByTestId('task-list')).toBeVisible({ timeout: 15_000 });

    await expect(page.getByPlaceholder('Search summary, type or owner…')).toHaveValue(fixtureSummary);
  });

  test('page reload always resets sort to default', async ({ page }) => {
    const sortSelect = page.getByRole('combobox', { name: 'Sort tasks' });
    await sortSelect.selectOption('name_asc');
    await expect(sortSelect).toHaveValue('name_asc');

    await page.reload();
    await waitForTasksPageReady(page);
    await page.getByTestId('tab-tasks').click();
    await expect(page.getByTestId('task-list')).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole('combobox', { name: 'Sort tasks' })).toHaveValue('id_desc');
  });
});
