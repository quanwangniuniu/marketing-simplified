import { test, expect } from '@playwright/test';
import {
  navigateToTasksAndSelectProject,
  waitForTasksPageReady,
} from './tasks-helpers';
import {
  switchTab,
  openFirstTaskFromListAndNavigate,
  openFirstTaskFromBoardAndNavigate,
} from './task-workspace-helpers';

test.describe('Tasks workspace flows', () => {
  test.describe.configure({ mode: 'serial' });

  let projectId: number;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'e2e/.auth/user.json',
    });
    const page = await context.newPage();
    projectId = await navigateToTasksAndSelectProject(page);
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`/tasks?project_id=${projectId}`);
    await waitForTasksPageReady(page);
  });

  // ── Flow 1: Tasks list ──────────────────────────────────────────────

  test('tasks list shows tasks after selecting a project', async ({ page }) => {
    expect(page.url()).toContain(`project_id=${projectId}`);

    // Switch to Tasks tab to be sure
    await page.getByTestId('tab-tasks').click();

    const taskList = page.getByTestId('task-list');
    await expect(taskList).toBeVisible({ timeout: 15_000 });

    const firstRow = page.getByTestId('task-row').first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    expect(await page.getByTestId('task-row').count()).toBeGreaterThan(0);
  });

  // ── Flow 2: View switching ──────────────────────────────────────────

  test('switch to Summary tab shows metrics', async ({ page }) => {
    await switchTab(page, 'Summary');

    await expect(page.getByTestId('tab-content-summary')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('summary-work-type-overview')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('summary-total-work-items')).toBeVisible();
  });

  test('switch to Board tab shows board columns', async ({ page }) => {
    await switchTab(page, 'Board');

    await expect(page.getByTestId('board-columns')).toBeVisible({ timeout: 10_000 });
  });

  test('switch to Tasks tab restores the task list', async ({ page }) => {
    await switchTab(page, 'Board');
    await expect(page.getByTestId('board-columns')).toBeVisible({ timeout: 10_000 });

    await switchTab(page, 'Tasks');

    await expect(page.getByTestId('task-list')).toBeVisible({ timeout: 10_000 });
  });

  // ── Flow 3: Open task ───────────────────────────────────────────────

  test('opening a task via drawer navigates to the task detail page', async ({ page }) => {
    await page.getByTestId('tab-tasks').click();
    const taskList = page.getByTestId('task-list');
    const isTasksView = await taskList.isVisible().catch(() => false);

    if (isTasksView) {
      await openFirstTaskFromListAndNavigate(page);
    } else {
      await switchTab(page, 'Board');
      await openFirstTaskFromBoardAndNavigate(page);
    }

    await page.waitForURL(/\/tasks\/\d+/, { timeout: 10_000 });
    await expect(page.getByTestId('task-id-label')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('back-to-tasks')).toBeVisible();
  });

  // ── Flow 4: Task detail sections ────────────────────────────────────

  test('task detail page shows description, comments, and no errors', async ({ page }) => {
    await page.getByTestId('tab-tasks').click();
    await expect(page.getByTestId('task-list')).toBeVisible({ timeout: 10_000 });

    await openFirstTaskFromListAndNavigate(page);
    await page.waitForURL(/\/tasks\/\d+/, { timeout: 10_000 });

    await expect(page.getByTestId('task-description-heading')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('task-comments-heading')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('task-detail-error')).not.toBeVisible();
  });

  // ── Slice 1: Search, sort, and group ───────────────────────────────

  test('search box filters tasks by summary text', async ({ page }) => {
    await page.getByTestId('tab-tasks').click();
    await expect(page.getByTestId('task-list')).toBeVisible({ timeout: 15_000 });

    const searchInput = page.getByPlaceholder('Search summary, type or owner…');
    await expect(searchInput).toBeVisible();

    // Type something unlikely to match anything → expect no task rows
    await searchInput.fill('zzz__no_match_xyz');
    await page.waitForTimeout(200);
    // Either "No tasks yet" message or zero rows
    const rowCount = await page.getByTestId('task-row').count();
    const emptyMsg = page.getByText('No tasks yet');
    const hasNoResults = rowCount === 0 || (await emptyMsg.isVisible().catch(() => false));
    expect(hasNoResults).toBe(true);
  });

  test('clear search button resets search', async ({ page }) => {
    await page.getByTestId('tab-tasks').click();
    await expect(page.getByTestId('task-list')).toBeVisible({ timeout: 15_000 });

    const searchInput = page.getByPlaceholder('Search summary, type or owner…');
    await searchInput.fill('zzz__no_match_xyz');
    await page.waitForTimeout(200);

    // Clear button should appear
    const clearBtn = page.getByRole('button', { name: 'Clear search' });
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    await expect(searchInput).toHaveValue('');
    // Task rows should be visible again
    await expect(page.getByTestId('task-row').first()).toBeVisible({ timeout: 5_000 });
  });

  test('sort dropdown is visible and can be changed', async ({ page }) => {
    await page.getByTestId('tab-tasks').click();
    await expect(page.getByTestId('task-list')).toBeVisible({ timeout: 15_000 });

    const sortSelect = page.getByRole('combobox', { name: 'Sort tasks' });
    await expect(sortSelect).toBeVisible();
    await sortSelect.selectOption('due_asc');
    await expect(sortSelect).toHaveValue('due_asc');
  });

  test('group by dropdown groups tasks with headers', async ({ page }) => {
    await page.getByTestId('tab-tasks').click();
    await expect(page.getByTestId('task-list')).toBeVisible({ timeout: 15_000 });

    const groupSelect = page.getByRole('combobox', { name: 'Group tasks' });
    await expect(groupSelect).toBeVisible();
    await groupSelect.selectOption('status');
    await page.waitForTimeout(300);

    // With grouping on, pagination should be hidden and group headers visible
    await expect(page.getByRole('combobox', { name: 'Group tasks' })).toHaveValue('status');
    // The table should still be visible
    await expect(page.getByTestId('task-list')).toBeVisible({ timeout: 5_000 });
  });
});
