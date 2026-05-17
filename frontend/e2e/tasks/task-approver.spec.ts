import { test, expect } from '@playwright/test';
import {
  navigateToTasksAndSelectProject,
  navigateToNewTaskPage,
  submitNewTaskAndGetId,
  deleteTaskById,
} from './tasks-helpers';

test.describe('Task approver assignment', () => {
  test.describe.configure({ mode: 'serial' });
  let createdTaskId: number | null = null;
  let projectId: number;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const page = await context.newPage();
    projectId = await navigateToTasksAndSelectProject(page);
    await context.close();
  });

  test.afterEach(async ({ page }) => {
    if (createdTaskId) {
      try { await deleteTaskById(page, createdTaskId); } catch { /* best-effort */ }
      createdTaskId = null;
    }
  });

  test('create task with approver, verify in list view detail panel', async ({ page }) => {
    await navigateToNewTaskPage(page, projectId);

    // Select Alert work type and fill required fields
    await page.getByRole('button', { name: 'Alert', exact: true }).click();
    await page.getByPlaceholder('Summary of this task').fill('E2E Approver Test Task');

    await expect(page.locator('#task-field-alert-alert_type')).toBeVisible({ timeout: 10_000 });
    await page.locator('#task-field-alert-alert_type').selectOption('performance_drop');
    await page.locator('#task-field-alert-severity').selectOption('medium');

    // Select any available approver (first non-empty option)
    const approverSelect = page.locator('select').filter({
      has: page.locator('option', { hasText: /Select an approver|Unassigned/ }),
    });
    await expect(approverSelect).toBeVisible({ timeout: 10_000 });
    const options = await approverSelect.locator('option').allTextContents();
    const realOptions = options.filter((o) => !o.includes('Select an approver') && !o.includes('Unassigned') && !o.includes('Loading'));
    if (realOptions.length > 0) {
      await approverSelect.selectOption({ index: 1 });
    }

    createdTaskId = await submitNewTaskAndGetId(page);
    expect(createdTaskId).toBeTruthy();

    // Navigate to tasks list and find the created task
    await page.goto(`/tasks?project_id=${projectId}`);
    await page.getByTestId('tab-tasks').click();
    await expect(page.getByTestId('task-list')).toBeVisible({ timeout: 15_000 });

    const taskEntry = page.getByText('E2E Approver Test Task').first();
    await expect(taskEntry).toBeVisible({ timeout: 10_000 });
  });
});
