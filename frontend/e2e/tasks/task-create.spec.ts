import { test, expect } from '@playwright/test';
import {
  navigateToTasksAndSelectProject,
  navigateToNewTaskPage,
  submitNewTaskAndGetId,
  deleteTaskById,
  selectFirstAvailableApprover,
} from './tasks-helpers';

test.describe('Task creation flow', () => {
  test.describe.configure({ mode: 'serial' });

  let createdTaskId: number | null = null;
  let projectId: number;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const page = await context.newPage();
    projectId = await navigateToTasksAndSelectProject(page);
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    createdTaskId = null;
    await navigateToNewTaskPage(page, projectId);
  });

  test.afterEach(async ({ page }) => {
    if (createdTaskId) {
      try { await deleteTaskById(page, createdTaskId); } catch { /* best-effort */ }
      createdTaskId = null;
    }
  });

  test('user can create a new task', async ({ page }) => {
    // Select work type
    await page.getByRole('button', { name: 'Asset', exact: true }).click();

    // Wait for required type fields before filling common fields so draft hydration cannot clear them.
    const tagsInput = page.locator('#task-field-asset-tags');
    await expect(tagsInput).toBeVisible({ timeout: 10_000 });

    await page.getByPlaceholder('Summary of this task').fill('E2E Asset Task - create flow');
    await tagsInput.fill('e2e,test');

    await selectFirstAvailableApprover(page);
    await page.getByPlaceholder('Summary of this task').fill('E2E Asset Task - create flow');
    await tagsInput.fill('e2e,test');

    createdTaskId = await submitNewTaskAndGetId(page);

    expect(createdTaskId).toBeTruthy();
    await expect(page.locator('[data-testid="toast-error"]')).not.toBeVisible();
  });
});
